export const cableCategories = [
  {
    id: 'power',
    label: 'Power',
    color: '#533afd',
    designedLength: 334325,
    pulledLength: 0,
    designedTermination: 4230,
    terminatedCount: 0,
    lineCount: 2115,
  },
  {
    id: 'control',
    label: 'Control',
    color: '#06b6d4',
    designedLength: 203260,
    pulledLength: 0,
    designedTermination: 2890,
    terminatedCount: 0,
    lineCount: 1445,
  },
  {
    id: 'iac',
    label: 'I&C',
    color: '#f59e0b',
    designedLength: 423792,
    pulledLength: 0,
    designedTermination: 3810, // line 1,905 × 2 (1라인=2포인트 규칙 통일)
    terminatedCount: 0,
    lineCount: 1905,
  },
  {
    id: 'pkg',
    label: 'PKG',
    color: '#10b981',
    designedLength: 443851, // 260629: 441,075 → 443,851 (FFC +621, STG +6,400, HRSG −4,245)
    pulledLength: 0,
    designedTermination: 10530,
    terminatedCount: 0,
    lineCount: 5265,
  },
];

// 우선순위별 물량 (PKG 포함 — AIS·DCS→수전, FGSS·HRSG B1→SC, STG·HRSG잔여·FFC→ETC)
// terminationCount = lineCount × 2 (1라인=2포인트 규칙 통일, 총 21,460)
// 260629 기준: PKG +2,776 m 전량 ETC (FFC +621, STG 40,640→47,040, HRSG잔여 43,773→39,528)
// PR: Power56,635 + Control31,480 + I&C32,121 + AIS253,362 + DCS76,529 = 450,127
// SC: Power69,380 + Control46,480 + I&C115,867 + FGSS23,848 + HRSG_B12,924 = 258,499
// ETC: Power208,310 + Control125,300 + I&C275,804 + STG47,040 + HRSG잔여39,528 + FFC621 = 696,602
// Total: 450,127 + 258,499 + 696,602 = 1,405,228
export const priorityData = [
  {
    name: 'PR (수전)',
    value: 450127,
    lineCount: 3648,
    terminationCount: 7296,
    color: '#ea2261',
  },
  {
    name: 'Simple Cycle',
    value: 258499,
    lineCount: 1608,
    terminationCount: 3216, // line 1,608 × 2
    color: '#533afd',
  },
  {
    name: '잔여 (ETC)',
    value: 696602, // 260629: 693,826 → 696,602 (PKG +2,776, 가닥수 불변)
    lineCount: 5474,
    terminationCount: 10948, // line 5,474 × 2
    color: '#06b6d4',
  },
];

export const powerReceivingPulling = {
  power: { designed: 56635, pulled: 0 },
  control: { designed: 31480, pulled: 0 },
  iac: { designed: 32121, pulled: 0 },
  pkg: { designed: 329890, pulled: 0 },
  total: { designed: 450126, pulled: 0 },
};

// Roll up entered field actuals (localStorage) into per-category pulled length + termination points.
// fieldData: { [cableNo]: { pulledLength, pullingDate, termDateFrom, termDateTo, ... } }
// master: array of cable rows { n, g, l, ... } from cable-data.json (for category + design length lookup)
const CAT_ID_BY_LABEL = { Power: 'power', Control: 'control', 'I&C': 'iac', PKG: 'pkg' };
export function rollupActuals(fieldData, master) {
  const out = { power: { pulled: 0, term: 0 }, control: { pulled: 0, term: 0 }, iac: { pulled: 0, term: 0 }, pkg: { pulled: 0, term: 0 } };
  if (!fieldData || !master) return out;
  const mmap = new Map(master.map((c) => [c.n, c]));
  for (const [cno, e] of Object.entries(fieldData)) {
    const cab = mmap.get(cno);
    const id = cab ? CAT_ID_BY_LABEL[cab.g] : null;
    if (!id || !out[id]) continue;
    if (e.pullingDate) {
      const pl = parseFloat(String(e.pulledLength ?? '').replace(/[^0-9.]/g, ''));
      out[id].pulled += !isNaN(pl) ? pl : (cab.l || 0);
    }
    if (e.termDateFrom) out[id].term += 1; // each cable end = 1 termination point (2 ends = 2P)
    if (e.termDateTo) out[id].term += 1;
  }
  return out;
}

function withActuals(actuals) {
  if (!actuals) return cableCategories;
  return cableCategories.map((c) => ({
    ...c,
    pulledLength: Math.round(actuals[c.id]?.pulled || 0),
    terminatedCount: actuals[c.id]?.term || 0,
  }));
}

export function getTotals(actuals) {
  const cats = withActuals(actuals);
  const totalDesignedLength = cats.reduce((s, c) => s + c.designedLength, 0);
  const totalPulledLength = cats.reduce((s, c) => s + c.pulledLength, 0);
  const totalDesignedTermination = cats.reduce((s, c) => s + c.designedTermination, 0);
  const totalTerminatedCount = cats.reduce((s, c) => s + c.terminatedCount, 0);
  const totalLineCount = cats.reduce((s, c) => s + c.lineCount, 0);

  const pullingPercent = totalDesignedLength > 0
    ? ((totalPulledLength / totalDesignedLength) * 100)
    : 0;
  const terminationPercent = totalDesignedTermination > 0
    ? ((totalTerminatedCount / totalDesignedTermination) * 100)
    : 0;

  return {
    totalDesignedLength,
    totalPulledLength,
    totalDesignedTermination,
    totalTerminatedCount,
    totalLineCount,
    pullingPercent,
    terminationPercent,
  };
}

export function getCategoryProgress(actuals) {
  return withActuals(actuals).map((c) => {
    const pullPct = c.designedLength > 0
      ? ((c.pulledLength / c.designedLength) * 100)
      : 0;
    const termPct = c.designedTermination > 0
      ? ((c.terminatedCount / c.designedTermination) * 100)
      : 0;
    return { ...c, pullPct, termPct };
  });
}

export function getPriorityChartData() {
  return priorityData.map((p) => ({
    name: p.name,
    value: p.value,
    lineCount: p.lineCount,
    color: p.color,
  }));
}
