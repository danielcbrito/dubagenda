export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          barbeiro_confirmou: boolean | null
          barbeiro_id: string | null
          cancelado_em: string | null
          cliente_confirmou: boolean | null
          created_at: string | null
          criado_por: string | null
          data: string
          duracao: number
          hora: string
          id: string
          is_free: boolean | null
          motivo_remarcacao: string | null
          observacoes: string | null
          payment_method: string | null
          ponto_liberado: boolean | null
          preco: number
          remarcacao_solicitada: boolean | null
          remarcado_de: string | null
          servico_id: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          tipo_agendamento: string | null
          updated_at: string | null
          usado_redemption_id: string | null
          user_id: string
          visivel_para_usuario: boolean | null
        }
        Insert: {
          barbeiro_confirmou?: boolean | null
          barbeiro_id?: string | null
          cancelado_em?: string | null
          cliente_confirmou?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          data: string
          duracao: number
          hora: string
          id?: string
          is_free?: boolean | null
          motivo_remarcacao?: string | null
          observacoes?: string | null
          payment_method?: string | null
          ponto_liberado?: boolean | null
          preco: number
          remarcacao_solicitada?: boolean | null
          remarcado_de?: string | null
          servico_id: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tipo_agendamento?: string | null
          updated_at?: string | null
          usado_redemption_id?: string | null
          user_id: string
          visivel_para_usuario?: boolean | null
        }
        Update: {
          barbeiro_confirmou?: boolean | null
          barbeiro_id?: string | null
          cancelado_em?: string | null
          cliente_confirmou?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          duracao?: number
          hora?: string
          id?: string
          is_free?: boolean | null
          motivo_remarcacao?: string | null
          observacoes?: string | null
          payment_method?: string | null
          ponto_liberado?: boolean | null
          preco?: number
          remarcacao_solicitada?: boolean | null
          remarcado_de?: string | null
          servico_id?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          tipo_agendamento?: string | null
          updated_at?: string | null
          usado_redemption_id?: string | null
          user_id?: string
          visivel_para_usuario?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_remarcado_de_fkey"
            columns: ["remarcado_de"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions_log: {
        Row: {
          action_name: string
          action_type: string
          after_state: Json | null
          approved_by: string | null
          auto_approved: boolean | null
          before_state: Json | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          parameters: Json | null
          result: Json | null
          reverted_at: string | null
          reverted_by: string | null
          session_id: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action_name: string
          action_type: string
          after_state?: Json | null
          approved_by?: string | null
          auto_approved?: boolean | null
          before_state?: Json | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          parameters?: Json | null
          result?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          session_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action_name?: string
          action_type?: string
          after_state?: Json | null
          approved_by?: string | null
          auto_approved?: boolean | null
          before_state?: Json | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          parameters?: Json | null
          result?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          session_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          comment: string | null
          conversation_id: string | null
          created_at: string
          helpful: boolean | null
          id: string
          message_id: string | null
          rating: number | null
          resolved_issue: boolean | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          conversation_id?: string | null
          created_at?: string
          helpful?: boolean | null
          id?: string
          message_id?: string | null
          rating?: number | null
          resolved_issue?: boolean | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          conversation_id?: string | null
          created_at?: string
          helpful?: boolean | null
          id?: string
          message_id?: string | null
          rating?: number | null
          resolved_issue?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string | null
          gateway_subscription_id: string | null
          id: string
          next_billing_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          plano_id: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          plano_id: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          plano_id?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      barbeiros: {
        Row: {
          apelido: string
          ativo: boolean | null
          comissao_pct: number | null
          created_at: string | null
          email: string | null
          foto_url: string | null
          google_calendar_connected: boolean | null
          google_client_id: string | null
          google_client_secret: string | null
          google_refresh_token: string | null
          id: string
          setup_completed: boolean | null
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apelido: string
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          google_calendar_connected?: boolean | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_refresh_token?: string | null
          id?: string
          setup_completed?: boolean | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apelido?: string
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          google_calendar_connected?: boolean | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_refresh_token?: string | null
          id?: string
          setup_completed?: boolean | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          appointment_id: string
          barbeiro_id: string
          created_at: string | null
          id: string
          pago: boolean | null
          percentual: number | null
          valor: number
        }
        Insert: {
          appointment_id: string
          barbeiro_id: string
          created_at?: string | null
          id?: string
          pago?: boolean | null
          percentual?: number | null
          valor: number
        }
        Update: {
          appointment_id?: string
          barbeiro_id?: string
          created_at?: string | null
          id?: string
          pago?: boolean | null
          percentual?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_horario: {
        Row: {
          aberto: boolean
          created_at: string | null
          delay_entre_servicos: number
          dia_semana: number
          hora_abertura: string
          hora_almoco_fim: string | null
          hora_almoco_inicio: string | null
          hora_fechamento: string
          id: string
          updated_at: string | null
        }
        Insert: {
          aberto?: boolean
          created_at?: string | null
          delay_entre_servicos?: number
          dia_semana: number
          hora_abertura?: string
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          aberto?: boolean
          created_at?: string | null
          delay_entre_servicos?: number
          dia_semana?: number
          hora_abertura?: string
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes_horario_barbeiro: {
        Row: {
          aberto: boolean | null
          barbeiro_id: string
          created_at: string | null
          delay_entre_servicos: number | null
          dia_semana: number
          hora_abertura: string | null
          hora_almoco_fim: string | null
          hora_almoco_inicio: string | null
          hora_fechamento: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          aberto?: boolean | null
          barbeiro_id: string
          created_at?: string | null
          delay_entre_servicos?: number | null
          dia_semana: number
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          aberto?: boolean | null
          barbeiro_id?: string
          created_at?: string | null
          delay_entre_servicos?: number | null
          dia_semana?: number
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_horario_barbeiro_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos: {
        Row: {
          agendamento_origem_id: string | null
          agendamento_usado_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          origem: string
          usado: boolean | null
          user_id: string
          valor: number
        }
        Insert: {
          agendamento_origem_id?: string | null
          agendamento_usado_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          origem: string
          usado?: boolean | null
          user_id: string
          valor: number
        }
        Update: {
          agendamento_origem_id?: string | null
          agendamento_usado_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          origem?: string
          usado?: boolean | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      disparos_programados: {
        Row: {
          contatos_ids: string[]
          created_at: string | null
          created_by: string | null
          data_programada: string
          executado: boolean | null
          executado_em: string | null
          id: string
          mensagem: string
          resultado: Json | null
        }
        Insert: {
          contatos_ids?: string[]
          created_at?: string | null
          created_by?: string | null
          data_programada: string
          executado?: boolean | null
          executado_em?: string | null
          id?: string
          mensagem: string
          resultado?: Json | null
        }
        Update: {
          contatos_ids?: string[]
          created_at?: string | null
          created_by?: string | null
          data_programada?: string
          executado?: boolean | null
          executado_em?: string | null
          id?: string
          mensagem?: string
          resultado?: Json | null
        }
        Relationships: []
      }
      dispositivos_autorizados: {
        Row: {
          autorizado_por: string | null
          created_at: string | null
          descricao: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id: string
        }
        Insert: {
          autorizado_por?: string | null
          created_at?: string | null
          descricao?: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id?: string
        }
        Update: {
          autorizado_por?: string | null
          created_at?: string | null
          descricao?: string | null
          device_fingerprint?: string
          device_name?: string
          device_type?: string
          id?: string
        }
        Relationships: []
      }
      dispositivos_conectados: {
        Row: {
          browser: string | null
          created_at: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_activity: string | null
          os: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          os?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string
          device_type?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          os?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_confirmation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          categoria: string
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          nota_anexo: string | null
          related_appointment_id: string | null
          tipo: Database["public"]["Enums"]["financial_entry_type"]
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: string
          nota_anexo?: string | null
          related_appointment_id?: string | null
          tipo: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          nota_anexo?: string | null
          related_appointment_id?: string | null
          tipo?: Database["public"]["Enums"]["financial_entry_type"]
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_excepcionais: {
        Row: {
          aberto: boolean
          created_at: string | null
          data: string
          hora_abertura: string | null
          hora_almoco_fim: string | null
          hora_almoco_inicio: string | null
          hora_fechamento: string | null
          id: string
          motivo: string | null
          updated_at: string | null
        }
        Insert: {
          aberto?: boolean
          created_at?: string | null
          data: string
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          motivo?: string | null
          updated_at?: string | null
        }
        Update: {
          aberto?: boolean
          created_at?: string | null
          data?: string
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          motivo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      horarios_excepcionais_barbeiro: {
        Row: {
          aberto: boolean | null
          barbeiro_id: string
          created_at: string | null
          data: string
          hora_abertura: string | null
          hora_almoco_fim: string | null
          hora_almoco_inicio: string | null
          hora_fechamento: string | null
          id: string
          motivo: string | null
          updated_at: string | null
        }
        Insert: {
          aberto?: boolean | null
          barbeiro_id: string
          created_at?: string | null
          data: string
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          motivo?: string | null
          updated_at?: string | null
        }
        Update: {
          aberto?: boolean | null
          barbeiro_id?: string
          created_at?: string | null
          data?: string
          hora_abertura?: string | null
          hora_almoco_fim?: string | null
          hora_almoco_inicio?: string | null
          hora_fechamento?: string | null
          id?: string
          motivo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_excepcionais_barbeiro_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      informacoes_aplicativo: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          categoria: string
          chave: string
          conteudo: string
          id: number
          ordem: number | null
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria: string
          chave: string
          conteudo: string
          id?: number
          ordem?: number | null
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria?: string
          chave?: string
          conteudo?: string
          id?: number
          ordem?: number | null
          titulo?: string
        }
        Relationships: []
      }
      informacoes_empresa: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          categoria: string
          chave: string
          id: number
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria: string
          chave: string
          id?: number
          valor: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria?: string
          chave?: string
          id?: number
          valor?: string
        }
        Relationships: []
      }
      logs_agendamentos: {
        Row: {
          acao: string
          agendamento_id: string | null
          detalhes: string | null
          id: string
          timestamp: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          agendamento_id?: string | null
          detalhes?: string | null
          id?: string
          timestamp?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          agendamento_id?: string | null
          detalhes?: string | null
          id?: string
          timestamp?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_agendamentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencao_emails_permitidos: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          agendamento_id: string | null
          created_at: string | null
          id: string
          lida: boolean | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agendamento"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          agendamento_id: string | null
          assinatura_id: string | null
          created_at: string | null
          data_pagamento: string | null
          gateway_payment_id: string | null
          id: string
          metodo: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"] | null
          user_id: string
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          gateway_payment_id?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"] | null
          user_id: string
          valor: number
        }
        Update: {
          agendamento_id?: string | null
          assinatura_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          gateway_payment_id?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"] | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_bookings: {
        Row: {
          asaas_payment_id: string | null
          barbeiro_id: string | null
          created_at: string | null
          data: string
          duracao: number
          expires_at: string | null
          hora: string
          id: string
          observacoes: string | null
          payment_intent_id: string | null
          payment_method: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          preco: number
          servico_id: string
          user_id: string
        }
        Insert: {
          asaas_payment_id?: string | null
          barbeiro_id?: string | null
          created_at?: string | null
          data: string
          duracao: number
          expires_at?: string | null
          hora: string
          id?: string
          observacoes?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          preco: number
          servico_id: string
          user_id: string
        }
        Update: {
          asaas_payment_id?: string | null
          barbeiro_id?: string | null
          created_at?: string | null
          data?: string
          duracao?: number
          expires_at?: string | null
          hora?: string
          id?: string
          observacoes?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          preco?: number
          servico_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_bookings_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_bookings_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_tickets: {
        Row: {
          category: string
          conversation_id: string | null
          created_at: string
          description: string
          id: string
          last_error: string | null
          payload: Json | null
          pending_ticket_id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number
          session_id: string | null
          status: string
          summary: string
          ticket_id: string | null
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          category?: string
          conversation_id?: string | null
          created_at?: string
          description: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          pending_ticket_id: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          session_id?: string | null
          status?: string
          summary: string
          ticket_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          category?: string
          conversation_id?: string | null
          created_at?: string
          description?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          pending_ticket_id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          session_id?: string | null
          status?: string
          summary?: string
          ticket_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean | null
          beneficios_json: Json | null
          created_at: string | null
          descricao: string | null
          id: string
          limite_agendamentos_mes: number | null
          nome: string
          preco_mensal: number
          prioridade_agendamento: number | null
          servico_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          beneficios_json?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          limite_agendamentos_mes?: number | null
          nome: string
          preco_mensal: number
          prioridade_agendamento?: number | null
          servico_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          beneficios_json?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          limite_agendamentos_mes?: number | null
          nome?: string
          preco_mensal?: number
          prioridade_agendamento?: number | null
          servico_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos: {
        Row: {
          created_at: string | null
          id: string
          last_awarded_at: string | null
          pontos: number | null
          promocao_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_awarded_at?: string | null
          pontos?: number | null
          promocao_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_awarded_at?: string | null
          pontos?: number | null
          promocao_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_promocao_id_fkey"
            columns: ["promocao_id"]
            isOneToOne: false
            referencedRelation: "promocoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean | null
          cpf: string | null
          created_at: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          blocked?: boolean | null
          cpf?: string | null
          created_at?: string | null
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          blocked?: boolean | null
          cpf?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promocoes: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          ativo: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          gerada_por_ia: boolean | null
          id: string
          imagem_url: string | null
          nome: string
          pontos_necessarios: number | null
          prompt_ia: string | null
          regras_json: Json | null
          weekly_required: boolean | null
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          gerada_por_ia?: boolean | null
          id?: string
          imagem_url?: string | null
          nome: string
          pontos_necessarios?: number | null
          prompt_ia?: string | null
          regras_json?: Json | null
          weekly_required?: boolean | null
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          gerada_por_ia?: boolean | null
          id?: string
          imagem_url?: string | null
          nome?: string
          pontos_necessarios?: number | null
          prompt_ia?: string | null
          regras_json?: Json | null
          weekly_required?: boolean | null
        }
        Relationships: []
      }
      relatorios_mensais: {
        Row: {
          agendamentos_cancelados: number
          agendamentos_completados: number
          agendamentos_no_show: number
          ano: number
          arquivo_pdf_url: string | null
          created_at: string
          gerado_automaticamente: boolean
          id: string
          insights_ia: Json | null
          lucro_liquido: number
          mes: number
          receita_app: number
          receita_barbearia: number
          receita_credito: number
          receita_plano: number
          receita_total: number
          resumo_ia: string | null
          taxas_asaas: number
          total_agendamentos: number
          updated_at: string
          variacao_agendamentos_percentual: number | null
          variacao_receita_percentual: number | null
        }
        Insert: {
          agendamentos_cancelados?: number
          agendamentos_completados?: number
          agendamentos_no_show?: number
          ano: number
          arquivo_pdf_url?: string | null
          created_at?: string
          gerado_automaticamente?: boolean
          id?: string
          insights_ia?: Json | null
          lucro_liquido?: number
          mes: number
          receita_app?: number
          receita_barbearia?: number
          receita_credito?: number
          receita_plano?: number
          receita_total?: number
          resumo_ia?: string | null
          taxas_asaas?: number
          total_agendamentos?: number
          updated_at?: string
          variacao_agendamentos_percentual?: number | null
          variacao_receita_percentual?: number | null
        }
        Update: {
          agendamentos_cancelados?: number
          agendamentos_completados?: number
          agendamentos_no_show?: number
          ano?: number
          arquivo_pdf_url?: string | null
          created_at?: string
          gerado_automaticamente?: boolean
          id?: string
          insights_ia?: Json | null
          lucro_liquido?: number
          mes?: number
          receita_app?: number
          receita_barbearia?: number
          receita_credito?: number
          receita_plano?: number
          receita_total?: number
          resumo_ia?: string | null
          taxas_asaas?: number
          total_agendamentos?: number
          updated_at?: string
          variacao_agendamentos_percentual?: number | null
          variacao_receita_percentual?: number | null
        }
        Relationships: []
      }
      resgates: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          expired_at: string | null
          id: string
          promocao_id: string | null
          status: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          expired_at?: string | null
          id?: string
          promocao_id?: string | null
          status?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          expired_at?: string | null
          id?: string
          promocao_id?: string | null
          status?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resgates_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_promocao_id_fkey"
            columns: ["promocao_id"]
            isOneToOne: false
            referencedRelation: "promocoes"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          custo_mao_obra: number | null
          custo_produtos: number | null
          descricao: string | null
          duracao_minutos: number
          id: string
          nome: string
          preco: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          custo_mao_obra?: number | null
          custo_produtos?: number | null
          descricao?: string | null
          duracao_minutos: number
          id?: string
          nome: string
          preco: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          custo_mao_obra?: number | null
          custo_produtos?: number | null
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          nome?: string
          preco?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          rating: number | null
          resolved_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          conversation_id: string | null
          created_at: string | null
          description: string
          error_message: string | null
          id: string
          location: string | null
          metadata: Json | null
          priority: string
          resolved_at: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          conversation_id?: string | null
          created_at?: string | null
          description: string
          error_message?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string
          error_message?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          error_message: string | null
          id: string
          last_check_at: string
          metadata: Json | null
          response_time_ms: number | null
          service_name: string
          status: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_check_at?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name: string
          status: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_check_at?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          category: string
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json | null
          id?: string
          level: string
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ti_security_config: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          disparo_ativo: boolean | null
          disparo_webhook_url: string | null
          id: string
          manutencao_ativa: boolean | null
          manutencao_aviso_ativo: boolean
          manutencao_aviso_mensagem: string | null
          manutencao_fim_programada: string | null
          manutencao_inicio_programada: string | null
          manutencao_ips_permitidos: string[] | null
          manutencao_mensagem: string | null
          updated_at: string | null
          webhook_url: string | null
          whatsapp_ativo: boolean | null
          whatsapp_webhook_url: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          disparo_ativo?: boolean | null
          disparo_webhook_url?: string | null
          id?: string
          manutencao_ativa?: boolean | null
          manutencao_aviso_ativo?: boolean
          manutencao_aviso_mensagem?: string | null
          manutencao_fim_programada?: string | null
          manutencao_inicio_programada?: string | null
          manutencao_ips_permitidos?: string[] | null
          manutencao_mensagem?: string | null
          updated_at?: string | null
          webhook_url?: string | null
          whatsapp_ativo?: boolean | null
          whatsapp_webhook_url?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          disparo_ativo?: boolean | null
          disparo_webhook_url?: string | null
          id?: string
          manutencao_ativa?: boolean | null
          manutencao_aviso_ativo?: boolean
          manutencao_aviso_mensagem?: string | null
          manutencao_fim_programada?: string | null
          manutencao_inicio_programada?: string | null
          manutencao_ips_permitidos?: string[] | null
          manutencao_mensagem?: string | null
          updated_at?: string | null
          webhook_url?: string | null
          whatsapp_ativo?: boolean | null
          whatsapp_webhook_url?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      whatsapp_verification_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_cpf: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_cpf?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_cpf?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_hide_old_cancelled_appointments: { Args: never; Returns: undefined }
      clean_expired_pending_bookings: { Args: never; Returns: undefined }
      clean_expired_verification_codes: { Args: never; Returns: undefined }
      create_barber_with_user: {
        Args: {
          p_apelido: string
          p_comissao_pct?: number
          p_email: string
          p_nome: string
          p_password: string
          p_telefone: string
        }
        Returns: Json
      }
      get_maintenance_status: {
        Args: never
        Returns: {
          manutencao_ativa: boolean
          manutencao_aviso_ativo: boolean
          manutencao_aviso_mensagem: string
          manutencao_fim_programada: string
          manutencao_inicio_programada: string
          manutencao_mensagem: string
        }[]
      }
      get_maintenance_status_with_ips: {
        Args: never
        Returns: {
          manutencao_ativa: boolean
          manutencao_aviso_ativo: boolean
          manutencao_aviso_mensagem: string
          manutencao_fim_programada: string
          manutencao_inicio_programada: string
          manutencao_ips_permitidos: string[]
          manutencao_mensagem: string
        }[]
      }
      get_user_available_credits: {
        Args: { p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_barber_hours: {
        Args: { p_barbeiro_id: string }
        Returns: undefined
      }
      is_device_authorized: {
        Args: { p_fingerprint: string }
        Returns: boolean
      }
      is_email_allowed_maintenance: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_ip_allowed_maintenance: { Args: { p_ip: string }; Returns: boolean }
      use_credits_atomic: {
        Args: { p_amount: number; p_appointment_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "barber" | "cliente"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled_by_admin"
        | "cancelled_by_user"
        | "no_show"
        | "excluido"
      financial_entry_type: "income" | "expense"
      payment_method: "card" | "pix" | "cash"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "overdue"
      subscription_status: "active" | "cancelled" | "past_due" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "barber", "cliente"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled_by_admin",
        "cancelled_by_user",
        "no_show",
        "excluido",
      ],
      financial_entry_type: ["income", "expense"],
      payment_method: ["card", "pix", "cash"],
      payment_status: ["pending", "paid", "failed", "refunded", "overdue"],
      subscription_status: ["active", "cancelled", "past_due", "suspended"],
    },
  },
} as const
