export const TYPES = [
  { id: 'inspo', label: 'Inspiratie', icon: 'grid' },
  { id: 'section', label: 'Secties', icon: 'crop' },
  { id: 'nav', label: 'Navigaties', icon: 'menu' },
  { id: 'palette', label: 'Kleuren', icon: 'palette' },
  { id: 'font', label: 'Typografie', icon: 'type' },
  { id: 'gradient', label: 'Gradients', icon: 'gradient' },
  { id: 'copy', label: 'Microcopy', icon: 'quote' },
];

export const DEFAULT_CATEGORIES = ['Hero', 'Sectie', 'Footer', 'Animatie', 'Mooi design'];

// Keep in sync with SECTION_TYPES in content/section-picker.js
export const SECTION_TYPES = [
  'Hero', 'Navigatie', 'Features', 'Cards', 'Pricing', 'Testimonials', 'CTA', 'FAQ',
  'Formulier', 'Footer', 'Galerij', 'Team', 'Stats', 'Logo wall', 'Blog / content', 'Overig',
];

export const COPY_CONTEXTS = [
  'Call-to-action', 'Foutmelding', 'Empty state', 'Onboarding', 'Bevestiging',
  'Tooltip / hint', 'Formulierlabel', 'Notificatie', '404', 'Headline', 'Overig',
];

// Keep in sync with NAV_TYPES in content/nav-capture.js
export const NAV_TYPES = ['Dropdown', 'Mega menu', 'Hamburger / mobiel', 'Fullscreen menu', 'Sidebar', 'Tab bar', 'Overig'];

export const POPULAR_FONTS = [
  'Inter', 'Instrument Sans', 'Instrument Serif', 'DM Sans', 'DM Serif Display', 'Manrope',
  'Space Grotesk', 'Space Mono', 'Syne', 'Sora', 'Plus Jakarta Sans', 'Outfit', 'Poppins',
  'Montserrat', 'Playfair Display', 'Fraunces', 'Cormorant Garamond', 'Libre Baskerville', 'Lora',
  'Bricolage Grotesque', 'Unbounded', 'Archivo', 'Work Sans', 'IBM Plex Sans', 'IBM Plex Mono',
  'JetBrains Mono', 'Epilogue', 'Familjen Grotesk', 'Hanken Grotesk', 'Onest', 'Geist', 'Figtree',
  'Urbanist', 'Red Hat Display', 'Bebas Neue', 'Anton', 'Oswald', 'Raleway', 'Nunito', 'Rubik',
  'Big Shoulders Display', 'Newsreader', 'Young Serif', 'Gloock', 'Schibsted Grotesk', 'Lexend',
];

const DEFAULTS = { customCategories: [], liveMode: false, lastCategory: null };

export const getSettings = () => chrome.storage.local.get(DEFAULTS);
export const setSetting = (key, value) => chrome.storage.local.set({ [key]: value });

export async function getCategories() {
  const { customCategories } = await getSettings();
  return [...DEFAULT_CATEGORIES, ...customCategories.filter(c => !DEFAULT_CATEGORIES.includes(c))];
}

export async function addCategory(name) {
  name = (name || '').trim();
  if (!name) return null;
  const { customCategories } = await getSettings();
  if (!customCategories.includes(name) && !DEFAULT_CATEGORIES.includes(name)) {
    await setSetting('customCategories', [...customCategories, name]);
  }
  return name;
}
