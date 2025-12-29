import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuthRequest {
  action: 'get_auth_url' | 'exchange_code' | 'disconnect';
  barbeiroId: string;
  code?: string;
  redirectUri?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!googleClientId || !googleClientSecret) {
      console.error('Missing Google OAuth credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Google Calendar não encontrada. Contate o administrador.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: AuthRequest = await req.json();
    const { action, barbeiroId, code, redirectUri } = body;

    console.log(`[google-calendar-auth] Action: ${action}, BarbeiroId: ${barbeiroId}`);

    // ==================================
    // GET AUTH URL - Retorna a URL para o usuário autorizar
    // ==================================
    if (action === 'get_auth_url') {
      const baseRedirectUri = redirectUri || `${req.headers.get('origin')}/barbeiro/setup`;
      
      const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ].join(' ');

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', googleClientId);
      authUrl.searchParams.set('redirect_uri', baseRedirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', barbeiroId); // Passa o ID do barbeiro no state

      console.log(`[google-calendar-auth] Generated auth URL for barbeiro ${barbeiroId}`);

      return new Response(
        JSON.stringify({ success: true, authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================================
    // EXCHANGE CODE - Troca o código pelo refresh_token
    // ==================================
    if (action === 'exchange_code') {
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código de autorização não fornecido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const baseRedirectUri = redirectUri || `${req.headers.get('origin')}/barbeiro/setup`;

      // Trocar o código pelo access_token e refresh_token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: baseRedirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('[google-calendar-auth] Token exchange error:', tokenData);
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao conectar: ${tokenData.error_description || tokenData.error}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { refresh_token, access_token } = tokenData;

      if (!refresh_token) {
        console.warn('[google-calendar-auth] No refresh_token received - user may have already authorized');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não foi possível obter permissão permanente. Tente revogar o acesso em myaccount.google.com/permissions e reconectar.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar email do Google para confirmação
      let userEmail = '';
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email || '';
      } catch (e) {
        console.warn('[google-calendar-auth] Could not fetch user email:', e);
      }

      // Salvar o refresh_token no banco
      const { error: updateError } = await supabase
        .from('barbeiros')
        .update({
          google_refresh_token: refresh_token,
          google_calendar_connected: true,
          google_client_id: googleClientId, // Salvar para uso futuro nas syncs
          google_client_secret: googleClientSecret,
        })
        .eq('id', barbeiroId);

      if (updateError) {
        console.error('[google-calendar-auth] Database update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao salvar conexão no banco de dados' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[google-calendar-auth] Successfully connected Google Calendar for barbeiro ${barbeiroId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Google Calendar conectado com sucesso!',
          email: userEmail
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================================
    // DISCONNECT - Desconectar o Google Calendar
    // ==================================
    if (action === 'disconnect') {
      const { error: updateError } = await supabase
        .from('barbeiros')
        .update({
          google_refresh_token: null,
          google_calendar_connected: false,
          google_client_id: null,
          google_client_secret: null,
        })
        .eq('id', barbeiroId);

      if (updateError) {
        console.error('[google-calendar-auth] Disconnect error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao desconectar' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[google-calendar-auth] Disconnected Google Calendar for barbeiro ${barbeiroId}`);

      return new Response(
        JSON.stringify({ success: true, message: 'Google Calendar desconectado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[google-calendar-auth] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
