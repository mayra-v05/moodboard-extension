import * as db from './lib/db.js';
import { getCategories, addCategory, getSettings, setSetting, POPULAR_FONTS, NAV_TYPES } from './lib/constants.js';
import { fetchPreview, normalizeUrl, detectSource, faviconUrl, sameUrl } from './lib/meta.js';
import { icon } from './lib/icons.js';
import { initI18n, t, langButton } from './lib/i18n.js';
import { pageFonts, scanTabStyle, tabCssColors } from './lib/page-scan.js';
import { h, $, toast, debounce, dedupeColors, normHex, textOn, loadFont, fontStack, parseTags, domain } from './lib/ui.js';

const SOURCE_LABEL = { pinterest: 'Pinterest', awwwards: 'Awwwards', dribbble: 'Dribbble', behance: 'Behance', web: 'Website' };
const isWeb = u => /^https?:/i.test(u || '');

let tab = null;
let tabUrl = null;
let preview = null;
let shot = null; // dataURL of the screenshot
let mode = 'auto';
let category = null;
let recSeconds = 8;
let previewSeq = 0;

await initI18n();
init();

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = isWeb(tab?.url) ? tab.url : null;

  $('#boardIcon').innerHTML = icon('external', 14);
  $('#openBoard').before(langButton());
  $('#openBoard').onclick = openBoard;
  $('#doneBoard').onclick = openBoard;
  $('#doneAgain').onclick = () => { $('#done').hidden = true; };
  document.querySelectorAll('.p-tabs button').forEach(b => { b.onclick = () => switchTab(b.dataset.tab); });

  if (!tabUrl) document.querySelectorAll('.needs-page').forEach(b => { b.disabled = true; b.title = 'Werkt alleen op een gewone webpagina'; });

  // Inspiration
  const urlIn = $('#url');
  if (tabUrl) urlIn.value = tabUrl;
  const reload = debounce(() => loadPreview(urlIn.value), 450);
  urlIn.addEventListener('input', reload);
  document.querySelectorAll('#mode button').forEach(b => { b.onclick = () => setMode(b.dataset.mode); });
  document.querySelectorAll('#recSecs button').forEach(b => {
    b.onclick = () => { recSeconds = +b.dataset.s; document.querySelectorAll('#recSecs button').forEach(x => x.classList.toggle('on', x === b)); updateModes(); };
  });
  $('#saveInspo').onclick = saveInspo;

  const { lastCategory } = await getSettings();
  await renderCats(lastCategory);
  const items = await db.allItems();
  $('#projects').replaceChildren(...[...new Set(items.map(i => i.project).filter(Boolean))].map(p => h('option', { value: p })));

  if (tabUrl) loadPreview(tabUrl); else { updateModes(); renderPreview(); }

  // Navigation
  const saved = await chrome.storage.local.get(['navVideo', 'navMobile', 'navMode', 'navSecs', 'navType']);
  let navMode = saved.navMode || 'video';
  let navSecs = [5, 8, 12].includes(saved.navSecs) ? saved.navSecs : 8;
  let navType = saved.navType || null;
  $('#navVideo').checked = saved.navVideo !== false;
  $('#navMobile').checked = !!saved.navMobile;
  $('#navVideo').onchange = e => chrome.storage.local.set({ navVideo: e.target.checked });
  $('#navMobile').onchange = e => chrome.storage.local.set({ navMobile: e.target.checked });
  const drawNav = () => {
    document.querySelectorAll('#navMode button').forEach(b => b.classList.toggle('on', b.dataset.m === navMode));
    document.querySelectorAll('#navSecs button').forEach(b => b.classList.toggle('on', +b.dataset.s === navSecs));
    $('#navVideoOpts').hidden = navMode !== 'video';
    $('#navPhotoOpts').hidden = navMode !== 'photos';
    $('#navModeHint').textContent = navMode === 'video'
      ? `Neemt ${navSecs} sec van dit tabblad op. Klap na het starten het menu open en weer dicht (klik of hover) — de popup sluit vanzelf.`
      : 'Screenshot van het menu dicht én uitgeklapt, stap voor stap op de pagina.';
    $('#captureNav').lastChild.textContent = navMode === 'video' ? ` Opnemen (${navSecs} sec)` : ' Starten';
    $('#navCats').replaceChildren(...NAV_TYPES.map(c => h('button', {
      class: 'chip' + (c === navType ? ' on' : ''),
      onclick: () => { navType = c; chrome.storage.local.set({ navType: c }); drawNav(); },
    }, c)));
  };
  document.querySelectorAll('#navMode button').forEach(b => { b.onclick = () => { navMode = b.dataset.m; chrome.storage.local.set({ navMode }); drawNav(); }; });
  document.querySelectorAll('#navSecs button').forEach(b => { b.onclick = () => { navSecs = +b.dataset.s; chrome.storage.local.set({ navSecs }); drawNav(); }; });
  drawNav();

  $('#captureNav').onclick = async () => {
    const btn = $('#captureNav');
    try {
      if (navMode === 'photos') {
        if ($('#navMobile').checked) await chrome.runtime.sendMessage({ type: 'nav-mobile', url: tab.url });
        else await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/i18n-dict.js', 'content/nav-capture.js'] });
        window.close();
        return;
      }
      // Video: initial screenshot as 'closed', then record X seconds
      if (!navType) { $('#navCats').classList.remove('shake'); void $('#navCats').offsetWidth; $('#navCats').classList.add('shake'); toast('Kies het soort navigatie'); return; }
      btn.disabled = true;
      const shotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 88 });
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      const videoKey = db.uid();
      const item = await db.putItem({
        type: 'nav', url: tab.url, title: 'Navigatie — ' + domain(tab.url), source: detectSource(tab.url), category: navType, project: '',
        closedKey: await db.putMedia(await (await fetch(shotUrl)).blob()), openKey: null, videoKey, pendingRecording: true,
        width: tab.width, height: tab.height, mobile: (tab.width || 1000) <= 500, siteUrl: detectSource(tab.url) === 'web' ? tab.url : null,
      });
      const res = await chrome.runtime.sendMessage({ type: 'start-recording', streamId, itemId: item.id, mediaKey: videoKey, seconds: navSecs });
      if (!res?.ok) { item.pendingRecording = false; item.videoKey = null; await db.putItem(item); throw new Error(res?.error || 'Opname kon niet starten'); }
      showDone('Opname gestart', `De komende ${navSecs} seconden worden opgenomen. Klap het menu nu open en dicht — de popup sluit vanzelf.`);
      setTimeout(() => window.close(), 1500);
    } catch (e) { toast('Kan hier geen navigatie opnemen: ' + e.message); }
    finally { btn.disabled = false; }
  };

  // Section: screenshot or recording
  const secSaved = await chrome.storage.local.get(['sectionMode', 'sectionSecs']);
  let secMode = secSaved.sectionMode === 'video' ? 'video' : 'shot';
  let secSecs = [5, 8, 12].includes(secSaved.sectionSecs) ? secSaved.sectionSecs : 8;
  const drawSec = () => {
    document.querySelectorAll('#secMode button').forEach(b => b.classList.toggle('on', b.dataset.m === secMode));
    document.querySelectorAll('#secSecs button').forEach(b => b.classList.toggle('on', +b.dataset.s === secSecs));
    $('#secSecsField').hidden = secMode !== 'video';
    const pick = $('#pickSection');
    if (secMode === 'video') pick.replaceChildren(h('i', { class: 'rec-dot' }), ` Sectie kiezen en opnemen (${secSecs} sec)`);
    else pick.textContent = 'Sectie selecteren op de pagina';
    $('#secModeHint').textContent = secMode === 'video'
      ? `Neemt ${secSecs} sec van alleen de gekozen sectie op. Hover of klik erin om animaties te laten zien, en scroll niet tijdens de opname.`
      : 'Screenshot van de sectie, ook als die langer is dan je scherm.';
  };
  document.querySelectorAll('#secMode button').forEach(b => { b.onclick = () => { secMode = b.dataset.m; chrome.storage.local.set({ sectionMode: secMode }); drawSec(); }; });
  document.querySelectorAll('#secSecs button').forEach(b => { b.onclick = () => { secSecs = +b.dataset.s; chrome.storage.local.set({ sectionSecs: secSecs }); drawSec(); }; });
  drawSec();

  // Section
  $('#pickSection').onclick = async () => {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/i18n-dict.js', 'content/section-picker.js'] });
      window.close();
    } catch (e) { toast('Kan hier geen sectie selecteren: ' + e.message); }
  };

  // Colors
  $('#extractColors').onclick = extractColors;
  $('#addHex').onclick = addManualColor;
  $('#pick').oninput = e => { $('#hex').value = e.target.value; };
  $('#hex').addEventListener('keydown', e => { if (e.key === 'Enter') addManualColor(); });
  $('#savePalette').onclick = savePalette;
  renderSwatches();

  // Fonts
  $('#popularFonts').replaceChildren(...POPULAR_FONTS.map(f => h('option', { value: f })));
  $('#detectFonts').onclick = detectFonts;
  $('#addFont').onclick = addManualFont;
  $('#fontName').addEventListener('keydown', e => { if (e.key === 'Enter') addManualFont(); });
  $('#saveFonts').onclick = saveFonts;
  renderFonts();
}

let fontsDetected = false;
function switchTab(id) {
  if (id === 'fonts' && tabUrl && !fontsDetected) { fontsDetected = true; detectFonts(); }
  document.querySelectorAll('.p-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'tab-' + id));
  $('#done').hidden = true;
}

function openBoard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('board.html') });
  window.close();
}

function showDone(title, text) {
  $('#doneTitle').textContent = title;
  $('#doneText').textContent = text || '';
  $('.done-icon').innerHTML = icon('check', 28);
  $('#done').hidden = false;
}

// ---------- Inspiration ----------
async function renderCats(selected) {
  const cats = await getCategories();
  if (selected && cats.includes(selected)) category = selected;
  const wrap = $('#cats');
  wrap.replaceChildren(
    ...cats.map(c => h('button', {
      class: 'chip' + (c === category ? ' on' : ''),
      onclick: () => { category = c; renderCats(); },
    }, c)),
    h('button', {
      class: 'chip add',
      onclick: async () => {
        const name = prompt(t('Naam van de nieuwe categorie'));
        const c = await addCategory(name);
        if (c) { category = c; renderCats(); }
      },
    }, '+ Nieuw'),
  );
}

const onCurrentTab = () => tabUrl && sameUrl($('#url').value, tabUrl);

function updateModes() {
  const onTab = onCurrentTab();
  document.querySelectorAll('#mode button').forEach(b => {
    b.disabled = b.dataset.mode !== 'auto' && !onTab;
    b.classList.toggle('on', b.dataset.mode === mode);
  });
  if (!onTab && mode !== 'auto') setMode('auto');
  const hints = {
    auto: preview?.video || preview?.gif
      ? 'Bewegende preview gevonden — wordt afgespeeld op je bord.'
      : preview && !preview.image ? 'Geen afbeelding gevonden: je bord toont een live preview van de site.' : 'Gebruikt de afbeelding of video van de link.',
    shot: 'Screenshot van het zichtbare deel van dit tabblad.',
    rec: `Neemt ${recSeconds} sec van dit tabblad op, zodat animaties bewaard blijven. Scroll of hover na het starten over de pagina.`,
  };
  $('#modeHint').textContent = onTab ? hints[mode] : (mode === 'auto' ? hints.auto : '') + (tabUrl ? '' : '');
  $('#recOpts').hidden = mode !== 'rec';
  setSaveLabel();
}

// In recording mode the big button is a record button: one click and the recording starts.
function setSaveLabel(text) {
  const btn = $('#saveInspo');
  if (text) { btn.textContent = text; return; }
  if (mode === 'rec') btn.replaceChildren(h('i', { class: 'rec-dot' }), ` Opnemen (${recSeconds} sec)`);
  else btn.textContent = 'Opslaan';
}

async function setMode(m) {
  mode = m;
  if (m === 'shot' && !shot) {
    try { shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 88 }); }
    catch (e) { toast('Screenshot mislukt: ' + e.message); }
  }
  updateModes();
  renderPreview();
}

async function loadPreview(raw) {
  const seq = ++previewSeq;
  const url = normalizeUrl(raw);
  preview = null;
  updateModes();
  if (!url || !isWeb(url)) { renderPreview(); return; }
  renderPreview(true);
  let p = null;
  const source = detectSource(url);
  try { p = await fetchPreview(url); } catch (e) { console.warn(e); }
  // On the current tab: fall back to the real (logged-in, rendered) HTML.
  if (onCurrentTab() && (!p || (!p.image && !p.video && !p.gif))) {
    try {
      const [{ result: html }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.documentElement.outerHTML });
      const fromTab = await fetchPreview(url, html);
      p = { ...fromTab, ...Object.fromEntries(Object.entries(p || {}).filter(([, v]) => v)) };
    } catch (e) { console.warn(e); }
  }
  if (seq !== previewSeq) return;
  preview = p || { url, title: tab?.title || domain(url), source };
  if (onCurrentTab() && preview.source === 'web' && mode === 'auto') { await setMode('shot'); return; }
  updateModes();
  renderPreview();
}

function renderPreview(loading = false) {
  const box = $('#preview');
  box.className = 'p-preview' + (loading ? ' loading' : '');
  box.replaceChildren();
  if (loading) { box.append(h('div', { class: 'ph' }, h('span', { class: 'spinner' }), 'Preview ophalen…')); return; }
  if (!preview) { box.append(h('div', { class: 'ph' }, 'Plak een link om een preview te zien')); return; }

  const media = h('div', { class: 'p-media' });
  if (mode === 'shot' && shot) media.append(h('img', { src: shot, alt: '' }));
  else if (mode === 'rec') media.append(shot ? h('img', { src: shot, alt: '' }) : h('div', { class: 'ph' }), h('span', { class: 'badge rec' }, h('i'), `Opname ${recSeconds}s`));
  else if (preview.video) { const v = h('video', { src: preview.video, autoplay: true, loop: true, playsInline: true }); v.muted = true; media.append(v, h('span', { class: 'badge moving' }, h('i'), 'Beweegt')); }
  else if (preview.gif || preview.image) {
    media.append(h('img', { src: preview.gif || preview.image, alt: '' }));
    if (preview.gif) media.append(h('span', { class: 'badge moving' }, h('i'), 'GIF'));
  } else media.append(h('div', { class: 'ph' }, h('span', { html: icon('live', 22) }), 'Live preview op je bord'));

  box.append(media, h('div', { class: 'p-cap' },
    h('img', { class: 'fav', src: faviconUrl(preview.url), alt: '' }),
    h('span', { class: 'title', 'data-no-i18n': true }, preview.title || domain(preview.url)),
    h('span', { class: 'src' }, SOURCE_LABEL[preview.source] || ''),
  ));
}

async function saveInspo() {
  const btn = $('#saveInspo');
  const rawUrl = $('#url').value.trim();
  if (!rawUrl) { toast('Plak eerst een link'); return; }
  if (!category) { $('#cats').classList.remove('shake'); void $('#cats').offsetWidth; $('#cats').classList.add('shake'); toast('Kies een categorie'); return; }

  btn.disabled = true;
  setSaveLabel(mode === 'rec' ? 'Opname starten…' : 'Opslaan…');
  let item = null;
  try {
    const url = normalizeUrl(rawUrl);
    const p = preview || { url, title: url, source: detectSource(url) };
    item = {
      type: 'inspo', url: p.url || url, title: p.title || tab?.title || url, description: p.description || '',
      source: p.source || 'web', image: p.image || null, gif: p.gif || null, video: p.video || null, siteUrl: p.siteUrl || null, sourceLink: p.sourceLink || null,
      category, project: $('#project').value.trim(),
    };

    if (mode === 'shot' || mode === 'rec') {
      const data = shot || await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 88 });
      const key = await db.putMedia(await (await fetch(data)).blob());
      if (mode === 'shot') { item.mediaKey = key; item.mediaType = 'image'; } else item.posterKey = key;
      if (tab?.title) item.title = tab.title;
    }

    setSetting('lastCategory', category);
    if (onCurrentTab()) item.style = await scanTabStyle(tab.id);

    if (mode === 'rec') {
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      item.pendingRecording = true;
      await db.putItem(item);
      const res = await chrome.runtime.sendMessage({ type: 'start-recording', streamId, itemId: item.id, seconds: recSeconds });
      if (!res?.ok) throw new Error(res?.error || 'Opname kon niet starten');
      showDone('Opname gestart', `De komende ${recSeconds} seconden worden opgenomen. Scroll of hover nu over de pagina — de popup sluit vanzelf.`);
      setTimeout(() => window.close(), 1800);
      return;
    }

    await db.putItem(item);
    showDone('Opgeslagen', `Toegevoegd aan “${category}”.`);
  } catch (e) {
    console.error(e);
    if (item?.pendingRecording) { item.pendingRecording = false; await db.putItem(item); }
    toast('Er ging iets mis: ' + e.message);
  } finally {
    btn.disabled = false;
    setSaveLabel();
  }
}

// ---------- Colors ----------
let swatches = []; // { hex, on }


async function extractColors() {
  const btn = $('#extractColors');
  btn.disabled = true;
  $('#swatches').replaceChildren(h('div', { class: 'ph small' }, h('span', { class: 'spinner' }), 'Kleuren uit de CSS van de website halen…'));
  try {
    const ranked = await tabCssColors(tab.id, 16);
    const existing = new Set(swatches.map(s => s.hex));
    swatches = [...swatches, ...ranked.filter(r => !existing.has(r.hex)).map((r, i) => ({ hex: r.hex, vars: r.vars, on: i < 8 }))];
    if (!$('#palName').value && tabUrl) $('#palName').value = domain(tabUrl);
    if (!ranked.length) toast('Geen kleuren gevonden in de CSS');
  } catch (e) { toast('Kon geen kleuren lezen: ' + e.message); }
  finally { btn.disabled = false; renderSwatches(); }
}

function addManualColor() {
  const hex = normHex($('#hex').value || $('#pick').value);
  if (!hex) { toast('Ongeldige hex-code'); return; }
  if (!swatches.some(s => s.hex === hex)) swatches.push({ hex, on: true });
  $('#hex').value = '';
  renderSwatches();
}

function renderSwatches() {
  const wrap = $('#swatches');
  if (!swatches.length) { wrap.replaceChildren(h('div', { class: 'ph small' }, 'Nog geen kleuren')); return; }
  wrap.replaceChildren(...swatches.map(s => h('button', {
    class: 'p-sw' + (s.on ? ' on' : ''),
    style: `background:${s.hex};color:${textOn(s.hex)}`,
    title: s.vars?.length ? `${s.hex} · ${s.vars.join(', ')}` : s.hex,
    onclick: () => { s.on = !s.on; renderSwatches(); },
  }, h('span', {}, s.hex.toUpperCase()))));
}

async function savePalette() {
  const colors = swatches.filter(s => s.on).map(s => s.hex);
  if (!colors.length) { toast('Selecteer minimaal één kleur'); return; }
  await db.putItem({ type: 'palette', name: $('#palName').value.trim() || 'Palet', colors, sourceUrl: tabUrl, project: '' });
  swatches = [];
  renderSwatches();
  showDone('Palet opgeslagen', `${colors.length} kleuren bewaard.`);
}

// ---------- Fonts ----------
let fonts = []; // { family, roles, weights, on, google }


async function detectFonts() {
  $('#fontList').replaceChildren(h('li', { class: 'ph small' }, h('span', { class: 'spinner' }), 'Lettertypes zoeken…'));
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageFonts });
    let picked = 0;
    fonts = result.slice(0, 8).map(f => ({ ...f, on: f.source !== 'system' && picked++ < 2 }));
    if (!picked && fonts[0]) fonts[0].on = true;
    renderFonts();
  } catch (e) { toast('Kon geen lettertypes lezen: ' + e.message); }
}

function addManualFont() {
  const family = $('#fontName').value.trim();
  if (!family) return;
  if (!fonts.some(f => f.family.toLowerCase() === family.toLowerCase())) fonts.push({ family, roles: [], weights: [], on: true, google: true });
  $('#fontName').value = '';
  renderFonts();
}

function renderFonts() {
  const list = $('#fontList');
  if (!fonts.length) list.replaceChildren(h('li', { class: 'ph small' }, 'Nog geen lettertypes'));
  else list.replaceChildren(...fonts.map(f => {
    loadFont(f.family);
    return h('li', { class: f.on ? 'on' : '' },
      h('label', {},
        h('input', { type: 'checkbox', checked: f.on, onchange: e => { f.on = e.target.checked; renderFonts(); } }),
        h('span', { class: 'f-name', style: `font-family:${fontStack(f.family)}` }, f.family),
        h('span', { class: 'f-meta', title: f.file || '' }, [{ google: 'Google Font', webfont: 'Webfont', local: 'Lokaal geïnstalleerd', system: 'Systeemfont' }[f.source] || (f.google ? 'Google Font' : ''), (f.roles || []).join(' · '), (f.weights || []).join('/')].filter(Boolean).join(' — ')),
      ),
    );
  }));
  const selected = fonts.filter(f => f.on);
  $('#comboWrap').hidden = selected.length !== 2;
}

async function saveFonts() {
  const selected = fonts.filter(f => f.on);
  if (!selected.length) { toast('Selecteer minimaal één lettertype'); return; }
  const base = { type: 'font', sourceUrl: tabUrl, project: '', sample: '' };
  if (selected.length === 2 && $('#combo').checked) {
    const [a, b] = selected;
    const heading = b.roles.includes('Heading') && !a.roles.includes('Heading') ? b : a;
    const body = heading === a ? b : a;
    await db.putItem({ ...base, heading: heading.family, body: body.family, weights: [...new Set([...heading.weights, ...body.weights])] });
  } else {
    for (const f of selected) await db.putItem({ ...base, heading: f.family, body: null, role: (f.roles || []).join(', '), weights: f.weights || [] });
  }
  fonts = fonts.filter(f => !f.on);
  renderFonts();
  showDone('Lettertypes opgeslagen', selected.map(f => f.family).join(' + '));
}
