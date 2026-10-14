# Moodboard — Chrome extension for design inspiration

Your own Pinterest-style board for UI/UX inspiration. Paste a link (Pinterest, Awwwards, Dribbble or any website), choose a category, click **Save**, and it shows up as a tile on your board. Videos, GIFs and recordings play inside the tile, and you can view websites live (moving).

## Installation
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Pin the icon to the toolbar. Shortcut: `Alt+Shift+S`

## What you can save
| Kind | How |
|---|---|
| **Favorite sections** | Popup → *Section* or `Alt+Shift+X`: click a section or drag a frame on the site. Choose **Screenshot** (long sections are stitched together) or **● Recording** (5/8/12 sec video of just that section; every frame is cropped) |
| **Navigations** | Popup → *Navigation* tab → *Record*, or `Alt+Shift+N`: screenshot closed → expand the menu (click or hover) → `Enter` → screenshot open, plus a video of it opening. *Mobile size* opens the site at 390px for hamburger menus. On the board: hover = open, detail = before/after slider |
| **Inspiration** (hero, footer, form, …) | Popup on any page, right-click → *Save to Moodboard → category*, or drag or paste onto the board |
| **Color palettes** | Popup → *Colors* grabs the colors of the page · eyedropper · colors from an image · WCAG contrast matrix |
| **Typography** | Popup → *Fonts* detects the page's fonts · heading/body pairings · Google Fonts load automatically |
| **Gradients** | Drag/paste a **screenshot** and the extension recognizes the gradient (linear + angle, radial + center, or mesh) with color stops and positions. Or build one yourself (linear / radial / conic / mesh) |
| **Microcopy** | Select text on a site → right-click → *Save as microcopy* |

## Moving previews
- **Automatic**: the extension looks up the video or GIF of a Pinterest pin, Awwwards site or Dribbble shot.
- **Recording**: records 5, 8 or 12 seconds of the current tab (feel free to scroll or hover while recording), so animations are kept exactly as you saw them.
- **Live**: websites load as a live iframe when you hover over the tile, or always when **Live previews** is on. In the detail view you can view and use the site live, at desktop or mobile size.

## Website style
The detail view shows the **color palette and fonts of the whole website**. Save the palette, a font or a pairing with one click.

Fonts are detected the way Font Ninja does it: for each text it measures which font the browser **actually renders** (canvas measurement on the font-family list), complemented by the loaded web fonts (`document.fonts`) and the downloaded font files. Hashed names like `__Inter_a1b2c3` or `GeistSans` become `Inter` and `Geist Sans`. There is always at least one font (the system font if needed).

If an item was not saved from the open tab, the extension briefly opens the site once in a background tab to measure it (with CSS analysis as a fallback).

## Prompt to recreate
Every detail view (inspiration, sections, navigations, gradients) has a ready-made **prompt** for Claude, v0, Lovable or Cursor. It is built from the kind of component, the source, the color palette, the fonts, motion and (for navigations) the open/closed behavior and accessibility. Choose your stack, copy the prompt and download the image to attach as a reference.

## Language
English by default. Switch to Dutch with the **NL / EN** button in the popup or on the board.

## Tips
- `/` search · `n` new item · `Alt+Shift+X` section · `Alt+Shift+N` navigation · `⌘/Ctrl+Enter` save in the editor
- Paste (`⌘V`) on the board: a link becomes inspiration, a hex code becomes a palette, plain text becomes microcopy
- In the detail view, *Extract colors* pulls a palette from the image
- **Export/Import** creates a JSON backup (including screenshots and recordings)
- Working for a client? Fill in **Project** and filter the board by it
- Hover over a tile to replay a video or live preview

## Privacy
Everything is stored locally in your browser (IndexedDB). Nothing is sent to a server, except fetching the link you save and Google Fonts for the font previews.

## Known limitations
- Some sites also block iframes via JavaScript; the live preview then stays empty. Use **Recording** instead.
- Pinterest loads some videos only as a stream. If no video is found, open the pin and choose **Recording**.
