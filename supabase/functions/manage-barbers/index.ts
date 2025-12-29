import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateBarberRequest {
  action: 'create' | 'update' | 'delete' | 'list';
  email?: string;
  password?: string;
  nome?: string;
  telefone?: string;
  apelido?: string;
  comissao_pct?: number;
  barbeiro_id?: string;
  ativo?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar autenticação do chamador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar role admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas administradores podem gerenciar barbeiros' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body: CreateBarberRequest = await req.json();

    switch (body.action) {
      case 'create': {
        if (!body.email || !body.password || !body.nome || !body.apelido) {
          return new Response(
            JSON.stringify({ success: false, error: 'Email, senha, nome e apelido são obrigatórios' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Verificar se email já existe em barbeiros
        const { data: existingBarber } = await supabaseAdmin
          .from('barbeiros')
          .select('id')
          .eq('email', body.email)
          .single();

        if (existingBarber) {
          return new Response(
            JSON.stringify({ success: false, error: 'Já existe um barbeiro com este email' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Criar registro de barbeiro (sem user_id ainda - será preenchido quando o barbeiro fizer login)
        const { data: barber, error: barberError } = await supabaseAdmin
          .from('barbeiros')
          .insert({
            apelido: body.apelido,
            email: body.email,
            telefone: body.telefone,
            comissao_pct: body.comissao_pct || 30,
            ativo: true,
            setup_completed: false
          })
          .select()
          .single();

        if (barberError) {
          console.error('Error creating barber record:', barberError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao criar registro do barbeiro' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // Criar usuário no auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            nome: body.nome,
            telefone: body.telefone
          }
        });

        if (authError) {
          // Rollback - deletar barbeiro criado
          await supabaseAdmin.from('barbeiros').delete().eq('id', barber.id);
          
          console.error('Error creating auth user:', authError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao criar usuário: ${authError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        // O trigger handle_new_user vai associar automaticamente o user_id ao barbeiro
        // e criar a role 'barber' - mas vamos garantir aqui também
        
        // Atualizar barbeiro com user_id
        await supabaseAdmin
          .from('barbeiros')
          .update({ user_id: authUser.user.id })
          .eq('id', barber.id);

        console.log(`Barbeiro criado com sucesso: ${body.apelido} (${body.email})`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              barbeiro_id: barber.id,
              user_id: authUser.user.id,
              email: body.email,
              apelido: body.apelido
            },
            message: 'Barbeiro criado com sucesso!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'update': {
        if (!body.barbeiro_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID do barbeiro é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (body.apelido) updateData.apelido = body.apelido;
        if (body.telefone) updateData.telefone = body.telefone;
        if (body.comissao_pct !== undefined) updateData.comissao_pct = body.comissao_pct;
        if (body.ativo !== undefined) updateData.ativo = body.ativo;
        updateData.updated_at = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from('barbeiros')
          .update(updateData)
          .eq('id', body.barbeiro_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao atualizar barbeiro' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Barbeiro atualizado com sucesso!' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'delete': {
        if (!body.barbeiro_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'ID do barbeiro é obrigatório' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Buscar barbeiro para pegar user_id
        const { data: barber } = await supabaseAdmin
          .from('barbeiros')
          .select('user_id')
          .eq('id', body.barbeiro_id)
          .single();

        // Deletar usuário auth se existir
        if (barber?.user_id) {
          await supabaseAdmin.auth.admin.deleteUser(barber.user_id);
        }

        // Deletar barbeiro (cascade vai deletar horários)
        const { error: deleteError } = await supabaseAdmin
          .from('barbeiros')
          .delete()
          .eq('id', body.barbeiro_id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao deletar barbeiro' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Barbeiro removido com sucesso!' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'list': {
        const { data: barbers, error: listError } = await supabaseAdmin
          .from('barbeiros')
          .select(`
            *,
            profiles:user_id (nome, telefone)
          `)
          .order('apelido');

        if (listError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao listar barbeiros' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: barbers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação inválida' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in manage-barbers:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
