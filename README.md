# Artes Nobiles

A simple, responsive, static website. The publishable website is in `dist/`.

Repository: [brantlymillegan/artes-nobiles-website](https://github.com/brantlymillegan/artes-nobiles-website). GitHub Actions deploys the default branch to GitHub Pages. See [GITHUB_PAGES.md](GITHUB_PAGES.md) for the exact DNS records for `artesnobiles.com` and HTTPS. Run `python3 scripts/build_pages.py` to validate and assemble the public release in `_site/`; the workflow publishes only those selected files.

Run a local preview with `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`, then open http://127.0.0.1:4173.

The Christmas Story reading proof is reference material only and is not included in this project. The supplied cover is included. The displayed ROSARIUM screen is a fresh capture from the local Android build. The book's purchase link and release information can be added when available.

The site is deployed on GitHub Pages with artesnobiles.com configured as its custom domain. GoDaddy DNS must be updated as described in the setup guide; HTTPS enforcement becomes available after the custom-domain certificate is issued.

The header uses the full-name SVG seals supplied in “Design company logo”: black in light mode and white in dark mode, following the System / Light / Dark selection. The original artwork is copied unchanged from `output/artes-nobilis-logos/full-name/`. The supplied artwork spells the name “Artes Nobilis”; the existing page text uses “Artes Nobiles” pending the user’s spelling clarification. The footer remains text and the initial favicon is unchanged.

Brand rules for this site:
- Do not invent company or product slogans or mottos.
- Render the ROSARIUM wordmark with its official Noto Serif variable font: weight 720 and 0.18em letter spacing.
- In every visible book title, set “The” smaller and italic, vertically centered to the left of “Christmas Story.”
- Center “The” against the main letters’ bodies, excluding the long tail of the “y.” The shared title component uses a .744em alignment box and reserves .233em below for the descender, in both the navigation and book heading.
- Match the cover’s exact typefaces: Big Caslon Medium for “Christmas Story” (tracking −0.018em) and Minion Variable Concept Italic for “The” (weight 400, optical size 21.22). The menu and book heading use outlined SVG glyphs from those actual font files, with accessible text, so rendering does not depend on installed fonts. Keep the existing website size ratios and vertical centering. Source measurements and the CoreText outline generator are in `output/christmas-title-fonts/`; no cover font files or book PDF are published.
- Show the app inside the actual Samsung Galaxy S26 device image, keeping the entire status bar within the screen corners.

The Galaxy S26 photograph is the official Samsung base-model Front2 Black asset. The page layers the unchanged ROSARIUM screenshot over its screen and preserves the camera from the same source photograph.

The System / Light / Dark control matches brantly.com's `app/theme-toggle.tsx` and its control styles. It opens on mouse hover, stays open on click, and closes after selection, Escape, or an outside press. An explicit preference is saved under `artes-nobiles-theme`; System clears that override and follows live OS appearance changes. Both the page and app screenshot follow the resolved theme.

Asset sources:
- App Store badge: unchanged English SVG from [Apple](https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg), downloaded September 12, 2026. Displayed as a disabled control with reduced opacity and “Coming soon” beneath it until the iOS listing is available.
- Google Play badge: unchanged English SVG from Google’s [Partner Marketing Hub](https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/), downloaded September 12, 2026. Displayed at 48px high with at least 12px surrounding clear space, linked directly to ROSARIUM’s listing.
- ROSARIUM screenshots: `dist/assets/rosarium-home-light.png` and `dist/assets/rosarium-home-dark.png`. These unmodified captures use an isolated Android emulator at 1080×2340, 420 logical dpi, font scale 1.0, and clean default app preferences. They were captured from the same APK (SHA-256 `0f4e065dff436937622a42799b2583bfee438c8ee85a6e788460071190a3250f`) on September 11, 2026. The clock and wordmark positions match between themes; all six visible main titles fit on one line. Screenshots retain their original aspect ratio inside the Samsung frame. Do not reuse the superseded 1080×2400 capture from the running test activity.
- ROSARIUM font: https://rosariumprayer.com/fonts/noto-serif-variable.ttf
- Samsung Galaxy S26: https://images.samsung.com/is/image/samsung/p6pim/us/s2602/gallery/us-galaxy-s26-s942-sm-s942uzkexaa-550995407?fmt=png-alpha&wid=2000&hei=2000
