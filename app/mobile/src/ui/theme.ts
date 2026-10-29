/**
 * The AEGIS design tokens, ported from `web/app/globals.css` (tweakcn
 * "nature") so the app and the project site are one system rather than two
 * things that happen to be green.
 *
 * The oklch values there were converted to sRGB hex; the names are kept
 * identical so a token can be traced back to the stylesheet it came from.
 * Light is the default, because a screen read in direct sun is the hard case.
 * Dark is opt-in from the Profile screen, for evenings and the shed.
 *
 * `color`, `chart` and `shadow` are live: they read the active palette on every
 * access, so a switch restyles the whole app without a restart. Anything built
 * once at module load (a StyleSheet, a tone table) has to go through
 * `themed()` or `live()` below, or it freezes on the palette it was born with.
 */

export type Scheme = 'light' | 'dark';

const lightColor = {
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
};

export type Palette = { [K in keyof typeof lightColor]: string };

/** Dark counterpart. Same hues, re-stepped so every pairing keeps its contrast. */
const darkColor: Palette = {
  background: '#111611',
  card: '#1A211A',
  foreground: '#EFE9DF',
  muted: '#242C24',
  mutedForeground: '#BDB6A9',
  fgSubtle: '#9AA595',
  border: '#2E3A2E',

  primary: '#66BB6A',
  primaryForeground: '#0A1F0C',
  secondary: '#1D3320',
  secondaryForeground: '#A5D6A7',
  accent: '#2F5A32',
  accentForeground: '#C8E6C9',

  warning: '#F0A830',
  warningForeground: '#F5BC63',
  warningMuted: '#3A2B10',
  warningBorder: '#5E461A',

  destructive: '#F0716A',
  destructiveForeground: '#1F0A08',
  destructiveMuted: '#3E1C19',
  destructiveBorder: '#6B2F2A',

  deep: '#0A1F0C',
  deepElevated: '#1F3420',
  deepBorder: '#304330',
  deepForeground: '#F8F5F0',
  deepMuted: '#99AA9A',

  unknown: '#A3AEBA',
  unknownSurface: '#222932',
  unknownBorder: '#36404B',
};

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
const lightChart = {
  fill: {
    good: lightColor.primary,
    warn: lightColor.warning,
    bad: lightColor.destructive,
    unknown: lightColor.unknown,
  },
  track: {
    good: '#D7EBD8',
    warn: '#F7E3C2',
    bad: '#F7D8D4',
    unknown: '#E4E9EE',
  },
  grid: '#EDE5DA',
  axis: '#DCD1C4',
  muted: '#CFC3B4',
  gap: 2,
};

const darkChart: typeof lightChart = {
  fill: {
    good: darkColor.primary,
    warn: darkColor.warning,
    bad: darkColor.destructive,
    unknown: darkColor.unknown,
  },
  track: {
    good: '#233A26',
    warn: '#40321A',
    bad: '#44211E',
    unknown: '#2A313A',
  },
  grid: '#262E26',
  axis: '#364036',
  muted: '#5C6357',
  gap: 2,
};

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

  /** The mono eyebrow that opens a section. */
  eyebrow: { fontFamily: font.mono, fontSize: 11.5, letterSpacing: 0.9 },
  /** The smallest label. WHY / CHECK NEXT. 11px: below that it was tiring to read, in Hindi most of all. */
  micro: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.8 },
  /** Chip keys: 10px at 0.09em. */
  chipLabel: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.7 },
  chipValue: { fontFamily: font.mono, fontSize: 13 },

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

const lightShadow = {
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
};

const darkShadow: typeof lightShadow = {
  card: { ...lightShadow.card, shadowColor: '#000000', shadowOpacity: 0.35 },
  lifted: { ...lightShadow.lifted, shadowColor: '#000000', shadowOpacity: 0.5 },
};

// ---- The active scheme ----------------------------------------------------

/** Both palettes, for the preview swatches on the Profile screen. */
export const palettes: Record<Scheme, Palette> = { light: lightColor, dark: darkColor };

let active: Scheme = 'light';

export function getScheme(): Scheme {
  return active;
}

/** Set before the tree re-renders, so what renders next already reads it. */
export function setActiveScheme(next: Scheme) {
  active = next;
}

/**
 * An object whose every property read goes to `read()` afresh. Used so tables
 * built at module load (tone maps, chart fills) follow the active palette.
 */
export function live<T extends object>(read: () => T): T {
  return new Proxy({} as T, {
    get: (_t, key) => Reflect.get(read(), key),
    has: (_t, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(read(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/**
 * `StyleSheet.create` that is rebuilt when the scheme changes:
 *
 *   const s = themed(() => StyleSheet.create({ card: { backgroundColor: color.card } }));
 */
export function themed<T extends object>(make: () => T): T {
  let cached: { scheme: Scheme; value: T } | null = null;
  return live(() => {
    if (!cached || cached.scheme !== active) cached = { scheme: active, value: make() };
    return cached.value;
  });
}

export const color: Palette = live(() => (active === 'dark' ? darkColor : lightColor));
export const chart = live(() => (active === 'dark' ? darkChart : lightChart));
/** The site's card shadow, translated to RN's elevation model. */
export const shadow = live(() => (active === 'dark' ? darkShadow : lightShadow));
