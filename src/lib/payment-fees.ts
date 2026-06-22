/**
 * Taxa de serviço cobrada do cliente em pagamentos online
 * (PIX ou Cartão). Não se aplica a Dinheiro nem Carteira.
 */
export const SERVICE_FEE_PIX_CARD = 0.9;

/** Retorna a taxa que deve ser somada de acordo com o método. */
export const getServiceFee = (method: string | null | undefined): number =>
  method === "pix" || method === "card" ? SERVICE_FEE_PIX_CARD : 0;
