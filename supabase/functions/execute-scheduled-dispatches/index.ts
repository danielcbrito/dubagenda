import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledDispatch {
  id: string
  mensagem: string
  contatos_ids: string[]
  data_programada: string
  executado: boolean
}

interface Profile {
  id: string
  nome: string
  telefone: string | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('[Scheduled Dispatches] Checking for pending dispatches...')

    const now = new Date().toISOString()

    // Busca disparos programados que já passaram da hora e não foram executados
    const { data: dispatches, error: dispatchError } = await supabase
      .from('disparos_programados')
      .select('*')
      .eq('executado', false)
      .lte('data_programada', now)

    if (dispatchError) {
      console.error('[Scheduled Dispatches] Error fetching dispatches:', dispatchError)
      throw dispatchError
    }

    if (!dispatches || dispatches.length === 0) {
      console.log('[Scheduled Dispatches] No pending dispatches found')
      return new Response(
        JSON.stringify({ message: 'No pending dispatches', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Scheduled Dispatches] Found ${dispatches.length} pending dispatch(es)`)

    // Busca configuração do webhook
    const { data: config, error: configError } = await supabase
      .from('webhook_config')
      .select('disparo_webhook_url, disparo_ativo')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (configError || !config?.disparo_webhook_url || !config?.disparo_ativo) {
      console.error('[Scheduled Dispatches] Webhook not configured or inactive')
      return new Response(
        JSON.stringify({ error: 'Webhook not configured or inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Busca todos os profiles necessários
    const allContactIds = [...new Set(dispatches.flatMap(d => d.contatos_ids))]
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nome, telefone')
      .in('id', allContactIds)

    if (profilesError) {
      console.error('[Scheduled Dispatches] Error fetching profiles:', profilesError)
      throw profilesError
    }

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

    let processed = 0
    let errors = 0

    // Processa cada disparo
    for (const dispatch of dispatches as ScheduledDispatch[]) {
      try {
        console.log(`[Scheduled Dispatches] Processing dispatch ${dispatch.id}...`)

        const contatos = dispatch.contatos_ids
          .map(id => profilesMap.get(id))
          .filter((p): p is Profile => !!p && !!p.telefone)
          .map(client => ({
            cliente_id: client.id,
            cliente_nome: client.nome,
            cliente_telefone: client.telefone,
            cliente_telefone_whatsapp: formatPhoneForWhatsApp(client.telefone!),
            mensagem: dispatch.mensagem.replace('{nome}', client.nome)
          }))

        if (contatos.length === 0) {
          console.log(`[Scheduled Dispatches] No valid contacts for dispatch ${dispatch.id}`)
          // Marca como executado mesmo sem contatos válidos
          await supabase
            .from('disparos_programados')
            .update({ 
              executado: true, 
              executado_em: new Date().toISOString(),
              resultado: { success: false, error: 'No valid contacts', total: 0 }
            })
            .eq('id', dispatch.id)
          continue
        }

        // Envia para o webhook
        const response = await fetch(config.disparo_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'disparo_mensagem_lote',
            total_contatos: contatos.length,
            contatos: contatos,
            programado: true,
            disparo_id: dispatch.id,
            timestamp: new Date().toISOString()
          })
        })

        const success = response.ok

        // Marca como executado
        await supabase
          .from('disparos_programados')
          .update({ 
            executado: true, 
            executado_em: new Date().toISOString(),
            resultado: { 
              success, 
              total: contatos.length,
              status: response.status
            }
          })
          .eq('id', dispatch.id)

        if (success) {
          processed++
          console.log(`[Scheduled Dispatches] Dispatch ${dispatch.id} executed successfully (${contatos.length} contacts)`)
        } else {
          errors++
          console.error(`[Scheduled Dispatches] Dispatch ${dispatch.id} failed with status ${response.status}`)
        }

        // Log no sistema
        await supabase.from('system_logs').insert({
          level: success ? 'info' : 'error',
          category: 'disparo_programado',
          message: success 
            ? `Disparo programado executado: ${contatos.length} contatos`
            : `Disparo programado falhou: status ${response.status}`,
          details: {
            dispatch_id: dispatch.id,
            total: contatos.length,
            success
          }
        })

      } catch (err) {
        console.error(`[Scheduled Dispatches] Error processing dispatch ${dispatch.id}:`, err)
        errors++

        // Marca como executado com erro
        await supabase
          .from('disparos_programados')
          .update({ 
            executado: true, 
            executado_em: new Date().toISOString(),
            resultado: { 
              success: false, 
              error: err instanceof Error ? err.message : 'Unknown error'
            }
          })
          .eq('id', dispatch.id)
      }
    }

    console.log(`[Scheduled Dispatches] Completed: ${processed} success, ${errors} errors`)

    return new Response(
      JSON.stringify({ 
        message: 'Dispatches processed', 
        processed, 
        errors,
        total: dispatches.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Scheduled Dispatches] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }
  return `${cleaned}@s.whatsapp.net`
}
