// Регистрация и вход: /api/register, /api/login, /api/logout.
// Подключается последним и пользуется общими помощниками game.js ($, post, boot, refresh, say, btn).
(function () {
  const box = $('auth'), form = $('auth-form'), err = $('auth-error');
  const userInput = $('auth-user'), passInput = $('auth-pass'), submit = $('auth-submit');
  const tabs = { login: $('auth-tab-login'), register: $('auth-tab-register') };
  let mode = 'login', started = false;

  function show(next) {
    mode = next || mode;
    err.textContent = '';
    for (const key of Object.keys(tabs)) tabs[key].setAttribute('aria-selected', String(key === mode));
    submit.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    passInput.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    box.hidden = false;
    document.body.classList.add('auth-pending');
    setTimeout(() => userInput.focus(), 0);
  }
  function hide() {
    box.hidden = true;
    document.body.classList.remove('auth-pending');
  }

  // Первый запуск игры или обновление данных после повторного входа.
  async function start() {
    if (started) { await refresh(); return; }
    started = true;
    try { await boot(); }
    catch (e) {
      started = false;
      say('Не удалось загрузить игру. Проверьте сервер и обновите страницу.');
      btn.textContent = 'Игра недоступна';
    }
  }

  Object.entries(tabs).forEach(([key, tab]) => {
    tab.onclick = () => { mode = key; passInput.value = ''; show(key); };
  });

  form.onsubmit = async e => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    try {
      const r = await fetch(mode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userInput.value.trim(), password: passInput.value })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        err.textContent = data.error || (mode === 'login' ? 'Не удалось войти.' : 'Не удалось зарегистрироваться.');
        return;
      }
      hide();
      await start();
    } catch (e) {
      err.textContent = 'Нет связи с сервером. Проверьте, что запущен server.py.';
    } finally {
      submit.disabled = false;
    }
  };

  $('blogout').onclick = async () => {
    await post('/api/logout', {}).catch(() => {});
    location.reload();
  };

  // game.js вызывает showAuth при 401 (сессия истекла во время игры).
  window.showAuth = show;

  // Стартовая проверка: есть ли живая сессия у этого браузера.
  fetch('/api/state')
    .then(r => {
      if (r.ok) { hide(); return start(); }
      show('login');
      if (r.status !== 401) err.textContent = 'Сервер отвечает ошибкой. Обновите страницу позже.';
    })
    .catch(() => {
      show('login');
      err.textContent = 'Нет связи с сервером. Запустите игру: python server.py';
    });
})();
