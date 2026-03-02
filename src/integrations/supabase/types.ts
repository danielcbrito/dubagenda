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
      account_deletion_feedback: {
        Row: {
          created_at: string
          details: string | null
          email: string | null
          id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_google_tokens: {
        Row: {
          connected_at: string | null
          created_at: string
          google_email: string | null
          google_picture_url: string | null
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          google_picture_url?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          google_picture_url?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agendamento_lembretes_log: {
        Row: {
          agendamento_id: string
          channel: string
          created_at: string
          details: Json | null
          id: string
          kind: string
          response: string | null
          response_at: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agendamento_id: string
          channel?: string
          created_at?: string
          details?: Json | null
          id?: string
          kind: string
          response?: string | null
          response_at?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agendamento_id?: string
          channel?: string
          created_at?: string
          details?: Json | null
          id?: string
          kind?: string
          response?: string | null
          response_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          google_event_id: string | null
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
          google_event_id?: string | null
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
          google_event_id?: string | null
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
            foreignKeyName: "agendamentos_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
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
      anuncios_app: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_target: string | null
          cta_tipo: string
          descricao: string | null
          id: string
          imagem_path: string
          ordem: number
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_target?: string | null
          cta_tipo?: string
          descricao?: string | null
          id?: string
          imagem_path: string
          ordem?: number
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_target?: string | null
          cta_tipo?: string
          descricao?: string | null
          id?: string
          imagem_path?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          asaas_payment_id: string | null
          barbeiro_id: string | null
          cash_payment_confirmed: boolean | null
          created_at: string | null
          gateway_subscription_id: string | null
          id: string
          next_billing_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pix_expires_at: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          plano_id: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_payment_id?: string | null
          barbeiro_id?: string | null
          cash_payment_confirmed?: boolean | null
          created_at?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          plano_id: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_payment_id?: string | null
          barbeiro_id?: string | null
          cash_payment_confirmed?: boolean | null
          created_at?: string | null
          gateway_subscription_id?: string | null
          id?: string
          next_billing_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          plano_id?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
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
      barbeiro_avaliacoes: {
        Row: {
          appointment_id: string
          barber_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewer_first_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          barber_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_first_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          barber_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_first_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      barbeiro_google_tokens: {
        Row: {
          barbeiro_id: string
          connected_at: string | null
          created_at: string
          google_email: string | null
          google_picture_url: string | null
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          barbeiro_id: string
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          google_picture_url?: string | null
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          barbeiro_id?: string
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          google_picture_url?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_barbeiro_google_tokens_barbeiro"
            columns: ["barbeiro_id"]
            isOneToOne: true
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_barbeiro_google_tokens_barbeiro"
            columns: ["barbeiro_id"]
            isOneToOne: true
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barbeiro_servico_duracao: {
        Row: {
          barbeiro_id: string
          created_at: string
          duracao_personalizada: number
          id: string
          servico_id: string
          updated_at: string
        }
        Insert: {
          barbeiro_id: string
          created_at?: string
          duracao_personalizada: number
          id?: string
          servico_id: string
          updated_at?: string
        }
        Update: {
          barbeiro_id?: string
          created_at?: string
          duracao_personalizada?: number
          id?: string
          servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbeiro_servico_duracao_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbeiro_servico_duracao_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbeiro_servico_duracao_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      barbeiros: {
        Row: {
          apelido: string
          asaas_account_id: string | null
          asaas_wallet_id: string | null
          ativo: boolean | null
          comissao_pct: number | null
          created_at: string | null
          deleted_at: string | null
          foto_url: string | null
          google_calendar_connected: boolean | null
          id: string
          setup_completed: boolean | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apelido: string
          asaas_account_id?: string | null
          asaas_wallet_id?: string | null
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          deleted_at?: string | null
          foto_url?: string | null
          google_calendar_connected?: boolean | null
          id?: string
          setup_completed?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apelido?: string
          asaas_account_id?: string | null
          asaas_wallet_id?: string | null
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          deleted_at?: string | null
          foto_url?: string | null
          google_calendar_connected?: boolean | null
          id?: string
          setup_completed?: boolean | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbeiros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      barbeiros_private: {
        Row: {
          asaas_api_key: string | null
          barbeiro_id: string
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          nome_completo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          asaas_api_key?: string | null
          barbeiro_id: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_api_key?: string | null
          barbeiro_id?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      chaves_pix: {
        Row: {
          apelido: string | null
          barbeiro_id: string | null
          chave: string
          created_at: string
          id: string
          instituicao: string | null
          is_default: boolean | null
          nome_titular: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apelido?: string | null
          barbeiro_id?: string | null
          chave: string
          created_at?: string
          id?: string
          instituicao?: string | null
          is_default?: boolean | null
          nome_titular?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apelido?: string | null
          barbeiro_id?: string | null
          chave?: string
          created_at?: string
          id?: string
          instituicao?: string | null
          is_default?: boolean | null
          nome_titular?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaves_pix_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaves_pix_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "comissoes_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
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
          {
            foreignKeyName: "configuracoes_horario_barbeiro_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          banco_codigo: string
          banco_nome: string | null
          barbeiro_id: string | null
          conta: string
          conta_digito: string
          created_at: string
          id: string
          is_default: boolean | null
          tipo_conta: string
          titular_cpf_cnpj: string
          titular_nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia: string
          banco_codigo: string
          banco_nome?: string | null
          barbeiro_id?: string | null
          conta: string
          conta_digito: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          tipo_conta?: string
          titular_cpf_cnpj: string
          titular_nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string
          banco_codigo?: string
          banco_nome?: string | null
          barbeiro_id?: string | null
          conta?: string
          conta_digito?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          tipo_conta?: string
          titular_cpf_cnpj?: string
          titular_nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_bancarias_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
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
      depositos: {
        Row: {
          barbeiro_id: string | null
          confirmado_em: string | null
          created_at: string
          expires_at: string | null
          gateway_payment_id: string | null
          id: string
          pix_payload: string | null
          pix_qr_code: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          barbeiro_id?: string | null
          confirmado_em?: string | null
          created_at?: string
          expires_at?: string | null
          gateway_payment_id?: string | null
          id?: string
          pix_payload?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          barbeiro_id?: string | null
          confirmado_em?: string | null
          created_at?: string
          expires_at?: string | null
          gateway_payment_id?: string | null
          id?: string
          pix_payload?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "depositos_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depositos_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupon_redemptions: {
        Row: {
          appointment_id: string | null
          coupon_id: string
          id: string
          used_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          coupon_id: string
          id?: string
          used_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          coupon_id?: string
          id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          nome: string | null
          percent: number
          starts_at: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          nome?: string | null
          percent: number
          starts_at?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          nome?: string | null
          percent?: number
          starts_at?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disparos_programados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      financeiro_auth_attempts: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          reason: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      financeiro_auth_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      financeiro_marco_zero: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_corte: string
          id: string
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_corte?: string
          id?: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_corte?: string
          id?: string
        }
        Relationships: []
      }
      financeiro_security_config: {
        Row: {
          created_at: string | null
          id: string
          must_change_password: boolean | null
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          password_hash?: string
          updated_at?: string | null
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
          {
            foreignKeyName: "horarios_excepcionais_barbeiro_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
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
          tenant_id: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria: string
          chave: string
          id?: number
          tenant_id?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria?: string
          chave?: string
          id?: number
          tenant_id?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "informacoes_empresa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      mensagem_templates: {
        Row: {
          ativo: boolean
          categoria: string
          conteudo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
          updated_at: string
          updated_by: string | null
          variaveis_disponiveis: string[] | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          conteudo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string
          updated_by?: string | null
          variaveis_disponiveis?: string[] | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          conteudo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
          variaveis_disponiveis?: string[] | null
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
      pagamentos_plano_barbearia: {
        Row: {
          assinatura_id: string
          barbeiro_id: string | null
          competencia: string
          confirmado_por: string
          created_at: string
          id: string
          observacoes: string | null
          user_id: string
          valor: number
        }
        Insert: {
          assinatura_id: string
          barbeiro_id?: string | null
          competencia: string
          confirmado_por: string
          created_at?: string
          id?: string
          observacoes?: string | null
          user_id: string
          valor: number
        }
        Update: {
          assinatura_id?: string
          barbeiro_id?: string | null
          competencia?: string
          confirmado_por?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_plano_barbearia_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_plano_barbearia_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_plano_barbearia_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          created_at: string
          id: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_provider: string
          reservation_expires_at: string
          status: string
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_provider?: string
          reservation_expires_at: string
          status?: string
          updated_at?: string
          user_id: string
          valor_total: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_provider?: string
          reservation_expires_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: []
      }
      pending_bookings: {
        Row: {
          asaas_payment_id: string | null
          barbeiro_id: string
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
          barbeiro_id: string
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
          barbeiro_id?: string
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
            foreignKeyName: "pending_bookings_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
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
      pin_financeiro: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plano_agendamentos_usos: {
        Row: {
          agendamento_id: string
          assinatura_id: string
          competencia: string
          created_at: string
          id: string
          released_at: string | null
          user_id: string
        }
        Insert: {
          agendamento_id: string
          assinatura_id: string
          competencia: string
          created_at?: string
          id?: string
          released_at?: string | null
          user_id: string
        }
        Update: {
          agendamento_id?: string
          assinatura_id?: string
          competencia?: string
          created_at?: string
          id?: string
          released_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "planos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      produto_imagens: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          ordem: number
          produto_id: string
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          ordem?: number
          produto_id: string
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          ordem?: number
          produto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_imagens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria_id: string | null
          created_at: string
          descricao: string
          estoque: number
          id: string
          nome: string
          preco: number
          status: string
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descricao: string
          estoque?: number
          id?: string
          nome: string
          preco: number
          status?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descricao?: string
          estoque?: number
          id?: string
          nome?: string
          preco?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          barbearia_preferida_id: string | null
          blocked: boolean | null
          cep: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          endereco_uf: string | null
          id: string
          nome: string
          signup_origin: string | null
          telefone: string | null
          updated_at: string | null
          wallet_pin_hash: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          barbearia_preferida_id?: string | null
          blocked?: boolean | null
          cep?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id: string
          nome: string
          signup_origin?: string | null
          telefone?: string | null
          updated_at?: string | null
          wallet_pin_hash?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          barbearia_preferida_id?: string | null
          blocked?: boolean | null
          cep?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          id?: string
          nome?: string
          signup_origin?: string | null
          telefone?: string | null
          updated_at?: string | null
          wallet_pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barbearia_preferida_id_fkey"
            columns: ["barbearia_preferida_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          weekly_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "promocoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      reservas_estoque: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          pedido_id: string
          produto_id: string
          quantidade: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          pedido_id: string
          produto_id: string
          quantidade: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          pedido_id?: string
          produto_id?: string
          quantidade?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_estoque_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
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
      saques: {
        Row: {
          barbeiro_id: string | null
          chave_pix_id: string | null
          chave_pix_tipo: string
          chave_pix_valor: string
          created_at: string
          id: string
          motivo_cancelamento: string | null
          processado_em: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          barbeiro_id?: string | null
          chave_pix_id?: string | null
          chave_pix_tipo: string
          chave_pix_valor: string
          created_at?: string
          id?: string
          motivo_cancelamento?: string | null
          processado_em?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          barbeiro_id?: string | null
          chave_pix_id?: string | null
          chave_pix_tipo?: string
          chave_pix_valor?: string
          created_at?: string
          id?: string
          motivo_cancelamento?: string | null
          processado_em?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saques_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_chave_pix_id_fkey"
            columns: ["chave_pix_id"]
            isOneToOne: false
            referencedRelation: "chaves_pix"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      taxas_gateway: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          metodo_pagamento: string
          taxa_fixa: number | null
          taxa_percentual: number | null
          tipo_taxa: string
          updated_at: string
          valor_taxa: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          metodo_pagamento: string
          taxa_fixa?: number | null
          taxa_percentual?: number | null
          tipo_taxa?: string
          updated_at?: string
          valor_taxa?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          metodo_pagamento?: string
          taxa_fixa?: number | null
          taxa_percentual?: number | null
          tipo_taxa?: string
          updated_at?: string
          valor_taxa?: number
        }
        Relationships: []
      }
      tenant_assinaturas: {
        Row: {
          cakto_customer_email: string | null
          cakto_order_id: string | null
          cakto_subscription_id: string | null
          cancelled_at: string | null
          created_at: string | null
          id: string
          next_billing_date: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          plano_id: string | null
          qtd_barbeiros: number
          status: Database["public"]["Enums"]["tenant_subscription_status"]
          subscription_start: string | null
          tenant_id: string
          trial_end: string
          trial_start: string
          updated_at: string | null
        }
        Insert: {
          cakto_customer_email?: string | null
          cakto_order_id?: string | null
          cakto_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          id?: string
          next_billing_date?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plano_id?: string | null
          qtd_barbeiros?: number
          status?: Database["public"]["Enums"]["tenant_subscription_status"]
          subscription_start?: string | null
          tenant_id: string
          trial_end?: string
          trial_start?: string
          updated_at?: string | null
        }
        Update: {
          cakto_customer_email?: string | null
          cakto_order_id?: string | null
          cakto_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          id?: string
          next_billing_date?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plano_id?: string | null
          qtd_barbeiros?: number
          status?: Database["public"]["Enums"]["tenant_subscription_status"]
          subscription_start?: string | null
          tenant_id?: string
          trial_end?: string
          trial_start?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "tenant_planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_assinaturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_cakto_events: {
        Row: {
          cakto_order_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          tenant_id: string | null
        }
        Insert: {
          cakto_order_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          tenant_id?: string | null
        }
        Update: {
          cakto_order_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_cakto_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_clientes: {
        Row: {
          added_by: string | null
          blocked: boolean
          created_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_mensagem_templates: {
        Row: {
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          id: string
          slug: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          conteudo: string
          created_at?: string | null
          id?: string
          slug: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          id?: string
          slug?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_mensagem_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_plano_faixas: {
        Row: {
          created_at: string
          id: string
          max_barbeiros: number | null
          min_barbeiros: number
          plano_id: string
          preco_cheio: number
          preco_promocional: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_barbeiros?: number | null
          min_barbeiros?: number
          plano_id: string
          preco_cheio: number
          preco_promocional: number
        }
        Update: {
          created_at?: string
          id?: string
          max_barbeiros?: number | null
          min_barbeiros?: number
          plano_id?: string
          preco_cheio?: number
          preco_promocional?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_plano_faixas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "tenant_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_planos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          destaque: boolean | null
          funcionalidades: Json | null
          id: string
          nome: string
          preco_anual: number | null
          preco_mensal: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          funcionalidades?: Json | null
          id?: string
          nome: string
          preco_anual?: number | null
          preco_mensal?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          funcionalidades?: Json | null
          id?: string
          nome?: string
          preco_anual?: number | null
          preco_mensal?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      tenant_webhook_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          tenant_id: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          tenant_id: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_webhook_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          bairro: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco_completo: string | null
          estado: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          nome: string
          numero: string | null
          onboarding_completed: boolean
          onboarding_step: number
          owner_user_id: string
          rua: string | null
          site: string | null
          slogan: string | null
          slug: string | null
          telefone: string | null
          trial_ends_at: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome: string
          numero?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          owner_user_id: string
          rua?: string | null
          site?: string | null
          slogan?: string | null
          slug?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          nome?: string
          numero?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          owner_user_id?: string
          rua?: string | null
          site?: string | null
          slogan?: string | null
          slug?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      ti_auth_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ti_auth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      ti_security_config: {
        Row: {
          created_at: string | null
          id: string
          must_change_password: boolean
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean
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
      wallet_balances: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_deposits: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          destination_account: string | null
          destination_agency: string | null
          destination_bank_code: string | null
          destination_cpf: string | null
          destination_name: string | null
          destination_pix_key: string | null
          gateway_payment_id: string | null
          id: string
          metadata: Json | null
          pix_expires_at: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          destination_account?: string | null
          destination_agency?: string | null
          destination_bank_code?: string | null
          destination_cpf?: string | null
          destination_name?: string | null
          destination_pix_key?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          destination_account?: string | null
          destination_agency?: string | null
          destination_bank_code?: string | null
          destination_cpf?: string | null
          destination_name?: string | null
          destination_pix_key?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          ativo: boolean | null
          confirmacao_ativo: boolean
          confirmacao_webhook_url: string | null
          created_at: string | null
          disparo_ativo: boolean | null
          disparo_webhook_url: string | null
          id: string
          lembrete_ativo: boolean | null
          lembrete_webhook_url: string | null
          loja_manutencao_ativa: boolean
          loja_manutencao_aviso_ativo: boolean
          loja_manutencao_aviso_mensagem: string | null
          loja_manutencao_fim_programada: string | null
          loja_manutencao_inicio_programada: string | null
          loja_manutencao_mensagem: string | null
          manutencao_ativa: boolean | null
          manutencao_aviso_ativo: boolean
          manutencao_aviso_mensagem: string | null
          manutencao_aviso_publico: string
          manutencao_fim_programada: string | null
          manutencao_inicio_programada: string | null
          manutencao_ips_permitidos: string[] | null
          manutencao_mensagem: string | null
          ticket_ativo: boolean
          ticket_webhook_url: string | null
          updated_at: string | null
          webhook_url: string | null
          whatsapp_ativo: boolean | null
          whatsapp_webhook_url: string | null
        }
        Insert: {
          ativo?: boolean | null
          confirmacao_ativo?: boolean
          confirmacao_webhook_url?: string | null
          created_at?: string | null
          disparo_ativo?: boolean | null
          disparo_webhook_url?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          lembrete_webhook_url?: string | null
          loja_manutencao_ativa?: boolean
          loja_manutencao_aviso_ativo?: boolean
          loja_manutencao_aviso_mensagem?: string | null
          loja_manutencao_fim_programada?: string | null
          loja_manutencao_inicio_programada?: string | null
          loja_manutencao_mensagem?: string | null
          manutencao_ativa?: boolean | null
          manutencao_aviso_ativo?: boolean
          manutencao_aviso_mensagem?: string | null
          manutencao_aviso_publico?: string
          manutencao_fim_programada?: string | null
          manutencao_inicio_programada?: string | null
          manutencao_ips_permitidos?: string[] | null
          manutencao_mensagem?: string | null
          ticket_ativo?: boolean
          ticket_webhook_url?: string | null
          updated_at?: string | null
          webhook_url?: string | null
          whatsapp_ativo?: boolean | null
          whatsapp_webhook_url?: string | null
        }
        Update: {
          ativo?: boolean | null
          confirmacao_ativo?: boolean
          confirmacao_webhook_url?: string | null
          created_at?: string | null
          disparo_ativo?: boolean | null
          disparo_webhook_url?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          lembrete_webhook_url?: string | null
          loja_manutencao_ativa?: boolean
          loja_manutencao_aviso_ativo?: boolean
          loja_manutencao_aviso_mensagem?: string | null
          loja_manutencao_fim_programada?: string | null
          loja_manutencao_inicio_programada?: string | null
          loja_manutencao_mensagem?: string | null
          manutencao_ativa?: boolean | null
          manutencao_aviso_ativo?: boolean
          manutencao_aviso_mensagem?: string | null
          manutencao_aviso_publico?: string
          manutencao_fim_programada?: string | null
          manutencao_inicio_programada?: string | null
          manutencao_ips_permitidos?: string[] | null
          manutencao_mensagem?: string | null
          ticket_ativo?: boolean
          ticket_webhook_url?: string | null
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
      whatsapp_instances: {
        Row: {
          api_key: string | null
          barbeiro_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string | null
          qrcode_base64: string | null
          status: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          barbeiro_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          qrcode_base64?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          barbeiro_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          qrcode_base64?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: true
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: true
            referencedRelation: "barbeiros_public"
            referencedColumns: ["id"]
          },
        ]
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
      barbeiro_rating_stats: {
        Row: {
          avg_rating: number | null
          barber_id: string | null
          ratings_count: number | null
        }
        Relationships: []
      }
      barbeiros_public: {
        Row: {
          apelido: string | null
          ativo: boolean | null
          foto_url: string | null
          id: string | null
          tenant_id: string | null
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean | null
          foto_url?: string | null
          id?: string | null
          tenant_id?: string | null
        }
        Update: {
          apelido?: string | null
          ativo?: boolean | null
          foto_url?: string | null
          id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbeiros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_tenant_admin_role: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      auto_hide_old_cancelled_appointments: { Args: never; Returns: undefined }
      auto_suspend_expired_cash_subscriptions: {
        Args: never
        Returns: undefined
      }
      calcular_saldo_barbeiro: {
        Args: { p_barbeiro_id?: string; p_user_id: string }
        Returns: {
          saldo_disponivel: number
          saldo_processando: number
          total_depositos: number
          total_entradas: number
          total_saques: number
        }[]
      }
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
      create_tenant_barber: {
        Args: {
          p_apelido: string
          p_comissao_pct?: number
          p_email: string
          p_nome: string
          p_telefone: string
        }
        Returns: Json
      }
      ensure_tenant_barber: {
        Args: { p_apelido: string; p_user_id: string }
        Returns: string
      }
      format_phone_for_whatsapp: { Args: { phone: string }; Returns: string }
      generate_tenant_slug: { Args: { tenant_name: string }; Returns: string }
      get_admin_banner_for_barber: {
        Args: { p_barbeiro_id: string }
        Returns: string
      }
      get_maintenance_status: {
        Args: never
        Returns: {
          manutencao_ativa: boolean
          manutencao_aviso_ativo: boolean
          manutencao_aviso_mensagem: string
          manutencao_aviso_publico: string
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
      get_or_create_wallet_balance: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_store_maintenance_config: {
        Args: never
        Returns: {
          created_at: string
          loja_manutencao_ativa: boolean
          loja_manutencao_aviso_ativo: boolean
          loja_manutencao_aviso_mensagem: string
          loja_manutencao_fim_programada: string
          loja_manutencao_inicio_programada: string
          loja_manutencao_mensagem: string
          updated_at: string
        }[]
      }
      get_tenant_subscription_status: {
        Args: { p_tenant_id: string }
        Returns: {
          days_remaining: number
          is_active: boolean
          is_expired: boolean
          is_trial: boolean
          plano_nome: string
          preco_mensal: number
          status: string
          trial_end: string
        }[]
      }
      get_user_available_credits: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_tenant_id: { Args: never; Returns: string }
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
      is_admin: { Args: never; Returns: boolean }
      is_device_authorized: {
        Args: { p_fingerprint: string }
        Returns: boolean
      }
      is_email_allowed_maintenance: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_ip_allowed_maintenance: { Args: { p_ip: string }; Returns: boolean }
      store_create_order_with_reservations: {
        Args: {
          p_items: Json
          p_payment_method?: string
          p_reserve_minutes?: number
          p_user_id: string
        }
        Returns: {
          pedido_id: string
          reservation_expires_at: string
          valor_total: number
        }[]
      }
      store_expire_pending_orders: { Args: never; Returns: number }
      store_finalize_paid_order: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      store_get_sales_ranking: {
        Args: { p_limit?: number }
        Returns: {
          produto_id: string
          sold_qty: number
        }[]
      }
      use_credits_atomic: {
        Args: { p_amount: number; p_appointment_id: string; p_user_id: string }
        Returns: Json
      }
      validar_saque: {
        Args: { p_barbeiro_id: string; p_user_id: string; p_valor: number }
        Returns: {
          motivo: string
          permitido: boolean
          saldo_atual: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "barber" | "cliente" | "ti" | "tenant_admin"
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
      subscription_status:
        | "active"
        | "cancelled"
        | "past_due"
        | "suspended"
        | "pending_cash"
      tenant_subscription_status:
        | "trialing"
        | "active"
        | "expired"
        | "cancelled"
        | "past_due"
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
      app_role: ["admin", "barber", "cliente", "ti", "tenant_admin"],
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
      subscription_status: [
        "active",
        "cancelled",
        "past_due",
        "suspended",
        "pending_cash",
      ],
      tenant_subscription_status: [
        "trialing",
        "active",
        "expired",
        "cancelled",
        "past_due",
      ],
    },
  },
} as const
