# Static assets (`public/`)

Files copied verbatim into the Vite build root (/). Referenced from [index.html](../index.html), [src/styles/index.css](../src/styles/index.css), and [src/constants/images.ts](../src/constants/images.ts).

## Overview

| Path | Summary |
| --- | --- |
| [favicon.svg](favicon.svg) | Primary favicon |
| [trusted-types.js](trusted-types.js) | Trusted Types default policy (loaded before the app bundle) |
| [_headers](_headers) | Netlify-style HSTS snippet (Vercel uses [vercel.json](../vercel.json) for production headers) |
| [fonts/](fonts/) | Barlow Semi Condensed + CS Gelios webfonts and license text |
| [images/](images/) | Odyssey art, responsive logos, favicon PNGs |

## Fonts (`fonts/`)

| File | Role |
| --- | --- |
| BarlowSemiCondensed-Regular.woff2 | Body copy |
| BarlowSemiCondensed-SemiBold.woff2 | Headings |
| BarlowSemiCondensed-Bold.woff2 | Strong emphasis |
| CSGelios-Regular.woff2 | Display / sign-in title |
| OFL.txt | Barlow license (SIL OFL) |
| CSGelios-LICENSE.txt | CS Gelios license |

index.html preloads Regular, SemiBold, and CS Gelios. @font-face rules live in [src/styles/index.css](../src/styles/index.css).

## Images (`images/`)

| Path | Role |
| --- | --- |
| logos/hackuta-logo-{120,240,400,640}.webp | Default logo srcset |
| logos/hackuta-logo-white-{120,240,400,640}.webp | Logo on dark backgrounds |
| coast/coast-cliff-v7-{400,560,800,1120}.webp | Sign-in backdrop responsive art |
| cyclops-cave-clear.webp, feast.webp, ground-clear.webp, pillars-clear.webp, temple-clear.webp, trojan-horse.webp | Register / profile atmosphere layers |
| favicon-32.png, apple-touch-icon.png | Legacy / PWA icon links in index.html |

Logo paths and widths are centralized in [src/constants/images.ts](../src/constants/images.ts).

## Security

[trusted-types.js](trusted-types.js) registers a permissive default Trusted Types policy so React can run under the strict CSP in [security/csp.ts](../security/csp.ts). It must load synchronously in index.html before the module entry.

## Related

| Location | Role |
| --- | --- |
| [security/README.md](../security/README.md) | CSP and response headers |
| [src/components/art/README.md](../src/components/art/README.md) | Logo and art components |

Parent index: [README.md](../README.md).
