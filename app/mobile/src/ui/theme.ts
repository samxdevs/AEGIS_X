/**
 * The AEGIS design tokens, ported from `web/app/globals.css` (tweakcn
 * "nature") so the app and the project site are one system rather than two
 * things that happen to be green.
 *
 * The oklch values there were converted to sRGB hex; the names are kept
 * identical so a token can be traced back to the stylesheet it came from.
 * Light only — the site deliberately removed its dark block, and a screen that
 * has to stay readable in direct sun is not where to reinstate one.
 */

export const color = {
  background: '#F8F5F0',
  card: '#FFFFFF',
  foreground: '#3E2723',
  muted: '#F0E9E0',
  mutedForeground: '#6D4C41',
  /**
   * Third text level, below mutedForeground. Used for mono micro-labels.
   *
   * Darkened from #9A7F77, which measured 3.70:1 on the card surface — under
   * the 4.5:1 needed for body text, and these are 10.5px labels, so the
   * large-text allowance does not apply. This step holds the same warm hue and
   * measures 4.98:1 on card, 4.58:1 on the page background.
   */
  fgSubtle: '#846A62',
  border: '#E0D6C9',

  primary: '#2E7D32',
  primaryForeground: '#FFFFFF',
  secondary: '#E8F5E9',
  secondaryForeground: '#1B5E20',
  accent: '#C8E6C9',
  accentForeground: '#1B5E20',

  /** Degraded but working — STALE inputs, provisional thresholds. */
  warning: '#D08600',
  warningForeground: '#B14F00',
  warningMuted: '#FBE5C3',
  warningBorder: '#F0CF9D',

  /** Genuine failure — a dead node, a schema violation. */
  destructive: '#C62828',
  destructiveForeground: '#FFFFFF',
  destructiveMuted: '#FFDEDA',
  destructiveBorder: '#FAC6BF',

  /**
   * The dark green the site uses for its inverted sections. Here it carries
   * the header band, so the app opens on the same note the site does.
   */
  deep: '#0A1F0C',
  deepElevated: '#1F3420',
  deepBorder: '#304330',
  deepForeground: '#F8F5F0',
  deepMuted: '#99AA9A',

  /**
   * "Not measured" is its own visual category, deliberately neutral: it must
   * not read as an alarm (it is not a failure) and must not read as a value
   * (it is not one). §14.2 — never blank, never zero, never a dash.
   */
  unknown: '#5B6570',
  unknownSurface: '#EEF1F4',
  unknownBorder: '#D6DDE4',
} as const;

/**
 * Chart tokens.
 *
 * Almost nothing this app plots is *categorical*. A canopy-stress band, an
 * input's freshness, a verdict — these are **status**: a small fixed scale with
 * reserved meaning, running good → warning → serious. So the marks draw from
 * the status palette above rather than from a series palette, and every one of
 * them ships with a written label beside it. Colour is never the only channel.
 *
 * Each status gets a light step of its own hue for meter tracks, so an unfilled
 * track reads as the same ramp as its fill rather than as dead grey.
 */
export const chart = {
  /** Meter fills, in severity order. */
  fill: {
    good: color.primary,
    warn: color.warning,
    bad: color.destructive,
    unknown: color.unknown,
  },
  /** The unfilled remainder of a meter: a lighter step of the fill's own hue. */
  track: {
    good: '#D7EBD8',
    warn: '#F7E3C2',
    bad: '#F7D8D4',
    unknown: '#E4E9EE',
  },
  /** Hairline grid and axis rules. One shade off the surface, never dashed. */
  grid: '#EDE5DA',
  axis: '#DCD1C4',
  /** De-emphasis: context marks that must recede behind the one that matters. */
  muted: '#CFC3B4',
  /** The gap punched between adjacent fills, in px. Never a stroke. */
  gap: 2,
} as const;

export const font = {
  sans: 'Montserrat_400Regular',
  sansMedium: 'Montserrat_500Medium',
  sansBold: 'Montserrat_700Bold',
  mono: 'SourceCodePro_400Regular',
  monoBold: 'SourceCodePro_600SemiBold',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** --radius is 0.5rem on the site; the ramp below matches its multipliers. */
export const radius = {
  sm: 5,
  md: 6,
  lg: 8,
  xl: 11,
  xxl: 14,
  pill: 999,
} as const;

/**
 * The type ramp, matching the site's.
 *
 * The site's tracking is in em; React Native's letterSpacing is in points, so
 * each value below is the em figure multiplied by its own font size. Two
 * things carry most of the identity: mono micro-labels set very small with
 * very wide tracking, and numbers always in mono so they read as numbers.
 */
export const type = {
  /** Page headline. */
  display: { fontFamily: font.sansBold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  title: { fontFamily: font.sansBold, fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  cardTitle: { fontFamily: font.sansBold, fontSize: 15.5, letterSpacing: -0.25 },

  /** The mono eyebrow that opens a section: 10.5px at 0.1em. */
  eyebrow: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 1.05 },
  /** The smallest label on the site: 9.5px at 0.1em. WHY / CHECK NEXT. */
  micro: { fontFamily: font.mono, fontSize: 9.5, letterSpacing: 0.95 },
  /** Chip keys: 10px at 0.09em. */
  chipLabel: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.9 },
  chipValue: { fontFamily: font.mono, fontSize: 12.5 },

  body: { fontFamily: font.sans, fontSize: 14.5, lineHeight: 24 },
  small: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.sansMedium, fontSize: 13.5 },

  /**
   * The one number a screen leads with. Exactly one per view, in the same sans
   * as everything else — a display face here reads as decoration — and with the
   * font's proportional figures, because equal-width digits make a number like
   * 121 look loose at this size.
   */
  hero: { fontFamily: font.sansBold, fontSize: 44, lineHeight: 48, letterSpacing: -1.4 },

  /** Big mono figure, as on the site's StatCard. */
  stat: { fontFamily: font.mono, fontSize: 26, letterSpacing: -0.5 },
  value: { fontFamily: font.monoBold, fontSize: 20 },
  valueSmall: { fontFamily: font.mono, fontSize: 12.5 },
} as const;

/** The site's card shadow, translated to RN's elevation model. */
export const shadow = {
  card: {
    shadowColor: '#3E2723',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#3E2723',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
