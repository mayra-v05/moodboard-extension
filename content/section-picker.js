// Injected into the page: lets you pick a section, takes a (long, if needed) screenshot of it
// and saves it as a favorite section via the service worker.
(() => {
  if (window.__moodboardPicker) { window.__moodboardPicker.start(); return; }

  const SECTION_TYPES = ['Hero', 'Navigatie', 'Features', 'Cards', 'Pricing', 'Testimonials', 'CTA', 'FAQ',
    'Formulier', 'Footer', 'Galerij', 'Team', 'Stats', 'Logo wall', 'Blog / content', 'Overig'];
  const SECTION_LIKE = 'section,header,footer,nav,form,article,aside,main > div,[role=region],[role=banner],[role=contentinfo],[class*="section" i],[class*="hero" i],[class*="footer" i]';
  const MAX_SCREENS = 8;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'Poppins', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .box { position: fixed; border: 2px solid #3dffb0; background: rgb(61 255 176 / .12); border-radius: 4px; pointer-events: none;
      transition: all .12s cubic-bezier(.16,1,.3,1); box-shadow: 0 0 0 99999px rgb(14 12 18 / .28); display: none; }
    .tag { position: absolute; left: -2px; top: -26px; padding: 3px 8px; border-radius: 6px; background: #3dffb0; color: #03140d; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .box.below .tag { top: auto; bottom: -26px; }
    .bar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 14px; align-items: center; padding: 9px 10px 9px 16px;
      border-radius: 999px; background: #0d0d0d; color: #f5f5f2; border: 1px solid #262626; font-size: 13px; box-shadow: 0 12px 30px -10px rgb(0 0 0 / .5); pointer-events: auto; white-space: nowrap; }
    .bar kbd { font: 11px ui-monospace, monospace; padding: 1px 6px; border-radius: 5px; background: #2e2c34; }
    .bar button, .panel button { all: unset; cursor: pointer; padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 500; }
    .bar button { background: #2e2c34; }
    .panel { position: fixed; right: 18px; bottom: 18px; width: 360px; max-height: calc(100vh - 36px); display: flex; flex-direction: column; gap: 12px; padding: 16px;
      border-radius: 20px; background: #0d0d0d; color: #f5f5f2; border: 1px solid #262626; box-shadow: 0 30px 70px -20px rgb(0 0 0 / .55); pointer-events: auto; font-size: 13px;
      animation: pop .4s cubic-bezier(.16,1,.3,1); }
    @keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.98); } }
    .panel h3 { margin: 0; font: 600 20px/1.15 'Poppins', ui-sans-serif, system-ui, sans-serif; letter-spacing: -.02em; }
    .shot { border-radius: 12px; background: #1b1b1b; overflow: auto; max-height: 240px; flex: none; }
    .shot img { display: block; width: 100%; }
    .meta { color: #8f8a96; font-size: 11px; margin-top: -6px; }
    label { display: grid; gap: 5px; font-size: 11px; font-weight: 600; color: #a8a8a3; }
    input { all: unset; padding: 8px 11px; border-radius: 10px; border: 1px solid #262626; font-size: 13px; color: #f5f5f2; background: #121212; }
    input:focus { border-color: #3dffb0; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; overflow-y: auto; max-height: 120px; }
    .chip { all: unset; cursor: pointer; padding: 5px 10px; border-radius: 999px; border: 1px solid #262626; font-size: 12px; }
    .chip.on { background: #3dffb0; color: #03140d; border-color: #3dffb0; font-weight: 500; }
    .row { display: flex; gap: 6px; justify-content: flex-end; }
    .ghost { color: #a8a8a3; }
    .ghost:hover { background: #1b1b1b; }
    .primary { background: #3dffb0; color: #03140d; font-weight: 600; }
    .primary[disabled] { opacity: .5; pointer-events: none; }
    .busy { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 10px 16px; border-radius: 999px; background: #3dffb0; color: #03140d; font-size: 13px; }
    .err { color: #ff5c6c; font-size: 12px; }
    .recframe { position: fixed; border: 2px dashed #3dffb0; border-radius: 6px; pointer-events: none; box-shadow: 0 0 0 9999px rgb(0 0 0 / .0); }
    .reclabel { position: fixed; display: flex; gap: 8px; align-items: center; padding: 5px 11px; border-radius: 999px; background: #0d0d0d;
      border: 1px solid #262626; color: #f5f5f2; font-size: 12px; font-weight: 500; pointer-events: none; white-space: nowrap; }
    .reclabel i { width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: .3; } }
    .shot { position: relative; }
    .vbadge { position: absolute; left: 8px; bottom: 8px; padding: 3px 9px; border-radius: 999px; background: rgb(0 0 0 / .7); color: #fff; font-size: 11px; font-weight: 600; }
  </style>
  <div class="box"><span class="tag"></span></div>
  <div class="bar"><b class="mode" style="color:#ff6b6b"></b>Klik op een sectie of sleep een kader <span><kbd>↑</kbd> <kbd>↓</kbd> groter/kleiner</span><span><kbd>Esc</kbd></span><button data-cancel>Annuleren</button></div>`;

  const box = root.querySelector('.box');
  const tag = root.querySelector('.tag');
  const bar = root.querySelector('.bar');
  bar.querySelector('[data-cancel]').onclick = () => stop();

  let mode = 'shot'; // 'shot' or 'video'
  let seconds = 8;
  let picking = false;
  let path = [];       // from the pointed element upwards
  let level = 0;       // index into path
  let drag = null;     // { x, y } start point
  let dragRect = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const own = e => e.composedPath().includes(host);

  function showBox(r, label) {
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    box.classList.toggle('below', r.top < 30);
    tag.textContent = label;
  }

  const current = () => path[level];
  function describe(el) {
    const r = el.getBoundingClientRect();
    const name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.classList[0] ? '.' + el.classList[0] : '');
    return `${name.slice(0, 40)} · ${Math.round(r.width)}×${Math.round(r.height)}`;
  }
  function highlight() {
    const el = current();
    if (el) showBox(el.getBoundingClientRect(), describe(el));
  }

  function onMove(e) {
    if (!picking || own(e)) return;
    if (drag) {
      const x = Math.min(drag.x, e.clientX), y = Math.min(drag.y, e.clientY);
      const w = Math.abs(e.clientX - drag.x), hgt = Math.abs(e.clientY - drag.y);
      if (dragRect || w > 6 || hgt > 6) {
        dragRect = { left: x, top: y, width: w, height: hgt };
        showBox(dragRect, `Eigen kader · ${Math.round(w)}×${Math.round(hgt)}`);
      }
      return;
    }
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === host || target === path[0]) return;
    const chain = [];
    for (let el = target; el && el !== document.documentElement; el = el.parentElement) chain.push(el);
    const preferred = target.closest(SECTION_LIKE);
    path = chain;
    level = preferred ? Math.max(0, chain.indexOf(preferred)) : 0;
    // Element too small? Jump to the first parent that is wide enough.
    while (level < chain.length - 1 && chain[level].getBoundingClientRect().width < Math.min(320, innerWidth * .3)) level++;
    highlight();
  }

  function block(e) { if (picking && !own(e)) { e.preventDefault(); e.stopPropagation(); } }
  function onDown(e) { if (!picking || own(e) || e.button !== 0) return; block(e); drag = { x: e.clientX, y: e.clientY }; dragRect = null; }
  function onUp(e) {
    if (!picking || own(e) || !drag) return;
    block(e);
    const vr = dragRect || current()?.getBoundingClientRect();
    const el = dragRect ? null : current();
    drag = null; dragRect = null;
    if (!vr || vr.width < 10 || vr.height < 10) return;
    select({ x: vr.left + scrollX, y: vr.top + scrollY, w: vr.width, h: vr.height }, el);
  }
  function onKey(e) {
    if (!picking) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowUp' && level < path.length - 1) { e.preventDefault(); level++; highlight(); }
    else if (e.key === 'ArrowDown' && level > 0) { e.preventDefault(); level--; highlight(); }
    else if (e.key === 'Enter' && current()) {
      e.preventDefault();
      const r = current().getBoundingClientRect();
      select({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }, current());
    }
  }
  const onScroll = () => { if (picking && !drag) highlight(); };

  const listeners = [['mousemove', onMove], ['mousedown', onDown], ['mouseup', onUp], ['click', block], ['keydown', onKey], ['scroll', onScroll]];
  function bind(on) { for (const [t, fn] of listeners) (on ? addEventListener : removeEventListener)(t, fn, true); }

  function start() {
    chrome.storage?.local.get(['sectionMode', 'sectionSecs']).then(r => {
      mode = r.sectionMode === 'video' ? 'video' : 'shot';
      seconds = [5, 8, 12].includes(r.sectionSecs) ? r.sectionSecs : 8;
      const tagEl = bar.querySelector('.mode');
      if (tagEl) tagEl.textContent = mode === 'video' ? `● ${globalThis.MB_I18N?.t('Opname') || 'Opname'} ${seconds}s` : '';
    }).catch(() => {});
    if (!document.getElementById('moodboard-poppins')) {
      const font = document.createElement('link');
      font.id = 'moodboard-poppins'; font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap';
      document.head?.append(font);
    }
    root.querySelector('.panel')?.remove();
    root.querySelector('.busy')?.remove();
    if (!host.isConnected) document.documentElement.append(host);
    host.style.display = '';
    bar.style.display = '';
    box.style.display = 'none';
    path = []; level = 0; drag = null;
    picking = true;
    bind(true);
    document.documentElement.style.cursor = 'crosshair';
  }

  function stop() {
    picking = false;
    bind(false);
    document.documentElement.style.cursor = '';
    host.remove();
  }

  // ---------- screenshot ----------
  async function captureViewport() {
    const res = await chrome.runtime.sendMessage({ type: 'capture-visible' });
    if (!res?.ok) throw new Error(res?.error || 'Screenshot mislukt');
    const img = new Image();
    img.src = res.dataUrl;
    await img.decode();
    return img;
  }

  function hideFloating(selected) {
    const hidden = [];
    for (const el of document.body.querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if ((pos === 'fixed' || pos === 'sticky') && !(selected && (selected.contains(el) || el.contains(selected)))) {
        hidden.push([el, el.style.visibility]);
        el.style.visibility = 'hidden';
      }
    }
    return () => hidden.forEach(([el, v]) => { el.style.visibility = v; });
  }

  async function capture(rect, el) {
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    const startX = scrollX, startY = scrollY;
    html.style.scrollBehavior = 'auto';
    const height = Math.min(rect.h, innerHeight * MAX_SCREENS);
    const bottom = rect.y + height;
    let canvas, ctx, scale, restore = null, y = rect.y, shots = 0;
    try {
      while (y < bottom - 1) {
        const fullyVisible = shots === 0 && rect.y >= scrollY && bottom <= scrollY + innerHeight;
        if (!fullyVisible) { scrollTo(startX, y); }
        await frames();
        await sleep(shots === 0 ? 120 : 550); // Chrome allows max. 2 screenshots per second
        const img = await captureViewport();
        scale ||= img.width / innerWidth;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = Math.round(rect.w * scale);
          canvas.height = Math.round(height * scale);
          ctx = canvas.getContext('2d');
        }
        const top = Math.max(y, scrollY), bot = Math.min(bottom, scrollY + innerHeight);
        if (bot <= top) break;
        const sx = (rect.x - scrollX) * scale;
        ctx.drawImage(img, sx, (top - scrollY) * scale, rect.w * scale, (bot - top) * scale, 0, (top - rect.y) * scale, rect.w * scale, (bot - top) * scale);
        y = bot;
        shots++;
        if (shots === 1 && y < bottom - 1) restore = hideFloating(el); // don't repeat sticky headers
      }
    } finally {
      restore?.();
      scrollTo(startX, startY);
      html.style.scrollBehavior = prevBehavior;
    }
    return { dataUrl: canvas.toDataURL('image/webp', 0.92), width: Math.round(rect.w), height: Math.round(height), cut: height < rect.h };
  }

  // ---------- save panel ----------
  async function select(rect, el) {
    picking = false;
    bind(false);
    document.documentElement.style.cursor = '';
    box.style.display = 'none';
    bar.style.display = 'none';
    host.style.display = 'none';
    await frames();

    if (mode === 'video') return recordSection(rect, el);

    let shot;
    try { shot = await capture(rect, el); }
    catch (e) { host.style.display = ''; return showPanel(null, e.message); }
    host.style.display = '';
    showPanel(shot, null, el);
  }

  // Records only the section: scroll it into view; cropping happens per frame in the recorder.
  async function recordSection(rect, el) {
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    const fits = rect.h <= innerHeight;
    scrollTo(scrollX, Math.max(0, fits ? rect.y - (innerHeight - rect.h) / 2 : rect.y));
    html.style.scrollBehavior = prevBehavior;
    await frames();
    await sleep(350);

    const x = Math.max(0, rect.x - scrollX), y = Math.max(0, rect.y - scrollY);
    const crop = { x, y, w: Math.min(rect.w, innerWidth - x), h: Math.min(rect.h - Math.max(0, scrollY - rect.y), innerHeight - y), vw: innerWidth, vh: innerHeight };

    // poster: one screenshot of the same frame
    let poster;
    try {
      const img = await captureViewport();
      const scale = img.width / innerWidth;
      const c = document.createElement('canvas');
      c.width = Math.round(crop.w * scale); c.height = Math.round(crop.h * scale);
      c.getContext('2d').drawImage(img, crop.x * scale, crop.y * scale, c.width, c.height, 0, 0, c.width, c.height);
      poster = { dataUrl: c.toDataURL('image/webp', 0.9), width: Math.round(crop.w), height: Math.round(crop.h), cut: !fits };
    } catch (e) { host.style.display = ''; return showPanel(null, e.message); }

    const res = await chrome.runtime.sendMessage({ type: 'section-record-start', crop, seconds }).catch(e => ({ ok: false, error: e.message }));
    host.style.display = '';
    if (!res?.ok) return showPanel(poster, null, el, (globalThis.MB_I18N?.t('Video niet beschikbaar') || 'Video niet beschikbaar') + ': ' + (res?.error || ''));

    // frame just outside the section (so it's not in the video), with a countdown if there's room
    const frame = document.createElement('div');
    frame.className = 'recframe';
    Object.assign(frame.style, { left: crop.x - 5 + 'px', top: crop.y - 5 + 'px', width: crop.w + 10 + 'px', height: crop.h + 10 + 'px' });
    const label = document.createElement('div');
    label.className = 'reclabel';
    const spaceAbove = crop.y > 40, spaceBelow = innerHeight - (crop.y + crop.h) > 40;
    if (spaceAbove) label.style.top = crop.y - 40 + 'px'; else if (spaceBelow) label.style.top = crop.y + crop.h + 12 + 'px'; else label.style.display = 'none'; // no room outside the section: show nothing, otherwise it ends up in the video
    label.style.left = Math.max(8, crop.x) + 'px';
    root.append(frame, label);
    for (let left = seconds; left > 0; left--) {
      label.innerHTML = '<i></i>';
      label.append(`${globalThis.MB_I18N?.t('Opname') || 'Opname'} · ${left}s — ${globalThis.MB_I18N?.t('hover of klik in de sectie, niet scrollen') || 'hover of klik in de sectie, niet scrollen'}`);
      await sleep(1000);
    }
    frame.remove(); label.remove();
    await sleep(700); // let the recorder finish
    showPanel({ ...poster, videoKey: res.key }, null, el);
  }

  function guessType(el) {
    if (!el) return null;
    const s = (el.tagName + ' ' + el.id + ' ' + el.className).toLowerCase();
    if (/footer|contentinfo/.test(s)) return 'Footer';
    if (/\bnav|navbar|menu/.test(s)) return 'Navigatie';
    if (/hero|banner|masthead/.test(s) || el.getBoundingClientRect().top + scrollY < 120) return 'Hero';
    if (/pricing|price|plans/.test(s)) return 'Pricing';
    if (/faq|accordion/.test(s)) return 'FAQ';
    if (/testimonial|review|quote/.test(s)) return 'Testimonials';
    if (/form|contact|newsletter|signup/.test(s)) return 'Formulier';
    if (/feature/.test(s)) return 'Features';
    if (/cta|call-to-action/.test(s)) return 'CTA';
    if (/gallery|galerij|portfolio|work/.test(s)) return 'Galerij';
    return null;
  }

  function discardVideo(shot) {
    if (shot?.videoKey) chrome.runtime.sendMessage({ type: 'nav-record-stop', key: shot.videoKey, discard: true }).catch(() => {});
  }

  function showPanel(shot, error, el, warning) {
    root.querySelector('.panel')?.remove();
    const panel = document.createElement('div');
    panel.className = 'panel';
    let type = guessType(el);
    const anchor = el?.id || el?.closest('[id]')?.id || '';

    if (error) {
      panel.innerHTML = `<h3>Dat lukte niet</h3><p class="err"></p><div class="row"><button class="ghost" data-x>Sluiten</button><button class="primary" data-again>Opnieuw</button></div>`;
      panel.querySelector('.err').textContent = error;
    } else {
      panel.innerHTML = `
        <h3>Favoriete sectie</h3>
        <div class="shot"><img alt=""></div>
        <div class="meta"></div>
        <p class="err" data-warn hidden></p>
        <label>Naam<input data-name data-no-i18n></label>
        <label>Soort sectie<div class="chips"></div></label>
        <p class="err" hidden></p>
        <div class="row"><button class="ghost" data-x>Annuleren</button><button class="ghost" data-again>Opnieuw</button><button class="primary" data-save>Opslaan</button></div>`;
      panel.querySelector('img').src = shot.dataUrl;
      panel.querySelector('.meta').textContent = `${shot.width} × ${shot.height}px` + (shot.videoKey ? (shot.cut ? ' · video van het zichtbare deel' : '') : (shot.cut ? ' · ingekort tot 8 schermen' : ''));
      if (shot.videoKey) {
        const b = document.createElement('span');
        b.className = 'vbadge';
        b.textContent = '● Video ' + seconds + 's';
        panel.querySelector('.shot').append(b);
      }
      if (warning) { const w = panel.querySelector('[data-warn]'); w.hidden = false; w.textContent = warning + ' — de screenshot wordt wel opgeslagen.'; }
      panel.querySelector('[data-name]').value = (document.title || location.hostname).split(/\s[|–—-]\s/)[0].slice(0, 80);
      const chips = panel.querySelector('.chips');
      const draw = () => {
        chips.replaceChildren(...SECTION_TYPES.map(t => {
          const b = document.createElement('button');
          b.className = 'chip' + (t === type ? ' on' : '');
          b.textContent = t;
          b.onclick = () => { type = t; draw(); };
          return b;
        }));
      };
      draw();

      const save = panel.querySelector('[data-save]');
      save.onclick = async () => {
        if (!type) { panel.querySelector('.err').hidden = false; panel.querySelector('.err').textContent = 'Kies het soort sectie'; return; }
        save.disabled = true;
        save.textContent = 'Opslaan…';
        const res = await chrome.runtime.sendMessage({
          type: 'save-section', dataUrl: shot.dataUrl, width: shot.width, height: shot.height, videoKey: shot.videoKey || null,
          url: location.href, anchor, title: panel.querySelector('[data-name]').value.trim(), category: type,
        }).catch(e => ({ ok: false, error: e.message }));
        if (!res?.ok) {
          save.disabled = false; save.textContent = 'Opslaan';
          const err = panel.querySelector('.err'); err.hidden = false; err.textContent = res?.error || 'Opslaan mislukt';
          return;
        }
        panel.innerHTML = `<h3>Opgeslagen ✓</h3><p>Staat nu bij <b></b> in je favoriete secties.</p><div class="row"><button class="ghost" data-x>Sluiten</button><button class="ghost" data-again>Nog een sectie</button><button class="primary" data-board>Bekijk bord</button></div>`;
        panel.querySelector('b').textContent = type;
        shot.videoKey = null; // saved, so don't discard it anymore
        wire();
        setTimeout(() => { if (panel.isConnected && !panel.matches(':hover')) stop(); }, 4000);
      };
    }

    function wire() {
      panel.querySelector('[data-x]')?.addEventListener('click', () => { discardVideo(shot); stop(); });
      panel.querySelector('[data-again]')?.addEventListener('click', () => { discardVideo(shot); start(); });
      panel.querySelector('[data-board]')?.addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'open-board', view: 'section' }); stop(); });
    }
    wire();
    root.append(panel);
  }

  window.__moodboardPicker = { start };
  globalThis.MB_I18N?.loadLang().then(() => globalThis.MB_I18N.observe(root));
  start();
})();
