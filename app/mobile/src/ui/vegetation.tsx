/**
 * The vegetation block — canopy cover, the four uncalibrated RGB indices, and
 * the NDVI value that is reserved rather than estimated.
 *
 * ── The mandatory caveat ────────────────────────────────────────────────────
 * VEGETATION_BLOCK_SPEC §1.2 is explicit and this file is the place it lands:
 *
 *   "The app MUST render the following caveat whenever relative vegetation
 *    bands are shown: 'Compares parts of your field against each other. It
 *    cannot tell you whether the whole field is healthy.'
 *    Do not conceal this in a hidden tooltip."
 *
 * So the caveat is a panel at the top of the card, above every band, in the
 * same type as the rest of the card. It is not a tooltip, not a disclosure, not
 * an asterisk, and it is rendered from the exported `VEGETATION_CAVEAT`
 * constant so a well-meaning edit cannot paraphrase away its second sentence —
 * which is the load-bearing half. A uniformly stressed field has a perfectly
 * normal internal distribution and looks entirely healthy here.
 *
 * ── Why relative at all ─────────────────────────────────────────────────────
 * There are no published, crop-specific absolute bands for uncalibrated RGB
 * indices. Their absolute value moves with the illumination spectrum, the
 * camera's white balance and gain, the sun angle and how much soil is in frame
 * — the same healthy canopy at 09:00 and at 14:00 gives materially different
 * VARI. Comparing the field against itself, in one session under one light,
 * cancels every one of those confounds. That is a real measurement of a real
 * thing; it is just a narrower thing than a reader assumes by default.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, Divider, Measurement, Panel, StatusChip, humaniseStatus } from './components.tsx';
import type { Tone } from './components.tsx';
import { DistributionStrip, Meter } from './charts.tsx';
import { LeafIcon, ProgressBar } from './tiles.tsx';
import { color, space, type, themed } from './theme.ts';
import type { CanopyCover, Vegetation, VegetationIndex } from '../schema/advisory.ts';
import { VEGETATION_CAVEAT } from '../schema/advisory.ts';
import { msg, tr } from '../i18n/tr.ts';

const BAND_TONE: Record<string, Tone> = {
  LOWER_TAIL: 'warn',
  BELOW_TYPICAL: 'warn',
  TYPICAL: 'neutral',
  ABOVE_TYPICAL: 'good',
};

/** The display strings VEGETATION_BLOCK_SPEC §4 prescribes, in both languages. */
const BAND_LABEL: Record<string, string> = {
  LOWER_TAIL: msg('Noticeably below field average'),
  BELOW_TYPICAL: msg('Slightly below field average'),
  TYPICAL: msg('Typical for this field'),
  ABOVE_TYPICAL: msg('Above field average'),
};

const BAND_COPY: Record<string, string> = {
  LOWER_TAIL:
    msg('Noticeably less green than the rest of your field. Worth walking over to inspect.'),
  BELOW_TYPICAL: msg('Slightly below typical field vigour.'),
  TYPICAL: msg('In line with the rest of the field.'),
  ABOVE_TYPICAL: msg('Among the greener, denser parts of the field.'),
};

/**
 * What each index is, in one line.
 *
 * Four acronyms in a column tell a farmer nothing. These do not explain the
 * arithmetic — they say what each one is sensitive to, which is what makes a
 * disagreement between them readable.
 */
const INDEX_BLURB: Record<string, string> = {
  VARI: msg('Overall greenness, with some of the haze and lighting taken out.'),
  ExG: msg('How strongly green wins over red and blue. Sensitive to how much leaf is in frame.'),
  TGI: msg('Leans on the chlorophyll signal, so it tracks leaf colour more than leaf quantity.'),
  DGCI: msg('How deep the green is, rather than how much of it there is.'),
};

function IndexRow({
  label,
  index,
  /** Only VARI carries a band today; the rest are shown as bare means. */
  showBand = true,
}: {
  label: string;
  index: VegetationIndex;
  showBand?: boolean;
}) {
  const band = showBand ? index.band : null;
  const tone: Tone = band ? (BAND_TONE[band] ?? 'neutral') : 'neutral';
  const hasSpread = typeof index.p10 === 'number' && typeof index.p90 === 'number';

  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={s.head}>
        <Text style={[type.chipLabel, { color: color.fgSubtle, flex: 1 }]}>
          {label.toUpperCase()}
        </Text>
        {band ? (
          <StatusChip label={BAND_LABEL[band] ? tr(BAND_LABEL[band]) : band.replace(/_/g, ' ')} tone={tone} />
        ) : null}
      </View>

      <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
        {INDEX_BLURB[label] ? tr(INDEX_BLURB[label]) : ''}
      </Text>

      {index.mean === null ? (
        <Panel label={tr('Withheld')} tone="unknown">
          {humaniseStatus(index.reason ?? undefined)}
          {typeof index.out_of_domain_fraction === 'number' && typeof index.threshold === 'number'
            ? ` ${tr('{p}% of the canopy pixels were outside, against a limit of {lim}%.', { p: Math.round(index.out_of_domain_fraction * 100), lim: Math.round(index.threshold * 100) })}`
            : ''}
        </Panel>
      ) : (
        <>
          <View style={s.indexRow}>
            <Text style={[type.value, { color: color.foreground }]}>{index.mean}</Text>
            {band ? (
              <Text
                style={[type.small, { color: color.mutedForeground, flex: 1, textAlign: 'right' }]}
              >
                {BAND_COPY[band] ? tr(BAND_COPY[band]) : ''}
              </Text>
            ) : null}
          </View>

          {/* Where this sits inside the field's own spread — which is the only
              comparison these indices support. A bare number cannot show it. */}
          {hasSpread ? (
            <DistributionStrip
              value={index.mean}
              p10={index.p10 as number}
              p50={index.p50 ?? undefined}
              p90={index.p90 as number}
              tone={tone}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * ExG, TGI and DGCI, side by side.
 *
 * None of the three carries a band, so each is a bare mean — useful to someone
 * comparing scans, and noise to someone reading one. They get one compact row
 * instead of a titled block each, and a withheld one says so in its cell
 * rather than showing a blank.
 */
function OtherIndices({
  exg,
  tgi,
  dgci,
}: {
  exg: VegetationIndex;
  tgi: VegetationIndex;
  dgci: VegetationIndex;
}) {
  const cells: [string, VegetationIndex][] = [
    ['ExG', exg],
    ['TGI', tgi],
    ['DGCI', dgci],
  ];
  return (
    <View>
      <Text style={[type.chipLabel, { color: color.fgSubtle }]}>{tr('OTHER COLOUR MEASURES')}</Text>
      <View style={s.cells}>
        {cells.map(([label, index]) => (
          <View key={label} style={{ flex: 1 }}>
            <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{label}</Text>
            <Text style={[type.value, { color: index.mean === null ? color.unknown : color.foreground, fontSize: 16 }]}>
              {index.mean === null ? tr('withheld') : String(index.mean)}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[type.small, { color: color.mutedForeground, marginTop: space.xs }]}>
        {tr('For comparing scans over time. ExG tracks how much leaf is in frame, TGI the chlorophyll signal, DGCI how deep the green is.')}
      </Text>
      {cells.some(([, i]) => i.mean === null) ? (
        <Text style={[type.small, { color: color.unknown, marginTop: space.xs }]}>
          {humaniseStatus(cells.find(([, i]) => i.mean === null)?.[1].reason ?? undefined)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * How much of the frame was crop at all.
 *
 * This gates everything below it, so it is rendered first and with its own
 * threshold read out of the payload. The contract's table says 0.10 and the
 * block spec says 0.15; the device sends 0.15. Neither number is hardcoded
 * here — a renderer that assumed one would quietly mislabel the other.
 */
function CanopyRow({ canopy }: { canopy: CanopyCover }) {
  const low = canopy.status === 'INSUFFICIENT_CANOPY';
  const floor = canopy.min_fraction_threshold;
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={s.head}>
        <Text style={[type.chipLabel, { color: color.fgSubtle, flex: 1 }]}>{tr('GROUND COVERED')}</Text>
        <StatusChip
          label={low ? tr('TOO LITTLE CROP') : tr('ENOUGH TO MEASURE')}
          tone={low ? 'warn' : 'good'}
        />
      </View>

      <Meter
        value={canopy.mean}
        min={0}
        max={1}
        tone={low ? 'warn' : 'good'}
        bands={[
          { upTo: floor, label: tr('too little'), tone: 'warn' },
          { upTo: 1, label: tr('measurable'), tone: 'good' },
        ]}
        markerLabel={tr('{p}% covered', { p: Math.round(canopy.mean * 100) })}
        caption={tr('The indices below need at least {p}% of the frame to be canopy. Under that, soil colour dominates and the reading describes the ground instead of the crop.', { p: Math.round(floor * 100) })}
      />

      {low ? (
        <Panel label={tr('Indices withheld')} tone="warn">
          {tr('Canopy cover too low to measure vegetation indices (under {p}%). Nothing was computed in their place. A number here would be about the soil, not the crop.', { p: Math.round(floor * 100) })}
        </Panel>
      ) : null}

      {typeof canopy.p10 === 'number' && typeof canopy.p90 === 'number' ? (
        <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: space.sm }]}>
          {tr('Across the scan: {lo}% at the thinnest, {hi}% at the densest.', { lo: Math.round(canopy.p10 * 100), hi: Math.round(canopy.p90 * 100) })}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The vegetation card.
 *
 * Order is deliberate: the caveat, then the gate, then the indices, then the
 * gated NDVI. A reader who stops after the first panel has still been told the
 * one thing they most need to know about everything underneath it.
 */
export function VegetationCard({ vegetation }: { vegetation: Vegetation }) {
  const relative = vegetation.interpretation_mode === 'relative';
  const canopy = vegetation.canopy_cover;
  const provisional = [canopy, vegetation.vari, vegetation.exg, vegetation.tgi, vegetation.dgci]
    .some((b) => b && b.threshold_confirmed === false);

  const lowCanopy = canopy?.status === 'INSUFFICIENT_CANOPY';
  const band = vegetation.vari?.mean !== null ? vegetation.vari?.band : null;
  const cover = canopy ? tr('{p}% ground covered', { p: Math.round(canopy.mean * 100) }) : null;
  const summary = lowCanopy
    ? [tr('Too little crop in frame'), cover].filter(Boolean).join(' · ')
    : [band ? (BAND_LABEL[band] ? tr(BAND_LABEL[band]) : band.replace(/_/g, ' ')) : null, cover]
        .filter(Boolean)
        .join(' · ') || tr('Not measured');

  return (
    <Card
      eyebrow={tr('Vegetation')}
      title={tr('Greenness')}
      summary={summary}
      summaryTone={lowCanopy ? 'warn' : band ? (BAND_TONE[band] ?? 'neutral') : 'neutral'}
      // VEGETATION_BLOCK_SPEC §1.2: the caveat goes wherever a relative band
      // is shown — which includes this folded summary line, so it sits under
      // it rather than behind the tap.
      note={relative && band ? tr(VEGETATION_CAVEAT) : undefined}
      // The tile shows ground cover only. The relative greenness band needs
      // its caveat beside it (§1.2), and a tile has no room for both, so the
      // band lives one tap down, where the caveat panel opens first.
      tile={
        canopy
          ? {
              icon: <LeafIcon color={lowCanopy ? color.warningForeground : color.secondaryForeground} />,
              label: tr('GROUND COVER'),
              value: String(Math.round(canopy.mean * 100)),
              unit: '%',
              tone: lowCanopy ? 'warn' : 'good',
              visual: (
                <ProgressBar
                  fraction={canopy.mean}
                  tone={lowCanopy ? 'warn' : 'good'}
                  tick={canopy.min_fraction_threshold}
                />
              ),
              caption: lowCanopy
                ? tr('Too little crop in frame to measure greenness')
                : tr('Crop in frame. Tap for greenness'),
            }
          : { icon: <LeafIcon color={color.unknown} />, label: tr('GROUND COVER'), value: tr('Not measured'), muted: true }
      }
    >
      {/* VEGETATION_BLOCK_SPEC §1.2, verbatim, on the screen, first. */}
      {relative ? (
        <Panel label={tr('How to read this')} tone="warn">
          {tr(VEGETATION_CAVEAT)} {tr('A field that is evenly stressed still looks perfectly normal here.')}
        </Panel>
      ) : null}

      <View style={{ marginTop: space.md }}>
        {canopy ? <CanopyRow canopy={canopy} /> : null}

        <Divider />

        {/* VARI is the one the pod bands, because it is the one the relative
            percentile machinery runs on. The other three are reported as means
            with no band, and showing an invented band for them would be
            manufacturing a comparison the pod did not make. */}
        <IndexRow label="VARI" index={vegetation.vari} />
        <OtherIndices exg={vegetation.exg} tgi={vegetation.tgi} dgci={vegetation.dgci} />
      </View>

      {/* Rule 2. Every one of these thresholds is engineering judgement on an
          uncalibrated camera, and none has been confirmed against a published
          source. Rendering them like cited figures would be citation drift
          happening in the presentation layer. */}
      {provisional ? (
        <Text style={[type.small, { color: color.warningForeground, marginTop: space.sm }]}>
          {tr('The cut-offs here are our own working values for an uncalibrated camera, not yet confirmed against a published source. The measurements are real.')}
        </Text>
      ) : null}

      <Divider />

      {/* Carried as a first-class field from day one so nothing downstream
          changes when the optics land. It shows as reserved, never as
          estimated — and this is the *value*, not the camera probe, which is a
          different block on a different card. */}
      <Measurement
        label={tr('NDVI (infrared)')}
        value={vegetation.ndvi}
        status={vegetation.ndvi_status}
        reason={vegetation.ndvi_reason ?? undefined}
        note={tr('NDVI needs a second camera that sees infrared. Until that camera and its bench calibration are finished, this is left empty rather than guessed at from the colour image.')}
      />
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cells: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  indexRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
}));
