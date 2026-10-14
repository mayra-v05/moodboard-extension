// Builds a prompt to have an AI tool recreate a saved example
// (Claude, v0, Lovable, Cursor, …). Everything comes from the item's data; nothing is sent to a server.

export const STACKS = {
  html: { nl: 'HTML + CSS (zonder framework)', en: 'HTML + CSS (no framework)' },
  react: { nl: 'React + Tailwind CSS', en: 'React + Tailwind CSS' },
  next: { nl: 'Next.js (App Router) + Tailwind CSS', en: 'Next.js (App Router) + Tailwind CSS' },
  vue: { nl: 'Vue 3 + CSS', en: 'Vue 3 + CSS' },
  webflow: { nl: 'Webflow (beschrijf de structuur, classes en interacties)', en: 'Webflow (describe the structure, classes and interactions)' },
};

// What a good example of this kind of component contains
const GUIDE = {
  Hero: { nl: 'een sterke kop, korte ondersteunende tekst, een primaire en secundaire call-to-action en een visual', en: 'a strong headline, short supporting copy, a primary and secondary call-to-action and a visual' },
  Navigatie: { nl: 'logo, hoofdlinks, een duidelijke call-to-action en een mobiele variant met menuknop', en: 'logo, main links, a clear call-to-action and a mobile variant with a menu button' },
  Footer: { nl: 'kolommen met links, eventueel een nieuwsbriefveld, social links en copyright', en: 'link columns, optionally a newsletter field, social links and copyright' },
  Formulier: { nl: 'duidelijke labels boven de velden, foutmeldingen bij het veld, een opvallende verzendknop', en: 'clear labels above fields, inline error messages, a prominent submit button' },
  Pricing: { nl: 'prijskaarten met het aanbevolen plan uitgelicht, feature-lijsten en een call-to-action per plan', en: 'pricing cards with the recommended plan highlighted, feature lists and a call-to-action per plan' },
  Cards: { nl: 'een consistente kaartopbouw (beeld, titel, tekst, actie) in een responsive grid', en: 'a consistent card structure (image, title, text, action) in a responsive grid' },
  Features: { nl: 'features met icoon, korte titel en uitleg, in een rustig grid', en: 'features with icon, short title and explanation, in a calm grid' },
  Testimonials: { nl: 'quotes met naam, functie en foto, eventueel als slider', en: 'quotes with name, role and photo, optionally as a slider' },
  CTA: { nl: 'één duidelijke boodschap met één primaire actie', en: 'one clear message with one primary action' },
  FAQ: { nl: 'een accordion met vragen die open- en dichtklappen', en: 'an accordion with questions that expand and collapse' },
  Dashboard: { nl: 'een heldere layout met navigatie, kerncijfers en data-visualisaties', en: 'a clear layout with navigation, key metrics and data visualisations' },
  Galerij: { nl: 'een beeldgrid met consistente verhoudingen en een hover-state', en: 'an image grid with consistent ratios and a hover state' },
  'Empty state': { nl: 'een illustratie, korte uitleg en één actie om verder te gaan', en: 'an illustration, short explanation and one action to continue' },
  Onboarding: { nl: 'stappen met voortgangsindicator en een duidelijke volgende actie', en: 'steps with a progress indicator and a clear next action' },
};

const NAV_BEHAVIOUR = {
  Dropdown: { nl: 'Submenu’s klappen uit onder het hoofditem bij hover (desktop) en klik/tap (touch).', en: 'Submenus expand below the main item on hover (desktop) and click/tap (touch).' },
  'Mega menu': { nl: 'Een breed paneel over de volle breedte met meerdere kolommen, uitgelichte items en eventueel beeld.', en: 'A wide full-width panel with multiple columns, featured items and optionally imagery.' },
  'Hamburger / mobiel': { nl: 'Een menuknop (hamburger) die het menu opent; het icoon animeert naar een sluitkruis.', en: 'A menu (hamburger) button that opens the menu; the icon animates into a close icon.' },
  'Fullscreen menu': { nl: 'Het menu bedekt het hele scherm met grote links; de pagina eronder scrollt niet mee.', en: 'The menu covers the full screen with large links; the page underneath does not scroll.' },
  Sidebar: { nl: 'Een zijpaneel dat vanaf de zijkant inschuift, met een overlay over de pagina.', en: 'A side panel that slides in from the edge, with an overlay over the page.' },
  'Tab bar': { nl: 'Een vaste balk met iconen en labels; het actieve item is duidelijk gemarkeerd.', en: 'A fixed bar with icons and labels; the active item is clearly marked.' },
};

const T = {
  nl: {
    build: (what, cat) => `Bouw ${what}${cat ? ` (${cat})` : ''} geïnspireerd op het bijgevoegde voorbeeld.`,
    section: 'een websitesectie', inspo: 'een webpagina-onderdeel', nav: 'een navigatie',
    source: 'Bron', reference: 'Referentie', refShot: 'Ik voeg een screenshot van het voorbeeld toe; houd de opbouw, verhoudingen en sfeer daarvan aan.',
    refVideo: 'Ik voeg een video toe die laat zien hoe het beweegt; neem die animaties en timing over.',
    refNav: 'Ik voeg screenshots van de dichte en de open toestand toe (en eventueel een video van het openklappen).',
    contains: 'Zorg dat het bevat:', style: 'Stijl', colors: 'Kleurenpalet (op volgorde van gebruik)', fonts: 'Lettertypes',
    google: 'Google Font', motion: 'Beweging',
    motionText: 'Het voorbeeld is geanimeerd. Gebruik vloeiende transities (ease-out, 200–600 ms) en respecteer prefers-reduced-motion.',
    navStates: 'Toestanden', closed: 'Dicht: compacte balk met logo, hoofdlinks en call-to-action.', open: 'Open:',
    navA11y: 'Toegankelijkheid: gebruik een <button> met aria-expanded en aria-controls, sluit met Esc, focus blijft in het open menu (focus trap bij fullscreen/sidebar) en alles werkt met het toetsenbord.',
    tech: 'Technisch', stack: 'Stack',
    techList: ['Semantische HTML en een mobile-first, responsive layout (breakpoints rond 768 en 1024 px).',
      'Toegankelijk volgens WCAG 2.2 AA: voldoende contrast, zichtbare focus-states, alt-teksten.',
      'Zet kleuren en lettertypes in CSS-variabelen / design tokens.',
      'Gebruik placeholder-tekst en -beelden; neem geen merknamen of content letterlijk over.'],
    gradientIntro: 'Maak deze gradient na en gebruik hem als achtergrond.', gradientUse: 'Lever ook een variant voor gradient-tekst en een knop met deze gradient.',
    size: 'Afmeting van het voorbeeld',
  },
  en: {
    build: (what, cat) => `Build ${what}${cat ? ` (${cat})` : ''} inspired by the attached example.`,
    section: 'a website section', inspo: 'a web page component', nav: 'a navigation',
    source: 'Source', reference: 'Reference', refShot: 'I’m attaching a screenshot of the example; follow its structure, proportions and mood.',
    refVideo: 'I’m attaching a video that shows how it moves; recreate those animations and timing.',
    refNav: 'I’m attaching screenshots of the closed and the open state (and possibly a video of it opening).',
    contains: 'Make sure it includes:', style: 'Style', colors: 'Color palette (in order of use)', fonts: 'Fonts',
    google: 'Google Font', motion: 'Motion',
    motionText: 'The example is animated. Use smooth transitions (ease-out, 200–600 ms) and respect prefers-reduced-motion.',
    navStates: 'States', closed: 'Closed: compact bar with logo, main links and call-to-action.', open: 'Open:',
    navA11y: 'Accessibility: use a <button> with aria-expanded and aria-controls, close with Esc, keep focus inside the open menu (focus trap for fullscreen/sidebar) and make everything keyboard operable.',
    tech: 'Technical', stack: 'Stack',
    techList: ['Semantic HTML and a mobile-first, responsive layout (breakpoints around 768 and 1024 px).',
      'Accessible to WCAG 2.2 AA: sufficient contrast, visible focus states, alt text.',
      'Put colors and fonts in CSS variables / design tokens.',
      'Use placeholder copy and images; don’t copy brand names or content literally.'],
    gradientIntro: 'Recreate this gradient and use it as a background.', gradientUse: 'Also provide a gradient-text variant and a button using this gradient.',
    size: 'Size of the example',
  },
};

const tr = (map, lang) => (map ? map[lang] || map.nl : null);

export function buildPrompt(it, { stack = 'react', lang = 'nl', catLabel = c => c } = {}) {
  const t = T[lang] || T.nl;
  const out = [];
  const stackLine = `${t.stack}: ${tr(STACKS[stack], lang)}.`;

  if (it.type === 'gradient') {
    out.push(t.gradientIntro, '', '```css', `background: ${it.css};`, '```', '', t.gradientUse, '', stackLine);
    return out.join('\n');
  }

  const cat = it.category ? catLabel(it.category) : '';
  const what = it.type === 'nav' ? t.nav : it.type === 'section' ? t.section : t.inspo;
  out.push(t.build(what, cat));
  const site = it.siteUrl || it.url;
  if (site) out.push(`${t.source}: ${site}`);

  const moving = it.video || it.gif || it.mediaType === 'video' || it.videoKey;
  out.push('', `${t.reference}:`, `- ${it.type === 'nav' ? t.refNav : t.refShot}`);
  if (moving && it.type !== 'nav') out.push(`- ${t.refVideo}`);
  if (it.width && it.height) out.push(`- ${t.size}: ${it.width} × ${it.height}px`);

  const guide = tr(GUIDE[it.category], lang);
  if (guide && it.type !== 'nav') out.push('', `${t.contains} ${guide}.`);

  if (it.type === 'nav') {
    out.push('', `${t.navStates}:`, `- ${t.closed}`);
    out.push(`- ${t.open} ${tr(NAV_BEHAVIOUR[it.category], lang) || ''}`.trimEnd());
    if (it.mobile) out.push(`- ${lang === 'en' ? 'The example was captured at mobile width; make the mobile version leading.' : 'Het voorbeeld is op mobiel formaat vastgelegd; maak de mobiele versie leidend.'}`);
    out.push(`- ${t.navA11y}`);
  }

  const colors = it.style?.colors || [];
  const fonts = it.style?.fonts?.filter(f => f.source !== 'system') || [];
  if (colors.length || fonts.length) {
    out.push('', `${t.style}:`);
    if (colors.length) out.push(`- ${t.colors}: ${colors.slice(0, 8).map(c => c.toUpperCase()).join(', ')}`);
    if (fonts.length) {
      out.push(`- ${t.fonts}:`);
      for (const f of fonts.slice(0, 3)) {
        const bits = [f.roles?.length ? f.roles.join('/') : '', f.weights?.length ? f.weights.join(', ') : '', f.google ? t.google : ''].filter(Boolean);
        out.push(`  - ${f.family}${bits.length ? ` (${bits.join(' · ')})` : ''}`);
      }
    }
  }
  if (moving) out.push('', `${t.motion}: ${t.motionText}`);

  out.push('', `${t.tech}:`, `- ${stackLine}`, ...t.techList.map(l => `- ${l}`));
  return out.join('\n');
}
