# Styles (`src/styles`)

Global CSS for the registration app. Single entry file imported from [main.tsx](../main.tsx).

## Overview

| File | Summary |
| --- | --- |
| [index.css](index.css) | Tailwind v4 theme, fonts, base reset, and component-layer classes |

## index.css sections

| Section | Classes / tokens | Used by |
| --- | --- | --- |
| @theme | --font-sans, --font-display, palette (--color-ink, --color-clay, …) | Tailwind utilities across app |
| @font-face | Barlow Semi Condensed, CS Gelios | Body and display headings |
| @layer base | :root aliases, body, focus, reduced motion | Global |
| Sign-in / storm | .sign-in-page, .sign-in-storm*, .sign-in-card*, .sign-in-form, .sign-in-otp* | SignInShell, SignInStormBackdrop, SignInPage |
| Register shell | .register-page | PageShell, loading states |
| Weather mood | .weather-mood-toggle* | WeatherMoodToggle |
| Odyssey CTA | .odyssey-btn | OdysseyButton |
| Art motion | .art-ship, .ship-oar, .ship-sail | Ship |

Form field appearance for the registration form uses mostly Tailwind classes from [formFieldStyles.ts](../pages/Register/components/formFieldStyles.ts), not dedicated CSS blocks in this file.

## External assets

| Asset | Path in CSS |
| --- | --- |
| Barlow Semi Condensed | /fonts/BarlowSemiCondensed-*.woff2 |
| CS Gelios | /fonts/CSGelios-Regular.woff2 |

Font files live under [public/fonts/](../../public/fonts/).

## Related

| Location | Role |
| --- | --- |
| [public/README.md](../../public/README.md) | Font files and licenses |
| [components/README.md](../components/README.md) | Components using these CSS classes |

Parent index: [../README.md](../README.md).
