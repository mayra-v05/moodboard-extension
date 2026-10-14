// Captures a navigation in two states: closed and open (expanded), optionally with a video
// of it opening. Confirm with Enter, so hover menus can stay open too.
(() => {
  if (window.__moodboardNav) { window.__moodboardNav.start(); return; }

  const NAV_TYPES = ['Dropdown', 'Mega menu', 'Hamburger / mobiel', 'Fullscreen menu', 'Sidebar', 'Tab bar', 'Overig'];
  const isMobileWindow = innerWidth <= 500;
  let navVideoDefault = true;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    * { box-sizing: border-box; font-family: 'Poppins', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .panel { position: fixed; right: 16px; bottom: 16px; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
      display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 20px; background: #0d0d0d; color: #f5f5f2;
      border: 1px solid #262626; box-shadow: 0 30px 70px -20px rgb(0 0 0 / .6); pointer-events: auto; font-size: 13px; line-height: 1.45;
      animation: pop .35s cubic-bezier(.16,1,.3,1); }
    @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.98); } }
    .step { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #3dffb0; }
    h3 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.02em; }
    p { margin: 0; color: #a8a8a3; }
    kbd { font: 11px ui-monospace, monospace; padding: 1px 6px; border-radius: 5px; background: #262626; color: #f5f5f2; }
    .row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    button { all: unset; cursor: pointer; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; }
    .ghost { color: #a8a8a3; } .ghost:hover { background: #1b1b1b; }
    .primary { background: #3dffb0; color: #03140d; font-weight: 600; }
    .check { display: flex; gap: 8px; align-items: center; color: #f5f5f2; cursor: pointer; }
    .check input { accent-color: #3dffb0; }
    .thumbs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .thumbs figure { margin: 0; display: grid; gap: 4px; }
    .thumbs img { width: 100%; aspect-ratio: 16/10; object-fit: cover; object-position: top; border-radius: 10px; background: #1b1b1b; }
    .thumbs figcaption { font-size: 11px; color: #6f6f6a; text-align: center; }
    label { display: grid; gap: 5px; font-size: 11px; font-weight: 600; color: #a8a8a3; }
    input[type=text] { all: unset; padding: 8px 11px; border-radius: 10px; border: 1px solid #262626; background: #121212; font-size: 13px; color: #f5f5f2; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { padding: 5px 10px; border: 1px solid #262626; font-size: 12px; font-weight: 400; }
    .chip.on { background: #3dffb0; color: #03140d; border-color: #3dffb0; font-weight: 500; }
    .note { font-size: 12px; color: #6f6f6a; }
    .err { color: #ff5c6c; font-size: 12px; }
    .rec { position: fixed; top: 10px; right: 10px; width: 12px; height: 12px; border-radius: 50%; background: #ff4d4d;
      box-shadow: 0 0 0 4px rgb(255 77 77 / .25); animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: .3; } }
    .count { position: fixed; inset: 0; display: grid; place-items: center; font-size: 120px; font-weight: 700; color: #3dffb0;
      text-shadow: 0 0 40px rgb(0 0 0 / .6); pointer-events: none; }
  </style>`;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const send = msg => chrome.runtime.sendMessage(msg).catch(e => ({ ok: false, error: e.message }));

  let state;
  let keyHandler = null;

  function setKey(fn) {
    if (keyHandler) removeEventListener('keydown', keyHandler, true);
    keyHandler = fn && (e => { if (e.key === 'Enter' && !e.composedPath().some(n => n.tagName === 'INPUT')) { e.preventDefault(); e.stopPropagation(); fn(); } else if (e.key === 'Escape') { stop(); } });
    if (keyHandler) addEventListener('keydown', keyHandler, true);
  }

  function panel(html) {
    root.querySelector('.panel')?.remove();
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = html;
    root.append(el);
    globalThis.MB_I18N?.translateTree(el);
    return el;
  }

  async function shot() {
    const prev = host.style.display;
    host.style.display = 'none';
    await frames();
    await sleep(80);
    const res = await send({ type: 'capture-visible' });
    host.style.display = prev;
    if (!res?.ok) throw new Error(res?.error || 'Screenshot mislukt');
    return res.dataUrl;
  }

  // ---------- step 1: closed ----------
  function start() {
    if (!host.isConnected) document.documentElement.append(host);
    if (!document.getElementById('moodboard-poppins')) {
      const font = document.createElement('link');
      font.id = 'moodboard-poppins'; font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
      document.head?.append(font);
    }
    root.querySelector('.rec')?.remove();
    state = { closed: null, open: null, videoKey: null, video: state?.video ?? navVideoDefault, type: isMobileWindow ? 'Hamburger / mobiel' : null };
    const el = panel(`
      <div class="step">Stap 1 van 3 · Dicht</div>
      <h3>Navigatie vastleggen</h3>
      <p>Zorg dat het menu nog dicht is en druk op <kbd>Enter</kbd>.</p>
      <label class="check"><input type="checkbox" data-video ${state.video ? 'checked' : ''}> Ook video van het openklappen</label>
      ${isMobileWindow ? '' : '<p class="note">Hamburgermenu’s zie je vaak alleen op mobiel. Gebruik dan <b>Mobiel formaat</b>.</p>'}
      <div class="row">
        <button class="ghost" data-x>Annuleren</button>
        ${isMobileWindow ? '' : '<button class="ghost" data-mobile>Mobiel formaat</button>'}
        <button class="primary" data-go>Dicht vastleggen</button>
      </div>`);
    el.querySelector('[data-video]').onchange = e => { state.video = e.target.checked; };
    el.querySelector('[data-x]').onclick = stop;
    el.querySelector('[data-mobile]')?.addEventListener('click', async () => { await send({ type: 'nav-mobile', url: location.href }); stop(); });
    const go = async () => {
      setKey(null);
      try { state.closed = await shot(); } catch (e) { return error(e.message); }
      stepOpen();
    };
    el.querySelector('[data-go]').onclick = go;
    setKey(go);
  }

  // ---------- step 2: open ----------
  async function stepOpen() {
    if (state.video) {
      const res = await send({ type: 'nav-record-start' });
      if (res?.ok) state.videoKey = res.key;
      else { state.video = false; state.videoError = res?.error; }
    }
    const el = panel(`
      <div class="step">Stap 2 van 3 · Open</div>
      <h3>Klap het menu nu open</h3>
      <p>Klik op de menuknop of hover over een menu-item. Druk op <kbd>Enter</kbd> zodra het menu helemaal open is.</p>
      ${state.videoKey ? '<p class="note">De video loopt. Dit paneel verdwijnt zo, zodat het niet in beeld komt.</p>' : ''}
      ${state.videoError ? '<p class="err"></p>' : ''}
      <div class="row">
        <button class="ghost" data-x>Annuleren</button>
        <button class="ghost" data-timer>Timer 3 sec</button>
        <button class="primary" data-go>Open vastleggen</button>
      </div>`);
    if (state.videoError) el.querySelector('.err').textContent = 'Video niet beschikbaar: ' + state.videoError + '. Screenshots werken wel.';
    el.querySelector('[data-x]').onclick = stop;

    const go = async () => {
      setKey(null);
      root.querySelector('.rec')?.remove();
      root.querySelector('.count')?.remove();
      try { state.open = await shot(); } catch (e) { return error(e.message); }
      if (state.videoKey) { await sleep(1200); send({ type: 'nav-record-stop', key: state.videoKey }); }
      stepSave();
    };
    el.querySelector('[data-go]').onclick = go;
    el.querySelector('[data-timer]').onclick = async () => {
      setKey(null);
      el.remove();
      const count = document.createElement('div');
      count.className = 'count';
      root.append(count);
      for (let i = 3; i > 0; i--) { count.textContent = i; await sleep(1000); }
      count.remove();
      go();
    };
    setKey(go);

    // Panel out of view during the recording; only a small red dot remains.
    if (state.videoKey) {
      await sleep(2200);
      if (!el.isConnected) return;
      el.remove();
      const dot = document.createElement('div');
      dot.className = 'rec';
      dot.title = 'Opname loopt — druk op Enter als het menu open is';
      root.append(dot);
    }
  }

  // ---------- step 3: save ----------
  function stepSave() {
    const el = panel(`
      <div class="step">Stap 3 van 3 · Opslaan</div>
      <div class="thumbs">
        <figure><img data-closed alt=""><figcaption>Dicht</figcaption></figure>
        <figure><img data-open alt=""><figcaption>Open</figcaption></figure>
      </div>
      ${state.videoKey ? '<p class="note">+ video van het openklappen</p>' : ''}
      <label>Naam<input type="text" data-name data-no-i18n></label>
      <label>Soort navigatie<div class="chips"></div></label>
      <p class="err" hidden></p>
      <div class="row">
        <button class="ghost" data-x>Annuleren</button>
        <button class="ghost" data-again>Opnieuw</button>
        <button class="primary" data-save>Opslaan</button>
      </div>`);
    el.querySelector('[data-closed]').src = state.closed;
    el.querySelector('[data-open]').src = state.open;
    el.querySelector('[data-name]').value = 'Navigatie — ' + location.hostname.replace(/^www\./, '');
    const chips = el.querySelector('.chips');
    const draw = () => {
      chips.replaceChildren(...NAV_TYPES.map(t => {
        const b = document.createElement('button');
        b.className = 'chip' + (t === state.type ? ' on' : '');
        b.textContent = t;
        b.onclick = () => { state.type = t; draw(); };
        return b;
      }));
      globalThis.MB_I18N?.translateTree(chips);
    };
    draw();
    el.querySelector('[data-x]').onclick = () => { discard(); stop(); };
    el.querySelector('[data-again]').onclick = () => { discard(); start(); };
    const save = el.querySelector('[data-save]');
    save.onclick = async () => {
      if (!state.type) { const err = el.querySelector('.err'); err.hidden = false; err.textContent = globalThis.MB_I18N?.t('Kies het soort navigatie') || 'Kies het soort navigatie'; return; }
      save.textContent = '…';
      const res = await send({
        type: 'save-nav', closed: state.closed, open: state.open, videoKey: state.videoKey, url: location.href,
        title: el.querySelector('[data-name]').value.trim(), category: state.type, mobile: isMobileWindow, width: innerWidth, height: innerHeight,
      });
      if (!res?.ok) { save.textContent = 'Opslaan'; const err = el.querySelector('.err'); err.hidden = false; err.textContent = res?.error || 'Opslaan mislukt'; return; }
      state.videoKey = null;
      const done = panel(`<h3>Opgeslagen ✓</h3><p>Staat nu bij Navigaties op je bord.</p>
        <div class="row"><button class="ghost" data-x>Sluiten</button><button class="ghost" data-again>Nog een navigatie</button><button class="primary" data-board>Bekijk bord</button></div>`);
      done.querySelector('[data-x]').onclick = stop;
      done.querySelector('[data-again]').onclick = start;
      done.querySelector('[data-board]').onclick = () => { send({ type: 'open-board', view: 'nav' }); stop(); };
      if (isMobileWindow) setTimeout(() => { if (done.isConnected) stop(); }, 5000);
    };
  }

  function error(message) {
    const el = panel(`<h3>Dat lukte niet</h3><p class="err"></p><div class="row"><button class="ghost" data-x>Sluiten</button><button class="primary" data-again>Opnieuw</button></div>`);
    el.querySelector('.err').textContent = message;
    el.querySelector('[data-x]').onclick = stop;
    el.querySelector('[data-again]').onclick = start;
  }

  function discard() {
    if (state?.videoKey) { send({ type: 'nav-record-stop', key: state.videoKey, discard: true }); state.videoKey = null; }
  }

  function stop() {
    discard();
    setKey(null);
    host.remove();
  }

  window.__moodboardNav = { start };
  Promise.all([
    globalThis.MB_I18N?.loadLang(),
    chrome.storage?.local.get('navVideo').then(r => { if (r.navVideo === false) navVideoDefault = false; }).catch(() => {}),
  ]).then(start);
})();
