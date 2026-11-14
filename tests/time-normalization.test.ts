import test from "node:test";
import assert from "node:assert/strict";

// ============================================================
// Simulação dos helpers puros que serão adicionados às edge functions
// (create-payment, validate-appointment, cancel-appointment-client,
// check-availability). Todas as funções são puras e independentes de
// imports do Deno, podendo ser testadas com node:test.
// ============================================================

/**
 * Normaliza um valor de horário (HH:mm ou HH:mm:ss) para HH:mm.
 * Valores nulos/undefined são preservados.
 */
function normalizeTimeValue(
  time: string | null | undefined
): string | null | undefined {
  if (time == null) return time;
  const [hours = "00", minutes = "00"] = String(time).split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/**
 * Converte HH:MM (ou HH:MM:SS) para minutos totais.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Simula a decisão de negócio das edge functions: o agendamento cabe
 * dentro do expediente?
 */
function cabeNoExpediente(
  hora: string,
  duracao: number,
  horaAbertura: string,
  horaFechamento: string
): boolean {
  const start = timeToMinutes(hora);
  const end = start + duracao;
  const open = timeToMinutes(horaAbertura);
  const close = timeToMinutes(horaFechamento);
  return start >= open && end <= close;
}

/**
 * Simula a mensagem de erro "fora do expediente" criada com valores
 * normalizados (o que a correção deve produzir).
 */
function mensagemForaExpediente(
  horaAbertura: string,
  horaFechamento: string
): string {
  return `Horário fora do expediente (${normalizeTimeValue(horaAbertura)}-${normalizeTimeValue(horaFechamento)}).`;
}

test("normalizeTimeValue converte HH:mm:ss para HH:mm", () => {
  assert.strictEqual(normalizeTimeValue("08:00:00"), "08:00");
  assert.strictEqual(normalizeTimeValue("19:00:00"), "19:00");
  assert.strictEqual(normalizeTimeValue("09:30:45"), "09:30");
});

test("normalizeTimeValue mantém HH:mm inalterado", () => {
  assert.strictEqual(normalizeTimeValue("08:00"), "08:00");
  assert.strictEqual(normalizeTimeValue("19:00"), "19:00");
  assert.strictEqual(normalizeTimeValue("18:30"), "18:30");
});

test("normalizeTimeValue normaliza entrada de uma única parte para HH:mm", () => {
  assert.strictEqual(normalizeTimeValue("08"), "08:00");
  assert.strictEqual(normalizeTimeValue("9"), "09:00");
  assert.strictEqual(normalizeTimeValue("18"), "18:00");
});

test("normalizeTimeValue preserva null e undefined", () => {
  assert.strictEqual(normalizeTimeValue(null), null);
  assert.strictEqual(normalizeTimeValue(undefined), undefined);
});

test("timeToMinutes ignora segundos e calcula corretamente ambos formatos", () => {
  assert.strictEqual(timeToMinutes("08:00:00"), 480);
  assert.strictEqual(timeToMinutes("08:00"), 480);
  assert.strictEqual(timeToMinutes("19:00"), 1140);
  assert.strictEqual(timeToMinutes("19:00:00"), 1140);
  assert.strictEqual(timeToMinutes("18:30"), 1110);
});

test("cabeNoExpediente permite 18:30 + 30min quando abertura 08:00:00 e fechamento 19:00 (formatos mistos)", () => {
  assert.strictEqual(
    cabeNoExpediente("18:30", 30, "08:00:00", "19:00"),
    true
  );
});

test("cabeNoExpediente bloqueia 18:30 + 60min quando fechamento é 19:00 (estoura o expediente)", () => {
  assert.strictEqual(
    cabeNoExpediente("18:30", 60, "08:00:00", "19:00"),
    false
  );
});

test("mensagem de erro exibe formatos normalizados (HH:mm-HH:mm)", () => {
  assert.strictEqual(
    mensagemForaExpediente("08:00:00", "19:00"),
    "Horário fora do expediente (08:00-19:00)."
  );
  assert.strictEqual(
    mensagemForaExpediente("08:00", "19:00:00"),
    "Horário fora do expediente (08:00-19:00)."
  );
});

test("mensagem de erro não exibe mais o formato misto (08:00:00-19:00)", () => {
  const msg = mensagemForaExpediente("08:00:00", "19:00");
  assert.ok(!msg.includes("08:00:00"), "não deve conter segundos na abertura");
  assert.ok(!msg.includes("19:00:00"), "não deve conter segundos no fechamento");
});
