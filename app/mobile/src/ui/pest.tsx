/**
 * The sticky-trap block.
 *
 * ── The safety architecture this card has to make visible ───────────────────
 * TEMPLATE_ID_REGISTRY §4.3 sets up a deliberate split, and it is the most
 * carefully designed thing in the payload:
 *
 *   The gate on whether a farmer sprays is `total_blobs_counted` — a
 *   deterministic watershed segmentation of the card. Not the CNN. The CNN is
 *   a cross-domain European trap model, stamped RECALLED_UNVERIFIED, and it
 *   does not get a vote on chemical intervention.
 *
 *   That count therefore includes debris, non-target flies and glue residue,
 *   which makes it a conservative *over*-estimate against the threshold.
 *
 * The second half is the part a naive renderer drops, and dropping it is not
 * neutral: an over-estimate presented as a species count pushes a farmer toward
 * spraying. So the disclaimer travels with the number, from a constant, and the
 * morphological breakdown below it is labelled as the unverified guess it is.
 *
 * ── The most useful state on the card ───────────────────────────────────────
 * `NOT_SAMPLED_BY_STICKY_TRAP`. A yellow card does not catch stem borers —
 * those are monitored on pheromone lures — and it does not count planthoppers,
 * which are counted by tapping the base of a hill. A low number for either is
 * not a low number, it is a meaningless one. Rendering that as "0" would be the
 * system inventing a measurement, so it renders as advice about what to do
 * instead.
 */

import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Chip,
  ChipRow,
  Divider,
  Muted,
  Panel,
  StatusChip,
  TONE,
  VerificationBadge,
} from './components.tsx';
import type { Tone } from './components.tsx';
import { EvidenceBar, Meter, Stat } from './charts.tsx';
import { BugIcon, Dots } from './tiles.tsx';
import { color, space, type, themed } from './theme.ts';
import type { PestFinding } from '../schema/advisory.ts';
import { TRAP_COUNT_DISCLAIMER } from '../schema/advisory.ts';
import { describeTaxon } from '../schema/classes.ts';
import { msg, tr } from '../i18n/tr.ts';

const PEST_TONE: Record<string, Tone> = {
  BELOW_ETL: 'good',
  AT_ETL: 'warn',
  ABOVE_ETL: 'bad',
  NO_PUBLISHED_ETL: 'unknown',
  NOT_SAMPLED_BY_STICKY_TRAP: 'unknown',
  UNKNOWN_PEST: 'unknown',
  CARD_SATURATED: 'warn',
  INVALID_MONITORING_WINDOW: 'warn',
  MISSING_DEPLOYMENT_TIMESTAMP: 'warn',
};

const PEST_STATUS_LABEL: Record<string, string> = {
  BELOW_ETL: msg('BELOW THE LIMIT'),
  AT_ETL: msg('AT THE LIMIT'),
  ABOVE_ETL: msg('OVER THE LIMIT'),
  NO_PUBLISHED_ETL: msg('NO PUBLISHED LIMIT'),
  NOT_SAMPLED_BY_STICKY_TRAP: msg('WRONG INSTRUMENT'),
  UNKNOWN_PEST: msg('PEST NOT RECOGNISED'),
  CARD_SATURATED: msg('CARD TOO FULL TO COUNT'),
  INVALID_MONITORING_WINDOW: msg('BAD MONITORING WINDOW'),
  MISSING_DEPLOYMENT_TIMESTAMP: msg('NO START DATE'),
};

/**
 * What each non-comparable status means, and what to do about it.
 *
 * Every one of these is a gap, and every one of them is more useful stated
 * plainly than papered over. The first two in particular turn an absence into
 * an instruction.
 */
const PEST_STATUS_BODY: Record<string, string> = {
  NOT_SAMPLED_BY_STICKY_TRAP:
    msg('A yellow sticky card is not how this pest is monitored, so no count is given for it. A count here would be a meaningless number rather than a low one. Stem borers are monitored on pheromone lure traps; planthoppers are counted by tapping the base of a hill over a tray. Ask your extension officer which applies to this one.'),
  NO_PUBLISHED_ETL:
    msg('The published guidance gives no action threshold for this pest, so there is nothing to compare the count against. That is the source being honest rather than a missing feature. Treat the count as something to watch over time, not as a trigger.'),
  UNKNOWN_PEST:
    msg('The system does not have an entry for this pest, so it cannot say what a normal count looks like.'),
  CARD_SATURATED:
    msg('The card is too crowded for the segmenter to separate individual insects, so the count would be an undercount. Replace the card and start a fresh monitoring window.'),
  INVALID_MONITORING_WINDOW:
    msg('The card has been out for either less than a day or more than a week, and the published threshold assumes something in between. No comparison was made.'),
  MISSING_DEPLOYMENT_TIMESTAMP:
    msg('Nobody recorded when this card was put out, so there is no monitoring window to divide by and no comparison to make.'),
};

/** The Model B morphological classes, in the words the registry uses. */
const MORPH_LABEL: Record<string, string> = {
  small_pale_winged: msg('small pale winged'),
  larger_insect: msg('larger insects'),
  debris: msg('debris'),
  UNCERTAIN_NON_TARGET: msg('could not classify'),
};

const MORPH_TONE: Record<string, Tone> = {
  small_pale_winged: 'warn',
  larger_insect: 'neutral',
  debris: 'unknown',
  UNCERTAIN_NON_TARGET: 'unknown',
};

function PestRow({ pest, index }: { pest: PestFinding; index: number }) {
  const status = String(pest.status);
  const unsampled = status === 'NOT_SAMPLED_BY_STICKY_TRAP';
  const comparable = status === 'BELOW_ETL' || status === 'AT_ETL' || status === 'ABOVE_ETL';
  const tone = PEST_TONE[status] ?? 'unknown';
  const threshold = pest.threshold_value;
  const total = pest.total_blobs_counted ?? pest.count_observed;

  const morph = pest.morphological_distribution;
  const morphSegments = morph
    ? Object.entries(morph)
        .filter(([, f]) => typeof f === 'number' && f > 0)
        .map(([k, f]) => ({
          count: Math.round(f * total),
          label: MORPH_LABEL[k] ? tr(MORPH_LABEL[k]) : k.replace(/_/g, ' '),
          tone: MORPH_TONE[k] ?? 'neutral',
        }))
    : [];

  return (
    <View>
      {index > 0 ? <Divider /> : null}
      <View style={s.head}>
        <Text style={[type.cardTitle, { color: color.foreground, flex: 1 }]}>
          {describeTaxon(pest.target_pest_context)}
        </Text>
        <StatusChip label={PEST_STATUS_LABEL[status] ? tr(PEST_STATUS_LABEL[status]) : status.replace(/_/g, ' ')} tone={tone} />
      </View>

      {/* The wrong-instrument case, and its siblings, are advice rather than
          gaps. Lead with what to do instead; the absent count is the footnote. */}
      {!comparable ? (
        <Panel label={PEST_STATUS_LABEL[status] ? tr(PEST_STATUS_LABEL[status]) : tr('Not comparable')} tone={tone}>
          {PEST_STATUS_BODY[status]
            ? tr(PEST_STATUS_BODY[status])
            : tr('No comparison could be made against a published limit.')}
        </Panel>
      ) : null}

      {/* The count itself, when counting it meant something. */}
      {!unsampled ? (
        <>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={[type.chipLabel, { color: color.fgSubtle }]}>{tr('CAUGHT ON THE CARD')}</Text>
              <View style={s.inlineValue}>
                <Text style={[type.stat, { color: color.foreground }]}>{pest.count_observed}</Text>
                {typeof threshold === 'number' ? (
                  <Text style={[type.chipValue, { color: color.fgSubtle }]}>
                    {tr('of {n}', { n: threshold })} {String(pest.threshold_unit ?? '').replace(/_/g, ' ')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {comparable && typeof threshold === 'number' ? (
            <Meter
              value={Math.min(pest.count_observed, threshold * 1.5)}
              min={0}
              max={threshold * 1.5}
              tone={tone}
              bands={[
                { upTo: threshold, label: tr('below'), tone: 'good' },
                { upTo: threshold * 1.5, label: tr('over'), tone: 'bad' },
              ]}
              markerLabel={tr('act at {n}', { n: threshold })}
              caption={
                status === 'ABOVE_ETL'
                  ? tr('Past the published point at which the guidance says to intervene.')
                  : status === 'AT_ETL'
                    ? tr('Exactly at the published intervention point.')
                    : tr('Under the published intervention point.')
              }
            />
          ) : null}

          {/* Rule: the count is a deliberate over-estimate, and saying so is
              not optional — an over-estimate that reads as a species count
              pushes toward spraying. */}
          <Panel label={tr('What that number counts')} tone="warn">
            {tr(TRAP_COUNT_DISCLAIMER)}
          </Panel>

          <ChipRow>
            <Chip label={tr('DAYS OUT')} value={String(pest.days_monitored)} />
            <Chip label={tr('PER DAY')} value={String(pest.daily_rate)} />
            <Chip
              label={tr('COUNTED BY')}
              value={
                pest.count_basis === 'watershed_all_blobs' ? tr('SHAPE SEGMENTER') : String(pest.count_basis)
              }
            />
          </ChipRow>

          {/* The daily rate is informational only. The published threshold is
              cumulative per card — "take up the intervention when the
              population exceeds 100 per trap" — not a per-day catch rate, and
              a reader who compares the daily figure against it will act late. */}
          {comparable ? (
            <Text style={[type.small, { color: color.mutedForeground, marginTop: space.sm }]}>
              {tr('The limit is counted across the whole time the card has been out, not per day. The per-day figure is there to show whether numbers are climbing.')}
            </Text>
          ) : null}
        </>
      ) : null}

      {/* The CNN's guess at what the blobs were. Secondary, informational, and
          explicitly unverified against Indian field conditions. */}
      {morphSegments.length > 0 ? (
        <View style={{ marginTop: space.md }}>
          <Text style={[type.chipLabel, { color: color.fgSubtle }]}>{tr('WHAT THE SHAPES LOOKED LIKE')}</Text>
          <EvidenceBar segments={morphSegments} />
          <Panel label={tr('A guess, not an identification')} tone="unknown">
            {tr('This breakdown comes from a model trained on traps in Europe and never checked against Indian field conditions. "Small pale winged" does not distinguish whitefly from thrips or aphids. It does not affect the count above or the comparison against the limit. Those come from the shape segmenter.')}
          </Panel>
        </View>
      ) : null}

      {/* Two provenances, kept apart, because they genuinely differ: the
          threshold is traced to a government IPM text; the classifier is not. */}
      {typeof threshold === 'number' ? (
        <>
          <Text style={[type.chipLabel, { color: color.fgSubtle, marginTop: space.md }]}>
            THE LIMIT ITSELF
          </Text>
          <VerificationBadge status={pest.threshold_verification_status} showNote={false} />
        </>
      ) : null}
    </View>
  );
}

export function PestCard({ pest }: { pest: PestFinding[] }) {
  const findings = pest ?? [];

  if (findings.length === 0) {
    return (
      <Card
        eyebrow={tr('Pest')}
        title={tr('Sticky trap')}
        summary={tr('No trap card photographed')}
        summaryTone="unknown"
        tile={{
          icon: <BugIcon color={color.unknown} />,
          label: tr('STICKY TRAP'),
          value: tr('No card'),
          muted: true,
          caption: tr('No trap card photographed'),
        }}
      >
        <Muted>
          {tr('No trap count in this advisory. A card has to be photographed and sent to the pod before there is anything to count. Nothing is assumed in the meantime.')}
        </Muted>
      </Card>
    );
  }

  // Folded: the status per pest, never the raw count — the count is a
  // deliberate over-estimate and its disclaimer lives with it, one tap down.
  const worst =
    findings.find((p) => p.status === 'ABOVE_ETL') ?? findings.find((p) => p.status === 'AT_ETL');
  const summary = findings
    .map(
      (p) =>
        `${describeTaxon(p.target_pest_context)}: ${(
          PEST_STATUS_LABEL[String(p.status)]
            ? tr(PEST_STATUS_LABEL[String(p.status)])
            : String(p.status).replace(/_/g, ' ')
        ).toLowerCase()}`,
    )
    .join(' · ');

  // The tile counts pests past their limit, not insects on the card. The card
  // total is a deliberate over-estimate whose disclaimer must travel with it,
  // so it stays one tap down, beside that disclaimer.
  const over = findings.filter((p) => p.status === 'ABOVE_ETL' || p.status === 'AT_ETL');
  const tileTone: Tone = over.length > 0 ? 'bad' : 'good';

  return (
    <Card
      eyebrow={tr('Pest')}
      title={tr('Sticky trap')}
      summary={summary}
      summaryTone={worst ? (PEST_TONE[String(worst.status)] ?? 'warn') : 'neutral'}
      tile={{
        icon: <BugIcon color={TONE[tileTone].fg} />,
        label: tr('STICKY TRAP'),
        value: over.length > 0 ? tr('{n} over', { n: over.length }) : tr('Below'),
        unit: over.length > 0 ? tr('the limit') : tr('the limits'),
        tone: tileTone,
        visual: <Dots tones={findings.map((p) => PEST_TONE[String(p.status)] ?? 'unknown')} />,
        caption:
          over.length > 0
            ? over.map((p) => describeTaxon(p.target_pest_context)).join(', ')
            : findings.length === 1
              ? tr('1 pest checked')
              : tr('{n} pests checked', { n: findings.length }),
      }}
    >
      {findings.map((p, i) => (
        <PestRow key={`${p.target_pest_context}-${i}`} pest={p} index={i} />
      ))}

      <Panel label={tr('Scale')} tone="neutral">
        {tr('Published guidance assumes four to five traps per acre. This system has one, which samples a spot rather than a field.')}
      </Panel>
    </Card>
  );
}

/**
 * The reply from `POST /api/v1/trap/upload`, rendered on the pod screen.
 *
 * Kept here rather than in the sync screen because it is the same contract as
 * the card above — the same counts, the same over-estimate, the same split
 * between the segmenter and the classifier — and the two should not drift.
 */
export function TrapUploadResultCard({
  result,
}: {
  result: {
    trap_id: string;
    total_blobs_counted: number;
    scale_status: string;
    scale_mm_per_pixel: number | null;
    etl_status: string;
    advisory_id: string | null;
  };
}) {
  const provisional = result.scale_status !== 'CALIBRATED';
  const tone = PEST_TONE[result.etl_status] ?? 'unknown';

  return (
    <Card eyebrow={tr('Trap card')} title={tr('Card {id}', { id: result.trap_id })}>
      <View style={s.statRow}>
        <Stat value={String(result.total_blobs_counted)} caption={tr('Shapes found on the card')} />
        <Stat
          value={PEST_STATUS_LABEL[result.etl_status] ? tr(PEST_STATUS_LABEL[result.etl_status]) : result.etl_status.replace(/_/g, ' ')}
          caption={tr('Against the published limit')}
          tone={tone}
        />
      </View>

      {provisional ? (
        <Panel label={tr('Scale not measured')} tone="warn">
          {tr('The pod could not work out how many millimetres a pixel covers ({s}), so it cannot tell a large insect from a small one by size. The total count is still the total count, but anything that depends on insect size is guesswork. Photograph the card flat, with its printed scale marker in frame, to fix this.', { s: result.scale_status.toLowerCase() })}
        </Panel>
      ) : (
        <Panel label={tr('Scale measured')} tone="good">
          {tr('Scale read from the card at {v} mm per pixel, so size-based sorting is meaningful.', { v: result.scale_mm_per_pixel ?? '?' })}
        </Panel>
      )}

      <Panel label={tr('What that number counts')} tone="warn">
        {tr(TRAP_COUNT_DISCLAIMER)}
      </Panel>

      {result.advisory_id ? (
        <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: space.sm }]}>
          {tr('Folded into advisory {id}. Pull from the pod to see it.', { id: result.advisory_id })}
        </Text>
      ) : (
        <Muted>
          {tr("The pod stored the count but did not build a new advisory from it. It will appear in the next scan's advisory.")}
        </Muted>
      )}
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  inlineValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
}));
