import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { confirmDebtPayment } from '../_shared/debt-payment.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) return json({ error: 'Serviço indisponível.' }, 503);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: 'Não autenticado.' }, 401);
    const admin = createClient(url, key);
    const body = await req.json();
    if (body.action === 'quote') {
      const { data, error } = await admin.rpc('quote_client_cancellation', { p_appointment: body.appointmentId, p_user: auth.user.id });
      if (error) return json({ error: 'Não foi possível consultar a taxa de cancelamento.' }, 400);

      let fee = Number(data?.valor_taxa) || 0;
      let originalPrice = Number(data?.valor_servico_original) || 0;

      // Fallback para agendamentos com preço zero (plano, resgate ou cortesia):
      // Se o preço base retornou 0 mas a configuração do profissional está habilitada,
      // busca o preço de catálogo do serviço para calcular a taxa percentual.
      if (originalPrice <= 0 && data?.config?.habilitado) {
        const { data: apt } = await admin
          .from('agendamentos')
          .select('preco, servico_id, barbeiro_id, data, hora')
          .eq('id', body.appointmentId)
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (apt?.servico_id) {
          const { data: svc } = await admin
            .from('servicos')
            .select('preco')
            .eq('id', apt.servico_id)
            .maybeSingle();

          const svcPrice = Number(svc?.preco) || 0;
          if (svcPrice > 0) {
            originalPrice = svcPrice;
            const { calculateCancellationFee } = await import('../_shared/cancellation-fee.ts');
            const aptDateTime = new Date(`${apt.data}T${apt.hora}`).getTime();
            fee = calculateCancellationFee(data.config, svcPrice, aptDateTime, Date.now());
          }
        }
      }

      return json({
        ...data,
        valor_taxa: fee,
        valor_servico_original: originalPrice,
      });
    }
    const appId = Deno.env.get('ID_DO_APLICATIVO_WOOVI');
    if (!appId) return json({ error: 'PIX temporariamente indisponível.' }, 503);
    const { data: row, error: rowError } = await admin.from('informacoes_empresa').select('id,tenant_id,valor')
      .eq('id', body.rowId).eq('categoria', 'debitos_cliente').eq('chave', `debito_cancelamento_${auth.user.id}`).single();
    if (rowError || !row?.tenant_id) return json({ error: 'Débito não encontrado.' }, 404);
    const debt = JSON.parse(row.valor);
    if (debt.cliente_id !== auth.user.id) return json({ error: 'Sem permissão.' }, 403);
    if (debt.status === 'pago') return json({ paid: true });
    if (debt.status !== 'pendente') return json({ error: 'Débito inválido.' }, 409);
    const debtAmount = Number(debt.total_pendente) || Number(debt.valor_taxa) || 0;
    const cents = Math.round(debtAmount * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) return json({ error: 'Valor inválido.' }, 400);

    const targetBarberId = debt.barbeiro_id || (Array.isArray(debt.itens) ? debt.itens.find((i: any) => i.status === 'pendente')?.barbeiro_id : null);

    const { data: charges, error: chargesError } = await admin.from('woovi_charges').select('*').eq('user_id', auth.user.id)
      .eq('metadata->>purpose', 'cancellation_debt').eq('metadata->>debt_id', debt.id).order('created_at', { ascending: false });
    if (chargesError) throw chargesError;
    // Verifica também tentativas anteriores: um PIX pago tardiamente ainda quita a dívida.
    for (const local of charges ?? []) {
      if (await confirmDebtPayment(admin, local, appId)) return json({ paid: true });
    }
    if (body.action === 'status') return json({ paid: false });
    if (body.action !== 'create') return json({ error: 'Ação inválida.' }, 400);
    const existing = charges?.find((c: any) => Date.parse(c.metadata?.expires_at ?? '') > Date.now() && c.br_code);
    if (existing) return json({ paid: false, br_code: existing.br_code, qr_code_image: existing.qr_code_image, expires_at: existing.metadata.expires_at });
    
    // Buscar barbeiro para destino do PIX
    let barberQuery = admin.from('barbeiros').select('id,apelido,woovi_pix_key').eq('tenant_id', row.tenant_id);
    if (targetBarberId) barberQuery = barberQuery.eq('id', targetBarberId);
    const { data: barberList, error: barberError } = await barberQuery.limit(1);
    const barber = barberList?.[0];

    if (barberError || !barber?.woovi_pix_key) return json({ error: 'PIX indisponível para este profissional. Entre em contato com a barbearia para regularizar a taxa.' }, 409);
    const subResponse = await fetch('https://api.woovi.com/api/v1/subaccount', { method: 'POST', headers: { Authorization: appId, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: barber.apelido ?? 'Barbeiro', pixKey: barber.woovi_pix_key }) });
    if (!subResponse.ok) {
      const subBody = await subResponse.text();
      if (!/exist|already|cadastrad/i.test(subBody)) throw new Error('Não foi possível iniciar o PIX.');
    }
    const correlation = `debt-${debt.id}-${Math.floor(Date.now() / 1800000)}`;
    const response = await fetch('https://api.woovi.com/api/v1/charge', { method: 'POST', headers: { Authorization: appId, 'Content-Type': 'application/json' }, body: JSON.stringify({ correlationID: correlation, value: cents, comment: 'Taxa de cancelamento/falta', expiresIn: 1800, subaccount: barber.woovi_pix_key }) });
    let result = await response.json();
    if (!response.ok) {
      // Mesma chave de idempotência numa tentativa simultânea: recupera em vez de cobrar novamente.
      const recovery = await fetch(`https://api.woovi.com/api/v1/charge/${encodeURIComponent(correlation)}`, { headers: { Authorization: appId } });
      if (!recovery.ok) throw new Error('Não foi possível gerar o PIX. Tente novamente.');
      result = await recovery.json();
    }
    const charge = result.charge ?? result;
    if (charge.correlationID !== correlation || charge.value !== cents || !charge.brCode) throw new Error('Cobrança PIX inválida.');
    const expiresAt = charge.expiresDate ?? new Date(Date.now() + 1800000).toISOString();
    const { error: saveError } = await admin.from('woovi_charges').upsert({ user_id: auth.user.id, barbeiro_id: barber.id, correlation_id: correlation,
      charge_id: charge.identifier ?? correlation, value_centavos: cents, br_code: charge.brCode, qr_code_image: charge.qrCodeImage ?? '', status: 'PENDING', raw_response: result,
      metadata: { purpose: 'cancellation_debt', debt_id: debt.id, tenant_id: row.tenant_id, expires_at: expiresAt } }, { onConflict: 'correlation_id', ignoreDuplicates: true });
    if (saveError) throw new Error('Não foi possível registrar o PIX. Tente novamente.');
    return json({ paid: false, br_code: charge.brCode, qr_code_image: charge.qrCodeImage ?? '', expires_at: expiresAt });
  } catch (error) {
    console.error('[cancellation-debt]', error instanceof Error ? error.message : 'Erro interno');
    return json({ error: 'Não foi possível processar a taxa. Tente novamente.' }, 500);
  }
});