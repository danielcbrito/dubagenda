/**
 * "Lembrar última conta" — armazena metadados não sensíveis do último
 * login bem-sucedido no localStorage para exibir um cartão de acesso
 * rápido ("Entrar como Daniel") na tela de login.
 *
 * Nunca armazenar senha ou tokens aqui.
 */

const KEY = "dub_last_account_v1";

export interface LastAccount {
  nome: string | null;
  email: string;
  avatar_url: string | null;
  savedAt: number;
}

export function getLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastAccount;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastAccount(data: Omit<LastAccount, "savedAt">) {
  try {
    const payload: LastAccount = { ...data, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearLastAccount() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
