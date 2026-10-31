/* KPI 화면과 사용자 동작 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = value => BigInt(value).toLocaleString('ko-KR') + '원';
  const rateText = value => value === null ? '목표 미설정' : Number.isInteger(value) ? value + '%' : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + '%';
  const monthText = value => value.replace('-', '.');
  let allRows = [];

  function filteredRows() {
    return allRows.filter(row => (!$('month-filter').value || row.month === $('month-filter').value) && (!$('team-filter').value || row.team === $('team-filter').value));
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
  async function refresh() {
    try {
      allRows = await KPIStore.readAll();
      setOptions('month-filter', allRows.map(row => row.month), '전체 월');
      setOptions('team-filter', allRows.map(row => row.team), '전체 부서');
      render();
    } catch (error) {
      const state = $('table-state'); state.hidden = false; state.classList.add('error');
      state.textContent = '데이터를 불러오지 못했습니다. ' + error.message;
      $('evidence-rows').replaceChildren(); $('chart').textContent = '데이터를 불러오지 못했습니다.';
    }
  }
  $('month-filter').addEventListener('change', render);
  $('team-filter').addEventListener('change', render);
  $('reset-filters').addEventListener('click', () => { $('month-filter').value = ''; $('team-filter').value = ''; render(); });
  $('kpi-form').addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('form-message'); message.textContent = ''; message.classList.remove('error');
    try {
      const record = KPICore.validateRecord({ month: $('entry-month').value, team: $('entry-team').value, target: $('entry-target').value, actual: $('entry-actual').value });
      await KPIStore.create(record);
      $('kpi-form').reset(); $('entry-month').value = '2026-10';
      $('month-filter').value = record.month; $('team-filter').value = record.team;
      message.textContent = '실적을 샘플에 추가했습니다. 이 내용은 새로고침하면 사라집니다.';
      await refresh();
    } catch (error) { message.textContent = error.message || '입력 내용을 저장하지 못했습니다.'; message.classList.add('error'); }
  });
  refresh();
})();
