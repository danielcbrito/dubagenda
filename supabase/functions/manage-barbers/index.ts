import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'create' | 'update' | 'delete' | 'list';

interface BarberRequest {
  action: Action;
  email?: string;
  password?: string;
  nome?: string;
  telefone?: string;
  apelido?: string;
  barbeiro_id?: string;
  ativo?: boolean;
}

/**
 * Helper para respostas JSON.
 *
 * Importante: para o front não cair no erro genérico “Edge Function returned a non-2xx status code”,
 * esta função sempre responde com HTTP 200 e controla erros via { success: false, error }.
 */
function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token.length ? token : null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Autenticação do chamador
    const token = getBearerToken(req.headers.get('Authorization'));
    if (!token) {
      return json({ success: false, error: 'Usuário não autenticado' });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[manage-barbers] auth.getUser error:', userError);
      return json({ success: false, error: 'Usuário não autenticado' });
    }

    // Verificar role admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[manage-barbers] role check error:', roleError);
      return json({ success: false, error: 'Erro ao validar permissões' });
    }

    if (!roleData) {
      return json({ success: false, error: 'Apenas administradores podem gerenciar barbeiros' });
    }

    const body = (await req.json().catch(() => null)) as BarberRequest | null;
    if (!body?.action) {
      return json({ success: false, error: 'Ação inválida' });
    }

    switch (body.action) {
      case 'create': {
        if (!body.email || !body.password || !body.nome || !body.apelido) {
          return json({
            success: false,
            error: 'Email, senha, nome e apelido são obrigatórios',
          });
        }

        // Verificar se email já existe em barbeiros
        const { data: existingBarber, error: existingError } = await supabaseAdmin
          .from('barbeiros')
          .select('id')
          .eq('email', body.email)
          .maybeSingle();

        if (existingError) {
          console.error('[manage-barbers] existing barber check error:', existingError);
          return json({ success: false, error: 'Erro ao validar barbeiro existente' });
        }

        if (existingBarber) {
          return json({ success: false, error: 'Já existe um barbeiro com este email' });
        }

        // Criar registro de barbeiro
        const { data: barber, error: barberError } = await supabaseAdmin
          .from('barbeiros')
          .insert({
            apelido: body.apelido,
            email: body.email,
            telefone: body.telefone ?? null,
            ativo: true,
            setup_completed: false,
          })
          .select()
          .single();

        if (barberError || !barber) {
          console.error('[manage-barbers] error creating barber record:', barberError);
          return json({ success: false, error: 'Erro ao criar registro do barbeiro' });
        }

        // Criar usuário no auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            nome: body.nome,
            telefone: body.telefone ?? null,
          },
        });

        if (authError || !authUser?.user) {
          // Rollback - deletar barbeiro criado
          await supabaseAdmin.from('barbeiros').delete().eq('id', barber.id);

          console.error('[manage-barbers] Error creating auth user:', authError);

          let errorMessage = authError?.message ?? 'Erro ao criar usuário';
          if (
            errorMessage.includes('already been registered') ||
            errorMessage.includes('email_exists')
          ) {
            errorMessage = 'Já existe uma conta com este email. Use outro email ou recupere a senha.';
          }

          return json({ success: false, error: errorMessage });
        }

        // Atualizar barbeiro com user_id
        const { error: linkError } = await supabaseAdmin
          .from('barbeiros')
          .update({ user_id: authUser.user.id })
          .eq('id', barber.id);

        if (linkError) {
          console.error('[manage-barbers] error linking barber to user:', linkError);
        }

        // Garantir role barber (não depende de trigger)
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: authUser.user.id, role: 'barber' })
          .select()
          .maybeSingle();

        if (roleInsertError) {
          // Não bloqueia o fluxo; apenas loga.
          console.error('[manage-barbers] error inserting barber role:', roleInsertError);
        }

        console.log(`[manage-barbers] Barbeiro criado: ${body.apelido} (${body.email})`);

        return json({
          success: true,
          data: {
            barbeiro_id: barber.id,
            user_id: authUser.user.id,
            email: body.email,
            apelido: body.apelido,
          },
          message: 'Barbeiro criado com sucesso!',
        });
      }

      case 'update': {
        if (!body.barbeiro_id) {
          return json({ success: false, error: 'ID do barbeiro é obrigatório' });
        }

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (typeof body.apelido === 'string') updateData.apelido = body.apelido;
        if (typeof body.telefone === 'string') updateData.telefone = body.telefone;
        if (typeof body.ativo === 'boolean') updateData.ativo = body.ativo;

        const { error: updateError } = await supabaseAdmin
          .from('barbeiros')
          .update(updateData)
          .eq('id', body.barbeiro_id);

        if (updateError) {
          console.error('[manage-barbers] update error:', updateError);
          return json({ success: false, error: 'Erro ao atualizar barbeiro' });
        }

        return json({ success: true, message: 'Barbeiro atualizado com sucesso!' });
      }

      case 'delete': {
        if (!body.barbeiro_id) {
          return json({ success: false, error: 'ID do barbeiro é obrigatório' });
        }

        // Buscar barbeiro para pegar user_id
        const { data: barber, error: fetchError } = await supabaseAdmin
          .from('barbeiros')
          .select('user_id')
          .eq('id', body.barbeiro_id)
          .maybeSingle();

        if (fetchError) {
          console.error('[manage-barbers] delete fetch error:', fetchError);
        }

        // Deletar usuário auth se existir
        if (barber?.user_id) {
          const { error: delUserError } = await supabaseAdmin.auth.admin.deleteUser(barber.user_id);
          if (delUserError) {
            console.error('[manage-barbers] delete auth user error:', delUserError);
          }
        }

        // Deletar barbeiro
        const { error: deleteError } = await supabaseAdmin
          .from('barbeiros')
          .delete()
          .eq('id', body.barbeiro_id);

        if (deleteError) {
          console.error('[manage-barbers] delete barber error:', deleteError);
          return json({ success: false, error: 'Erro ao deletar barbeiro' });
        }

        return json({ success: true, message: 'Barbeiro removido com sucesso!' });
      }

      case 'list': {
        const { data: barbers, error: listError } = await supabaseAdmin
          .from('barbeiros')
          .select('*')
          .order('apelido');

        if (listError) {
          console.error('[manage-barbers] list error:', listError);
          return json({ success: false, error: 'Erro ao listar barbeiros' });
        }

        const enriched = await Promise.all(
          (barbers ?? []).map(async (barber) => {
            if (!barber.user_id) return { ...barber, profiles: null };

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('nome, telefone')
              .eq('id', barber.user_id)
              .maybeSingle();

            return { ...barber, profiles: profile ?? null };
          })
        );

        return json({ success: true, data: enriched });
      }

      default:
        return json({ success: false, error: 'Ação inválida' });
    }
  } catch (error) {
    console.error('[manage-barbers] unexpected error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});
