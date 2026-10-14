// Translation NL → EN. The UI strings in the source are Dutch; this dictionary renders them in English.
// Plain script (no import/export), so it works in the popup, the board, the service worker
// and as a content script on websites. Sets globalThis.MB_I18N.
(() => {
  if (globalThis.MB_I18N) return;
  const D = {
    // general
    'Moodboard': 'Moodboard', 'Opslaan': 'Save', 'Opslaan…': 'Saving…', 'Annuleren': 'Cancel', 'Sluiten': 'Close',
    'Toevoegen': 'Add', 'Bewerken': 'Edit', 'Bijwerken': 'Update', 'Bijgewerkt': 'Updated', 'Verwijderen': 'Delete',
    'Verwijder': 'Delete', 'Verwijderd': 'Deleted', 'Opgeslagen': 'Saved', 'Opgeslagen ✓': 'Saved ✓', 'Opnieuw': 'Try again',
    'Export': 'Export', 'Import': 'Import', 'Open bord': 'Open board', 'Bekijk bord': 'View board', 'Nog iets opslaan': 'Save something else',
    'Link': 'Link', 'Naam': 'Name', 'Notitie': 'Note', 'Tags': 'Tags', 'Project': 'Project', 'Project / klant': 'Project / client',
    'Categorie': 'Category', 'Preview': 'Preview', 'Website': 'Website', 'Bron': 'Source', 'Titel': 'Title', 'Soort': 'Kind',
    'Omschrijving': 'Description', 'Context': 'Context', 'Tekst': 'Text', 'Type': 'Type', 'Hoek': 'Angle', 'Kleur': 'Color',
    'Item': 'Item', 'Onbekend item': 'Unknown item', 'Zonder titel': 'Untitled', 'Zonder categorie': 'No category',
    'Gekopieerd': 'Copied', 'Upload': 'Upload', 'Video': 'Video', 'GIF': 'GIF', 'Beweegt': 'Moving',

    // kinds
    'Alles': 'All', 'Inspiratie': 'Inspiration', 'Secties': 'Sections', 'Sectie': 'Section', 'Kleuren': 'Colors',
    'Typografie': 'Typography', 'Lettertypes': 'Fonts', 'Gradients': 'Gradients', 'Motion': 'Motion', 'Microcopy': 'Microcopy',
    'Resources': 'Resources', 'Resource': 'Resource', 'Palet': 'Palette', 'Lettertype': 'Font', 'Combinatie': 'Pairing',
    'Gradient': 'Gradient', 'Easing': 'Easing',

    // inspiration categories
    'Hero': 'Hero', 'Navigatie': 'Navigation', 'Footer': 'Footer', 'Formulier': 'Form', 'Cards': 'Cards', 'Pricing': 'Pricing',
    'Dashboard': 'Dashboard', 'Mobiel': 'Mobile', 'Onboarding': 'Onboarding', 'Empty state': 'Empty state',
    'Micro-interactie': 'Micro-interaction', 'Animatie': 'Animation', 'Scroll-effect': 'Scroll effect',
    'Style / Moodboard': 'Style / Moodboard', 'Kleurgebruik': 'Use of color', 'Illustratie': 'Illustration', 'Iconen': 'Icons',
    'Fotografie': 'Photography', '404 / Error': '404 / Error', 'Checkout': 'Checkout', 'Productpagina': 'Product page',
    'Portfolio': 'Portfolio', 'Overig': 'Other', 'Mooi design': 'Beautiful design',
    // section types
    'Features': 'Features', 'Testimonials': 'Testimonials', 'CTA': 'CTA', 'FAQ': 'FAQ', 'Galerij': 'Gallery', 'Team': 'Team',
    'Stats': 'Stats', 'Logo wall': 'Logo wall', 'Blog / content': 'Blog / content',
    // microcopy contexts
    'Call-to-action': 'Call-to-action', 'Foutmelding': 'Error message', 'Bevestiging': 'Confirmation', 'Tooltip / hint': 'Tooltip / hint',
    'Formulierlabel': 'Form label', 'Notificatie': 'Notification', 'Headline': 'Headline',
    // resources
    'Tool': 'Tool', 'Figma plugin': 'Figma plugin', 'Icon set': 'Icon set', 'Illustraties': 'Illustrations', 'Font foundry': 'Font foundry',
    'Stockbeeld': 'Stock imagery', 'Mockups': 'Mockups', 'Component library': 'Component library', 'Artikel / case': 'Article / case study',

    // board
    'Jouw': 'Your', 'inspiratie': 'inspiration', ', op één plek.': ', all in one place.',
    'Zoek op titel, tag, kleur, font…': 'Search by title, tag, color, font…', 'Live previews': 'Live previews',
    'Laat websites zonder video live (bewegend) zien op het bord': 'Show websites without video live (moving) on the board',
    'Alle categorieën': 'All categories', 'Alle secties': 'All sections', 'Alle projecten': 'All projects',
    'Je bord is nog leeg': 'Your board is still empty', 'Niets gevonden': 'Nothing found',
    'Probeer een andere zoekterm of filter.': 'Try a different search term or filter.',
    'Klik op het extensie-icoon op een Pinterest-pin of Awwwards-site, sleep een afbeelding hierheen, of plak (⌘V) een link.':
      'Click the extension icon on a Pinterest pin or Awwwards site, drag an image here, or paste (⌘V) a link.',
    'Open een website, klik op het extensie-icoon → Sectie, en kies een hero, footer of andere sectie. Sneltoets: Alt+Shift+X.':
      'Open a website, click the extension icon → Section, and pick a hero, footer or any other section. Shortcut: Alt+Shift+X.',
    'Eerste item toevoegen': 'Add your first item', 'Laat los om op te slaan': 'Drop to save',
    'Open origineel': 'Open original', 'Origineel': 'Original', 'Bron van pin': 'Pin source', 'Kleuren halen': 'Extract colors',
    'Live desktop': 'Live desktop', 'Live mobiel': 'Live mobile', 'Live preview': 'Live preview',
    'Live preview beschikbaar (hover)': 'Live preview available (hover)', 'Live-URL': 'Live URL',
    'Vul de echte website in om hem live te bekijken.': 'Enter the real website to view it live.',
    'Opname': 'Recording', 'Opname bezig…': 'Recording…', 'Kopieer CSS': 'Copy CSS', 'Kopieer als CSS-variabelen': 'Copy as CSS variables',
    'Kopieer tekst': 'Copy text', 'Bekijk op Google Fonts': 'View on Google Fonts',
    'Goede typografie maakt inhoud leesbaar en geeft een merk een stem. Dit is': 'Good typography makes content readable and gives a brand a voice. This is',
    'als bodytekst.': 'as body text.',
    'Weet je zeker dat je dit item wilt verwijderen?': 'Are you sure you want to delete this item?',
    'Naam van de nieuwe categorie': 'Name of the new category', '+ Nieuwe categorie…': '+ New category…', '+ Nieuw': '+ New',
    'Wat spreekt je aan aan dit voorbeeld?': 'What do you like about this example?', 'Wat spreekt je aan?': 'What do you like about it?',
    'Wat vind je hier goed aan?': 'What do you like about it?', 'Optioneel, bv. Nairiva': 'Optional, e.g. Nairiva', 'bv. Nairiva': 'e.g. Nairiva',
    'https://… (voor live preview)': 'https://… (for live preview)', 'https://… (optioneel)': 'https://… (optional)',
    'https://… (website van de sectie)': 'https://… (website of the section)', 'dark, 3d, brutalist': 'dark, 3d, brutalist',
    // editor
    'Of upload een afbeelding / video': 'Or upload an image / video',
    'Plak een link, of sleep / upload een afbeelding of video': 'Paste a link, or drag / upload an image or video',
    'Preview ophalen…': 'Fetching preview…', 'Geen afbeelding gevonden': 'No image found', '· beweegt': '· moving',
    '· kon pagina niet lezen': '· could not read page', 'Voeg een link of bestand toe': 'Add a link or file',
    'Kies eerst een categorie': 'Choose a category first', 'Kies een categorie': 'Choose a category',
    'Tip: met de popup (tab Sectie) of Alt+Shift+X selecteer je een sectie direct op de website.':
      'Tip: use the popup (Section tab) or Alt+Shift+X to select a section right on the website.',
    'Upload of sleep een screenshot van de sectie': 'Upload or drag a screenshot of the section', 'Screenshot uploaden': 'Upload screenshot',
    'Soort sectie': 'Section type', 'bv. Linear — pricing': 'e.g. Linear — pricing',
    'Upload een screenshot van de sectie': 'Upload a screenshot of the section', 'Kies het soort sectie': 'Choose the section type',
    'bv. Warm editorial': 'e.g. Warm editorial', 'Pipet': 'Eyedropper', 'Uit afbeelding': 'From image', 'Contrast (WCAG)': 'Contrast (WCAG)',
    'Hex': 'Hex', 'Verwijder kleur': 'Remove color', 'Voeg minimaal één kleur toe': 'Add at least one color',
    'Voeg minstens twee kleuren toe om contrast te vergelijken.': 'Add at least two colors to compare contrast.',
    'Heading-lettertype': 'Heading font', 'Body-lettertype': 'Body font', 'bv. Fraunces': 'e.g. Fraunces', 'bv. Inter (optioneel)': 'e.g. Inter (optional)',
    'Voorbeeldtekst': 'Sample text', 'Voorbeeldtekst, bv. Ontwerp met intentie': 'Sample text, e.g. Design with intent',
    'Waar wil je dit voor gebruiken?': 'What do you want to use this for?',
    'Goede typografie maakt inhoud leesbaar, toegankelijk en aantrekkelijk. Zo klinkt dit lettertype als lopende tekst in een interface. 0123456789':
      'Good typography makes content readable, accessible and attractive. This is how the font reads as running text in an interface. 0123456789',
    'Google Fonts worden automatisch geladen. Lokaal geïnstalleerde lettertypes werken ook.': 'Google Fonts load automatically. Locally installed fonts work too.',
    'Vul minimaal één lettertype in': 'Enter at least one font', 'bv. Sunset glow': 'e.g. Sunset glow',
    'Je kunt de CSS ook zelf aanpassen of plakken.': 'You can also edit or paste the CSS yourself.', 'Geen gradient': 'No gradient',
    'Kleur toevoegen': 'Add color', 'Kies een preset…': 'Choose a preset…', 'Preset': 'Preset', 'Duur (ms)': 'Duration (ms)',
    'bv. “Oeps, deze pagina is op vakantie.”': 'e.g. “Oops, this page is on vacation.”', 'Vul een tekst in': 'Enter some text',
    'Naam van de tool': 'Name of the tool', 'Waarvoor gebruik je het?': 'What do you use it for?', 'Vul een link in': 'Enter a link',
    'Geen afbeelding om kleuren uit te halen': 'No image to extract colors from', 'Dit is geen Moodboard-export': 'This is not a Moodboard export',

    // popup
    'Plak een Pinterest-, Awwwards- of website-link': 'Paste a Pinterest, Awwwards or website link',
    'Plak een link om een preview te zien': 'Paste a link to see a preview', 'Live preview op je bord': 'Live preview on your board',
    'Automatisch': 'Automatic', 'Screenshot': 'Screenshot', 'Opnameduur': 'Recording length',
    'Bewegende preview gevonden — wordt afgespeeld op je bord.': 'Moving preview found — it will play on your board.',
    'Geen afbeelding gevonden: je bord toont een live preview van de site.': 'No image found: your board will show a live preview of the site.',
    'Gebruikt de afbeelding of video van de link.': 'Uses the image or video from the link.',
    'Screenshot van het zichtbare deel van dit tabblad.': 'Screenshot of the visible part of this tab.',
    'Project, tags & notitie': 'Project, tags & note',
    'Plak eerst een link': 'Paste a link first', 'Opname gestart': 'Recording started', 'Opname kon niet starten': 'Recording could not start',
    'Favoriete sectie vastleggen': 'Capture a favorite section',
    'Kies een hero, footer, pricing-blok of andere sectie op deze pagina. Er wordt een screenshot van gemaakt, ook als de sectie langer is dan je scherm.':
      'Pick a hero, footer, pricing block or any other section on this page. It gets screenshotted, even if the section is taller than your screen.',
    'Sectie selecteren op de pagina': 'Select a section on the page', 'Klik op een sectie, of sleep een eigen kader': 'Click a section, or drag your own area',
    'kiest een grotere of kleinere sectie,': 'picks a larger or smaller section,', 'bevestigt': 'confirms', 'Sneltoets zonder popup:': 'Shortcut without the popup:',
    'Kleuren van deze pagina ophalen': 'Get colors from this page', 'Klik op een kleur om hem aan of uit te zetten.': 'Click a color to toggle it.',
    'Kies kleur': 'Pick color', 'Hex-code': 'Hex code', 'Naam palet': 'Palette name', 'Palet opslaan': 'Save palette',
    'Nog geen kleuren': 'No colors yet', 'Ongeldige hex-code': 'Invalid hex code', 'Selecteer minimaal één kleur': 'Select at least one color',
    'Palet opgeslagen': 'Palette saved', 'Lettertypes van deze pagina detecteren': 'Detect fonts on this page',
    'Of typ een lettertype, bv. Fraunces': 'Or type a font, e.g. Fraunces', 'Opslaan als combinatie (heading + body)': 'Save as pairing (heading + body)',
    'Lettertypes opslaan': 'Save fonts', 'Nog geen lettertypes': 'No fonts yet', 'Selecteer minimaal één lettertype': 'Select at least one font',
    'Lettertypes opgeslagen': 'Fonts saved', 'Werkt alleen op een gewone webpagina': 'Only works on a regular web page',
    'Opslaan op Moodboard': 'Save to Moodboard',

    // section picker on websites
    'Klik op een sectie of sleep een kader': 'Click a section or drag an area', 'groter/kleiner': 'larger/smaller',
    'Favoriete sectie': 'Favorite section', 'Dat lukte niet': 'That didn’t work', 'Staat nu bij': 'Now saved under',
    'in je favoriete secties.': 'in your favorite sections.', 'Nog een sectie': 'Another section', 'Opslaan mislukt': 'Saving failed',
    'Screenshot mislukt': 'Screenshot failed',

    // website style
    'Stijl van de website': 'Website style', 'gemeten op de pagina': 'measured on the page', 'uit de CSS van de site': 'from the site’s CSS',
    'uit de afbeelding': 'from the image', 'Opnieuw analyseren': 'Analyze again', 'Website analyseren…': 'Analyzing website…',
    'Kleurenpalet': 'Color palette', 'Opslaan als palet': 'Save as palette', 'Opslaan bij Typografie': 'Save to Typography',
    'Combinatie opslaan': 'Save pairing', 'Geen lettertypes gevonden.': 'No fonts found.', 'Eigen font': 'Custom font',
    'Lettertype opgeslagen': 'Font saved', 'Palet uit afbeelding': 'Palette from image', 'Kon de website niet laden': 'Could not load the website',
    'Geen website of afbeelding om te analyseren': 'No website or image to analyze',

    'Lettertypes zoeken…': 'Finding fonts…', 'Webfont': 'Webfont', 'Lokaal geïnstalleerd': 'Installed locally', 'Systeemfont': 'System font', 'Kon de website niet scannen': 'Could not scan the website',
    'San Francisco (systeem)': 'San Francisco (system)', 'Sans-serif (standaard)': 'Sans-serif (default)', 'Serif (standaard)': 'Serif (default)',
    'Monospace (standaard)': 'Monospace (default)', 'Monospace (systeem)': 'Monospace (system)',

    'Sleep een screenshot van een gradient hierheen': 'Drag a screenshot of a gradient here', 'of klik om te uploaden · plakken (⌘V) kan ook': 'or click to upload · pasting (⌘V) works too',
    'Gradient herkennen…': 'Detecting gradient…', 'Lineair': 'Linear', 'Radiaal': 'Radial', 'Conic': 'Conic', 'Mesh': 'Mesh',
    'Positie %': 'Position %', 'Afbeelding te klein of transparant': 'Image too small or transparent',

    'Vlak': 'Fill', 'Knop': 'Button', 'Kaart': 'Card', 'Kleurstops': 'Color stops', 'Aan de slag': 'Get started', 'Meer info': 'Learn more',
    'Kaarttitel': 'Card title', 'Zo ziet de gradient eruit als header van een kaart.': 'This is how the gradient looks as a card header.',
    'Gradient-tekst': 'Gradient text', 'Tailwind': 'Tailwind', 'Kopieer': 'Copy',

    // navigations
    'Navigaties': 'Navigations', 'Navigatie': 'Navigation', 'Alle navigaties': 'All navigations', 'Soort navigatie': 'Navigation type',
    'Dropdown': 'Dropdown', 'Mega menu': 'Mega menu', 'Hamburger / mobiel': 'Hamburger / mobile', 'Fullscreen menu': 'Fullscreen menu',
    'Sidebar': 'Sidebar', 'Tab bar': 'Tab bar', 'Dicht': 'Closed', 'Open': 'Open', 'Vergelijk': 'Compare', 'Naast elkaar': 'Side by side',
    'Desktop': 'Desktop', 'Navigatie · mobiel': 'Navigation · mobile', 'Navigatie · desktop': 'Navigation · desktop', '· met video': '· with video',
    'Navigatie vastleggen': 'Capture a navigation', 'Navigatie vastleggen (dicht → open)': 'Capture navigation (closed → open)',
    'Navigatie vastleggen (dicht → open)…': 'Capture navigation (closed → open)…',
    'Leg een menu dicht én uitgeklapt vast, met een video van het openklappen.': 'Capture a menu closed and expanded, with a video of it opening.',
    'Sneltoets:': 'Shortcut:', 'Video (optioneel)': 'Video (optional)', 'bv. Navigatie — linear.app': 'e.g. Navigation — linear.app',
    'Voeg een screenshot van dicht én open toe': 'Add a screenshot of both closed and open', 'Kies het soort navigatie': 'Choose the navigation type',
    'Tip: met de popup (tab Sectie → Navigatie vastleggen) of Alt+Shift+N leg je dicht, open en een video direct op de website vast.':
      'Tip: use the popup (Section tab → Capture a navigation) or Alt+Shift+N to capture closed, open and a video right on the website.',
    'Open een website, klik op het extensie-icoon → Sectie → Navigatie vastleggen. Je legt het menu dicht én open vast, met video. Sneltoets: Alt+Shift+N.':
      'Open a website, click the extension icon → Section → Capture a navigation. You capture the menu closed and open, with video. Shortcut: Alt+Shift+N.',
    // nav-capture panel
    'Stap 1 van 3 · Dicht': 'Step 1 of 3 · Closed', 'Stap 2 van 3 · Open': 'Step 2 of 3 · Open', 'Stap 3 van 3 · Opslaan': 'Step 3 of 3 · Save',
    'Zorg dat het menu nog dicht is en druk op': 'Make sure the menu is still closed and press', 'Ook video van het openklappen': 'Also record a video of it opening',
    'Hamburgermenu’s zie je vaak alleen op mobiel. Gebruik dan': 'Hamburger menus often only appear on mobile. In that case use',
    'Mobiel formaat': 'Mobile size', 'Dicht vastleggen': 'Capture closed', 'Klap het menu nu open': 'Now open the menu',
    'Klik op de menuknop of hover over een menu-item. Druk op': 'Click the menu button or hover over a menu item. Press',
    'zodra het menu helemaal open is.': 'as soon as the menu is fully open.',
    'De video loopt. Dit paneel verdwijnt zo, zodat het niet in beeld komt.': 'Recording. This panel disappears in a moment so it stays out of the shot.',
    'Timer 3 sec': '3 sec timer', 'Open vastleggen': 'Capture open', '+ video van het openklappen': '+ video of it opening',
    'Soort navigatie': 'Navigation type', 'Staat nu bij Navigaties op je bord.': 'Now saved under Navigations on your board.',
    'Nog een navigatie': 'Another navigation', 'Opname loopt — druk op Enter als het menu open is': 'Recording — press Enter when the menu is open',

    'Fonts': 'Fonts', 'Navigatie opnemen': 'Record a navigation', 'Opnemen': 'Record',
    'Leg vast hoe een menu eruitziet als het dicht is én als het uitgeklapt is. Wordt opgeslagen bij': 'Capture how a menu looks closed and expanded. Saved under',
    'op je bord.': 'on your board.', 'Menu dicht → druk op': 'Menu closed → press', 'Klap het menu open (klik of hover) →': 'Open the menu (click or hover) →',
    'Kies het soort navigatie en sla op': 'Choose the navigation type and save', 'Video van het openklappen': 'Video of it opening',
    'Op mobiel formaat (390px, voor hamburgermenu’s)': 'At mobile size (390px, for hamburger menus)',

    'Vastleggen als': 'Capture as', 'Speelt af': 'Playing', 'Screenshots': 'Screenshots', 'Starten': 'Start', 'Ook video van het openklappen': 'Also record a video of it opening',
    'Screenshot van het menu dicht én uitgeklapt, stap voor stap op de pagina.': 'Screenshots of the menu closed and expanded, step by step on the page.',
    'Kan hier geen navigatie opnemen: ': 'Can’t record a navigation here: ',

    'Prompt om na te maken': 'Prompt to recreate it', 'Plak in Claude, v0, Lovable of Cursor': 'Paste into Claude, v0, Lovable or Cursor',
    'Kopieer prompt': 'Copy prompt', 'Stack': 'Stack', 'Download beeld': 'Download image', 'Geen beeld om te downloaden': 'No image to download',
    'Tip: voeg het gedownloade beeld toe aan je prompt als referentie.': 'Tip: attach the downloaded image to your prompt as a reference.',

    'Kleuren uit de CSS van deze website halen': 'Get colors from this website’s CSS',
    'Kleuren uit de CSS van de website halen…': 'Reading colors from the website’s CSS…', 'Geen kleuren gevonden in de CSS': 'No colors found in the CSS',
    'Kijkt naar alle stylesheets van de site (ook van andere pagina’s), niet alleen naar wat je ziet. Klik op een kleur om hem aan of uit te zetten.':
      'Looks at all of the site’s stylesheets (including other pages), not just what you see. Click a color to toggle it.',
    'kleuren uit de CSS van de site · fonts gemeten op de pagina': 'colors from the site’s CSS · fonts measured on the page',

    'Screenshot van de sectie, ook als die langer is dan je scherm.': 'Screenshot of the section, even if it’s taller than your screen.',
    'hover of klik in de sectie, niet scrollen': 'hover or click inside the section, don’t scroll', 'Video niet beschikbaar': 'Video not available',
    '· video van het zichtbare deel': '· video of the visible part',

    'Opname starten…': 'Starting recording…',

    // context menu
    'Sectie vastleggen…': 'Capture section…', 'Opslaan als microcopy: “%s”': 'Save as microcopy: “%s”',
  };

  const tr = s => (D[s] != null ? D[s] : rules(s));
  const PREFIX = {
    'Er ging iets mis': 'Something went wrong', 'Import mislukt': 'Import failed', 'Screenshot mislukt': 'Screenshot failed',
    'Kon geen kleuren lezen': 'Could not read colors', 'Kon geen lettertypes lezen': 'Could not read fonts',
    'Kan hier geen sectie selecteren': 'Can’t select a section here',
  };
  const R = [
    [/^(\d+) kleuren$/, (_, n) => `${n} colors`],
    [/^(\d+) kleuren bewaard\.$/, (_, n) => `${n} colors saved.`],
    [/^(\d+) items geïmporteerd$/, (_, n) => `${n} items imported`],
    [/^(\d+) items geëxporteerd$/, (_, n) => `${n} items exported`],
    [/^Toegevoegd aan “(.+)”\.$/, (_, c) => `Added to “${tr(c)}”.`],
    [/^Opname (\d+)s$/, (_, n) => `Recording ${n}s`],
    [/^Opgeslagen op (.+)$/, (_, d) => `Saved on ${d}`],
    [/^Eigen kader · (.+)$/, (_, d) => `Custom area · ${d}`],
    [/^(.+) · ingekort tot 8 schermen$/, (_, d) => `${d} · trimmed to 8 screens`],
    [/^(Kleur|CSS|Tekst|Prompt) gekopieerd: ([\s\S]*)$/, (_, k, v) => `${{ Kleur: 'Color', CSS: 'CSS', Tekst: 'Text', Prompt: 'Prompt' }[k]} copied: ${v}`],
    [/^Kopieer (#\w+)$/, (_, c) => `Copy ${c}`],
    [/^Neemt (\d+) sec van alleen de gekozen sectie op\. Hover of klik erin om animaties te laten zien, en scroll niet tijdens de opname\.$/,
      (_, n) => `Records ${n} sec of just the selected section. Hover or click inside it to show animations, and don’t scroll while recording.`],
    [/^Opname · (\d+)s — (.*)$/, (_, n, r) => `Recording · ${n}s — ${r}`],
    [/^(.*) — de screenshot wordt wel opgeslagen\.$/, (_, w) => `${w} — the screenshot will still be saved.`],
    [/^Opnemen \((\d+) sec\)$/, (_, n) => `Record (${n} sec)`],
    [/^Sectie kiezen en opnemen \((\d+) sec\)$/, (_, n) => `Pick a section and record (${n} sec)`],
    [/^Neemt (\d+) sec van dit tabblad op\. Klap na het starten het menu open en weer dicht \(klik of hover\) — de popup sluit vanzelf\.$/,
      (_, n) => `Records ${n} sec of this tab. After starting, open the menu and close it again (click or hover) — the popup closes by itself.`],
    [/^De komende (\d+) seconden worden opgenomen\. Klap het menu nu open en dicht — de popup sluit vanzelf\.$/,
      (_, n) => `The next ${n} seconds are being recorded. Open and close the menu now — the popup closes by itself.`],
    [/^Kan hier geen navigatie opnemen: ([\s\S]*)$/, (_, e) => `Can’t record a navigation here: ${e}`],
    [/^Video niet beschikbaar: ([\s\S]*)\. Screenshots werken wel\.$/, (_, e) => `Video not available: ${e}. Screenshots still work.`],
    [/^Kan hier geen navigatie vastleggen: ([\s\S]*)$/, (_, e) => `Can’t capture a navigation here: ${e}`],
    [/^(Lineair|Radiaal|Conic|Mesh)( · .*)? · (\d+) kleuren$/, (_, k, mid, n) => `${{ Lineair: 'Linear', Radiaal: 'Radial', Conic: 'Conic', Mesh: 'Mesh' }[k]}${mid || ''} · ${n} colors`],
    [/^Herkend als (\S+)(?: (\d+)°)? met (\d+) kleuren · (\d+)% overeenkomst$/, (_, k, a, n, m) => `Detected as ${{ lineair: 'linear', radiaal: 'radial', mesh: 'mesh' }[k] || k}${a ? ` ${a}°` : ''} with ${n} colors · ${m}% match`],
    [/^Neemt (\d+) sec van dit tabblad op, zodat animaties bewaard blijven\. Scroll of hover na het starten over de pagina\.$/,
      (_, n) => `Records ${n} sec of this tab so animations are preserved. Scroll or hover over the page after starting.`],
    [/^De komende (\d+) seconden worden opgenomen\. Scroll of hover nu over de pagina — de popup sluit vanzelf\.$/,
      (_, n) => `The next ${n} seconds are being recorded. Scroll or hover over the page now — the popup closes by itself.`],
    [/^(Er ging iets mis|Import mislukt|Screenshot mislukt|Kon geen kleuren lezen|Kon geen lettertypes lezen|Kan hier geen sectie selecteren): ([\s\S]*)$/,
      (_, p, rest) => `${PREFIX[p]}: ${rest}`],
  ];
  function rules(s) {
    for (const [re, fn] of R) if (re.test(s)) return s.replace(re, fn);
    return null;
  }

  // Translate one text; keeps surrounding whitespace. Returns the original if there is no translation.
  function t(text) {
    if (!text || globalThis.MB_I18N.lang !== 'en') return text;
    const core = text.trim();
    const out = core && tr(core);
    return out == null ? text : text.replace(core, out);
  }

  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);

  function translateTree(root) {
    if (globalThis.MB_I18N.lang !== 'en' || !root) return;
    if (root.nodeType === 3) { const v = t(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) translateAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 1) { translateAttrs(n); continue; }
      if (SKIP.has(n.parentElement?.tagName) || n.parentElement?.closest('[data-no-i18n]')) continue;
      const v = t(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
  }
  function translateAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute?.(a);
      if (v) { const nv = t(v); if (nv !== v) el.setAttribute(a, nv); }
    }
  }

  function observe(root) {
    if (globalThis.MB_I18N.lang !== 'en') return;
    translateTree(root);
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') translateTree(m.target);
        else if (m.type === 'attributes') translateAttrs(m.target);
        else m.addedNodes.forEach(translateTree);
      }
    }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // English by default; Dutch only when chosen with the language button.
  const defaultLang = () => 'en';

  async function loadLang() {
    try {
      const { lang } = await chrome.storage.local.get('lang');
      globalThis.MB_I18N.lang = lang === 'nl' || lang === 'en' ? lang : defaultLang();
    } catch { globalThis.MB_I18N.lang = defaultLang(); }
    return globalThis.MB_I18N.lang;
  }

  globalThis.MB_I18N = { lang: 'en', t, translateTree, observe, loadLang };
})();
