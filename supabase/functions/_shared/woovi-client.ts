/** Booking charges require the professional's explicit credential, never a master fallback. */
export class WooviError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = 'WooviError';
  }
}

export async function wooviFetch<T>(path: string, init: { appId: string; method?: string; body?: unknown }): Promise<T> {
  const appId = init.appId.trim();
  if (!appId) throw new Error('Conta Woovi do profissional sem credencial.');
  const response = await fetch(`https://api.woovi.com${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: appId, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new WooviError(response.status, body, `Woovi HTTP ${response.status}`);
  return body as T;
}