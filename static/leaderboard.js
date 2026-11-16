// Лидерборд «Рекорды»: топ-10 по весу каждого вида и по стоимости одиночной рыбы.
// Данные — GET /api/leaderboard, загружаются при каждом открытии экрана.
let LB = null, lbSection = 'price';
const lbKeys = () => ['price', ...F.map(f => f.id)];

function renderLbTabs() {
  $('lb-tabs').innerHTML = ['<button role="tab" id="lb-tab-price" aria-controls="lb-body">Самая дорогая</button>',
    ...F.map(f => `<button role="tab" id="lb-tab-${f.id}" aria-controls="lb-body">${escapeLocationText(f.name)}</button>`)].join('');
  lbKeys().forEach(key => {
    const tab = $(`lb-tab-${key}`);
    tab.onclick = () => selectLbSection(key);
    tab.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const keys = lbKeys(), i = keys.indexOf(lbSection);
      const next = event.key === 'Home' ? keys[0] : event.key === 'End' ? keys[keys.length - 1]
        : keys[(i + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
      selectLbSection(next); $(`lb-tab-${next}`).focus();
    };
  });
}
function selectLbSection(key) {
  lbSection = key;
  lbKeys().forEach(k => {
    const selected = k === key;
    $(`lb-tab-${k}`).setAttribute('aria-selected', String(selected));
    $(`lb-tab-${k}`).tabIndex = selected ? 0 : -1;
  });
  $('lb-body').setAttribute('aria-labelledby', `lb-tab-${key}`);
  renderLbBoard();
}
function renderLbBoard() {
  if (!LB) return;
  const isPrice = lbSection === 'price';
  const rows = isPrice ? LB.price : (LB.fish.find(b => b.id === lbSection) || {rows: []}).rows;
  const fishName = isPrice ? null : (F.find(f => f.id === lbSection) || {}).name;
  $('lb-summary').textContent = isPrice ? 'Самая дорогая пойманная рыба · топ-10' : `${fishName} · наибольший вес · топ-10`;
  if (!rows.length) {
    $('lb-body').innerHTML = `<p class="guide-note">${isPrice ? 'Пока нет проданных уловов — поймайте рыбу и нажмите «Забрать».' : 'Пока никто не поймал эту рыбу. Станьте первым!'}</p>`;
    return;
  }
  const head = isPrice ? '<th>Место</th><th>Рыбак</th><th>Рыба</th><th>Вес</th><th>Стоимость</th><th>Дата</th>'
    : '<th>Место</th><th>Рыбак</th><th>Вес</th><th>Дата</th>';
  $('lb-body').innerHTML = '<div class="table-scroll"><table aria-label="Топ-10 рыбаков"><thead><tr>' + head + '</tr></thead><tbody>' +
    rows.map((r, i) => {
      const name = escapeLocationText(r.username) + (r.you ? ' <span class="lb-you">вы</span>' : '');
      const cells = isPrice
        ? `<td>${escapeLocationText(r.fish)}</td><td>${r.weight.toFixed(2)} кг</td><td>${rub(r.price)} ₽</td>`
        : `<td>${r.weight.toFixed(2)} кг</td>`;
      return `<tr${r.you ? ' class="lb-me"' : ''}><td class="lb-rank${i < 3 ? ' lb-top' : ''}">${i + 1}</td><td>${name}</td>${cells}<td>${escapeLocationText(r.caught_at.slice(0, 10))}</td></tr>`;
    }).join('') + '</tbody></table></div>';
}
async function openLeaderboard() {
  showView('lb');
  $('lb-body').innerHTML = '<p class="guide-note">Загружаем рекорды…</p>';
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error(res.status);
    LB = await res.json();
  } catch (e) {
    LB = null;
    $('lb-summary').textContent = '';
    $('lb-body').innerHTML = '<p class="guide-note">Не удалось загрузить рекорды. Вернитесь к рыбалке и откройте вкладку ещё раз.</p>';
    return;
  }
  renderLbTabs();
  selectLbSection(lbKeys().includes(lbSection) ? lbSection : 'price');
}
function initLeaderboard() {
  $('blb').disabled = false;
  $('blb').onclick = () => openLeaderboard();
  $('lb-return').onclick = () => { showView('fishing'); $('bplay').focus(); };
}