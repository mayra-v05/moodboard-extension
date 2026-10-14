import { putItem, putMedia, deleteMedia, uid } from './lib/db.js';
import { fetchPreview, detectSource } from './lib/meta.js';
import { getCategories } from './lib/constants.js';
import './lib/i18n-dict.js';
import { scanTabStyle } from './lib/page-scan.js';
import { dedupeColors } from './lib/ui.js';

const t = s => globalThis.MB_I18N.t(s);

const CONTEXTS = ['page', 'link', 'image', 'video'];

async function buildMenus() {
  await globalThis.MB_I18N.loadLang();
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'section', title: t('Sectie vastleggen…'), contexts: ['page', 'image', 'link', 'video'] });
  chrome.contextMenus.create({ id: 'nav', title: t('Navigatie vastleggen (dicht → open)…'), contexts: ['page', 'image', 'link', 'video'] });
  chrome.contextMenus.create({ id: 'root', title: t('Opslaan op Moodboard'), contexts: CONTEXTS });
  for (const c of await getCategories()) {
    chrome.contextMenus.create({ id: 'cat:' + c, parentId: 'root', title: t(c), contexts: CONTEXTS });
  }
  chrome.contextMenus.create({ id: 'copy', title: t('Opslaan als microcopy: “%s”'), contexts: ['selection'] });
}

chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);
chrome.storage.onChanged.addListener(changes => { if (changes.customCategories || changes.lang) buildMenus(); });

function badge(text, color = '#16151a', clearAfter = 0) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  if (clearAfter) setTimeout(() => chrome.action.setBadgeText({ text: '' }), clearAfter);
}

const fromPreview = p => ({
  url: p.url, title: p.title, description: p.description || '', source: p.source,
  image: p.image || null, gif: p.gif || null, video: p.video || null, siteUrl: p.siteUrl || null, sourceLink: p.sourceLink || null,
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'section') return pickSection(tab);
    if (info.menuItemId === 'nav') return captureNav(tab);
    badge('…');
    if (info.menuItemId === 'copy') {
      await putItem({ type: 'copy', text: info.selectionText, context: 'Overig', sourceUrl: info.pageUrl, project: '' });
      return badge('✓', '#2f9e44', 1500);
    }
    const category = String(info.menuItemId).replace(/^cat:/, '');
    const base = { type: 'inspo', category, tags: [], note: '', project: '' };
    let item;

    if (info.mediaType === 'image' && info.srcUrl && !info.srcUrl.startsWith('data:')) {
      const gif = /\.gif(\?|$)/i.test(info.srcUrl);
      item = { ...base, url: info.pageUrl, title: tab?.title || '', source: detectSource(info.pageUrl), image: gif ? null : info.srcUrl, gif: gif ? info.srcUrl : null };
    } else if (info.mediaType === 'video' && info.srcUrl && /^https?:/.test(info.srcUrl)) {
      item = { ...base, url: info.pageUrl, title: tab?.title || '', source: detectSource(info.pageUrl), video: info.srcUrl };
    } else if (info.linkUrl) {
      const p = await fetchPreview(info.linkUrl).catch(() => ({ url: info.linkUrl, title: info.linkUrl, source: detectSource(info.linkUrl) }));
      item = { ...base, ...fromPreview(p) };
    } else {
      const p = await fetchPreview(info.pageUrl).catch(() => ({ url: info.pageUrl, source: detectSource(info.pageUrl) }));
      item = { ...base, ...fromPreview(p), title: tab?.title || p.title || info.pageUrl };
      item.style = await scanTabStyle(tab.id);
      // For regular websites, a screenshot of what you see is more useful than the og:image.
      if (item.source === 'web' || (!item.image && !item.video && !item.gif)) {
        try {
          const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 88 });
          item.mediaKey = await putMedia(await (await fetch(shot)).blob());
          item.mediaType = 'image';
        } catch (e) { console.warn('Screenshot mislukt', e); }
      }
    }
    await putItem(item);
    badge('✓', '#2f9e44', 1500);
  } catch (e) {
    console.error(e);
    badge('!', '#e5484d', 2500);
  }
});

// --- Recording a tab (via offscreen document) ---
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Korte video-opname van een tabblad om animaties te bewaren op het moodboard.',
  });
}

// --- Favorite sections ---
async function pickSection(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url || '')) return badge('!', '#e5484d', 2000);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/i18n-dict.js', 'content/section-picker.js'] });
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'pick-section') pickSection(tab);
  if (command === 'capture-nav') captureNav(tab);
});

// --- Navigations (closed → open) ---
async function captureNav(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url || '')) return badge('!', '#e5484d', 2000);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/i18n-dict.js', 'content/nav-capture.js'] });
}

const discardKeys = new Set();

async function startTabRecording(tab, { seconds = 25, crop = null } = {}) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  await ensureOffscreen();
  const key = uid();
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'record', streamId, mediaKey: key, seconds, crop });
  if (!res?.ok) throw new Error(res?.error || 'Opname kon niet starten');
  badge('REC', '#e5484d');
  return key;
}

const dataUrlToBlob = async url => (await fetch(url)).blob();

async function saveNav(msg) {
  const source = detectSource(msg.url);
  return putItem({
    type: 'nav', url: msg.url, title: msg.title || '', source, category: msg.category, project: '',
    closedKey: await putMedia(await dataUrlToBlob(msg.closed)),
    openKey: await putMedia(await dataUrlToBlob(msg.open)),
    videoKey: msg.videoKey || null, mobile: !!msg.mobile, width: msg.width, height: msg.height,
    siteUrl: source === 'web' ? msg.url : null,
  });
}

// Opens the page in a phone-sized window, where hamburger menus appear.
async function openMobileNav(url) {
  const win = await chrome.windows.create({ url, type: 'popup', width: 390, height: 844 + 70, focused: true });
  const tabId = win.tabs[0].id;
  await new Promise(resolve => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listener); resolve(); };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(done, 15000);
  });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/i18n-dict.js', 'content/nav-capture.js'] });
}

async function saveSection(msg, tab) {
  const blob = await (await fetch(msg.dataUrl)).blob();
  const video = msg.videoKey ? { mediaKey: msg.videoKey, mediaType: 'video', posterKey: await putMedia(blob), recording: true } : null;
  const source = detectSource(msg.url);
  const page = msg.url.split('#')[0];
  const style = tab?.id ? await scanTabStyle(tab.id) : null;
  return putItem({
    type: 'section', style, url: msg.url, title: msg.title || tab?.title || '', source, category: msg.category,
    note: msg.note || '', tags: [], project: '', width: msg.width, height: msg.height,
    ...(video || { mediaKey: await putMedia(blob), mediaType: 'image' }),
    siteUrl: source === 'web' ? (msg.anchor ? `${page}#${msg.anchor}` : page) : null,
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'capture-visible') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then(dataUrl => sendResponse({ ok: true, dataUrl }), e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'save-section') {
    saveSection(msg, sender.tab).then(() => { badge('✓', '#2f9e44', 1500); sendResponse({ ok: true }); }, e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'nav-record-start') {
    startTabRecording(sender.tab).then(key => sendResponse({ ok: true, key }), e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'section-record-start') {
    startTabRecording(sender.tab, { seconds: msg.seconds, crop: msg.crop }).then(key => sendResponse({ ok: true, key }), e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'nav-record-stop') {
    if (msg.discard) discardKeys.add(msg.key);
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop', key: msg.key })
      .then(r => { if (msg.discard && !r?.ok) { discardKeys.delete(msg.key); deleteMedia(msg.key); } }) // recording was already finished
      .catch(() => { if (msg.discard) { discardKeys.delete(msg.key); deleteMedia(msg.key); } });
    return;
  }
  if (msg.type === 'save-nav') {
    saveNav(msg).then(() => { badge('✓', '#2f9e44', 1500); sendResponse({ ok: true }); }, e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'nav-mobile') {
    openMobileNav(msg.url).catch(e => console.error(e));
    return;
  }
  if (msg.type === 'open-board') {
    chrome.tabs.create({ url: chrome.runtime.getURL('board.html' + (msg.view ? '#' + msg.view : '')) });
    return;
  }
  if (msg.type === 'start-recording') {
    (async () => {
      await ensureOffscreen();
      badge('REC', '#e5484d');
      const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'record', streamId: msg.streamId, itemId: msg.itemId, mediaKey: msg.mediaKey, seconds: msg.seconds });
      if (!res?.ok) throw new Error(res?.error || 'Opname kon niet starten');
    })().then(() => sendResponse({ ok: true }), e => { badge('!', '#e5484d', 2500); sendResponse({ ok: false, error: e.message }); });
    return true;
  }
  if (msg.type === 'recording-done' && msg.key && discardKeys.has(msg.key)) {
    discardKeys.delete(msg.key);
    deleteMedia(msg.key);
  }
  if (msg.type === 'recording-done') {
    badge(msg.ok ? '✓' : '!', msg.ok ? '#2f9e44' : '#e5484d', 2000);
  }
});

// Clean up the "allow in iframe" rule of a closed board tab.
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});
});
