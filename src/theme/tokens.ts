/**
 * USKOČI — dizajn tokeni
 *
 * Tonovi su vlasnikovi i zaključani: forest, teal, ivory, cream, narandžasta.
 * Ono što je dodato je LESTVICA. Originalna paleta je imala rupu od 0.439 u
 * svetlini između teal2 i line, pa ništa nije moglo da se odigne ni od čega.
 * Ovde je najveći razmak 0.160, a podloga i kartica se razlikuju za 0.087.
 *
 * Svaki par teksta i podloge ispod je proveren na WCAG AA (4.5:1).
 * Ne dodavati boju koja nije prošla tu proveru.
 */

export const palette = {
  // tamna strana — zaglavlja, hero kartice, istaknute površine
  forest900: '#0A2C28',
  forest800: '#0E3D37', // vlasnikov forest
  forest700: '#1B574C',
  forest600: '#276D5F',
  teal500: '#2E7A6A', // vlasnikov teal
  teal400: '#5D9387', // vlasnikov teal2 — SAMO kao površina, ne kao tekst na tamnom

  // srednji tonovi — popuna rupe; ivice, razdelnici, neaktivna stanja, mapa
  sage300: '#9BB1A0',
  sage200: '#C9C7B2',
  line100: '#E7D6BE', // vlasnikova linija

  // svetla strana — razmaknuta da postoji dubina
  cream050: '#F8EBD7', // vlasnikov cream
  ground: '#FBF1E2', // podloga aplikacije
  surface: '#FFFCF7', // kartica
  raised: '#FFFFFF', // modal, sheet, ono što lebdi

  // narandžasta ima DVA tokena i to nije stilski hir:
  // #FF7908 kao tekst na svetloj podlozi daje 2.51 — to je defekt.
  orange: '#FF7908', // POVRŠINA: dugme, badž. Tamno mastilo na njoj = 6.71
  orangeInk: '#C23C00', // TEKST na svetloj podlozi = 5.21
  orangeSoft: '#FFF0E2', // podloga za narandžasti akcenat
  onOrange: '#25150A', // mastilo koje ide NA narandžastu

  // tekst
  ink: '#0E3D37', // na svetloj = 11.78
  inkMuted: '#5C6F69', // na svetloj = 5.22 (original #657872 je padao na 3.98)
  onDark: '#FBF2E5', // na forest800 = 10.87
  onDarkMuted: '#73A99D', // na forest800 = 4.53 (teal400 je padao na 3.44)

  // semantika — nikad sama, uvek uz ikonu ili tekst
  success: '#1D6F4B',
  successBg: '#EAF6EF',
  danger: '#9E3626',
  dangerBg: '#F8E3DE',
  warn: '#8A5100',
  warnBg: '#FFF4DF',
  info: '#245EA8',
  infoBg: '#EAF2FF',
} as const;

/** 4/8 ritam. Ne uvoditi vrednosti van ove skale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Tipografija. Minimum 12px za sve što nosi značenje —
 * referenca je imala tekst od 7px, uključujući labelu na dugmetu.
 */
export const type = {
  display: { fontSize: 30, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '800' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' as const },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.6 },
  action: { fontSize: 15, lineHeight: 20, fontWeight: '700' as const, letterSpacing: -0.1 },
} as const;

/**
 * Pokret. Vrednosti nisu izmišljene — dolaze iz pravila:
 * ease-in se ne koristi na UI, izlaz je kraći od ulaza,
 * a sve što je pod prstom ide na spring, ne na timing.
 */
export const motion = {
  press: 120, // odziv na dodir
  toggle: 180, // prekidač, čip
  enter: 260,
  exit: 180, // izlaz je kraći od ulaza
  easeOut: [0.23, 1, 0.32, 1] as const,
  easeInOut: [0.77, 0, 0.175, 1] as const,
  sheet: [0.32, 0.72, 0, 1] as const,
  pressScale: 0.97,
  spring: { duration: 400, dampingRatio: 0.85 },
  springSheet: { duration: 300, dampingRatio: 0.8 },
} as const;

/** Minimalna dodirna meta. Ako je vizuelno manje, širi se hitSlop-om. */
export const touch = {
  min: 44,
  gap: 8,
} as const;

export const elevation = {
  card: {
    shadowColor: '#0E3D37',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0E3D37',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export type Palette = typeof palette;
