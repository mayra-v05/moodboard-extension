import './i18n-dict.js';
import { h } from './ui.js';

export const i18n = globalThis.MB_I18N;
export const t = s => i18n.t(s);
export const dateLocale = () => (i18n.lang === 'en' ? 'en-GB' : 'nl-NL');

// Loads the chosen language and translates the page (including everything that appears dynamically later).
export async function initI18n() {
  await i18n.loadLang();
  document.documentElement.lang = i18n.lang;
  document.title = t(document.title);
  i18n.observe(document.body);
  return i18n.lang;
}

export function langButton(cls = 'btn ghost small') {
  const other = i18n.lang === 'en' ? 'nl' : 'en';
  return h('button', {
    class: cls + ' lang-btn', 'data-no-i18n': true,
    title: other === 'en' ? 'Switch to English' : 'Wissel naar Nederlands',
    onclick: async () => { await chrome.storage.local.set({ lang: other }); location.reload(); },
  }, other.toUpperCase());
}
