# HackUTA 2026 Registration — Design Context

Last updated: September 20, 2026

## Project status

- Repository: `hackuta-2026-registration`
- Current scope is the registration form and application flow.
- **Implemented sections:** Registration form with multi-step flow (application, success).
- Palette tokens live in `src/styles/index.css` (`--color-*` / `--ink`, `--clay`, etc.).

## Theme and art direction

- Theme: Greek mythology, focused on Homer's *Odyssey*.
- Visual treatment: ancient pottery and illustration style, consistent with the landing page.
- Preferred historical grammar: Attic/Corinthian black-figure pottery.
- Use terracotta/clay as the primary background to evoke pottery surfaces.
- Registration is treated as the first step of the hacker's odyssey — gathering crew information before the journey begins.

## Core creative concept: The Call to Adventure

The registration form represents the beginning of the hacker's odyssey. The design should feel like an ancient scroll or pottery inscription where participants record their commitment to the journey.

Central metaphor:

> Registration is signing the crew manifest — your commitment to embark on the hackathon odyssey.

## Visual system

Site palette (defined in `src/styles/index.css`):

- Ink: `#1a3a52` (`--color-ink` / `--ink`) — primary text and form borders
- Night: `#102f46` (`--color-night` / `--night`) — accent backgrounds
- Clay: `#eee3d2` (`--color-clay` / `--clay`) — primary background (terracotta pottery surface)
- Sand: `#ded0bc` (`--color-sand` / `--sand`) — secondary surfaces and borders
- Light: `#f6eddf` (`--color-light` / `--light`) — card backgrounds and highlights
- Ocean: `#305873` (`--color-ocean` / `--ocean`) — links and interactive elements
- Mist: `#8ca1aa` (`--color-mist` / `--mist`) — helper text and muted UI

The registration page uses a **white/clay theme** rather than the dark theme, creating a parchment-like or pottery surface feel.

## Design principles for registration

1. **Clarity over decoration**: Forms must be easy to read and complete.
2. **Progressive disclosure**: Show information as needed, don't overwhelm.
3. **Accessibility first**: All form fields must be properly labeled and keyboard navigable.
4. **Visual consistency**: Use the same Odyssey-themed components as the landing page (OdysseyButton, Logo, etc.).
5. **Subtle theming**: Greek pottery motifs should accent, not obscure, the functional form.

## Page structure

### 1. Registration page layout
- Centered single-column layout (max-width ~640-720px)
- Clay background evokes pottery surface
- White/light card contains the form with subtle borders
- Logo at top links back to landing page
- Decorative art elements frame the form without interfering

### 2. Form styling
- Clean, readable input fields with clear labels
- Required fields marked with asterisks
- Inline validation with helpful error messages
- Group related fields visually
- Generous spacing for comfortable completion

### 3. Success state
- Celebratory messaging
- Clear next steps
- Visual confirmation that the journey has begun

## Recommended decorative elements

Use sparingly to enhance without cluttering:

- Greek key / meander borders on cards
- Small pottery shard shapes as section dividers
- Olive branch or laurel accents near success state
- Ship illustration on success confirmation
- Wave patterns as subtle backgrounds
- Incised line artwork (SVG strokes) for decorative borders

## Technical direction

- React/TypeScript with Vite
- Tailwind CSS utility classes
- Form state management with controlled components
- Convex backend for data persistence
- Proper form validation and accessibility
- Mobile-responsive design

## Animation and motion

Keep animations subtle and purposeful:
- Form field focus states with smooth transitions
- Button hover and press states
- Success state entrance with gentle fade/slide
- Scroll-triggered decorative element reveals (optional)
- Respect `prefers-reduced-motion` for accessibility

## Accessibility requirements

- All form fields must have associated labels
- Error messages announced to screen readers
- Keyboard navigation throughout
- Focus indicators on all interactive elements
- Color contrast ratios meet WCAG AA standards
- Form instructions clear and concise

## Components to reuse from landing

- `OdysseyButton`: Primary CTA button with pottery-themed styling
- `Logo`: HackUTA logo with variants (dark/light, header/decorative)
- `Ship`: Decorative ship illustration
- `OliveBranch`: Success state decoration

## Reference files from landing

- Design system: `hackuta-2026-repository/HACKUTA_DESIGN_CONTEXT.md`
- Component library: `hackuta-2026-repository/src/components/`
- Shared styles: Use consistent palette and typography

## File organization

```
src/
├── components/
│   ├── art/              # Decorative SVG components
│   │   ├── Logo.tsx
│   │   ├── Ship.tsx
│   │   ├── OliveBranch.tsx
│   │   └── ...
│   ├── OdysseyButton.tsx # Themed button component
│   └── AuthBootstrap.tsx # Auth wrapper
├── pages/
│   └── Register/
│       ├── RegisterPage.tsx      # Main registration page
│       ├── ApplicationForm.tsx   # Multi-step form
│       ├── SuccessStep.tsx       # Success confirmation
│       └── components/           # Form-specific components
├── styles/
│   └── index.css        # Global styles and theme tokens
└── constants/
    └── site.ts          # Shared constants
```

## Form fields and validation

All validation rules are defined in `shared/registration/validation.ts` and shared between client and server.

Required fields:
- First name, last name
- Phone number, age
- School, level of study, major, graduation year
- Gender
- T-shirt size
- First hackathon (yes/no)
- How did you hear about us
- Emergency contact name and phone
- MLH Code of Conduct agreement
- MLH data sharing consent

Optional fields:
- Race/ethnicity
- Dietary restrictions
- Resume upload
- LinkedIn, GitHub, portfolio URLs
- Accessibility needs
- MLH communications consent

## Historical and visual references

Same as landing page — reference Met Museum pottery collections, black-figure technique, and ancient Greek decorative motifs.

## Notes on form UX

- Auto-save is not implemented — submission is atomic
- Resume upload happens at submission time
- Form validation happens on submit and on field blur
- Error messages appear inline near the affected field
- Success page provides clear next steps and contact info

