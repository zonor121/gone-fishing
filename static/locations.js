// Карточки используют те же данные, что и расчёт поклёвки: отдельного списка рыб нет.
const escapeLocationText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const locationWeight = value => value.toLocaleString('ru-RU', {maximumFractionDigits: 2});
const locationPreviews = {};
function fishIllustration(f) {
  return fishSvg(f);
}
function fishTile(f, caption) {
  return `<div class="location-fish">${fishIllustration(f)}<span>${escapeLocationText(f.name)}</span>${caption ? `<small>${caption}</small>` : ''}</div>`;
}
function renderLocations() {
  $('location-list').innerHTML = Object.values(L).map((l, index) => {
    const fishes = F.filter(f => f.locs.includes(l.code));
    const popular = [...fishes].sort((a,b) => b.freq-a.freq || a.id-b.id).slice(0,3);
    const light = [...fishes].sort((a,b) => a.min-b.min)[0];
    const heavy = [...fishes].sort((a,b) => b.max-a.max)[0];
    const selected = sl.value === l.code;
    const habitat = l.code === 'sea' ? (boatOwned ? 'Открытое море · ваша лодка' : `Бонусная локация · нужна лодка за ${rub(boatPrice)} ₽`) : l.current ? 'Течение · открытый берег' : l.forest ? 'Тихая вода · хвойный лес' : 'Тихая вода · открытый берег';
    return `<article class="location-option${selected?' is-current':''}" aria-labelledby="location-name-${index}"><img class="location-preview" src="${locationPreviews[l.code]}" alt="Пейзаж локации ${escapeLocationText(l.name)}"><h3 id="location-name-${index}">${escapeLocationText(l.name)}</h3><p class="location-habitat">${habitat}</p><p class="location-online">Рыбаков онлайн: ${MP.counts[l.code] || 0}</p><section class="fish-panel"><h4>Наиболее популярные рыбы</h4><div class="popular-fish">${popular.map(f=>fishTile(f)).join('') || '<p>Виды пока не указаны.</p>'}</div></section><section class="fish-panel"><h4>Диапазон веса рыб</h4><div class="weight-fish">${light ? fishTile(light,`от ${locationWeight(light.min)} кг`)+fishTile(heavy,`до ${locationWeight(heavy.max)} кг`) : '<p>Нет данных о весе.</p>'}</div></section><p class="location-species"><b>Все виды:</b> ${fishes.map(f=>escapeLocationText(f.name)).join(', ') || 'не указаны'}</p><button data-location="${escapeLocationText(l.code)}" aria-pressed="${selected}">${l.code === 'sea' && !boatOwned ? `Нужна лодка · ${rub(boatPrice)} ₽` : (selected?'Выбрано: ':'Ловить здесь: ')+escapeLocationText(l.name)}</button></article>`;
  }).join('');
}
function initLocations() {
  // Снимки настоящих игровых пейзажей, а не несвязанные фотографии водоёмов.
  Object.values(L).forEach(l => { paintLandscape(l); locationPreviews[l.code] = landscape.toDataURL('image/png'); });
  landscapeKey = '';
  const updateCurrent = () => { $('location-current').textContent = L[sl.value].name; };
  sl.addEventListener('change', updateCurrent); updateCurrent();
  $('blocations').disabled = false;
  $('blocations').onclick = () => {
    if (S !== 'idle' || sl.disabled) return;
    $('locations-help').textContent = 'Изучите водоёмы и выберите, за какой рыбой отправиться.';
    renderLocations(); modal('locations', true);
    $('locations').querySelector('.location-window').scrollTop = 0;
  };
  $('location-list').onclick = e => {
    const button = e.target.closest('button[data-location]');
    if (!button || S !== 'idle' || sl.disabled || !L[button.dataset.location]) return;
    if(button.dataset.location === 'sea' && !boatOwned) {
      $('locations-help').textContent = `Для морской рыбалки необходимо приобрести лодку за ${rub(boatPrice)} ₽ в магазине.`;
      $('locations').querySelector('.location-window').scrollTop = 0; return;
    }
    sl.value = button.dataset.location;
    updateLocationInfo();
    say(`Место ловли: ${L[sl.value].name}. Снасти готовы.`);
    modal('locations', false);
  };
}
