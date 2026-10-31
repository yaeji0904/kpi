/* 계산·입력 검증·가상 데이터·데이터 읽기/쓰기 계층
   파일 직접 열기(file://)에서는 fetch를 사용하지 않고 아래 메모리 샘플을 사용합니다.
   Supabase 연결 시 KPIStore의 readAll/create 구현을 교체하면 됩니다. */
(function (root) {
  'use strict';

  const SAMPLE = [
    { id: 'sample-1', month: '2026-09', team: '영업A', target: 10000000, actual: 9000000 },
    { id: 'sample-2', month: '2026-09', team: '영업B', target: 8000000, actual: 8800000 },
    { id: 'sample-3', month: '2026-09', team: '영업C', target: 12000000, actual: 10800000 },
    { id: 'sample-4', month: '2026-10', team: '영업A', target: 10000000, actual: 11000000 },
    { id: 'sample-5', month: '2026-10', team: '영업B', target: 8000000, actual: 7200000 },
    { id: 'sample-6', month: '2026-10', team: '영업C', target: 12000000, actual: 12600000 }
  ];

  function validateRecord(input) {
    const month = String(input.month ?? '').trim();
    const team = String(input.team ?? '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('월을 확인해 주세요.');
    if (!team || [...team].length > 80) throw new Error('부서명은 1~80자로 입력해 주세요.');
    const amount = (value, label) => {
      const text = String(value ?? '').trim();
      if (!/^\d+$/.test(text)) throw new Error(label + '은 0 이상의 정수로 입력해 주세요.');
      const number = Number(text);
      if (!Number.isSafeInteger(number)) throw new Error(label + '이 입력 가능한 범위를 넘었습니다.');
      return number;
    };
    return { month, team, target: amount(input.target, '목표 금액'), actual: amount(input.actual, '실적 금액') };
  }

  function summarize(rows) {
    const target = rows.reduce((sum, row) => sum + BigInt(row.target), 0n);
    const actual = rows.reduce((sum, row) => sum + BigInt(row.actual), 0n);
    const rate = target === 0n ? null : Number((actual * 10000n + target / 2n) / target) / 100;
    return { target, actual, count: rows.length, rate };
  }

  let rows = SAMPLE.map(row => ({ ...row }));
  const store = {
    mode: 'sample',
    async readAll() { return rows.map(row => ({ ...row })); },
    async create(input) {
      const duplicate = rows.some(row => row.month === input.month && row.team.toLocaleLowerCase() === input.team.toLocaleLowerCase());
      if (duplicate) throw new Error('같은 월·부서의 항목이 이미 있습니다. 기존 항목을 확인해 주세요.');
      const record = { ...input, id: 'sample-' + Date.now() };
      rows = [...rows, record];
      return { ...record };
    }
  };

  root.KPICore = { SAMPLE, validateRecord, summarize };
  root.KPIStore = store;
})(window);
