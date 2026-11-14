import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

const WOOVI_API = 'https://api.woovi.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');

    if (!url || !key || !anon) {
      return json({ error: 'Configuração do Supabase ausente.' }, 503);
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) {
      return json({ error: 'Não autenticado.' }, 401);
    }

    const admin = createClient(url, key);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    // ─────────────────────────────────────────────────────────────
    // 1. AÇÃO: QUOTE (Consulta prévia da taxa antes do cancelamento)
    // ─────────────────────────────────────────────────────────────
    if (action === 'quote') {
      const appointmentId = body.appointmentId;
      if (!appointmentId) return json({ error: 'appointmentId obrigatório' }, 400);

      const { data: apt, error: aptErr } = await admin
        .from('agendamentos')
        .select('id, user_id, preco, data, hora, inicio_em, barbeiro_id, servico_id, servico:servicos(nome, preco)')
        .eq('id', appointmentId)
        .eq('user_id', auth.user.id)
        .single();

      if (aptErr || !apt) {
        return json({ error: 'Agendamento não encontrado' }, 404);
      }

      const inicioEm = apt.inicio_em
        ? new Date(apt.inicio_em).getTime()
        : new Date(`${apt.data}T${apt.hora}`).getTime();

      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const isWithin2Hours = now > (inicioEm - twoHoursMs);

      const originalPrice = Number(apt.preco) || Number((apt.servico as any)?.preco) || 0;
      const fee = isWithin2Hours ? Math.round(originalPrice * 0.20 * 100) / 100 : 0;
      const feeBarber = isWithin2Hours ? Math.round(fee * 0.50 * 100) / 100 : 0;
      const feePlatform = Math.round((fee - feeBarber) * 100) / 100;

      return json({
        dentro_2h: isWithin2Hours,
        isFree: !isWithin2Hours,
        valor_servico_original: originalPrice,
        valor_taxa: fee,
        valor_barbeiro: feeBarber,
        valor_plataforma: feePlatform,
        horas_restantes: Math.max(0, Math.round(((inicioEm - now) / 3600000) * 10) / 10),
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. BUSCAR DÍVIDA PENDENTE NA TABELA dividas
    // ─────────────────────────────────────────────────────────────
    let query = admin
      .from('dividas')
      .select('*, barbeiro:barbeiros(id, apelido, woovi_pix_key), agendamento:agendamentos(data, hora, servico:servicos(nome))')
      .eq('cliente_id', auth.user.id);

    if (body.dividaId) {
      query = query.eq('id', body.dividaId);
    } else {
      query = query.eq('status', 'pendente').order('criado_em', { ascending: false }).limit(1);
    }

    const { data: dividaRows, error: dividaErr } = await query;
    const divida = dividaRows?.[0];

    if (dividaErr) {
      console.error('[cancellation-debt] Erro ao buscar divida:', dividaErr);
      return json({ error: 'Erro ao consultar pendência financeira.' }, 500);
    }

    if (!divida) {
      return json({ paid: true, message: 'Nenhuma pendência encontrada.' });
    }

    if (divida.status === 'pago') {
      return json({ paid: true, divida_id: divida.id });
    }

    const wooviAppId = Deno.env.get('ID_DO_APLICATIVO_WOOVI');
    const plataformaWooviId = Deno.env.get('PLATAFORMA_WOOVI_ID') || 'placeholder_plataforma_woovi_id';

    // ─────────────────────────────────────────────────────────────
    // 3. AÇÃO: STATUS (Checar se já foi pago via webhook ou consulta Woovi)
    // ─────────────────────────────────────────────────────────────
    if (action === 'status') {
      if (divida.status === 'pago') {
        return json({ paid: true, divida_id: divida.id });
      }

      // Se temos correlationID (pix_id) e credencial Woovi, checa diretamente na API Woovi
      if (divida.pix_id && wooviAppId) {
        try {
          const resp = await fetch(`${WOOVI_API}/api/v1/charge/${encodeURIComponent(divida.pix_id)}`, {
            headers: { Authorization: wooviAppId },
          });

          if (resp.ok) {
            const chargeData = await resp.json();
            const charge = chargeData.charge ?? chargeData;
            const status = charge.status;

            if (status === 'COMPLETED' || status === 'ACTIVE_PAID') {
              // Quitar no banco de dados
              await admin.rpc('quitar_divida', {
                p_divida_id: divida.id,
                p_pix_id: divida.pix_id,
              });

              return json({ paid: true, divida_id: divida.id });
            }
          }
        } catch (checkErr) {
          console.warn('[cancellation-debt] Falha ao consultar Woovi charge status:', checkErr);
        }
      }

      return json({
        paid: false,
        divida_id: divida.id,
        valor_total: divida.valor_total,
        valor_barbeiro: divida.valor_barbeiro,
        valor_plataforma: divida.valor_plataforma,
        pix_qr_code: divida.pix_qr_code,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. AÇÃO: CREATE (Geração de QR Code PIX com split 50/50 na Woovi)
    // ─────────────────────────────────────────────────────────────
    if (action === 'create') {
      if (!wooviAppId) {
        return json({ error: 'Gateway de pagamento PIX (Woovi) não configurado.' }, 503);
      }

      const barber = divida.barbeiro as any;
      const subaccountPixKey = barber?.woovi_pix_key;

      if (!subaccountPixKey) {
        return json(
          {
            error: 'Chave PIX do profissional não encontrada. Entre em contato com a barbearia para regularização.',
          },
          409
        );
      }

      // 4.1 Garantir subconta Woovi para o barbeiro (idempotente)
      try {
        const subResp = await fetch(`${WOOVI_API}/api/v1/subaccount`, {
          method: 'POST',
          headers: {
            Authorization: wooviAppId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: barber?.apelido ?? 'Barbeiro',
            pixKey: subaccountPixKey,
          }),
        });

        if (!subResp.ok) {
          const subText = await subResp.text();
          if (!/exist|already|cadastrad/i.test(subText)) {
            console.warn('[cancellation-debt] Subconta Woovi avisou:', subText);
          }
        }
      } catch (subErr) {
        console.warn('[cancellation-debt] Erro de rede ao verificar subconta:', subErr);
      }

      // 4.2 Valores em centavos e split 50/50
      const totalCents = Math.round(Number(divida.valor_total) * 100);
      const barberCents = Math.round(Number(divida.valor_barbeiro) * 100);
      const platformCents = totalCents - barberCents;

      const correlationID = `divida-${divida.id}`;

      // Monta payload de cobrança com split para Woovi
      // Divisão: 50% pro barbeiro afetado, 50% pra conta da plataforma
      const splitsArray: Array<{ pixKey: string; value: number }> = [
        {
          pixKey: subaccountPixKey,
          value: barberCents,
        },
      ];

      // Se a variável PLATAFORMA_WOOVI_ID estiver configurada com chave válida diferente do placeholder
      if (plataformaWooviId && !plataformaWooviId.includes('placeholder')) {
        splitsArray.push({
          pixKey: plataformaWooviId,
          value: platformCents,
        });
      }

      const wooviPayload: Record<string, unknown> = {
        correlationID,
        value: totalCents,
        comment: `Taxa cancelamento - ${barber?.apelido || 'Barbearia'}`.slice(0, 140),
        expiresIn: 3600, // 1 hora
        splits: splitsArray,
        subaccount: subaccountPixKey,
        additionalInfo: [
          { key: 'DividaID', value: divida.id },
          { key: 'AgendamentoID', value: divida.agendamento_id },
          { key: 'Barbeiro', value: barber?.apelido || '' },
          { key: 'SplitBarbeiro', value: `R$ ${(barberCents / 100).toFixed(2)}` },
          { key: 'SplitPlataforma', value: `R$ ${(platformCents / 100).toFixed(2)}` },
        ],
      };

      const chargeResp = await fetch(`${WOOVI_API}/api/v1/charge`, {
        method: 'POST',
        headers: {
          Authorization: wooviAppId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooviPayload),
      });

      let chargeResult = await chargeResp.json().catch(() => ({}));

      // Idempotência: se já existe com o mesmo correlationID, recupera os dados existentes
      if (!chargeResp.ok) {
        const recoveryResp = await fetch(
          `${WOOVI_API}/api/v1/charge/${encodeURIComponent(correlationID)}`,
          { headers: { Authorization: wooviAppId } }
        );
        if (!recoveryResp.ok) {
          console.error('[cancellation-debt] Erro ao gerar charge Woovi:', chargeResp.status, chargeResult);
          return json({ error: 'Não foi possível gerar a cobrança PIX. Tente novamente.' }, 502);
        }
        chargeResult = await recoveryResp.json();
      }

      const charge = chargeResult.charge ?? chargeResult;
      const brCode = charge.brCode;
      const qrCodeImage = charge.qrCodeImage || '';
      const expiresAt = charge.expiresDate || new Date(Date.now() + 3600 * 1000).toISOString();

      if (!brCode) {
        console.error('[cancellation-debt] Resposta da Woovi sem brCode:', chargeResult);
        return json({ error: 'Resposta PIX inválida da operadora.' }, 502);
      }

      // Atualiza a tabela dividas com o pix_qr_code e pix_id
      await admin
        .from('dividas')
        .update({
          pix_qr_code: brCode,
          pix_id: correlationID,
        })
        .eq('id', divida.id);

      // Registra também na tabela woovi_charges para auditoria e histórico
      await admin.from('woovi_charges').upsert(
        {
          user_id: auth.user.id,
          barbeiro_id: divida.barbeiro_id,
          agendamento_id: divida.agendamento_id,
          correlation_id: correlationID,
          charge_id: charge.identifier ?? correlationID,
          value_centavos: totalCents,
          br_code: brCode,
          qr_code_image: qrCodeImage,
          status: 'PENDING',
          raw_response: chargeResult,
          metadata: {
            purpose: 'cancellation_fee',
            divida_id: divida.id,
            valor_total: divida.valor_total,
            valor_barbeiro: divida.valor_barbeiro,
            valor_plataforma: divida.valor_plataforma,
            expires_at: expiresAt,
          },
        },
        { onConflict: 'correlation_id', ignoreDuplicates: true }
      );

      return json({
        paid: false,
        divida_id: divida.id,
        valor_total: divida.valor_total,
        valor_barbeiro: divida.valor_barbeiro,
        valor_plataforma: divida.valor_plataforma,
        br_code: brCode,
        qr_code_image: qrCodeImage,
        expires_at: expiresAt,
      });
    }

    return json({ error: 'Ação não reconhecida' }, 400);
  } catch (error) {
    console.error('[cancellation-debt] Erro inesperado:', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno do servidor' }, 500);
  }
});