/**
 * The renderer primitives, in the site's visual idiom.
 *
 * Ported shapes from `web/components/ui/bits.tsx` and `alert-card.tsx`:
 * Eyebrow (mono label with a dot), Chip (mono key/value), StatCard (big mono
 * figure over a caption), and the bordered sub-panel the alert card uses for
 * its WHY / CHECK NEXT blocks. Same radii, same tracking, same three-level
 * text hierarchy.
 *
 * §14.3 still governs the behaviour underneath the styling: "the app is the
 * last place a fabricated number can be caught, and the easiest place for one
 * to be created." `<Measurement>` takes a value and its status together and
 * has no prop that renders a null as 0, blank, or a dash.
 */

import { Children, createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, radius, shadow, space, type } from './theme.ts';
import type { SourceKind, VerificationStatus } from '../schema/advisory.ts';
import { presentVerification } from '../schema/templates.ts';
import { currentLanguage, tr } from '../i18n/tr.ts';
import type { Language } from '../schema/templates.ts';

// ---- Tones ----------------------------------------------------------------

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'unknown';

/** border / surface / text for each tone, matching the site's chip variants. */
export const TONE: Record<Tone, { border: string; bg: string; fg: string }> = {
  neutral: { border: color.border, bg: color.muted, fg: color.mutedForeground },
  good: { border: color.accent, bg: color.secondary, fg: color.secondaryForeground },
  warn: { border: color.warningBorder, bg: color.warningMuted, fg: color.warningForeground },
  bad: { border: color.destructiveBorder, bg: color.destructiveMuted, fg: color.destructive },
  unknown: { border: color.unknownBorder, bg: color.unknownSurface, fg: color.unknown },
};

// ---- Eyebrow --------------------------------------------------------------

/** The mono label with a leading dot that opens a section on the site. */
export function Eyebrow({
  children,
  tone = 'good',
  onDeep = false,
}: {
  children: ReactNode;
  tone?: Tone;
  onDeep?: boolean;
}) {
  const t = onDeep
    ? { border: color.deepBorder, bg: 'rgba(31,52,32,0.6)', fg: color.deepMuted }
    : TONE[tone];
  return (
    <View style={[s.eyebrow, { borderColor: t.border, backgroundColor: t.bg }]}>
      <View style={[s.dot, { backgroundColor: onDeep ? color.primary : t.fg }]} />
      <Text style={[type.eyebrow, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

// ---- Chip -----------------------------------------------------------------

/** Mono key/value chip. `label` is optional, as on the site. */
export function Chip({
  label,
  value,
  tone = 'neutral',
}: {
  label?: string;
  value: ReactNode;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <View style={[s.chip, { borderColor: t.border, backgroundColor: t.bg }]}>
      {label ? <Text style={[type.chipLabel, { color: t.fg }]}>{label}</Text> : null}
      <Text style={[type.chipValue, { color: tone === 'neutral' ? color.foreground : t.fg }]}>
        {value}
      </Text>
    </View>
  );
}

/** The compact status pill — the site's SeverityChip. */
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[s.statusChip, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.chipLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ---- Card -----------------------------------------------------------------

/**
 * True inside a `<Group>`. A `Card` rendered there becomes one foldable row of
 * the group instead of a card of its own, so the detailed cards can be stacked
 * into one compact list without each being rewritten.
 */
const InGroup = createContext(false);

/** True inside a `<TileGrid>`: a `Card` with a `tile` renders as a tile. */
const InTiles = createContext(false);

/** What a reading shows as a weather-style tile. */
export type TileSpec = {
  icon: ReactNode;
  /** Short caps label above the number: "LEAF TEMP". */
  label: string;
  /** The one big figure, or a short phrase when nothing was measured. */
  value: string;
  unit?: string;
  tone?: Tone;
  /** True when `value` is a phrase like "Not measured" rather than a reading. */
  muted?: boolean;
  /** The small graphic that places the value on its scale. */
  visual?: ReactNode;
  caption?: string;
};

export function Card({
  title,
  eyebrow,
  right,
  summary,
  summaryTone = 'neutral',
  note,
  tile,
  children,
}: {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  /**
   * The one-line reading shown while folded inside a `<Group>`. Ignored on a
   * standalone card, which always shows its full body.
   */
  summary?: string;
  summaryTone?: Tone;
  /**
   * A caveat that must stay visible while folded, because the summary would
   * mislead without it. Rendered under the summary, never behind the tap.
   */
  note?: string;
  /** How this card looks inside a `<TileGrid>`. Ignored everywhere else. */
  tile?: TileSpec;
  children: ReactNode;
}) {
  const inTiles = useContext(InTiles);
  const inGroup = useContext(InGroup);
  if (inTiles && tile) {
    return (
      <Tile spec={tile} title={title ?? eyebrow ?? ''}>
        {children}
      </Tile>
    );
  }
  if (inGroup) {
    return (
      <Fold title={title ?? eyebrow ?? ''} summary={summary} summaryTone={summaryTone} note={note}>
        {children}
      </Fold>
    );
  }
  return (
    <View style={s.card}>
      {(title || eyebrow || right) && (
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Text style={[type.micro, { color: color.fgSubtle, marginBottom: 5 }]}>
                {eyebrow.toUpperCase()}
              </Text>
            ) : null}
            {title ? (
              <Text style={[type.cardTitle, { color: color.foreground }]}>{title}</Text>
            ) : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * One card holding several foldable rows.
 *
 * Every child `Card` renders as a row: its title, a one-line summary and a
 * chevron. Tapping opens the full card body in place. This is what keeps the
 * advisory screen to about two phone-heights without dropping any of what the
 * individual cards say — it is all still there, one tap down.
 */
export function Group({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={s.card}>
      {eyebrow || title ? (
        <View style={{ marginBottom: space.xs }}>
          {eyebrow ? (
            <Text style={[type.micro, { color: color.fgSubtle, marginBottom: 5 }]}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
          {title ? <Text style={[type.cardTitle, { color: color.foreground }]}>{title}</Text> : null}
        </View>
      ) : null}
      <InGroup.Provider value>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? s.groupRule : undefined}>
            {row}
          </View>
        ))}
      </InGroup.Provider>
    </View>
  );
}

/**
 * The field readings as a grid of tiles, weather-app style.
 *
 * Two tiles to a row, each an icon, one big figure and a small graphic. A tap
 * widens that tile to the full row and opens the full card beneath its figure,
 * so the detail sits where the eye already is.
 */
export function TileGrid({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      {eyebrow || title ? (
        <View style={{ marginBottom: space.sm, paddingHorizontal: 2 }}>
          {eyebrow ? (
            <Text style={[type.micro, { color: color.fgSubtle, marginBottom: 4 }]}>
              {eyebrow.toUpperCase()}
            </Text>
          ) : null}
          {title ? <Text style={[type.cardTitle, { color: color.foreground }]}>{title}</Text> : null}
        </View>
      ) : null}
      <InTiles.Provider value>
        <View style={s.tileGrid}>{children}</View>
      </InTiles.Provider>
    </View>
  );
}

function Tile({ spec, title, children }: { spec: TileSpec; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tone = spec.muted ? 'unknown' : (spec.tone ?? 'neutral');
  const t = TONE[tone];
  const bg = tone === 'neutral' ? color.card : t.bg;
  const fg = tone === 'neutral' ? color.foreground : t.fg;

  return (
    <View style={[s.tile, { backgroundColor: bg, borderColor: t.border }, open && s.tileOpen]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${spec.value}${spec.unit ? ` ${spec.unit}` : ''}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        <View style={s.tileHead}>
          {spec.icon}
          <Text style={[type.micro, { color: fg, flex: 1, opacity: 0.85 }]} numberOfLines={1}>
            {spec.label}
          </Text>
          <Text style={[type.chipValue, { color: fg, opacity: 0.6 }]}>{open ? '−' : '+'}</Text>
        </View>

        <View style={s.tileValueRow}>
          <Text
            style={[spec.muted ? s.tileMuted : s.tileValue, { color: fg }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {spec.value}
          </Text>
          {spec.unit && !spec.muted ? (
            <Text style={[type.label, { color: fg, marginLeft: 3, opacity: 0.8 }]}>{spec.unit}</Text>
          ) : null}
        </View>

        {spec.visual && !spec.muted ? <View style={{ marginTop: 6 }}>{spec.visual}</View> : null}

        {spec.caption ? (
          <Text style={[type.small, { color: fg, marginTop: 6, opacity: 0.85 }]} numberOfLines={open ? undefined : 2}>
            {spec.caption}
          </Text>
        ) : null}
      </Pressable>

      {open ? <View style={s.tileBody}>{children}</View> : null}
    </View>
  );
}

/** A row that shows a summary and opens to its full content on tap. */
export function Fold({
  title,
  summary,
  summaryTone = 'neutral',
  note,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  summaryTone?: Tone;
  note?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = TONE[summaryTone];
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? tr('Hides the details') : tr('Shows the details')}
        style={({ pressed }) => [s.foldHead, pressed && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: color.foreground }]}>{title}</Text>
          {summary ? (
            <View style={s.foldSummary}>
              <View style={[s.dot, { backgroundColor: summaryTone === 'neutral' ? color.fgSubtle : t.fg }]} />
              <Text
                style={[
                  type.small,
                  { color: summaryTone === 'neutral' ? color.mutedForeground : t.fg, flex: 1 },
                ]}
              >
                {summary}
              </Text>
            </View>
          ) : null}
          {note ? (
            <Text style={[type.small, { color: color.fgSubtle, marginTop: 3, fontSize: 12 }]}>
              {note}
            </Text>
          ) : null}
        </View>
        <Text style={[type.chipValue, { color: color.fgSubtle, fontSize: 16 }]}>
          {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open ? <View style={{ paddingBottom: space.md }}>{children}</View> : null}
    </View>
  );
}

/**
 * The bordered sub-panel the alert card uses for WHY and CHECK NEXT: a mono
 * micro-label over prose, tinted by tone.
 */
export function Panel({
  label,
  tone = 'neutral',
  children,
}: {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <View style={[s.panel, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.micro, { color: t.fg }]}>{label.toUpperCase()}</Text>
      <Text style={[type.small, { color: t.fg, marginTop: 6 }]}>{children}</Text>
    </View>
  );
}

/** Big mono figure over a caption — the site's StatCard. */
export function StatCard({
  value,
  caption,
  highlight = false,
}: {
  value: string;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        s.stat,
        highlight
          ? { borderColor: color.accent, backgroundColor: color.secondary }
          : { borderColor: color.border, backgroundColor: color.card },
      ]}
    >
      <Text style={[type.stat, { color: highlight ? color.primary : color.foreground }]}>
        {value}
      </Text>
      <Text
        style={[
          type.small,
          { color: highlight ? color.secondaryForeground : color.mutedForeground, marginTop: 5 },
        ]}
      >
        {caption}
      </Text>
    </View>
  );
}

// ---- Confidence bar -------------------------------------------------------

/** The alert card's confidence meter: a 6px track with a mono figure beside it. */
export function ConfidenceBar({ value, label = 'CONF' }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={s.confRow}>
      <Text style={[type.micro, { color: color.fgSubtle }]}>{label}</Text>
      <View style={s.confTrack}>
        <View style={[s.confFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={[type.chipValue, { color: color.foreground }]}>{pct.toFixed(2)}</Text>
    </View>
  );
}

// ---- Measurement ----------------------------------------------------------

/**
 * The one way this app renders a quantity.
 *
 * Pass the value and the reason it might be absent in the same breath. A null
 * with no status is a programming error, not a display state, and it renders
 * as a loud one rather than as an innocuous blank.
 */
export function Measurement({
  label,
  value,
  unit,
  status,
  reason,
  source,
  note,
  size = 'default',
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  /** Machine-readable status. Required when value is null (§7.3 rule 1). */
  status?: string;
  /** Human-readable reason. Shown verbatim when the value is absent. */
  reason?: string;
  source?: SourceKind;
  note?: string;
  size?: 'default' | 'compact';
}) {
  const absent = value === null || value === undefined;

  return (
    <View style={s.measurement}>
      <View style={s.measurementHead}>
        <Text style={[type.chipLabel, { color: color.fgSubtle }]}>{label.toUpperCase()}</Text>
        {/* No value, no provenance: a MEASURED tag over NOT MEASURED says both. */}
        {source && !absent ? <SourceTag source={source} /> : null}
      </View>

      {absent ? (
        <NotMeasured status={status} reason={reason} />
      ) : (
        <View style={s.valueRow}>
          <Text
            style={[
              size === 'compact' ? type.value : type.stat,
              { color: color.foreground },
            ]}
          >
            {String(value)}
          </Text>
          {unit ? (
            <Text style={[type.chipValue, { color: color.fgSubtle, marginLeft: 5 }]}>{unit}</Text>
          ) : null}
        </View>
      )}

      {note ? (
        <Text style={[type.small, { color: color.mutedForeground, marginTop: 6 }]}>{note}</Text>
      ) : null}
    </View>
  );
}

/**
 * The explicit not-measured state. Never blank, never zero, never a dash.
 *
 * A missing status is itself rendered as a fault, because a null the app
 * cannot explain is exactly what §7.3 rule 1 exists to make impossible.
 */
export function NotMeasured({ status, reason }: { status?: string; reason?: string }) {
  const unexplained = !status && !reason;
  const t = unexplained ? TONE.bad : TONE.unknown;
  // The pod's own words, kept underneath ours. Its `*_reason` strings are
  // written for whoever is holding the device — "Optical path and calib_matrix
  // in progress" — so they belong below the farmer-facing sentence, not
  // instead of it, and they must not be thrown away either. The bare status
  // code is not shown: it is a string for the developer log, and on a phone
  // screen it read as an error message.
  const detail =
    statusDetail(status) ??
    statusDetail(reason) ??
    (reason && reason !== status ? reason : null);

  return (
    <View style={[s.notMeasured, { borderColor: t.border, backgroundColor: t.bg }]}>
      <View style={s.notMeasuredHead}>
        <Text style={[type.micro, { color: t.fg }]}>{tr('NOT MEASURED')}</Text>
      </View>
      <Text style={[type.small, { color: t.fg, marginTop: 6 }]}>
        {unexplained
          ? tr('No status given. The advisory does not say why this is missing. Treat this record as untrustworthy.')
          : humaniseStatus(status ?? reason)}
      </Text>
      {detail ? (
        <Text style={[type.valueSmall, { color: t.fg, opacity: 0.7, marginTop: 6 }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

/**
 * Fallback prose for a status code that arrived without a written reason.
 *
 * The pod normally sends its own sentence, and that is preferred — this is the
 * safety net for a code it did not narrate. Every branch is written for a
 * farmer rather than for a developer: a screen that prints NOT_SOLAR_NOON at
 * someone standing in a field has told them nothing.
 */
export function humaniseStatus(status?: string): string {
  // Several reasons arrive as a code with a parenthesised engineering detail
  // appended — "HARDWARE_NOT_CONNECTED (Target CSI camera /dev/video1 not
  // found...)". Match on the code and keep the detail for the developer view.
  const code = (status ?? '').split(' (')[0];

  switch (code) {
    // -- Thermal / CWSI ------------------------------------------------------
    case 'THERMAL_REFS_NOT_CONFIGURED':
      return tr('The thermal camera is working, but the wet and dry reference pads it measures against have not been set up. Canopy temperature is real; the stress index needs those pads and was not estimated without them.');
    case 'INSUFFICIENT_REFERENCE_GAP':
      return tr('The wet and dry reference pads were too close in temperature for the stress index to mean anything.');
    case 'WET_REF_VARIANCE_HIGH':
    case 'DRY_REF_VARIANCE_HIGH':
      return tr('One of the reference pads gave an unsteady reading, so the stress index was not worked out from it.');
    case 'HARDWARE_NOT_CONNECTED':
      return tr('The sensor this needs was not connected during the scan.');
    case 'REPLAY_THERMAL_NOT_OF_SCENE':
      return tr('This scan is a replay of a recorded video. The thermal camera was not pointed at the scene in the video, so its reading would describe somewhere else and was left out. The camera itself is fine.');

    // -- NDVI ----------------------------------------------------------------
    case 'GATED_HARDWARE_CALIBRATION':
    case 'PENDING_HARDWARE_FINALIZATION':
      return tr('The second camera and its bench calibration have not landed yet. Nothing is estimated in their place.');
    case 'NOIR_CAMERA_NOT_DETECTED_ON_CSI_1':
      return tr('The infrared camera was not found on the pod.');

    // -- Satellite -----------------------------------------------------------
    case 'NO_SATELLITE_DATA_RECORDED':
      return tr('No satellite image has been downloaded for this field yet. That step needs an internet connection, which the pod does not have in the field.');
    case 'NO_CLEAR_SCENE':
      return tr('Every recent satellite pass over this field was under cloud.');
    case 'CREDENTIALS_MISSING':
      return tr('The satellite service login is not set up on the pod.');
    case 'FIELD_CONFIG_MISSING':
    case 'FIELD_NOT_CONFIGURED':
      return tr('The boundary of this field has not been entered, so there is no area to read a satellite image over.');

    // -- Irrigation ----------------------------------------------------------
    case 'INSUFFICIENT_TEMPERATURE_HISTORY':
      return tr('Not enough temperature readings came back from the field station in the last day to work out water use.');
    case 'INSUFFICIENT_24H_HISTORY': {
      // "(need >=6 readings spanning >=6h in last 24h ..., found 26 readings
      // spanning 4.9h, ...)" — pull the two spans out; the rest stays as detail.
      const need = /need[^,]*?spanning\s*>=\s*([\d.]+)\s*h/.exec(status ?? '')?.[1];
      const found = /found[^,]*?spanning\s*([\d.]+)\s*h/.exec(status ?? '')?.[1];
      return (
        (need
          ? tr('The field station needs at least {h} hours of readings from the last day to work this out.', { h: need })
          : tr('The field station needs more hours of readings from the last day to work this out.')) +
        (found ? ` ${tr('It has {h} hours so far.', { h: found })}` : '')
      );
    }

    // -- Vegetation ----------------------------------------------------------
    case 'INSUFFICIENT_CANOPY_FRACTION':
      return tr('Too little of the frame was canopy. Below that point soil colour dominates and the reading would be about the ground, not the crop.');
    case 'OUT_OF_DOMAIN_FRACTION_EXCEEDED':
      return tr('Too much of the frame fell outside the range of greens this measure is defined for, so the average would have described a minority of the pixels.');
    case 'NO_FRAMES_ACCEPTED':
      return tr('No frame in this scan passed the checks needed to compute it.');

    // -- Growth stage --------------------------------------------------------
    case 'DAYS_SINCE_PLANTING_REQUIRED':
    case 'AWAITING_PLANTING_DATE':
      return tr('The planting date has not been entered, so the crop stage cannot be worked out.');
    case 'CROP_NOT_SPECIFIED':
      return tr('The scan did not settle on one crop, so there is no crop calendar to place it against.');
    case 'UNSUPPORTED_CROP':
      return tr('There is no growth-stage table for this crop in the system.');

    // -- Scan ----------------------------------------------------------------
    case 'GPS_TRACK_NOT_RECORDED':
      return tr('No satellite track was recorded during the walk, so the distance covered is not known.');

    default:
      return status ?? tr('Not available.');
  }
}

/**
 * The same reasons as `humaniseStatus`, cut to a phrase for a folded row.
 *
 * The full sentence is one tap away; this is what a farmer reads while
 * scanning the list, so it names the gap and nothing else.
 */
export function shortStatus(status?: string | null): string {
  const code = (status ?? '').split(' (')[0];
  switch (code) {
    case 'THERMAL_REFS_NOT_CONFIGURED':
      return tr('Reference pads not set up');
    case 'INSUFFICIENT_REFERENCE_GAP':
    case 'WET_REF_VARIANCE_HIGH':
    case 'DRY_REF_VARIANCE_HIGH':
      return tr('Reference pads gave a bad reading');
    case 'HARDWARE_NOT_CONNECTED':
      return tr('Sensor not connected');
    case 'REPLAY_THERMAL_NOT_OF_SCENE':
      return tr('Not used (replayed video)');
    case 'GATED_HARDWARE_CALIBRATION':
    case 'PENDING_HARDWARE_FINALIZATION':
      return tr('Infrared camera not fitted yet');
    case 'NOIR_CAMERA_NOT_DETECTED_ON_CSI_1':
      return tr('Infrared camera not found');
    case 'NO_SATELLITE_DATA_RECORDED':
      return tr('No satellite image downloaded');
    case 'NO_CLEAR_SCENE':
      return tr('Cloudy on every recent satellite pass');
    case 'CREDENTIALS_MISSING':
      return tr('Satellite login not set up');
    case 'FIELD_CONFIG_MISSING':
    case 'FIELD_NOT_CONFIGURED':
      return tr('Field boundary not entered');
    case 'INSUFFICIENT_TEMPERATURE_HISTORY':
      return tr('Field station needs more readings');
    case 'INSUFFICIENT_24H_HISTORY': {
      const need = /need[^,]*?spanning\s*>=\s*([\d.]+)\s*h/.exec(status ?? '')?.[1];
      const found = /found[^,]*?spanning\s*([\d.]+)\s*h/.exec(status ?? '')?.[1];
      return need && found
        ? tr('Station has {f} h of readings, needs {n} h', { f: found, n: need })
        : 'Field station needs more hours of readings';
    }
    case 'INSUFFICIENT_CANOPY_FRACTION':
      return tr('Too little crop in the frame');
    case 'OUT_OF_DOMAIN_FRACTION_EXCEEDED':
      return tr('Colours outside the measurable range');
    case 'NO_FRAMES_ACCEPTED':
      return tr('No usable frames');
    case 'DAYS_SINCE_PLANTING_REQUIRED':
    case 'AWAITING_PLANTING_DATE':
      return tr('Planting date not entered');
    case 'CROP_NOT_SPECIFIED':
      return tr('Scan saw more than one crop');
    case 'UNSUPPORTED_CROP':
      return tr('No stage table for this crop');
    case 'GPS_TRACK_NOT_RECORDED':
      return tr('No GPS track recorded');
    default:
      return tr('Not available');
  }
}

/**
 * The engineering detail some reason codes carry in parentheses.
 *
 * Shown small and last. It is genuinely useful — "`/dev/video1` not found;
 * available: `['/dev/video0']`" is the fix — but it is for whoever is holding
 * the pod, not for the farmer, so it must not be the sentence they read first.
 */
export function statusDetail(status?: string): string | null {
  const m = /^[A-Z0-9_]+ \((.*)\)$/s.exec(status ?? '');
  return m ? m[1] : null;
}

// ---- Source tag -----------------------------------------------------------

/**
 * Rule 4 made visible. A derived quantity must not be able to pass itself off
 * as an observation, so the distinction sits on the face of every value.
 *
 * `derived_fao56` is spelled out rather than shortened: a farmer reading
 * "DERIVED FAO56" beside a water figure learns it came from a standard table
 * and a formula, which is exactly the claim the block is making.
 */
export function SourceTag({ source }: { source: SourceKind }) {
  const tone: Tone =
    source === 'measured' ? 'good' : source === 'provisional' ? 'warn' : 'neutral';
  const label =
    source === 'measured'
      ? tr('MEASURED')
      : source === 'provisional'
        ? tr('PROVISIONAL')
        : String(source).replace(/_/g, ' ').toUpperCase();
  return <StatusChip label={label} tone={tone} />;
}

// ---- Verification ---------------------------------------------------------

/**
 * The citation-provenance badge that TEMPLATE_ID_REGISTRY §1.2 makes mandatory.
 *
 * Renders from the structural `verification_status` enum by way of
 * `presentVerification`, never by pattern-matching the prose — which is the
 * whole reason the edge carries the status twice. A `RECALLED_UNVERIFIED` dose
 * gets the destructive tone and a full-width note, not a quiet grey chip, and
 * the note cannot be collapsed: `mandatory` is decided in the schema layer and
 * this component has no prop to override it.
 */
export function VerificationBadge({
  status,
  language = currentLanguage(),
  /** Set false on a dense list where the full note would repeat every row. */
  showNote = true,
}: {
  status: VerificationStatus;
  language?: Language;
  showNote?: boolean;
}) {
  const p = presentVerification(status, language);
  const tone = p.tone as Tone;
  return (
    <View style={{ marginTop: space.sm }}>
      <StatusChip label={p.badge} tone={tone} />
      {showNote || p.mandatory ? (
        <View style={{ marginTop: -space.sm }}>
          <Panel label={p.mandatory ? tr('Read this first') : tr('Where this comes from')} tone={tone}>
            {p.note}
          </Panel>
        </View>
      ) : null}
    </View>
  );
}

// ---- Rows and text --------------------------------------------------------

export function Row({ children }: { children: ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

export function Divider() {
  return <View style={s.divider} />;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={[type.small, { color: color.mutedForeground }]}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={[type.body, { color: color.foreground }]}>{children}</Text>;
}

/** Horizontally wrapping chip strip, as at the foot of the alert card. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={s.chipRow}>{children}</View>;
}

const s = StyleSheet.create({
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'flex-start',
    height: 29,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 30,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  statusChip: {
    alignSelf: 'flex-start',
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.md,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.sm,
  },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  tile: {
    width: '48.8%',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.md,
    ...shadow.card,
  },
  tileOpen: { width: '100%' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.sm },
  tileValue: { fontFamily: font.sansBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  tileMuted: { fontFamily: font.sansBold, fontSize: 17, lineHeight: 34 },
  tileBody: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.card,
    marginHorizontal: -space.md,
    marginBottom: -space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  groupRule: { borderTopWidth: 1, borderTopColor: color.border },
  foldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  foldSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },

  panel: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    marginTop: space.sm,
  },

  stat: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: space.lg },

  confRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.md },
  confTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    overflow: 'hidden',
  },
  confFill: { height: 6, borderRadius: radius.pill, backgroundColor: color.primary },

  measurement: { marginBottom: space.md },
  measurementHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: space.sm,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },

  notMeasured: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  notMeasuredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: space.sm,
  },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.sm },
});
