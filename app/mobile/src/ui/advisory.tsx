/**
 * Advisory blocks: provenance, verdict, growth stage, actions, inputs, scan.
 *
 * Built on the site's alert-card structure: a mono micro-label, the value, then
 * tinted WHY / CHECK NEXT sub-panels and a chip strip at the foot. Each block
 * exists to satisfy a named requirement from the wire contract, and the comment
 * on each says which.
 *
 * ── The recurring idea ──────────────────────────────────────────────────────
 * The pod is headless and the mast has no screen. This app is the only place a
 * farmer can ever learn that something was withheld, gated, provisional or
 * unmeasured. So every one of those states is rendered as a first-class thing
 * with its own words, not as a blank, a dash, or a zero.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Chip,
  ChipRow,
  Divider,
  Muted,
  Panel,
  Row,
  StatusChip,
  TONE,
  humaniseStatus,
  shortStatus,
} from './components.tsx';
import type { Tone } from './components.tsx';
import { EvidenceBar, Meter, Stat } from './charts.tsx';
import { ProgressBar, SproutIcon } from './tiles.tsx';
import { color, radius, shadow, space, type } from './theme.ts';
import type {
  Advisory,
  AdvisoryInput,
  CropHealth,
  CropHealthState,
  GrowthStage,
  InputStatus,
} from '../schema/advisory.ts';
import { DRIED_LEAF_CAVEAT, DRIED_LEAF_CLASS, describeClass } from '../schema/classes.ts';
import { presentVerification, renderAction } from '../schema/templates.ts';
import type { Language } from '../schema/templates.ts';
import type { AdvisoryOrigin } from '../db/advisories.ts';
import type { Violation } from '../schema/validate.ts';
import { describeViolation } from '../schema/validate.ts';
import { dateLocale, msg, tr } from '../i18n/tr.ts';

// ---- Origin and backend ---------------------------------------------------

/**
 * Never present replayed history as live measurement. Sample and replay data
 * get a banner at the top of every screen that shows them, not a subtle
 * footnote.
 *
 * Note this keys on the stored origin, which is resolved with `isReplay` — a
 * missing `replay` field reads as replay, not as live. A bug on either side
 * produces the under-claim rather than the over-claim.
 */
export function OriginBanner({ origin }: { origin: AdvisoryOrigin }) {
  if (origin === 'synced') return null;

  // One line each. The banner still leads the screen, but it no longer takes a
  // paragraph to say "this is a replay".
  const copy: Record<Exclude<AdvisoryOrigin, 'synced'>, { label: string; body: string; tone: Tone }> = {
    fixture: {
      // True of all six shipped samples, including the one real device
      // capture among them: none came from this farmer's pod.
      label: tr('SAMPLE DATA'),
      body: tr('Built into the app for testing. Not from your pod or your field.'),
      tone: 'warn',
    },
    replay: {
      label: tr('REPLAY'),
      body: tr('Real model output on a recorded video, not a live scan.'),
      tone: 'unknown',
    },
    imported: {
      label: tr('IMPORTED FILE'),
      body: tr('Loaded from a file, not pulled from a pod. Check where it came from.'),
      tone: 'unknown',
    },
  };

  const c = copy[origin];
  const t = TONE[c.tone];
  return (
    <View style={[s.banner, s.bannerRow, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.micro, { color: t.fg }]}>{c.label}</Text>
      <Text style={[type.small, { color: t.fg, flex: 1 }]}>{c.body}</Text>
    </View>
  );
}

/**
 * Which engine produced these diagnoses.
 *
 * `trt` is the normal, silent case and gets a chip rather than a banner. The
 * other two are worth interrupting for:
 *
 *   onnx  the CPU fallback ran instead of the GPU. The numbers are the same
 *         model, but the fact that it happened at all means something about the
 *         device is not as expected, and it is the kind of thing that only ever
 *         gets noticed if the app says so.
 *   mock  a synthetic test vector. A production gateway returns 403 rather than
 *         serving one of these, so a `mock` advisory on this phone did not come
 *         from a production pod and nothing in it is a measurement.
 */
export function BackendBanner({ advisory }: { advisory: Advisory }) {
  const backend = advisory.inference_backend;
  if (backend === 'trt') return null;

  const mock = backend === 'mock';
  const t = mock ? TONE.bad : TONE.warn;
  return (
    <View style={[s.banner, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.micro, { color: t.fg }]}>
        {mock ? tr('SIMULATED MODEL OUTPUT · NOT A MEASUREMENT') : tr('RAN ON THE FALLBACK ENGINE')}
      </Text>
      <Text style={[type.small, { color: t.fg, marginTop: 5 }]}>
        {mock
          ? tr('This advisory was produced by the simulated inference backend, not by the model running on the device. A pod in normal operation refuses to hand these out at all. Nothing here is a reading of a real plant.')
          : tr('Same model, but the pod did not start up normally. Worth telling whoever maintains it.')}
      </Text>
    </View>
  );
}

// ---- Schema violations ----------------------------------------------------

/** An advisory that broke a schema rule is shown as broken, not quietly rendered. */
export function ViolationsCard({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;
  return (
    <View style={s.violations}>
      <Text style={[type.micro, { color: color.destructive }]}>
        {violations.length === 1
          ? tr('1 SCHEMA VIOLATION')
          : tr('{n} SCHEMA VIOLATIONS', { n: violations.length })}
      </Text>
      <Text style={[type.small, { color: color.destructive, marginTop: 6 }]}>
        {tr('This advisory does not satisfy the contract the pod and this app share. Do not act on it without checking the pod.')}
      </Text>
      {violations.map((v, i) => (
        <Text key={i} style={[type.valueSmall, { color: color.destructive, marginTop: 5 }]}>
          • {describeViolation(v)}
        </Text>
      ))}
    </View>
  );
}

// ---- Crop health ----------------------------------------------------------

const HEALTH_TONE: Record<string, Tone> = {
  HEALTHY: 'good',
  DISEASE: 'bad',
  NOT_CROP: 'unknown',
  UNCERTAIN: 'warn',
  NO_DATA: 'unknown',
};

const HEALTH_HEADLINE: Record<string, string> = {
  HEALTHY: msg('Looks healthy'),
  DISEASE: msg('Something was found'),
  NOT_CROP: msg('This was not crop'),
  UNCERTAIN: msg('Not clear enough to say'),
  NO_DATA: msg('Nothing was scanned'),
};

const HEALTH_BODY: Record<string, string> = {
  HEALTHY:
    msg('The model positively recognised healthy crop. That is a stronger call than "nothing found".'),
  DISEASE: msg('Check it by eye before treating anything.'),
  NOT_CROP: msg('Mostly soil, path or hands, so there was nothing to diagnose.'),
  UNCERTAIN: msg('The frames disagreed, so the pod did not pick an answer.'),
  NO_DATA: msg('No frames were evaluated in this scan.'),
};

/** The reasons the aggregator gives for declining to call a verdict. */
const HEALTH_REASON_COPY: Record<string, string> = {
  MULTIPLE_CROPS_DETECTED:
    msg('The camera saw more than one crop. Did you cross a field edge or an intercropped strip? The findings below may belong to different crops.'),
  HIGH_UNCERTAINTY: msg('The frames disagreed too much for one answer to stand out.'),
  UNCONFIRMED_DETECTIONS:
    msg('Something was seen, but never in two frames in a row, so it was not called.'),
};

/**
 * The block that exists because an empty disease list is ambiguous.
 *
 * "Healthy", "nothing scanned", "everything was rejected as not-crop" and "the
 * model could not decide" are four different things to tell a farmer, and
 * before this block they all rendered as the same empty list.
 */
export function CropHealthCard({
  health,
  topClass,
}: {
  health: CropHealth;
  /** The strongest entry in `disease[]`. v1.0 dropped `crop_health.class`. */
  topClass: string | null;
}) {
  const tone = HEALTH_TONE[health.state] ?? 'unknown';
  const t = TONE[tone];
  const isDriedLeaf = topClass === DRIED_LEAF_CLASS;
  const described = topClass ? describeClass(topClass) : null;

  const total = health.frames_evaluated;
  const other = Math.max(0, total - health.frames_agreeing - health.frames_uncertain);

  return (
    <View style={[s.verdictCard, { borderColor: t.border }]}>
      {/* The band carries the state colour; the words carry the state. Never
          one without the other — this has to read in sun and in grayscale. */}
      <View style={[s.verdictBand, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
        <Text style={[type.title, { color: t.fg }]}>
          {tr(HEALTH_HEADLINE[health.state] ?? String(health.state))}
        </Text>
        {described ? (
          <Text style={[type.label, { color: t.fg, marginTop: 4 }]}>{described.label}</Text>
        ) : health.crop ? (
          <Text style={[type.label, { color: t.fg, marginTop: 4 }]}>
            {health.crop.charAt(0).toUpperCase() + health.crop.slice(1)}
          </Text>
        ) : null}
        <Text style={[type.small, { color: t.fg, marginTop: 6, opacity: 0.9 }]}>
          {tr(HEALTH_BODY[health.state] ?? '')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
        {/* How much of the evidence agreed. This leads rather than the
            confidence because held-out accuracy is far below in-distribution
            accuracy — agreement across frames is the more honest signal. */}
        {total > 0 ? (
          <Text style={[type.label, { color: color.foreground }]}>
            {tr('{n} of {total} frames agreed', { n: health.frames_agreeing, total })}
          </Text>
        ) : null}

        {total > 0 ? (
          <EvidenceBar
            segments={[
              { count: health.frames_agreeing, label: tr('agreed'), tone },
              { count: other, label: tr('disagreed'), tone: 'neutral' },
              { count: health.frames_uncertain, label: tr('unsure'), tone: 'warn' },
            ]}
          />
        ) : null}

        {/* The model groups dried leaf with the healthy classes, which is right
            for the model and wrong for the farmer. Never "your sugarcane is
            healthy" when what was detected is dried leaves. */}
        {isDriedLeaf ? (
          <Panel label={tr('What this actually means')} tone="warn">
            {tr(DRIED_LEAF_CAVEAT)}
          </Panel>
        ) : null}

        {health.reason ? (
          <Panel label={tr('Heads up')} tone="warn">
            {HEALTH_REASON_COPY[health.reason] ? tr(HEALTH_REASON_COPY[health.reason]) : humaniseStatus(health.reason)}
          </Panel>
        ) : null}

        {/* Frames thrown away before the vote are reported under Scan details:
            they never entered the vote, so they do not belong beside it. */}
      </View>
    </View>
  );
}

// ---- Growth stage ---------------------------------------------------------

const STAGE_LABEL: Record<string, string> = {
  initial: msg('Just established'),
  development: msg('Growing out'),
  mid_season: msg('Full canopy'),
  late_season: msg('Ripening'),
};

/**
 * Where the crop is in its season, and what that is worth.
 *
 * Two provenance fields, and the card renders them separately because they mean
 * different things (registry §1.3). The stage boundaries come from FAO-56. The
 * *cycle length* — how long this variety takes — is either the farmer's own
 * answer, which is authoritative for their field, or a regional default the app
 * should be inviting them to correct.
 */
export function GrowthStageCard({ stage }: { stage: GrowthStage }) {
  const known = Boolean(stage.stage);
  const cycleFromFarmer =
    stage.cycle_verification_status === 'VERIFIED' ||
    stage.cycle_source === 'user_override' ||
    stage.cycle_source === 'farmer_override';

  const days = stage.days_since_planting;
  const cycle = stage.total_cycle_days;
  const canopy = stage.canopy_cover_measured;
  const expected = stage.canopy_cover_expected_range;

  const stageName = tr(STAGE_LABEL[stage.stage ?? ''] ?? String(stage.stage));
  const summary = known
    ? [
        stageName,
        typeof days === 'number'
          ? typeof cycle === 'number'
            ? tr('day {d} of ~{c}', { d: days, c: cycle })
            : tr('day {d}', { d: days })
          : null,
        cycleFromFarmer ? null : tr('variety assumed'),
      ]
        .filter(Boolean)
        .join(' · ')
    : tr('Not worked out: {why}', { why: shortStatus(stage.reason ?? stage.status).toLowerCase() });

  return (
    <Card
      eyebrow={tr('Season')}
      title={tr('Crop stage')}
      summary={summary}
      summaryTone={known ? 'neutral' : 'unknown'}
      tile={
        known && typeof days === 'number'
          ? {
              icon: <SproutIcon color={color.secondaryForeground} />,
              label: tr('CROP STAGE'),
              value: tr('Day {d}', { d: days }),
              visual:
                typeof cycle === 'number' && cycle > 0 ? (
                  <ProgressBar fraction={days / cycle} tone="good" />
                ) : undefined,
              caption: [
                stageName,
                typeof cycle === 'number' ? tr('of ~{c} days', { c: cycle }) : null,
                cycleFromFarmer ? null : tr('variety assumed'),
              ]
                .filter(Boolean)
                .join(' · '),
            }
          : {
              icon: <SproutIcon color={color.unknown} />,
              label: tr('CROP STAGE'),
              value: known ? stageName : tr('Not known'),
              muted: !known,
              caption: known ? undefined : shortStatus(stage.reason ?? stage.status),
            }
      }
    >
      {!known ? (
        <Panel label={tr('Stage not worked out')} tone="unknown">
          {humaniseStatus(stage.reason ?? stage.status)}
        </Panel>
      ) : (
        <>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={[type.cardTitle, { color: color.foreground }]}>
                {stageName}
              </Text>
              <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: 3 }]}>
                {stage.crop ? `${stage.crop} · ` : ''}
                {stage.stage_code ?? ''}
              </Text>
            </View>
            {typeof stage.kc === 'number' ? (
              <Chip label={tr('WATER FACTOR')} value={stage.kc.toFixed(2)} />
            ) : null}
          </View>

          {typeof days === 'number' && typeof cycle === 'number' && cycle > 0 ? (
            <Meter
              value={Math.min(days, cycle)}
              min={0}
              max={cycle}
              tone="good"
              markerLabel={tr('day {d}', { d: days })}
              caption={tr('Day {d} of an assumed {c}-day cycle.', { d: days, c: cycle })}
            />
          ) : null}

          {/* Measured canopy against what this stage should look like. When
              they disagree, the planting date is usually the thing that is
              wrong, not the crop — which is a useful thing to be told. */}
          {typeof canopy === 'number' && expected ? (
            <Panel
              label={tr('Canopy against the stage')}
              tone={canopy >= expected[0] && canopy <= expected[1] ? 'good' : 'warn'}
            >
              {tr('The scan measured {m}% ground cover. A crop at this stage is usually between {lo}% and {hi}%.', {
                m: Math.round(canopy * 100),
                lo: Math.round(expected[0] * 100),
                hi: Math.round(expected[1] * 100),
              })}
              {canopy < expected[0]
                ? ` ${tr('Less cover than expected can mean the planting date entered is too early, or that the crop is behind.')}`
                : canopy > expected[1]
                  ? ` ${tr('More cover than expected usually means the planting date entered is too late.')}`
                  : ''}
            </Panel>
          ) : null}
        </>
      )}

      <Divider />

      {/* The variety cycle, and whose claim it is. */}
      <Panel
        label={cycleFromFarmer ? tr('Cultivar: Verified by Farmer') : tr('Default Variety Assumption')}
        tone={cycleFromFarmer ? 'good' : 'warn'}
      >
        {cycleFromFarmer
          ? tr('Worked out using the {c}-day cycle you entered for your own seed variety.', { c: cycle ?? '?' })
          : tr('No seed variety has been entered, so a regional default of {c} days was assumed. If you know your variety, the stage above will get noticeably better once you enter it.', { c: cycle ?? '?' })}
      </Panel>

      {stage.document_reference ? (
        <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: space.sm }]}>
          {stage.document_reference}
        </Text>
      ) : null}
    </Card>
  );
}

// ---- Inputs ---------------------------------------------------------------

const INPUT_LABEL: Record<string, string> = {
  pod_thermal: msg('Pod thermal camera'),
  pod_gps: msg('Pod GPS'),
  pod_camera_rgb: msg('Pod colour camera'),
  pod_ndvi: msg('Pod infrared camera'),
  mast_ambient: msg('Air temp / humidity'),
  mast_soil: msg('Soil probes'),
  mast_trap: msg('Sticky trap camera'),
};

/** The same sensors, short enough to list in one folded line. */
const INPUT_SHORT: Record<string, string> = {
  pod_thermal: msg('Thermal'),
  pod_gps: msg('GPS'),
  pod_camera_rgb: msg('Camera'),
  pod_ndvi: msg('Infrared'),
  mast_ambient: msg('Air sensor'),
  mast_soil: msg('Soil probes'),
  mast_trap: msg('Trap camera'),
};

const INPUT_STATUS_SHORT: Record<string, string> = {
  PENDING_CALIBRATION: msg('needs calibration'),
  MOCK_PROVISIONAL: msg('simulated'),
  ABSENT: msg('not connected'),
};

const INPUT_STATUS_TONE: Record<string, Tone> = {
  OK: 'good',
  PENDING_CALIBRATION: 'warn',
  MOCK_PROVISIONAL: 'bad',
  ABSENT: 'unknown',
};

const INPUT_STATUS_LABEL: Record<string, string> = {
  OK: msg('WORKING'),
  PENDING_CALIBRATION: msg('NEEDS CALIBRATION'),
  MOCK_PROVISIONAL: msg('SIMULATED'),
  ABSENT: msg('NOT CONNECTED'),
};

/**
 * What each status actually means for the numbers on this screen.
 *
 * `PENDING_CALIBRATION` is the one worth getting right and the one an
 * inattentive UI renders as a fault. The sensor is present, connected and
 * returning real data. What is missing is a calibration step, and the derived
 * figure that needs it was withheld rather than estimated. That is the system
 * behaving correctly, and it should not be painted red.
 */
const INPUT_STATUS_BODY: Record<string, string> = {
  PENDING_CALIBRATION:
    msg('This sensor is connected and working. What it measures directly is real and is shown. A second figure worked out from it needs a calibration step that has not been done, so that figure was left out rather than guessed.'),
  MOCK_PROVISIONAL:
    msg('This sensor is being simulated. Nothing that depends on it is a measurement of your field.'),
  ABSENT:
    msg('This sensor was not connected during the scan. Anything that needed it is missing rather than estimated.'),
};

/**
 * `pod_thermal: ABSENT` on a replay, where it does not mean "not connected".
 *
 * When `thermal.reason` is REPLAY_THERMAL_NOT_OF_SCENE, the pod reports the
 * thermal input as ABSENT because its reading was dropped: the camera was not
 * looking at the scene in the video being replayed. Showing NOT CONNECTED
 * would send someone to check a cable that is fine.
 */
const REPLAY_THERMAL_LABEL = msg('NOT USED: REPLAY');
const REPLAY_THERMAL_BODY = msg(
  'This scan is a replay of a recorded video. The thermal camera was connected, but it was not looking at the scene in the video, so its reading was left out rather than attached to the wrong field.',
);

function isReplayThermal(input: AdvisoryInput, thermalReason?: string | null): boolean {
  // Keyed on the reason, not on ABSENT alone: whatever status the pod gives the
  // input, a reading dropped for this reason was not used. A simulated sensor
  // still says SIMULATED — that is the more important thing to know.
  return (
    input.name === 'pod_thermal' &&
    input.status !== 'MOCK_PROVISIONAL' &&
    (thermalReason ?? '').split(' (')[0] === 'REPLAY_THERMAL_NOT_OF_SCENE'
  );
}

/**
 * What the advisory was built from.
 *
 * Contract v1.0 trimmed this block to name, node and status — there are no
 * per-input ages or RTC flags on the wire any more. The status enum carries
 * the whole story now, and the four values are genuinely different claims.
 * The one exception is thermal on a replay, which needs `thermal.reason` to
 * tell apart from a missing camera — see `isReplayThermal`.
 */
export function InputsCard({
  inputs,
  thermalReason,
}: {
  inputs: AdvisoryInput[];
  thermalReason?: string | null;
}) {
  if (!inputs || inputs.length === 0) {
    return (
      <Card
        eyebrow={tr('Provenance')}
        title={tr('Sensors used')}
        summary={tr('None declared, so nothing shows what was measured')}
        summaryTone="bad"
      >
        <Panel label={tr('Nothing declared')} tone="bad">
          {tr('This advisory does not list the sensors it came from, so there is no way to tell which of its numbers were measured and which were not.')}
        </Panel>
      </Card>
    );
  }

  // Folded: how many sensors fed this scan, and what is up with the rest.
  // PENDING_CALIBRATION is not "not used" — its direct reading is real and on
  // this screen — so it is named for what it is rather than lumped in.
  const working = inputs.filter((x) => x.status === 'OK' && !isReplayThermal(x, thermalReason));
  const notWorking = inputs
    .filter((x) => !working.includes(x))
    .map((x) => {
      const name = INPUT_SHORT[x.name] ? tr(INPUT_SHORT[x.name]) : x.name.replace(/_/g, ' ');
      if (isReplayThermal(x, thermalReason)) return tr('{name} not used (replay)', { name });
      const state = INPUT_STATUS_SHORT[String(x.status)];
      return `${name} ${state ? tr(state) : String(x.status).toLowerCase()}`;
    });
  const anySimulated = inputs.some((x) => x.status === 'MOCK_PROVISIONAL');

  return (
    <Card
      eyebrow={tr('Provenance')}
      title={tr('Sensors used')}
      summary={
        notWorking.length === 0
          ? tr('All {n} working', { n: inputs.length })
          : `${tr('{w} of {n} fully working', { w: working.length, n: inputs.length })} · ${notWorking.join(' · ')}`
      }
      summaryTone={anySimulated ? 'bad' : notWorking.length > 0 ? 'unknown' : 'good'}
    >
      {inputs.map((input, i) => {
        const status = input.status as InputStatus;
        const replayThermal = isReplayThermal(input, thermalReason);
        const label = replayThermal
          ? tr(REPLAY_THERMAL_LABEL)
          : INPUT_STATUS_LABEL[status]
            ? tr(INPUT_STATUS_LABEL[status])
            : String(status).replace(/_/g, ' ');
        const tone: Tone = replayThermal ? 'neutral' : (INPUT_STATUS_TONE[status] ?? 'bad');
        const bodyEn = replayThermal ? REPLAY_THERMAL_BODY : INPUT_STATUS_BODY[status];
        const body = bodyEn ? tr(bodyEn) : undefined;
        return (
          <View key={`${input.name}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={[type.label, { color: color.foreground }]}>
                  {INPUT_LABEL[input.name] ? tr(INPUT_LABEL[input.name]) : input.name.replace(/_/g, ' ')}
                </Text>
                <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: 3 }]}>
                  {input.source_node === 'POD' ? tr('on the pod you carry') : tr('on the field station')}
                </Text>
              </View>
              <StatusChip label={label} tone={tone} />
            </Row>
            {/* The chip already names the state; the body only explains it. */}
            {body ? (
              <Text style={[type.small, { color: TONE[tone].fg, marginBottom: space.xs }]}>
                {body}
              </Text>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

// ---- Actions --------------------------------------------------------------

const CONFIDENCE_TONE: Record<string, Tone> = { high: 'good', medium: 'neutral', low: 'warn' };
const CONFIDENCE_HI: Record<string, string> = { high: 'उच्च', medium: 'मध्यम', low: 'कम' };

/**
 * The pod's recommended actions — the product.
 *
 * These are what a farmer gets with no connection, in their own language,
 * complete. The generated explanation elsewhere on the screen is a nicer
 * rendering of them, never a substitute.
 *
 * Three things are non-negotiable here and all three come from the registry:
 *
 *   advisory_only appears on every action, per-action rather than once at the
 *   bottom, so it cannot scroll out of view. Actuation was dropped from scope
 *   and the UI must not imply otherwise.
 *
 *   The verification badge renders from the structural enum, so switching to
 *   Hindi cannot drop it — which is the failure mode §1.2 exists to prevent.
 *
 *   A mandatory verification note (RECALLED_UNVERIFIED, or a status this build
 *   does not recognise) is always open, above the reasoning. Only the ordinary
 *   provenance notes fold behind "Why?".
 */
export function ActionsCard({
  actions,
  language = 'en',
  onLanguageChange,
}: {
  actions: Advisory['actions'];
  language?: Language;
  onLanguageChange?: (l: Language) => void;
}) {
  const toggle = onLanguageChange ? (
    <LanguageToggle value={language} onChange={onLanguageChange} />
  ) : undefined;

  if (!actions || actions.length === 0) {
    return (
      <Card title={language === 'hi' ? 'किसान सलाह' : 'Farmer Advisory'} right={toggle}>
        <Muted>{language === 'hi' ? 'इस सलाह में कोई कार्य नहीं है।' : 'No actions in this advisory.'}</Muted>
      </Card>
    );
  }

  return (
    <Card title={language === 'hi' ? 'किसान सलाह' : 'Farmer Advisory'} right={toggle}>
      {actions.map((a, i) => (
        <ActionRow
          key={`${a.rank}-${a.template_id}`}
          action={a}
          language={language}
          first={i === 0}
        />
      ))}

      <Text style={[type.small, { color: color.fgSubtle, marginTop: space.md }]}>
        {language === 'hi'
          ? 'यह प्रणाली केवल सलाह देती है। यह किसी पंप, वाल्व या स्प्रेयर को नहीं चलाती।'
          : 'AEGIS only advises. It does not run any pump, valve or sprayer.'}
      </Text>
    </Card>
  );
}

function ActionRow({
  action: a,
  language,
  first,
}: {
  action: Advisory['actions'][number];
  language: Language;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  const r = renderAction(a, language);
  const v = presentVerification(a.verification_status, language);
  const hi = language === 'hi';

  return (
    <View style={{ marginTop: first ? 0 : space.md }}>
      {!first ? <Divider /> : null}
      <View style={s.actionHead}>
        <View style={s.rank}>
          <Text style={[type.chipLabel, { color: color.primaryForeground }]}>{a.rank}</Text>
        </View>
        <Text style={[type.body, { color: color.foreground, flex: 1, lineHeight: 21 }]}>
          {r.action}
        </Text>
      </View>

      {/* Mandatory, structural, and above the reasoning rather than below it —
          a caution a reader reaches after the dose is a caution they read after
          deciding. */}
      {v.mandatory ? (
        <Panel label={hi ? 'पहले यह पढ़ें' : 'Read this first'} tone={v.tone as Tone}>
          {v.note}
        </Panel>
      ) : null}

      <View style={[s.chipLine, { marginTop: space.sm }]}>
        <StatusChip label={v.badge} tone={v.tone as Tone} />
        <StatusChip
          label={a.advisory_only ? (hi ? 'केवल सलाह' : 'ADVISORY ONLY') : 'UNLABELLED'}
          tone={a.advisory_only ? 'good' : 'bad'}
        />
        <StatusChip
          label={
            hi
              ? `भरोसा ${CONFIDENCE_HI[a.confidence] ?? String(a.confidence)}`
              : `CONFIDENCE ${String(a.confidence).toUpperCase()}`
          }
          tone={CONFIDENCE_TONE[a.confidence] ?? 'neutral'}
        />
        {/* Provenance of the words themselves. The pod has no generative layer,
            so anything not stamped "template" did not come from it — only that
            case is worth a chip. */}
        {a.generated_by !== 'template' ? (
          <StatusChip label={`WORDING ${String(a.generated_by).toUpperCase()}`} tone="warn" />
        ) : null}
      </View>

      {!r.localised ? (
        <Panel label="Not translated" tone="warn">
          This app has no Hindi wording for this instruction, so the pod&apos;s English is
          shown instead. Ask someone to read it with you rather than guessing at it.
        </Panel>
      ) : null}

      {/* The pod and this app disagree about how well-sourced this advice is.
          Not fatal, and the pod wins — but a silent disagreement is how a
          caution goes missing. */}
      {r.verificationMismatch ? (
        <Panel label="Source marking disagrees" tone="warn">
          The pod marked this advice differently from the registry this app ships with. The
          pod&apos;s marking is the one shown. Worth reporting.
        </Panel>
      ) : null}

      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ marginTop: space.sm, alignSelf: 'flex-start', paddingVertical: 4 }}
      >
        <Text style={[type.label, { color: color.primary }]}>
          {open ? (hi ? 'कारण छिपाएँ −' : 'Hide why −') : hi ? 'क्यों? +' : 'Why? +'}
        </Text>
      </Pressable>

      {open ? (
        <View>
          {r.rationale ? (
            <Text style={[type.small, { color: color.mutedForeground, marginTop: space.xs }]}>
              {r.rationale}
            </Text>
          ) : null}
          {!v.mandatory ? (
            <Text style={[type.small, { color: color.fgSubtle, marginTop: space.sm }]}>
              {v.note}
            </Text>
          ) : null}
          {/* Plain text rather than a link: this phone is offline in the field
              and a dead tap is worse than text you can type out later. */}
          {a.url ? (
            <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: space.sm }]}>
              {a.url}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The offline language switch for the template actions.
 *
 * This is the whole point of the pod shipping `template_id` and `params` rather
 * than only a rendered sentence: the Hindi comes out of a table compiled into
 * the app, with no model and no network. It sits in the action card's header
 * because it changes that card and nothing else.
 */
export function LanguageToggle({
  value,
  onChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
}) {
  const options: { code: Language; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'hi', label: 'हिंदी' },
  ];
  return (
    <View style={s.toggle}>
      {options.map((o) => {
        const active = o.code === value;
        return (
          <Pressable
            key={o.code}
            onPress={() => onChange(o.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.code === 'en' ? 'English' : 'Hindi'}
            style={[s.toggleItem, active && { backgroundColor: color.primary }]}
          >
            <Text
              style={[
                type.chipValue,
                { color: active ? color.primaryForeground : color.mutedForeground, fontSize: 12 },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


// ---- Scan -----------------------------------------------------------------

/** What the walk itself consisted of. Never labelled a flight. */
export function ScanCard({ advisory }: { advisory: Advisory }) {
  const scan = advisory.scan;
  const health = advisory.crop_health;
  const seconds =
    scan.ended_utc && !Number.isNaN(Date.parse(scan.ended_utc))
      ? Math.round((Date.parse(scan.ended_utc) - Date.parse(scan.started_utc)) / 1000)
      : null;
  const mostDiscarded =
    scan.frames_captured > 0 && scan.frames_evaluated / scan.frames_captured < 0.6;
  const rejectedNotCrop = health?.frames_rejected_not_crop ?? 0;
  const rejectedOod = health?.frames_rejected_ood ?? 0;

  return (
    <Card
      eyebrow={tr('Scan')}
      title={tr('Scan details')}
      summary={[
        tr('{n} of {total} frames used', { n: scan.frames_evaluated, total: scan.frames_captured }),
        seconds !== null ? formatDuration(seconds) : null,
        advisory.replay ? tr('replayed video') : modeLabel(scan.mode),
      ]
        .filter(Boolean)
        .join(' · ')}
      summaryTone={mostDiscarded ? 'warn' : 'neutral'}
    >
      <Row>
        <Muted>{tr('Started')}</Muted>
        <Text style={[type.valueSmall, { color: color.foreground }]}>
          {formatStamp(scan.started_utc)}
        </Text>
      </Row>
      {scan.ended_utc ? (
        <Row>
          <Muted>{tr('Finished')}</Muted>
          <Text style={[type.valueSmall, { color: color.foreground }]}>
            {formatStamp(scan.ended_utc)}
          </Text>
        </Row>
      ) : null}

      <View style={s.statRow}>
        <Stat value={String(scan.frames_captured)} caption={tr('Frames taken')} />
        <Stat value={String(scan.frames_evaluated)} caption={tr('Good enough to use')} />
        <Stat value={String(scan.tiles_classified)} caption={tr('Patches examined')} />
      </View>

      {/* Moved here from the verdict card. Thrown-away frames never entered
          the vote, so they belong with how the scan was collected rather than
          beside the verdict they had no part in. */}
      {rejectedNotCrop + rejectedOod > 0 ? (
        <Text style={[type.small, { color: color.mutedForeground, marginTop: space.sm }]}>
          {tr('{a} frames were not crop and {b} did not look like anything the model was trained on. Both were set aside before the vote rather than forced into a class.', { a: rejectedNotCrop, b: rejectedOod })}
        </Text>
      ) : null}

      {/* Frames are thrown away by quality gates before anything is classified.
          A scan that kept a third of its frames is a scan worth repeating, and
          nothing else on the screen says so. */}
      {mostDiscarded ? (
        <Panel label={tr('Most frames were discarded')} tone="warn">
          {tr('Only {n} of {total} frames were sharp and well-lit enough to use. Walking more slowly, holding the pod steadier, or scanning out of hard direct sun will keep more of them.', { n: scan.frames_evaluated, total: scan.frames_captured })}
        </Panel>
      ) : null}

      <Divider />

      <Row>
        <Muted>{tr('Distance walked')}</Muted>
        <Text style={[type.valueSmall, { color: color.foreground }]}>
          {scan.distance_walked_m === null
            ? `${tr('not recorded')}${scan.distance_reason ? ` · ${shortStatus(scan.distance_reason).toLowerCase()}` : ''}`
            : `${scan.distance_walked_m} m`}
        </Text>
      </Row>

      <ChipRow>
        <Chip label={tr('MODE')} value={modeLabel(scan.mode)} />
        <Chip label={tr('ENGINE')} value={String(advisory.inference_backend).toUpperCase()} />
        <Chip
          label={tr('SOURCE')}
          value={advisory.replay ? tr('RECORDED') : tr('LIVE')}
          tone={advisory.replay ? 'unknown' : 'good'}
        />
        <Chip label={tr('SEQ')} value={String(advisory.seq)} />
      </ChipRow>
    </Card>
  );
}

export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(dateLocale());
}

function modeLabel(mode: unknown): string {
  return mode === 'handheld_pod' ? tr('handheld pod') : String(mode).replace(/_/g, ' ');
}

/** "25 Sep, 3:15 pm" — the form a person says out loud. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 90) return tr('{s} s walk', { s: seconds });
  return tr('{m} min walk', { m: Math.round(seconds / 60) });
}

const s = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    marginBottom: space.md,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  violations: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.destructiveBorder,
    backgroundColor: color.destructiveMuted,
    padding: space.lg,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  chipLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    padding: 2,
  },
  toggleItem: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },

  verdictCard: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: space.md,
    ...shadow.card,
  },
  verdictBand: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    marginBottom: space.sm,
  },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  rank: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
