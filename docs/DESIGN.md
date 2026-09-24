# HackUTA 2026 Register — Design context

Odyssey theme, palette, and UX principles for this app. The marketing landing page maintains a separate doc in [hackuta-2026-repository/HACKUTA_DESIGN_CONTEXT.md](https://github.com/aroudrasthakur/hackuta-2026-repository/blob/main/HACKUTA_DESIGN_CONTEXT.md).

Last updated: September 2026

## Project status

| Item | Detail |
| --- | --- |
| Repository | hackuta-2026-register |
| Scope | Sign-in (password + OTP), forgot-password reset, application form with draft autosave, applicant profile dashboard |
| Implemented routes | /sign-in, /register, /profile |
| Theme tokens | [src/styles/index.css](../src/styles/index.css) (`--color-*` / `--ink`, `--clay`, etc.) |

Code layout: [src/README.md](../src/README.md) · Static art: [public/README.md](../public/README.md)

## Theme and art direction

- Theme: Greek mythology, focused on Homer's *Odyssey*.
- Visual treatment: ancient pottery and illustration, consistent with the landing page.
- Preferred historical grammar: Attic/Corinthian black-figure pottery.
- Clay/terracotta backgrounds evoke pottery surfaces on register and profile pages.
- Sign-in uses a storm backdrop (coast art + animated rain) — the call to adventure before the manifest.

Central metaphor:

> Registration is signing the crew manifest — your commitment to embark on the hackathon odyssey.

## Visual system

Palette (defined in [src/styles/index.css](../src/styles/index.css)):

| Token | Hex | Role |
| --- | --- | --- |
| ink | #1a3a52 | Primary text and form borders |
| night | #102f46 | Accent backgrounds |
| clay | #eee3d2 | Primary background (pottery surface) |
| sand | #ded0bc | Secondary surfaces and borders |
| light | #f6eddf | Card backgrounds and highlights |
| ocean | #305873 | Links and interactive elements |
| mist | #8ca1aa | Helper text and muted UI |

Register and profile use a clay/light theme (parchment-like). Sign-in uses night/ocean storm framing.

## Design principles

1. **Clarity over decoration** — forms must be easy to read and complete.
2. **Progressive disclosure** — show information as needed.
3. **Accessibility first** — labeled fields, keyboard navigation, WCAG AA contrast.
4. **Visual consistency** — reuse OdysseyButton, Logo, Ship, OliveBranch from the shared visual language.
5. **Subtle theming** — pottery motifs accent, not obscure, functional UI.

## Page structure

| Route | Layout |
| --- | --- |
| /sign-in | SignInShell — storm backdrop, centered card, logo links to landing; primary submit (`.sign-in-btn`) plus compact secondary actions (`.sign-in-btn--secondary`) for forgot password and mode switch |
| /register | StormPageFrame + PageShell — single-column form (~640–720px), clay background |
| /profile | Same shell — wide compact card; overview grid (applicant details + timeline); sign-out below the grid |

Form styling: required marks, inline Zod errors, grouped MLH fields, generous spacing. Success step uses Ship + OliveBranch before redirect to profile.

## Decorative elements (use sparingly)

- Greek key / meander borders on cards
- Ship illustration (background + success state)
- Olive branch on success confirmation
- Storm/rain on sign-in (SignInStormBackdrop)
- Incised SVG line art for borders

Component details: [src/components/art/README.md](../src/components/art/README.md)

## Motion

- Smooth focus/hover transitions on fields, sign-in buttons, and OdysseyButton
- Storm animation on sign-in (respects prefers-reduced-motion)
- Weather mood toggle (calm / enrage) on register and profile
- Success step entrance fade/slide

## Form fields and validation

Authoritative field list and Zod rules: [shared/registration/schema.ts](../shared/registration/schema.ts) and [shared/README.md](../shared/README.md).

## Form UX (current behavior)

| Behavior | Detail |
| --- | --- |
| Draft autosave | applications:saveApplicationDraft debounced ~800ms while status is draft |
| Resume upload | POST /resume-upload before submit; capability token redeemed at registrations:register |
| Validation | Client Zod on submit + blur; server validateRegistrationPayload() is authoritative |
| Errors | Inline per field; Convex/HTTP errors mapped via shared/registration/submitErrors.ts |
| After submit | Brief SuccessStep, then redirect to /profile |

## Related docs

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes and data flows |
| [API.md](API.md) | Draft and submit endpoints |
| Landing design context | [hackuta-2026-repository/HACKUTA_DESIGN_CONTEXT.md](https://github.com/aroudrasthakur/hackuta-2026-repository/blob/main/HACKUTA_DESIGN_CONTEXT.md) |

Parent index: [README.md](README.md)
