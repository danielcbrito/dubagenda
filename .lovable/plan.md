## Problemas Identificados
1. **Confusão no Sistema de Pontos (Fidelidade):** O componente visual `LoyaltyCard` possui um valor padrão de 5 pontos, enquanto a regra do banco de dados é 8. Isso faz com que usuários com 5, 6 ou 7 pontos vejam a mensagem "Resgate disponível", causando a impressão de que ganharam cortes grátis indevidamente.
2. **Erro na Confirmação de Agendamento:** Existem gatilhos (triggers) duplicados na tabela de agendamentos que podem estar causando conflitos ou erros de chave duplicada durante a inserção/atualização, resultando em falhas na confirmação para o cliente.
3. **Webhook de Confirmação:** A função de webhook precisa ser validada para garantir que está enviando os dados para a URL correta (webhook principal vs confirmação) e que falhas externas não interrompam o processo de agendamento.

## Plano de Ação

### 1. Ajuste no Frontend (Fidelidade)
- Alterar o valor padrão de `pontosNecessarios` no componente `LoyaltyCard.tsx` de 5 para 8.
- Garantir que `Cliente.tsx` e `ClientePerfil.tsx` passem o valor correto da promoção ativa para o componente.

### 2. Limpeza do Banco de Dados (Triggers)
- Remover gatilhos duplicados na tabela `agendamentos` (`log_appointment_changes`, `set_cancelado_em_trigger`, `trg_enforce_barbeiro_id_required_agendamentos`) mantendo as versões mais recentes e padronizadas (`trg_agendamentos_...`).

### 3. Melhoria e Teste do Webhook
- Atualizar a função `send_agendamento_whatsapp_webhook` para registrar explicitamente qual URL de webhook foi utilizada em cada tentativa.
- Unificar o envio para o "Webhook Principal" se o usuário assim desejar, ou garantir a prioridade correta.

### 4. Auditoria de Pontos
- Verificar se houve alguma alteração em massa nos pontos além da "capagem" em 8 (que foi solicitada anteriormente para evitar abusos).
- Como não houve criação de novos resgates (`resgates`) nas últimas 24 horas, o sistema de pontos em si não "deu" cortes grátis, apenas a interface exibiu incorretamente.

## Detalhes Técnicos
- Migração SQL para remover triggers obsoletos.
- Edição do arquivo `src/components/client/LoyaltyCard.tsx`.
- Edição do arquivo `src/pages/Cliente.tsx`.
