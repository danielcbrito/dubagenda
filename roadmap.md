## Cadastro WhatsApp (2026-10-21)
- [x] Restaurar whatsapp_signup_otp ausente no banco e restringir acesso ao serviço.
- [x] Testar gravação com rollback e consulta pela função publicada sem enviar mensagem a terceiros.
- [ ] Confirmar recebimento do código no WhatsApp: aguarda nova tentativa do cliente, sem telefone de teste autorizado.

## Planos DUB recriados e clientes encaixados (2026-10-03)
- [x] Recriados os 3 planos DESATIVADOS: só corte R$ 94,90, Corte e Sobrancelha R$ 99,90, Corte e Barba R$ 129,90, limite 4 usos/mês

## Varredura completa de planos (2026-10-05)
- [x] Restaurados 12 assinantes em dia + 6 vencidos (opção de renovar); detalhes em docs/diagnostico-planos-dub-2026-10-05.txt
- [x] Corrigido PLANO_INEXISTENTE ao barbeiro confirmar corte de plano
- [x] Renovação liberada quando o ciclo vence (não exige usar os 4 cortes)
- [x] Cortes avulsos do Henri (03/10) e Kaique (05/10) convertidos para plano

## Pagamento por barbeiro
- [x] Consultar configuração individual, ocultar métodos desativados e ajustar seleção.
- [x] Sincronizar alterações de configuração em tempo real e testar as regras.

## Taxa de cancelamento e bloqueio
- [x] Registrar taxa privada e atômica no cancelamento, sem duplicação.
- [x] Bloquear cliente com débito pendente e integrar PIX confirmado com desbloqueio.
- [x] Testar regras e documentar fluxos e limitações.
- [ ] Validar cancelamento e pagamento real autenticado: sessão indisponível no Supabase externo.

## Liberação manual da taxa
- [x] Atualizar bloqueio imediatamente em liberação manual, dispensa ou exclusão autorizada, preservando outras dívidas; testes unitários e simulação visual passaram.
- [x] Incluir nome e telefone do cliente nos novos débitos; função conferida no banco e limitações documentadas.
- [ ] Validar botão Liberar cliente com sessão real: painel do barbeiro fora deste app; leitura e dispensa autorizadas no banco já corrigidas, mas sessão do painel indisponível.

## Correção do bloqueio após liberação
- [x] Liberar o único débito ainda pendente (Pablo), conforme solicitação; confirmado zero pendentes após a alteração.
- [x] Comparar integração do painel; corrigir leitura e liberação pelo profissional vinculado via RLS e trigger de campos imutáveis, sem auto-liberação do cliente.

## Correção da Taxa de Cancelamento e Bloqueio para Planos e Agendamentos Gratuitos (2026-10-19)
- [x] Identificada a causa raiz: agendamentos com plano gravam `preco = 0`. O cálculo percentual de cancelamento multiplicava por zero gerando taxa 0, o que impedia a gravação do débito e o bloqueio do cliente.
- [x] Implementado fallback no backend e banco: quando `preco <= 0`, a taxa incide sobre o preço de catálogo do serviço (`servicos.preco`).
- [x] Atualizadas as Edge Functions `cancellation-debt` e `cancel-appointment-client` para garantir a cotação e o registro do débito.
- [x] Criada migration `20261019220000_fix_cancellation_fee_zero_price_plans.sql` e atualizado `criar_conta_barbearia_vip.sql`.
- [x] Configurada chave PIX para o Barbeiro VIP (`1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770`).
## Compatibilidade Multi-tenant de Horários e Isolamento do Barbeiro em Tempo Real (2026-10-20)
- [x] ClienteAgendar.tsx: `loadClosedDates` atualizada para buscar `configuracoes_horario_unidade` por `tenant_id` ordenada por `unidade_id`. `weekdayOpenMap` usa os horários da barbearia como base e isola o expediente do barbeiro (se a barbearia estiver fechada, permanece fechada). Adicionada subscrição Realtime via WebSocket para `configuracoes_horario_unidade` e `configuracoes_horario_barbeiro`.
- [x] BarbershopPublic.tsx: Removidos todos os horários estáticos/hardcoded ("08:00–20:00, Domingo Fechado"). Adicionado carregamento dinâmico de `configuracoes_horario_unidade` pelo `tenant_id` (com fallback para `configuracoes_horario`) e formatação inteligente de grupos consecutivos de dias. Adicionada subscrição Realtime para atualizar instantaneamente na tela quando houver alteração no painel.
- [x] useSlotAvailability.ts & useBarberBusinessHours.ts: `loadUnidadeConfig` atualizada com `.order('unidade_id', { nullsFirst: false }).limit(1)`. Adicionados listeners Realtime para `configuracoes_horario_unidade` e `configuracoes_horario_barbeiro` e clamp rigoroso (se a barbearia estiver fechada, dia permanece fechado).
- [x] Edge Functions: Atualizadas `validate-appointment`, `atomic-booking`, `check-availability`, `create-payment`, `create-checkout` e `cancel-appointment-client` para consultar `configuracoes_horario_unidade` antes do fallback legado, garantindo que agendamentos em dias abertos pela barbearia (ex: domingo) sejam aceitos pelo backend.
- [x] Testes automatizados executados com sucesso (`tests/business-hours-multitenant.test.ts` e `tests/cancellation-fee.test.ts`) e build de produção validado sem erros.

## Resolução da Trava de Horário Acima das 20h (8 da noite) no Agendamento do Cliente (2026-10-20)
- [x] **Diagnóstico da Causa Raiz**:
  * A Edge Function remota `check-availability` executava uma regra de clamp limitando `config.hora_fechamento` ao horário de fechamento padrão legado da loja (`configuracoes_horario`, que fechava às 20:00:00).
  * Por isso, quando o barbeiro definia seu horário pessoal abaixo das 20h (ex: 18h), funcionava normalmente; mas ao definir acima das 20h (ex: 23:35 / 23:50), os slots ficavam truncados às 19:30 (último atendimento de 30min antes das 20:00).
- [x] **Remoção de Clamp Indevido**:
  * Em `supabase/functions/check-availability/index.ts`, `validate-appointment/index.ts`, `create-payment/index.ts` e `src/hooks/useBarberBusinessHours.ts`: preservado apenas o bloqueio se a barbearia estiver fechada (`aberto === false`). Se a loja estiver aberta, o horário pessoal configurado pelo barbeiro é respeitado integralmente.
- [x] **Sincronização em Tempo Real no Frontend (`src/hooks/useSlotAvailability.ts`)**:
  * Adicionada verificação e expansão automática de slots para cobrir toda a amplitude do expediente pessoal do profissional (`configuracoes_horario_barbeiro` / exceções).
  * Atualização instantânea via WebSocket Realtime sempre que o barbeiro alterar seu horário pessoal no painel.
- [x] **Inspeção de Contas VIP e Destravamento**:
  * Inspecionado o Cliente VIP (`661836a7-a45e-4255-9b37-ec137225a706`), Barbeiro VIP (`1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770`) e Barbearia VIP (`5e825363-70ff-4abe-9143-9e87758437e7`).
  * Confirmado que todos os clientes permanecem 100% destravados (`blocked: false`, 0 débitos pendentes).
- [x] **Validação e Testes**:
  * Teste unitário e de integração ponta a ponta gerando 151 slots para terça-feira das 09:00 até 23:05 (terminando às 23:35).
  * Todos os 29 testes do projeto aprovados com 100% de sucesso e build verificado.
