/**
 * Mechanical enforcement of the schema rules, against wire contract v1.0.
 *
 * "The app is the last place a fabricated number can be caught, and the easiest
 * place for one to be created." A rule that only exists in prose gets violated
 * by the third person to touch the renderer. These are the same rules, written
 * so a test can fail on them.
 *
 * This runs on every advisory at ingest, before it reaches SQLite. An advisory
 * that violates a rule is stored flagged and rendered with the violation shown —
 * never silently dropped, and never silently trusted.
 *
 * ── A note on strictness ────────────────────────────────────────────────────
 * The rules are about *provenance*, not about completeness. A thin advisory —
 * CWSI unavailable because the reference pads are unconfigured, `pest[]` empty
 * because no trap card was uploaded, NDVI gated on optics that have not
 * arrived, `irrigation` collapsed to two keys because the mast is not deployed
 * — is a valid advisory and must pass. What must not pass is a value that does
 * not say where it came from, or an absence that does not say why.
 *
 * Getting that boundary wrong in the strict direction is not a safe failure: an
 * app that flags every real advisory as broken is an app nobody reads the
 * warnings on. The advisory the hardware team captured from the Jetson is in
 * `fixtures/advisory-device-capture.json` precisely so that the suite fails the
 * moment this validator starts rejecting reality.
 */

import type { Advisory, SourceKind, VerificationStatus } from './advisory.ts';
import { SUPPORTED_SCHEMA_VERSIONS, UTC_INSTANT, UTC_TIMESTAMP } from './advisory.ts';
import { TEMPLATE_IDS } from './templates.ts';

/** Which of the five rules a violation belongs to. */
export type RuleId = 1 | 2 | 3 | 4 | 5;

export const RULE_NAMES: Record<RuleId, string> = {
  1: 'absence is null plus a machine-readable reason',
  2: 'every threshold carries its source and confirmation',
  3: 'inputs[] is mandatory and complete',
  4: 'source on every numeric block',
  5: 'every claim declares its citation provenance',
};

export type Violation = {
  rule: RuleId;
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  violations: Violation[];
};

const SOURCE_KINDS: readonly SourceKind[] = [
  'measured',
  'derived',
  'derived_fao56',
  'provisional',
];

/** Contract §4.5, frozen at four values. */
const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'VERIFIED',
  'WEB_VERIFIED',
  'RECALLED_UNVERIFIED',
  'UNSOURCED',
];

/** Contract §4.7. */
const INPUT_STATUSES = ['OK', 'PENDING_CALIBRATION', 'MOCK_PROVISIONAL', 'ABSENT'];

/** Contract §2.6. */
const PEST_STATUSES = [
  'BELOW_ETL',
  'AT_ETL',
  'ABOVE_ETL',
  'NO_PUBLISHED_ETL',
  'NOT_SAMPLED_BY_STICKY_TRAP',
  'UNKNOWN_PEST',
  'CARD_SATURATED',
  'INVALID_MONITORING_WINDOW',
  'MISSING_DEPLOYMENT_TIMESTAMP',
];

/** Contract §4.4. */
const RELIABILITY_TIERS = ['TESTED_ROBUST', 'TESTED_WEAK', 'TESTED_FAILED', 'UNTESTED'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Rule 3 — which declared input each populated section is built from.
 *
 * Deliberately one unambiguous input per section rather than everything that
 * touched it. The test is "could this number exist without that sensor", and
 * only these answer no.
 *
 * Note what is absent: `irrigation` is not here. It is built from ground mast
 * telemetry, and the mast does not appear in `inputs[]` on the device today —
 * the contract's enum for `inputs[].name` lists only the three pod sensors.
 * Requiring a mast entry would fail every real advisory.
 */
const SECTION_INPUTS: Record<string, readonly string[]> = {
  'thermal.tc_c': ['pod_thermal'],
  vegetation: ['pod_camera_rgb'],
  disease: ['pod_camera_rgb'],
  'detections.located': ['pod_gps'],
};

/** The four availability blocks share one shape and one rule. */
const AVAILABILITY_BLOCKS = ['thermal', 'ndvi', 'ndvi_satellite', 'irrigation'] as const;

export function validateAdvisory(raw: unknown): ValidationResult {
  const v: Violation[] = [];
  const add = (rule: RuleId, path: string, message: string) => v.push({ rule, path, message });

  if (!isObject(raw)) {
    add(1, '$', 'advisory is not an object');
    return { ok: false, violations: v };
  }
  const a = raw as unknown as Advisory;

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(a.schema_version as '1.0')) {
    add(1, 'schema_version', `unsupported schema_version ${JSON.stringify(a.schema_version)}`);
  }

  // ---- Rule 1: absence is null plus a machine-readable reason ---------------
  // A null with no status beside it is indistinguishable from a field somebody
  // forgot to fill in, which is exactly the ambiguity this rule removes.

  // Provenance. Absent `replay` is *read* as true elsewhere (isReplay), so this
  // is not a safety hole — but an advisory that does not stamp itself is still
  // a malformed advisory and the pod validates it before its own write.
  if (typeof a.replay !== 'boolean') {
    add(1, 'replay', 'advisory does not declare whether it is a live scan or a replay');
  }
  if (typeof a.seq !== 'number') {
    add(1, 'seq', 'advisory carries no seq; it cannot be ordered against the others');
  }
  // Which engine ran the model. Its absence means a silent CPU fallback cannot
  // be distinguished from a TensorRT run, which is the thing the field exists
  // to rule out.
  if (typeof a.inference_backend !== 'string' || !a.inference_backend) {
    add(1, 'inference_backend', 'advisory does not declare which inference backend produced it');
  }

  // Every document-level timestamp is UTC with a trailing Z, at second
  // resolution. Per-frame capture stamps are looser — see UTC_INSTANT.
  const checkStamp = (
    path: string,
    value: unknown,
    required: boolean,
    pattern: RegExp = UTC_TIMESTAMP,
  ): void => {
    if (value === null || value === undefined) {
      if (required) add(1, path, 'timestamp missing');
      return;
    }
    if (typeof value !== 'string' || !pattern.test(value)) {
      add(1, path, `timestamp ${JSON.stringify(value)} is not an ISO-8601 UTC instant`);
    }
  };
  checkStamp('generated_at_utc', a.generated_at_utc, true);

  const scan = a.scan;
  if (isObject(scan)) {
    checkStamp('scan.started_utc', scan.started_utc, true);
    checkStamp('scan.ended_utc', scan.ended_utc, false);
    if (scan.distance_walked_m === null && !scan.distance_reason) {
      add(1, 'scan.distance_walked_m', 'distance is null with no reason given');
    }
  } else {
    add(1, 'scan', 'scan block missing; an advisory must say what produced it');
  }

  const health = a.crop_health;
  if (!isObject(health)) {
    add(1, 'crop_health', 'crop_health block missing; an empty disease[] is ambiguous without it');
  } else if (health.state !== 'HEALTHY' && health.state !== 'DISEASE' && !health.reason) {
    // HEALTHY and DISEASE are definitive verdicts and need no reason. Every
    // other state is the pod declining to call it, and declining without
    // saying why is the ambiguity rule 1 exists to remove.
    add(1, 'crop_health.reason', `state is ${String(health.state)} but no reason is given`);
  }

  // The four availability blocks. One shape, one rule: false needs a reason.
  for (const key of AVAILABILITY_BLOCKS) {
    const block = (a as unknown as Record<string, unknown>)[key];
    if (!isObject(block)) {
      add(1, key, `${key} block missing; the app cannot tell unavailable from unreported`);
      continue;
    }
    if (typeof block.available !== 'boolean') {
      add(1, `${key}.available`, 'block does not declare whether it is available');
      continue;
    }
    if (block.available === false && !block.reason) {
      add(1, `${key}.reason`, 'block is unavailable but does not say why');
    }
  }

  // Thermal: CWSI and its terms. The interesting legitimate state is
  // available:false with a real tc_c — the array works, the references do not.
  const thermal = a.thermal;
  if (isObject(thermal)) {
    if (thermal.available === true && typeof thermal.cwsi !== 'number') {
      add(1, 'thermal.cwsi', 'thermal declares itself available but carries no CWSI value');
    }
    if (typeof thermal.cwsi === 'number' && thermal.available !== true) {
      add(1, 'thermal.cwsi', 'a CWSI value is present but the block says it is unavailable');
    }
    // Reported unclamped, so the out-of-bounds flag is what makes a value
    // outside 0–1 readable rather than looking like a bug.
    if (typeof thermal.cwsi === 'number' && (thermal.cwsi < 0 || thermal.cwsi > 1) && !thermal.flag) {
      add(1, 'thermal.flag', 'CWSI is outside 0–1 with no flag explaining it');
    }
  }

  // The two different things called ndvi. `vegetation.ndvi` is the value;
  // top-level `ndvi` is the NoIR camera probe. Conflating them is the single
  // easiest mistake to make against this payload.
  const veg = a.vegetation;
  if (isObject(veg)) {
    if (veg.ndvi === null && (!veg.ndvi_status || veg.ndvi_status === 'OK')) {
      add(1, 'vegetation.ndvi', 'ndvi is null but ndvi_status does not say why');
    }
    if (typeof veg.ndvi === 'number' && veg.ndvi_status !== 'OK') {
      add(1, 'vegetation.ndvi', 'ndvi has a value but ndvi_status is not OK');
    }

    const canopy = veg.canopy_cover;
    if (!isObject(canopy)) {
      add(1, 'vegetation.canopy_cover', 'canopy_cover block missing; the indices below it are ungated');
    } else if (typeof canopy.min_fraction_threshold !== 'number') {
      // The contract says 0.10 and the block spec says 0.15. Neither may be
      // assumed by the renderer, so the payload has to carry it.
      add(
        1,
        'vegetation.canopy_cover.min_fraction_threshold',
        'canopy gate threshold missing; the app must not assume 0.10 or 0.15',
      );
    }

    for (const key of ['vari', 'exg', 'tgi', 'dgci'] as const) {
      const idx = veg[key];
      // A withheld index is legitimate — DGCI is dropped outright when too much
      // of the frame falls outside its valid hue arc. It just has to say so.
      if (isObject(idx) && idx.mean === null && !idx.reason) {
        add(1, `vegetation.${key}.mean`, `${key} is null with no reason to explain it`);
      }
    }
  } else {
    add(1, 'vegetation', 'vegetation block missing');
  }

  // Growth stage. A null stage is the common case (no planting date entered)
  // and is fine; a null stage with no status to explain it is not.
  const stage = a.growth_stage;
  if (!isObject(stage)) {
    add(1, 'growth_stage', 'growth_stage block missing');
  } else if (!stage.stage && (!stage.status || stage.status === 'OK')) {
    add(1, 'growth_stage.status', 'no stage was estimated but the status does not say why');
  }

  const detections = Array.isArray(a.detections) ? a.detections : [];
  detections.forEach((d, i) => {
    checkStamp(`detections[${i}].captured_utc`, d.captured_utc, true, UTC_INSTANT);
    // A missing position is normal — the pod is handheld and often has no fix.
    // The scan-level gps.status carries the reason, so this is not a per-point
    // violation. What is a violation is a coordinate pair half-present.
    if ((d.lat === null) !== (d.lon === null)) {
      add(1, `detections[${i}]`, 'detection has one coordinate without the other');
    }
  });

  const pests = Array.isArray(a.pest) ? a.pest : [];
  pests.forEach((p, i) => {
    if (!PEST_STATUSES.includes(String(p.status))) {
      add(1, `pest[${i}].status`, `unrecognised ETL status ${JSON.stringify(p.status)}`);
    }
    if (typeof p.threshold_available !== 'boolean') {
      add(1, `pest[${i}].threshold_available`, 'does not declare whether a numeric threshold exists');
    }
    // The flag and the value have to agree, or the UI cannot tell "no published
    // limit" from "a limit we failed to read".
    if (p.threshold_available === true && typeof p.threshold_value !== 'number') {
      add(1, `pest[${i}].threshold_value`, 'claims a threshold exists but carries no value');
    }
    if (p.threshold_available === false && typeof p.threshold_value === 'number') {
      add(1, `pest[${i}].threshold_value`, 'carries a threshold value while declaring none exists');
    }
  });

  // ---- Rule 2: every threshold carries source and confirmation --------------
  // A provisional number rendered identically to a cited one is citation drift
  // happening in the presentation layer. Note this fires on the *presence* of a
  // threshold: a null threshold with a status explaining why is the common
  // case, and is not a violation.

  pests.forEach((p, i) => {
    if (typeof p.threshold_value !== 'number') return;
    if (!p.threshold_unit) {
      add(2, `pest[${i}].threshold_unit`, 'threshold given with no unit to compare against');
    }
    if (!VERIFICATION_STATUSES.includes(p.threshold_verification_status)) {
      add(2, `pest[${i}].threshold_verification_status`, 'threshold given with no verification status');
    }
  });

  if (isObject(veg)) {
    // Every uncalibrated index that produced a number owes a threshold source.
    // These are all PROVISIONAL today and the UI depends on being able to say so.
    for (const key of ['canopy_cover', 'vari', 'exg', 'tgi', 'dgci'] as const) {
      const idx = veg[key] as unknown;
      if (!isObject(idx)) continue;
      if (typeof idx.mean !== 'number') continue;
      if (typeof idx.threshold_confirmed !== 'boolean') {
        add(2, `vegetation.${key}.threshold_confirmed`, 'index given with no confirmation flag');
      }
      if (!idx.threshold_source) {
        add(2, `vegetation.${key}.threshold_source`, 'index given with no threshold provenance');
      }
    }
  }

  // ---- Rule 3: inputs[] mandatory and complete ------------------------------

  const inputs = Array.isArray(a.inputs) ? a.inputs : null;
  if (!inputs) {
    add(3, 'inputs', 'inputs[] is missing; the advisory does not declare what it was built from');
  } else {
    if (inputs.length === 0) {
      add(3, 'inputs', 'inputs[] is empty');
    }
    const declared = new Set<string>(inputs.map((i) => i.name));
    inputs.forEach((input, i) => {
      if (!input.name) {
        add(3, `inputs[${i}].name`, 'input has no name');
      }
      if (!input.source_node) {
        add(3, `inputs[${i}].source_node`, 'input does not say which node it is on');
      }
      // An unknown *status* is the dangerous one. An unknown name is a new
      // sensor and renders as itself; an unknown status has no tone to map to.
      if (!INPUT_STATUSES.includes(String(input.status))) {
        add(3, `inputs[${i}].status`, `unrecognised input status ${JSON.stringify(input.status)}`);
      }
    });

    const populated: string[] = [];
    if (isObject(thermal) && typeof thermal.tc_c === 'number') populated.push('thermal.tc_c');
    if (Array.isArray(a.disease) && a.disease.length > 0) populated.push('disease');
    if (
      isObject(veg) &&
      ['vari', 'exg', 'tgi', 'dgci'].some((k) => {
        const idx = (veg as Record<string, unknown>)[k];
        return isObject(idx) && typeof idx.mean === 'number';
      })
    ) {
      populated.push('vegetation');
    }
    if (detections.some((d) => typeof d.lat === 'number')) populated.push('detections.located');

    for (const section of populated) {
      for (const need of SECTION_INPUTS[section] ?? []) {
        if (!declared.has(need)) {
          add(3, section, `produced a value from "${need}" but does not declare it in inputs[]`);
        }
      }
    }
  }

  // ---- Rule 4: source on every numeric block --------------------------------
  // Walked rather than spot-checked, so a field added to one of these blocks
  // next month cannot quietly ship without declaring itself.

  const valueBlocks: Array<[string, unknown]> = [];
  if (isObject(veg)) {
    for (const key of ['canopy_cover', 'vari', 'exg', 'tgi', 'dgci'] as const) {
      valueBlocks.push([`vegetation.${key}`, veg[key]]);
    }
  }
  if (Array.isArray(a.disease)) {
    a.disease.forEach((d, i) => valueBlocks.push([`disease[${i}]`, d]));
  }
  detections.forEach((d, i) => valueBlocks.push([`detections[${i}]`, d]));
  if (isObject(health)) valueBlocks.push(['crop_health', health]);
  if (isObject(stage)) valueBlocks.push(['growth_stage', stage]);
  // The availability blocks only owe a source once they actually carry figures.
  if (isObject(a.irrigation) && a.irrigation.available === true) {
    valueBlocks.push(['irrigation', a.irrigation]);
  }

  for (const [path, block] of valueBlocks) {
    if (!isObject(block)) {
      add(4, path, 'value block missing');
      continue;
    }
    const carriesNumber = Object.values(block).some((x) => typeof x === 'number');
    if (!carriesNumber) continue;
    if (!SOURCE_KINDS.includes(block.source as SourceKind)) {
      add(4, `${path}.source`, 'numeric block does not declare how its figures came to exist');
    }
  }

  // ---- Rule 5: every claim declares its citation provenance -----------------
  // The rule the whole action pipeline turns on. A dose recalled from a model's
  // memory and a dose traced to a CIB&RC registered label claim must never be
  // able to render identically, and the only thing that separates them on the
  // wire is this enum.

  detections.forEach((d, i) => {
    if (!RELIABILITY_TIERS.includes(String(d.cross_source_reliability))) {
      add(
        5,
        `detections[${i}].cross_source_reliability`,
        'detection does not state how well its class generalises to unseen cameras',
      );
    }
  });

  if (isObject(stage) && !VERIFICATION_STATUSES.includes(stage.verification_status)) {
    add(5, 'growth_stage.verification_status', 'growth stage does not declare its provenance');
  }

  if (Array.isArray(a.actions)) {
    a.actions.forEach((act, i) => {
      if (act.advisory_only !== true) {
        add(1, `actions[${i}].advisory_only`, 'action does not declare itself advisory-only');
      }
      if (!act.template_id) {
        add(1, `actions[${i}].template_id`, 'action has no template_id; it cannot be translated offline');
      } else if (!(TEMPLATE_IDS as readonly string[]).includes(act.template_id)) {
        // Not fatal to rendering — the English still shows — but it means the
        // Hindi view has nothing to render from, which is worth surfacing.
        add(
          5,
          `actions[${i}].template_id`,
          `template ${JSON.stringify(act.template_id)} is not one of the 21 in the registry; it cannot be shown in Hindi`,
        );
      }
      if (act.generated_by !== 'template') {
        add(
          1,
          `actions[${i}].generated_by`,
          `action claims to be generated by ${JSON.stringify(act.generated_by)}; the pod only emits templates`,
        );
      }
      if (!VERIFICATION_STATUSES.includes(act.verification_status)) {
        add(
          5,
          `actions[${i}].verification_status`,
          'action does not declare whether its recommendation is verified',
        );
      }
      // Registry §1.2 carries the status twice on purpose, because a localised
      // view renders from the template table and may never read the English
      // rationale. If the two disagree, one of them is lying to somebody.
      const inParams = act.params?.verification_status;
      if (typeof inParams === 'string' && inParams !== act.verification_status) {
        add(
          5,
          `actions[${i}].params.verification_status`,
          `params say ${JSON.stringify(inParams)} but the action says ${JSON.stringify(act.verification_status)}`,
        );
      }
      // A web-verified claim that cannot be traced is not web-verified.
      if (act.verification_status === 'WEB_VERIFIED' && !act.url && !act.document_reference) {
        add(
          5,
          `actions[${i}].url`,
          'action claims WEB_VERIFIED but carries neither a URL nor a document reference',
        );
      }
    });
  } else {
    add(1, 'actions', 'actions[] is missing');
  }

  return { ok: v.length === 0, violations: v };
}

/** Human-readable one-liner for logs and the debug screen. */
export function describeViolation(x: Violation): string {
  return `rule ${x.rule} (${RULE_NAMES[x.rule]}) at ${x.path}: ${x.message}`;
}

/**
 * The blocks the advisory screen dereferences without checking first.
 *
 * Separate from `validateAdvisory` on purpose. That answers "is this record
 * trustworthy?" — a question about provenance, where a thin-but-honest advisory
 * passes. This answers a blunter one: "will the renderer survive this?"
 *
 * A record can be perfectly valid under an older schema and still be missing a
 * block this build reads. That is not hypothetical — it is how the advisory
 * screen came to die on `crop_health.state` after the handheld-pod rewrite,
 * with a replica full of drone-era records that had been valid when stored, and
 * it is exactly what happens again to every record written before contract v1.0
 * replaced the `water` block with `thermal` / `ndvi` / `irrigation`.
 *
 * The app is the only interface this system has. A white screen is the worst
 * thing it can do, because it tells the farmer nothing at all — worse than a
 * screen saying "this record is from an older version and cannot be shown".
 */
export const REQUIRED_BLOCKS = [
  'scan',
  'crop_health',
  'growth_stage',
  'vegetation',
  'thermal',
  'ndvi',
  'ndvi_satellite',
  'irrigation',
  'gps',
  'inputs',
  'actions',
] as const;

export function missingBlocks(advisory: unknown): string[] {
  if (!isObject(advisory)) return [...REQUIRED_BLOCKS];
  return REQUIRED_BLOCKS.filter((key) => {
    const value = advisory[key];
    if (value === null || value === undefined) return true;
    // inputs and actions are arrays; the rest are objects. Either way, a
    // primitive where a block should be is just as unrenderable as nothing.
    return typeof value !== 'object';
  });
}

/** True when the renderer can walk this record without guarding every access. */
export function isRenderable(advisory: unknown): boolean {
  return missingBlocks(advisory).length === 0;
}
