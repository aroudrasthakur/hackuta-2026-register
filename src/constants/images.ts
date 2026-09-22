export const LOGO_WIDTHS = [120, 240, 400, 640] as const;

const LOGO_FILES = {
  light: "hackuta-logo",
  dark: "hackuta-logo-white",
} as const;

export type LogoVariant = keyof typeof LOGO_FILES;
export type LogoLayout = "header" | "hero" | "footer";

export const LOGO_SIZES: Record<LogoLayout, string> = {
  header: "44px",
  hero: "(max-width: 599px) 200px, 320px",
  footer: "40px",
};

export function logoSrcSet(variant: LogoVariant) {
  const base = LOGO_FILES[variant];
  return LOGO_WIDTHS.map((w) => `/images/logos/${base}-${w}.webp ${w}w`).join(
    ", ",
  );
}

export function logoDefaultSrc(variant: LogoVariant, width = 400) {
  const base = LOGO_FILES[variant];
  return `/images/logos/${base}-${width}.webp`;
}
