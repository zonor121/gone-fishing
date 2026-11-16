// Звон колокольчиков при поклёвке: синтез WebAudio, без аудиофайлов и зависимостей.
let audioCtx = null;
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
// Браузеры разрешают звук только после жеста пользователя.
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, unlockAudio, {passive: true}));

function bellChime() {
  // Заглушка, если WebAudio недоступен или заблокирован: остаётся текст «Поклёвка!» и «ПОДСЕКАЙ!».
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  [0, .17, .4].forEach((offset, strike) => {
    const t0 = now + offset, base = strike === 1 ? 1560 : 1320;
    [[1, 1], [2.76, .45], [5.4, .2]].forEach(([ratio, amp]) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(.16 * amp, t0 + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, t0 + .7 / ratio);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0 + .8);
    });
  });
}