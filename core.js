/* 검증·계산 규칙과 Supabase 인증/데이터 접근 계층 */
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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('월을 YYYY-MM 형식으로 입력해 주세요.');
    if (!team || [...team].length > 80) throw new Error('부서명은 앞뒤 공백을 정리한 1~80자로 입력해 주세요.');
    const amount = (value, label) => {
      const text = String(value ?? '').trim();
      if (!/^\d+$/.test(text)) throw new Error(label + '은 0 이상의 정수로 입력해 주세요.');
      const number = Number(text);
      if (!Number.isSafeInteger(number)) throw new Error(label + '은 JavaScript 안전 정수 범위 이내여야 합니다.');
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

  let client = null;
  function configured(config) {
    const url = String(config?.supabaseUrl ?? '').trim();
    const key = String(config?.supabasePublishableKey ?? '').trim();
    if (!url || !key || /YOUR_|PLACEHOLDER|REPLACE_ME/i.test(url + ' ' + key)
      || /sb_secret_|service_role/i.test(key)) return false;
    try {
      const parsed = new URL(url);
      return (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
        && !!parsed.hostname;
    } catch { return false; }
  }
  function requireClient() {
    if (!client) throw new Error('Supabase가 설정되지 않았거나 연결을 초기화하지 못했습니다.');
    return client;
  }
  function raise(error) {
    if (error?.code === '23505') throw new Error('같은 사용자의 월·부서 KPI가 이미 있습니다.');
    if (error?.code === '42501' || error?.status === 403) throw new Error('권한이 없습니다. 로그인 상태와 본인 행 RLS 정책을 확인해 주세요.');
    throw new Error(error?.message || 'Supabase 요청에 실패했습니다.');
  }

  const store = {
    mode: 'supabase',
    isConfigured: configured,
    initialize(config) {
      if (!configured(config)) return { configured: false, reason: 'config.js에 Supabase 프로젝트 URL과 publishable key를 설정해 주세요.' };
      if (!root.supabase?.createClient) return { configured: false, reason: 'Supabase JS 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.' };
      client = root.supabase.createClient(config.supabaseUrl.trim(), config.supabasePublishableKey.trim(), {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
      });
      return { configured: true };
    },
    getSession() { return requireClient().auth.getSession(); },
    signIn(email, password) { return requireClient().auth.signInWithPassword({ email, password }); },
    signOut() { return requireClient().auth.signOut(); },
    onAuthStateChange(callback) { return requireClient().auth.onAuthStateChange(callback); },
    async readAll(userId) {
      if (!userId) throw new Error('로그인 사용자 정보가 없어 조회할 수 없습니다.');
      const { data, error } = await requireClient().from('kpi_records')
        .select('id, user_id, month, team, target, actual, created_at')
        .eq('user_id', userId)
        .order('month', { ascending: false })
        .order('team', { ascending: true });
      if (error) raise(error);
      return data || [];
    },
    async create(input) {
      const record = validateRecord(input);
      const { data, error } = await requireClient().from('kpi_records')
        .insert(record)
        .select('id, user_id, month, team, target, actual, created_at')
        .single();
      if (error) raise(error);
      return data;
    }
  };

  root.KPICore = { SAMPLE, validateRecord, summarize };
  root.KPIStore = store;
})(window);
