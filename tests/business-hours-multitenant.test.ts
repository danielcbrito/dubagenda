import test from "node:test";
import assert from "node:assert/strict";

// 1. Simulação do algoritmo de weekdayOpenMap em ClienteAgendar.tsx
function buildWeekdayOpenMap(params: {
  globalConfig?: Array<{ dia_semana: number; aberto: boolean }>;
  unitConfig?: Array<{ dia_semana: number; aberto: boolean; updated_at?: string | null }>;
  barberConfig?: Array<{ dia_semana: number; aberto: boolean; updated_at?: string | null }>;
  barbeiroId?: string | null;
  isVipRestrictedPlan?: boolean;
}): Record<number, boolean> {
  const weekdayOpenMap: Record<number, boolean> = {};

  // 1. Base: padrão global legado
  for (const c of params.globalConfig || []) {
    weekdayOpenMap[c.dia_semana] = c.aberto !== false;
  }

  const unitConfigMap = new Map<number, any>();
  for (const c of (params.unitConfig || [])) {
    if (!unitConfigMap.has(c.dia_semana)) {
      unitConfigMap.set(c.dia_semana, c);
    }
  }

  const barberConfigMap = new Map<number, any>();
  if (params.barbeiroId && params.barberConfig) {
    for (const c of params.barberConfig) {
      barberConfigMap.set(c.dia_semana, c);
    }
  }

  for (let dow = 0; dow <= 6; dow++) {
    const unitConf = unitConfigMap.get(dow);
    const barberConf = barberConfigMap.get(dow);

    if (unitConf && barberConf) {
      const unitUpdated = unitConf.updated_at ? new Date(unitConf.updated_at).getTime() : 0;
      const barberUpdated = barberConf.updated_at ? new Date(barberConf.updated_at).getTime() : 0;

      if (unitUpdated > barberUpdated) {
        weekdayOpenMap[dow] = unitConf.aberto !== false;
      } else {
        if (unitConf.aberto === false) {
          weekdayOpenMap[dow] = false;
        } else {
          weekdayOpenMap[dow] = barberConf.aberto !== false;
        }
      }
    } else if (unitConf) {
      weekdayOpenMap[dow] = unitConf.aberto !== false;
    } else if (barberConf) {
      if (weekdayOpenMap[dow] !== false) {
        weekdayOpenMap[dow] = barberConf.aberto !== false;
      }
    }
  }

  // Restrição do plano VIP (apenas no fluxo de plano)
  if (params.isVipRestrictedPlan) {
    const allowedVipDays = [2, 3, 4];
    [0, 1, 2, 3, 4, 5, 6].forEach((dow) => {
      if (!allowedVipDays.includes(dow)) {
        weekdayOpenMap[dow] = false;
      }
    });
  }

  return weekdayOpenMap;
}

// 2. Simulação do agrupador de horários de BarbershopPublic.tsx
function formatGroupedSchedule(
  hours: Array<{ dia_semana: number; aberto: boolean; hora_abertura: string; hora_fechamento: string }>
) {
  if (!hours || hours.length === 0) return [];

  const daysOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayNames: Record<number, string> = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
    0: 'Domingo',
  };

  const dayInfo = daysOrder.map((dow) => {
    const found = hours.find((h) => h.dia_semana === dow);
    const isOpen = found ? found.aberto : dow !== 0;
    const openTime = found?.hora_abertura ? found.hora_abertura.substring(0, 5) : '09:00';
    const closeTime = found?.hora_fechamento ? found.hora_fechamento.substring(0, 5) : '20:00';
    const timeStr = isOpen ? `${openTime} – ${closeTime}` : 'Fechado';
    return { dow, name: dayNames[dow], isOpen, timeStr };
  });

  const groups: Array<{ label: string; hours: string; isOpen: boolean }> = [];
  let currentGroup: { start: string; end: string; timeStr: string; isOpen: boolean; count: number } | null = null;

  for (const day of dayInfo) {
    if (!currentGroup) {
      currentGroup = { start: day.name, end: day.name, timeStr: day.timeStr, isOpen: day.isOpen, count: 1 };
    } else if (currentGroup.timeStr === day.timeStr) {
      currentGroup.end = day.name;
      currentGroup.count += 1;
    } else {
      const label = currentGroup.count === 1 ? currentGroup.start : `${currentGroup.start} a ${currentGroup.end}`;
      groups.push({ label, hours: currentGroup.timeStr, isOpen: currentGroup.isOpen });
      currentGroup = { start: day.name, end: day.name, timeStr: day.timeStr, isOpen: day.isOpen, count: 1 };
    }
  }

  if (currentGroup) {
    const label = currentGroup.count === 1 ? currentGroup.start : `${currentGroup.start} a ${currentGroup.end}`;
    groups.push({ label, hours: currentGroup.timeStr, isOpen: currentGroup.isOpen });
  }

  return groups;
}

test("1. Domingo aberto na unidade sobressai o global legado que era fechado", () => {
  const globalLegacy = [
    { dia_semana: 0, aberto: false }, // Domingo fechado no global
    { dia_semana: 1, aberto: true },
    { dia_semana: 2, aberto: true },
    { dia_semana: 3, aberto: true },
    { dia_semana: 4, aberto: true },
    { dia_semana: 5, aberto: true },
    { dia_semana: 6, aberto: true },
  ];

  const unitConfig = [
    { dia_semana: 0, aberto: true }, // Unidade abre domingo
    { dia_semana: 1, aberto: false }, // Unidade fecha segunda
  ];

  const map = buildWeekdayOpenMap({
    globalConfig: globalLegacy,
    unitConfig: unitConfig,
    barbeiroId: null,
  });

  assert.equal(map[0], true, "Domingo deve estar ABERTO pela unidade");
  assert.equal(map[1], false, "Segunda deve estar FECHADA pela unidade");
  assert.equal(map[2], true, "Terça deve continuar aberta pelo fallback");
});

test("2. Barbeiro não pode abrir em dia que a barbearia está fechada", () => {
  const map = buildWeekdayOpenMap({
    globalConfig: [{ dia_semana: 0, aberto: false }],
    unitConfig: [{ dia_semana: 0, aberto: false }], // Barbearia fecha domingo
    barberConfig: [{ dia_semana: 0, aberto: true }], // Barbeiro queria atender
    barbeiroId: "barber-1",
  });

  assert.equal(map[0], false, "Domingo DEVE permanecer fechado pois a barbearia está fechada");
});

test("3. Barbeiro pode tirar folga em dia que a barbearia está aberta", () => {
  const map = buildWeekdayOpenMap({
    globalConfig: [{ dia_semana: 3, aberto: true }],
    unitConfig: [{ dia_semana: 3, aberto: true }], // Quarta aberta na barbearia
    barberConfig: [{ dia_semana: 3, aberto: false }], // Barbeiro tira folga na quarta
    barbeiroId: "barber-1",
  });

  assert.equal(map[3], false, "Quarta DEVE ficar fechada para o cliente desse barbeiro");
});

test("4. Sem barbeiro selecionado, segue estritamente a barbearia", () => {
  const map = buildWeekdayOpenMap({
    globalConfig: [{ dia_semana: 6, aberto: true }],
    unitConfig: [{ dia_semana: 6, aberto: true }],
    barberConfig: [{ dia_semana: 6, aberto: false }],
    barbeiroId: null, // Nenhum barbeiro selecionado
  });

  assert.equal(map[6], true, "Sábado deve ser aberto pois nenhum barbeiro específico foi escolhido");
});

test("5. Formatação agrupada de horários na BarbershopPublic agrupa dias consecutivos idênticos", () => {
  const hours = [
    { dia_semana: 1, aberto: true, hora_abertura: "08:00", hora_fechamento: "20:00" },
    { dia_semana: 2, aberto: true, hora_abertura: "08:00", hora_fechamento: "20:00" },
    { dia_semana: 3, aberto: true, hora_abertura: "08:00", hora_fechamento: "20:00" },
    { dia_semana: 4, aberto: true, hora_abertura: "08:00", hora_fechamento: "20:00" },
    { dia_semana: 5, aberto: true, hora_abertura: "08:00", hora_fechamento: "20:00" },
    { dia_semana: 6, aberto: true, hora_abertura: "08:00", hora_fechamento: "18:00" },
    { dia_semana: 0, aberto: false, hora_abertura: "09:00", hora_fechamento: "18:00" },
  ];

  const grouped = formatGroupedSchedule(hours);
  assert.equal(grouped.length, 3);
  assert.deepEqual(grouped[0], { label: "Segunda a Sexta", hours: "08:00 – 20:00", isOpen: true });
  assert.deepEqual(grouped[1], { label: "Sábado", hours: "08:00 – 18:00", isOpen: true });
  assert.deepEqual(grouped[2], { label: "Domingo", hours: "Fechado", isOpen: false });
});

test("6. Formatação com domingo aberto exibe horário real do domingo", () => {
  const hours = [
    { dia_semana: 1, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 2, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 3, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 4, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 5, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 6, aberto: true, hora_abertura: "09:00", hora_fechamento: "19:00" },
    { dia_semana: 0, aberto: true, hora_abertura: "10:00", hora_fechamento: "16:00" },
  ];

  const grouped = formatGroupedSchedule(hours);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0], { label: "Segunda a Sábado", hours: "09:00 – 19:00", isOpen: true });
  assert.deepEqual(grouped[1], { label: "Domingo", hours: "10:00 – 16:00", isOpen: true });
});

// 3. Simulação da geração de slots de useSlotAvailability
function generateSlotsForBarber(params: {
  openTime: string;
  closeTime: string;
  serviceDuration: number;
  slotInterval: number;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  occupied?: Array<{ hora: string; duracao: number }>;
}): string[] {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  const openMin = toMin(params.openTime);
  const closeMin = toMin(params.closeTime);
  const lStart = params.lunchStart ? toMin(params.lunchStart) : null;
  const lEnd = params.lunchEnd ? toMin(params.lunchEnd) + 10 : null; // 10 min buffer

  const slots: string[] = [];
  for (let s = openMin; s < closeMin; s += params.slotInterval) {
    const sEnd = s + params.serviceDuration;
    if (sEnd > closeMin) continue;
    if (lStart !== null && lEnd !== null && s < lEnd && sEnd > lStart) continue;

    let blocked = false;
    for (const occ of params.occupied || []) {
      const oS = toMin(occ.hora);
      const oE = oS + occ.duracao;
      if (s < oE && sEnd > oS) { blocked = true; break; }
    }
    if (!blocked) slots.push(toTime(s));
  }
  return slots;
}

test("7. Barbeiro VIP com horário pessoal até 23:35 gera slots até 23:05 (sem truncamento em 20:00)", () => {
  const slots = generateSlotsForBarber({
    openTime: "09:00",
    closeTime: "23:35",
    serviceDuration: 30,
    slotInterval: 5,
    lunchStart: "13:30",
    lunchEnd: "14:30",
    occupied: []
  });

  assert.ok(slots.length > 100, `Deve gerar múltiplos horários, gerou ${slots.length}`);
  assert.equal(slots[0], "09:00", "Primeiro slot deve ser 09:00");
  assert.ok(slots.includes("20:00"), "Grade deve conter 20:00");
  assert.ok(slots.includes("21:00"), "Grade deve conter 21:00");
  assert.ok(slots.includes("22:00"), "Grade deve conter 22:00");
  assert.ok(slots.includes("23:00"), "Grade deve conter 23:00");
  assert.equal(slots[slots.length - 1], "23:05", "Último slot com duração de 30min deve ser 23:05 (termina às 23:35)");
});

test("8. Barbeiro com horário pessoal reduzido (09:00 às 18:00) encerra às 17:30", () => {
  const slots = generateSlotsForBarber({
    openTime: "09:00",
    closeTime: "18:00",
    serviceDuration: 30,
    slotInterval: 5,
    lunchStart: "13:30",
    lunchEnd: "14:30",
    occupied: []
  });

  assert.equal(slots[slots.length - 1], "17:30", "Último slot deve ser 17:30 para encerramento às 18:00");
  assert.ok(!slots.includes("18:00"), "Não pode conter 18:00 (serviço de 30min passaria de 18:00)");
  assert.ok(!slots.includes("20:00"), "Não pode conter horários após o encerramento do barbeiro");
});

test("9. Horário da unidade atualizado mais recentemente sobressai horário pessoal do barbeiro", () => {
  // Barbearia VIP Exclusive:
  // Barbeiro tinha salvo às 06:39 que terça (dia 2) estava fechado
  // Depois às 07:22 salvou no horário da unidade que terça estava aberto
  const map = buildWeekdayOpenMap({
    globalConfig: [{ dia_semana: 2, aberto: false }],
    unitConfig: [{ dia_semana: 2, aberto: true, updated_at: "2026-10-20T07:22:44.057Z" }],
    barberConfig: [{ dia_semana: 2, aberto: false, updated_at: "2026-10-20T06:39:09.313Z" }],
    barbeiroId: "barbeiro-vip",
  });

  assert.equal(map[2], true, "Terça DEVE estar aberta pois a unidade foi atualizada por último");
});

test("10. Cliente VIP fora do fluxo de plano (isPlanFlow: false) pode agendar em qualquer dia aberto da barbearia", () => {
  // Cliente VIP não está usando plano nesta reserva (isVipRestrictedPlan = false)
  const map = buildWeekdayOpenMap({
    globalConfig: [
      { dia_semana: 0, aberto: false },
      { dia_semana: 1, aberto: true },
      { dia_semana: 2, aberto: true },
      { dia_semana: 3, aberto: true },
      { dia_semana: 4, aberto: true },
      { dia_semana: 5, aberto: true },
      { dia_semana: 6, aberto: true },
    ],
    unitConfig: [
      { dia_semana: 1, aberto: true },
      { dia_semana: 5, aberto: true },
      { dia_semana: 6, aberto: true },
    ],
    barbeiroId: "barbeiro-vip",
    isVipRestrictedPlan: false, // Fora do fluxo de plano!
  });

  assert.equal(map[1], true, "Segunda deve estar aberta para agendamento avulso");
  assert.equal(map[5], true, "Sexta deve estar aberta para agendamento avulso");
  assert.equal(map[6], true, "Sábado deve estar aberto para agendamento avulso");
});

test("11. Horário especial de madrugada (00:40 às 23:55) gera slots a partir de 00:40 até 23:25 sem travar em 09:00", () => {
  const slots = generateSlotsForBarber({
    openTime: "00:40",
    closeTime: "23:55",
    serviceDuration: 30,
    slotInterval: 5,
    lunchStart: null,
    lunchEnd: null,
    occupied: []
  });

  assert.ok(slots.length > 200, `Deve gerar ampla grade de horários, gerou ${slots.length}`);
  assert.equal(slots[0], "00:40", "Primeiro slot deve ser exatamente 00:40");
  assert.ok(slots.includes("01:00"), "Grade deve conter 01:00 da madrugada");
  assert.ok(slots.includes("08:00"), "Grade deve conter 08:00");
  assert.ok(slots.includes("12:00"), "Grade deve conter 12:00");
  assert.ok(slots.includes("23:00"), "Grade deve conter 23:00");
  assert.equal(slots[slots.length - 1], "23:25", "Último slot com duração de 30min antes de 23:55 deve ser 23:25");
});

test("12. Resolução de horário efetivo entre unidade e barbeiro escolhe o mais recente", () => {
  function resolveEffective(
    unit: { hora_abertura: string; hora_fechamento: string; updated_at: string },
    barber: { hora_abertura: string; hora_fechamento: string; updated_at: string }
  ) {
    const uT = new Date(unit.updated_at).getTime();
    const bT = new Date(barber.updated_at).getTime();
    return uT > bT ? unit : barber;
  }

  const unitConfig = {
    hora_abertura: "00:40:00",
    hora_fechamento: "23:55:00",
    updated_at: "2026-10-20T07:22:44.057Z",
  };
  const barberConfig = {
    hora_abertura: "00:45:00",
    hora_fechamento: "20:00:00",
    updated_at: "2026-10-20T06:39:09.313Z",
  };

  const effective = resolveEffective(unitConfig, barberConfig);
  assert.equal(effective.hora_abertura, "00:40:00", "Abertura deve ser 00:40:00 da unidade mais recente");
  assert.equal(effective.hora_fechamento, "23:55:00", "Fechamento deve ser 23:55:00 da unidade mais recente");
});

