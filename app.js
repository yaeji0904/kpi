/* Supabase 로그인 상태에 따라 본인 KPI만 표시하는 화면 동작 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = value => BigInt(value).toLocaleString('ko-KR') + '원';
  const rateText = value => value === null ? '목표 미설정' : Number.isInteger(value) ? value + '%' : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '%';
  const monthText = value => value.replace('-', '.');
  let allRows = [];
  let currentUser = null;
  let configured = false;

  function authMessage(message, isError = false) {
    const el = $('auth-message'); el.textContent = message; el.classList.toggle('error', isError);
  }
  function formMessage(message, isError = false) {
    const el = $('form-message'); el.textContent = message; el.classList.toggle('error', isError);
  }
  function clearDashboard() {
    allRows = [];
    $('evidence-rows').replaceChildren(); $('chart').replaceChildren();
    $('target-total').textContent = '—'; $('actual-total').textContent = '—'; $('achievement-rate').textContent = '—';
    $('row-count').textContent = '0건'; $('result-caption').textContent = '';
    $('table-state').hidden = true; $('table-state').classList.remove('error');
    $('month-filter').value = ''; $('team-filter').value = '';
  }
  function setOptions(id, values, label) {
    const select = $(id), previous = select.value;
    select.replaceChildren(new Option(label, ''));
    [...new Set(values)].sort().forEach(value => select.add(new Option(value, value)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function cell(row, value, className) {
    const td = document.createElement('td'); td.textContent = value;
    if (className) td.className = className;
    row.append(td); return td;
  }
  function filteredRows() {
    return allRows.filter(row => (!$('month-filter').value || row.month === $('month-filter').value)
      && (!$('team-filter').value || row.team === $('team-filter').value));
  }
  function render() {
    const rows = filteredRows(), total = KPICore.summarize(rows);
    $('target-total').textContent = money(total.target);
    $('actual-total').textContent = money(total.actual);
    $('achievement-rate').textContent = rateText(total.rate);
    $('rate-caption').textContent = total.rate === null ? '목표 합계가 0원입니다.' : '실적 합계 ÷ 목표 합계 × 100';
    $('row-count').textContent = total.count + '건';
    $('result-caption').textContent = rows.length ? rows.length + '건의 실적을 표시 중' : '조회 결과 없음';

    const body = $('evidence-rows'); body.replaceChildren();
    const state = $('table-state'); state.hidden = rows.length > 0; state.classList.remove('error');
    state.textContent = '조건에 맞는 데이터가 없습니다. 월 또는 부서 필터를 바꾸거나 새 실적을 입력해 주세요.';
    for (const record of rows) {
      const tr = document.createElement('tr');
      cell(tr, monthText(record.month)); cell(tr, record.team, 'team-cell');
      cell(tr, money(record.target), 'numeric'); cell(tr, money(record.actual), 'numeric');
      cell(tr, rateText(KPICore.summarize([record]).rate), 'numeric rate-cell'); body.append(tr);
    }

    const chart = $('chart'); chart.replaceChildren();
    const teams = [...new Set(rows.map(row => row.team))].sort();
    if (!teams.length) { const empty = document.createElement('p'); empty.className = 'chart-empty'; empty.textContent = '표시할 부서 데이터가 없습니다.'; chart.append(empty); }
    for (const team of teams) {
      const summary = KPICore.summarize(rows.filter(row => row.team === team));
      const line = document.createElement('div'); line.className = 'chart-row';
      const name = document.createElement('span'); name.className = 'chart-team'; name.textContent = team;
      const track = document.createElement('div'); track.className = 'chart-track'; track.setAttribute('role', 'img'); track.setAttribute('aria-label', team + ' 달성률 ' + rateText(summary.rate));
      const fill = document.createElement('div'); fill.className = 'chart-fill'; fill.style.width = (summary.rate === null ? 0 : Math.min(100, summary.rate)) + '%'; track.append(fill);
      const rate = document.createElement('span'); rate.className = 'chart-rate'; rate.textContent = rateText(summary.rate);
      line.append(name, track, rate); chart.append(line);
    }
  }
  async function refresh(userId = currentUser?.id) {
    if (!userId || currentUser?.id !== userId) return false;
    const state = $('table-state'); state.hidden = false; state.classList.remove('error'); state.textContent = '저장된 KPI를 불러오는 중입니다.';
    try {
      const nextRows = await KPIStore.readAll(userId);
      if (currentUser?.id !== userId) return false;
      allRows = nextRows;
      setOptions('month-filter', allRows.map(row => row.month), '전체 월');
      setOptions('team-filter', allRows.map(row => row.team), '전체 부서');
      render();
      return true;
    } catch (error) {
      if (currentUser?.id !== userId) return false;
      state.hidden = false; state.classList.add('error');
      state.textContent = '저장된 데이터를 불러오지 못했습니다. ' + error.message;
      $('evidence-rows').replaceChildren(); $('chart').textContent = '데이터를 불러오지 못했습니다.';
      $('target-total').textContent = '—'; $('actual-total').textContent = '—'; $('achievement-rate').textContent = '—';
      allRows = [];
      return false;
    }
  }
  async function applySession(session) {
    const nextUser = session?.user || null;
    if (!nextUser) {
      const wasSignedIn = !!currentUser;
      currentUser = null; clearDashboard(); $('dashboard').hidden = true;
      $('auth-user').hidden = true; $('logout-button').hidden = true;
      $('login-form').hidden = !configured;
      $('connection-label').textContent = configured ? '로그인 필요' : 'Supabase 미설정';
    $('connection-pill').classList.toggle('is-connected', false);
    $('connection-pill').classList.toggle('is-error', !configured);
      if (configured && wasSignedIn) authMessage('로그아웃되었습니다.');
      return;
    }
    const changedUser = currentUser?.id !== nextUser.id;
    if (changedUser) clearDashboard();
    currentUser = nextUser;
    $('dashboard').hidden = false; $('login-form').hidden = true;
    $('auth-user').hidden = false; $('auth-user').textContent = nextUser.email || '로그인 사용자';
    $('logout-button').hidden = false; $('connection-label').textContent = 'Supabase 연결';
    $('connection-pill').classList.add('is-connected'); $('connection-pill').classList.remove('is-error');
    authMessage('로그인되었습니다. 본인 계정의 KPI만 조회합니다.');
    if (changedUser) await refresh(nextUser.id);
  }

  $('month-filter').addEventListener('change', render);
  $('team-filter').addEventListener('change', render);
  $('reset-filters').addEventListener('click', () => { $('month-filter').value = ''; $('team-filter').value = ''; render(); });
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('login-button'); button.disabled = true; button.textContent = '로그인 중…';
    authMessage('로그인 요청 중입니다.');
    try {
      const { data, error } = await KPIStore.signIn($('login-email').value.trim(), $('login-password').value);
      if (error) throw error;
      $('login-password').value = '';
      await applySession(data.session);
    } catch (error) {
      $('connection-pill').classList.add('is-error'); $('connection-pill').classList.remove('is-connected');
      authMessage('로그인하지 못했습니다. 이메일·비밀번호와 Supabase Auth 설정을 확인해 주세요. ' + (error.message || ''), true);
    } finally { button.disabled = false; button.textContent = '로그인'; }
  });
  $('logout-button').addEventListener('click', async () => {
    $('logout-button').disabled = true;
    try {
      const { error } = await KPIStore.signOut();
      if (error) throw error;
      await applySession(null);
    } catch (error) { authMessage('로그아웃하지 못했습니다. ' + (error.message || ''), true); }
    finally { $('logout-button').disabled = false; }
  });
  $('kpi-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) { formMessage('먼저 로그인해 주세요.', true); return; }
    const userId = currentUser.id, button = $('kpi-form').querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = '저장 중…'; formMessage('Supabase에 저장 중입니다.');
    try {
      const record = KPICore.validateRecord({ month: $('entry-month').value, team: $('entry-team').value, target: $('entry-target').value, actual: $('entry-actual').value });
      await KPIStore.create(record);
      if (currentUser?.id !== userId) return;
      $('kpi-form').reset(); $('entry-month').value = '2026-10';
      const loaded = await refresh(userId);
      if (loaded) {
        $('month-filter').value = record.month; $('team-filter').value = record.team; render();
        formMessage('저장했습니다. 다시 조회해도 이 자료가 유지됩니다.');
      } else {
        formMessage('저장은 완료했지만 목록을 다시 불러오지 못했습니다. 새로고침 후 확인해 주세요.', true);
      }
    } catch (error) { formMessage(error.message || '저장하지 못했습니다.', true); }
    finally { button.disabled = false; button.textContent = 'KPI 저장'; }
  });

  const setup = KPIStore.initialize(window.KPI_CONFIG);
  configured = setup.configured;
  if (!configured) {
    $('connection-label').textContent = 'Supabase 미설정';
    $('connection-pill').classList.add('is-error');
    authMessage(setup.reason + ' 로그인과 저장은 설정 후 사용할 수 있습니다.', true);
    $('login-form').hidden = true; $('dashboard').hidden = true;
  } else {
    $('login-form').hidden = false;
    authMessage('이미 등록된 Supabase 사용자로 로그인해 주세요. 이 화면에서는 계정을 만들지 않습니다.');
    KPIStore.onAuthStateChange((_event, session) => {
      Promise.resolve().then(() => applySession(session));
    });
    KPIStore.getSession().then(({ data, error }) => {
      if (error) throw error;
      return applySession(data.session);
    }).catch(error => {
      $('connection-label').textContent = 'Supabase 오류';
      $('connection-pill').classList.add('is-error'); $('connection-pill').classList.remove('is-connected');
      authMessage('로그인 상태를 확인하지 못했습니다. 네트워크와 Supabase 설정을 확인해 주세요. ' + (error.message || ''), true);
      $('login-form').hidden = false;
    });
  }
})();
