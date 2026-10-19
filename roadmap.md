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
