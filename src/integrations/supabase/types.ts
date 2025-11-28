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
          id: string
          user_id: string | null
        }
        Insert: {
          apelido: string
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          apelido?: string
          ativo?: boolean | null
          comissao_pct?: number | null
          created_at?: string | null
          id?: string
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
          preco: number
          servico_id: string
          user_id: string
        }
        Insert: {
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
          preco: number
          servico_id: string
          user_id: string
        }
        Update: {
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
          updated_at?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_hide_old_cancelled_appointments: { Args: never; Returns: undefined }
      clean_expired_pending_bookings: { Args: never; Returns: undefined }
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
