/**
 * The AEGIS advisory wire schema — `schema_version` "1.0", as frozen by
 * `docs/PAYLOAD_CONTRACT.md` (21 September 2026).
 *
 * This is the phone-side half of a contract shared with the Handheld Nano Pod.
 * It is deliberately a faithful mirror of the JSON rather than a prettier
 * reinterpretation: the sibling `<field>_status` / `<field>_reason` keys, the
 * four parallel availability blocks, and the two different things both called
 * `ndvi` are all modelled exactly as the pod emits them.
 *
 * ── The architecture ────────────────────────────────────────────────────────
 * There is no drone. There is no flight, no survey pass and no inspection pass.
 * The system is two devices:
 *
 *   the Nano Pod    handheld, carried by the farmer through the field. Jetson
 *                   Nano, RGB CSI camera, MLX90640 thermal array, GPS, and a
 *                   NoIR camera reserved for NDVI. Headless — no screen.
 *   the Ground Mast unattended, left standing in the field. ESP32, sticky-trap
 *                   camera, soil probes, SHT40 ambient, BH1750 light, IR point.
 *                   The pod *pulls* from it; it never pushes.
 *
 * Everything is a **scan**, run by a **pod**. The word "flight" must not appear
 * on any screen.
 *
 * One consequence worth keeping in mind while editing this file: the pod is
 * headless and the mast has no screen, so **this app is the only user interface
 * the system has.** Every degradation the hardware reports is one a farmer can
 * only ever learn about here.
 *
 * ── On tolerating drift ─────────────────────────────────────────────────────
 * Several blocks arrive thinner than the contract's tables describe. The real
 * advisory captured from the device carries an `irrigation` block of exactly
 * two keys, and a `growth_stage.status` of `CROP_NOT_SPECIFIED` — a value the
 * contract's enum does not list. So the optionality below is wider than the
 * tables: everything past the availability flag is optional, and every closed
 * enum is widened so an unrecognised value arrives as itself instead of being
 * silently coerced into a neighbouring meaning.
 */

/** Widens a closed enum without losing its autocomplete. */
type Open<T extends string> = T | (string & {});

/** Rule 4 — every numeric block declares how its figures came to exist. */
export type SourceKind = Open<'measured' | 'derived' | 'derived_fao56' | 'provisional'>;

/**
 * The frozen four-value citation provenance enum (contract §4.5).
 *
 * This is the single most load-bearing enum in the payload, because it is what
 * separates a dose traced to a CIB&RC registered label claim from one a model
 * recalled from memory. `RECALLED_UNVERIFIED` must never render like the
 * others — see `src/schema/templates.ts` for the mandatory UI rules.
 */
export type VerificationStatus = Open<
  'VERIFIED' | 'WEB_VERIFIED' | 'RECALLED_UNVERIFIED' | 'UNSOURCED'
>;

/**
 * Which inference engine produced the diagnoses.
 *
 * `trt` is TensorRT on the Nano's Maxwell GPU and is what the real device
 * always reports. `onnx` is the CPU fallback. `mock` is a synthetic test
 * vector: the gateway refuses to serve one at all in production mode (403), so
 * an advisory stamped `mock` on this phone came from somewhere other than a
 * production pod and the UI says so.
 */
export type InferenceBackend = Open<'trt' | 'onnx' | 'mock'>;

// ---- Sensor inputs --------------------------------------------------------

/**
 * Contract §4.7. Note what is *not* here: there is no STALE.
 *
 * `PENDING_CALIBRATION` is the interesting one and it is not a fault. The
 * thermal array is present, connected and returning a valid canopy temperature;
 * what is missing is the wet/dry reference calibration that turns that
 * temperature into CWSI. Rendering it as "broken" would be wrong, and rendering
 * it as "OK" would promise a number that is not coming.
 */
export type InputStatus = Open<'OK' | 'PENDING_CALIBRATION' | 'MOCK_PROVISIONAL' | 'ABSENT'>;

/** `POD` for pod-borne sensors, `MAST` for the ground station. Never parsed. */
export type SourceNode = Open<'POD' | 'MAST'>;

export type AdvisoryInput = {
  name: Open<'pod_camera_rgb' | 'pod_gps' | 'pod_thermal'>;
  source_node: SourceNode;
  status: InputStatus;
};

// ---- Scan -----------------------------------------------------------------

export type Scan = {
  started_utc: string;
  ended_utc: string;
  /** The only mode. A handheld pod walked through the crop. */
  mode: Open<'handheld_pod'>;
  frames_captured: number;
  /** Frames that passed quality gates 1–4. */
  frames_evaluated: number;
  /** `frames * 9` — each frame is cut into nine 224x224 tiles for inference. */
  tiles_classified: number;
  distance_walked_m: number | null;
  /** Rule 1 — present whenever the distance is null. */
  distance_reason?: string | null;
};

// ---- Crop health ----------------------------------------------------------

/**
 * The five states the frame aggregator can return.
 *
 * This block exists because an empty `disease[]` is ambiguous between four
 * different things to tell a farmer: the crop is healthy, nothing was scanned,
 * everything was rejected as not-crop, or the model was uncertain. `NO_DATA`
 * exists specifically so "healthy" and "never looked at" can never render the
 * same colour.
 */
export type CropHealthState = Open<'HEALTHY' | 'DISEASE' | 'UNCERTAIN' | 'NOT_CROP' | 'NO_DATA'>;

export type CropHealth = {
  state: CropHealthState;
  /** e.g. HIGH_UNCERTAINTY, MULTIPLE_CROPS_DETECTED, UNCONFIRMED_DETECTIONS. */
  reason: string | null;
  crop: Open<'rice' | 'wheat' | 'sugarcane'> | null;
  frames_evaluated: number;
  frames_agreeing: number;
  /** Rejected by the open-set energy gate — nothing the model was trained on. */
  frames_rejected_ood: number;
  frames_rejected_not_crop: number;
  frames_uncertain: number;
  source: SourceKind;
};

// ---- Growth stage ---------------------------------------------------------

/**
 * FAO-56 Chapter 5 phenology.
 *
 * Two verification fields, and they mean different things (registry §1.3):
 *
 *   verification_status        provenance of the stage boundaries and Kc, which
 *                              are traced to FAO Irrigation and Drainage Paper
 *                              No. 56 and are normally WEB_VERIFIED.
 *   cycle_verification_status  provenance of the *variety cycle length*.
 *                              VERIFIED here means the farmer typed in their own
 *                              seed variety — their own report about their own
 *                              field, which is authoritative for it.
 *                              RECALLED_UNVERIFIED means a regional default was
 *                              assumed, and the UI invites them to correct it.
 */
export type GrowthStage = {
  crop: Open<'rice' | 'wheat' | 'sugarcane'> | null;
  stage: Open<'initial' | 'development' | 'mid_season' | 'late_season'> | null;
  stage_code: Open<'INI' | 'DEV' | 'MID' | 'LATE'> | null;
  days_since_planting?: number | null;
  total_cycle_days?: number | null;
  cycle_source?: Open<'default_assumption' | 'user_override' | 'farmer_override'> | null;
  cycle_verification_status?: VerificationStatus | null;
  stage_lengths_days?: Record<string, number> | null;
  canopy_cover_measured?: number | null;
  canopy_cover_expected_range?: [number, number] | null;
  /** FAO-56 Table 12 crop coefficient, 0.20–1.35. */
  kc?: number | null;
  /**
   * The contract lists OK / DAYS_SINCE_PLANTING_REQUIRED / AWAITING_PLANTING_DATE
   * / UNSUPPORTED_CROP. The device also emits CROP_NOT_SPECIFIED, which the
   * contract's table does not carry — hence the open enum.
   */
  status: Open<
    | 'OK'
    | 'DAYS_SINCE_PLANTING_REQUIRED'
    | 'AWAITING_PLANTING_DATE'
    | 'UNSUPPORTED_CROP'
    | 'CROP_NOT_SPECIFIED'
  >;
  reason?: string | null;
  verification_status: VerificationStatus;
  source: SourceKind;
  document_reference?: string | null;
};

// ---- Vegetation -----------------------------------------------------------

/**
 * Where an index sits in its own field's distribution for this scan.
 *
 * There are no published, crop-specific absolute bands for uncalibrated RGB
 * indices. Their absolute value depends on the illumination spectrum, the
 * camera's white balance and gain, the sun angle and how much soil is in frame
 * — the same healthy canopy at 09:00 and 14:00 gives materially different VARI.
 *
 * So the pod compares the field against itself: one illumination, one camera,
 * one session, and all of those confounds cancel. A cell in the bottom decile
 * of its own field this afternoon is genuinely worth walking over to look at.
 */
export type IndexBand = Open<'LOWER_TAIL' | 'BELOW_TYPICAL' | 'TYPICAL' | 'ABOVE_TYPICAL'>;

/** Why an index mean was withheld. */
export type IndexReason = Open<
  /** DGCI only — too much of the frame fell outside the valid hue arc. */
  | 'OUT_OF_DOMAIN_FRACTION_EXCEEDED'
  /** Soil reflectance dominated the frame; the canopy fraction was too low. */
  | 'INSUFFICIENT_CANOPY_FRACTION'
  | 'NO_FRAMES_ACCEPTED'
>;

export type VegetationIndex = {
  mean: number | null;
  /** Present when `mean` is null. Rule 1 — absence carries a reason. */
  reason?: IndexReason | null;
  p10?: number | null;
  p50?: number | null;
  p90?: number | null;
  field_median?: number | null;
  band?: IndexBand | null;
  /** How `band` was decided. "within_scan_percentile" is the only mode today. */
  band_basis?: string | null;
  /** DGCI only — the fraction of pixels outside the index's valid hue domain. */
  out_of_domain_fraction?: number | null;
  /** The withholding threshold, so the UI can state it rather than assume it. */
  threshold?: number | null;
  min_fraction_threshold?: number | null;
  /** Rule 2 — always starts "PROVISIONAL" on these uncalibrated heuristics. */
  threshold_source?: string | null;
  threshold_confirmed?: boolean | null;
  source: SourceKind;
};

/**
 * How much of the frame was green canopy at all.
 *
 * This gates every index below it: under `min_fraction_threshold` the frame is
 * mostly soil, and an index computed over it describes the ground rather than
 * the crop. The threshold itself is provisional and the block says so.
 */
export type CanopyCover = {
  mean: number;
  p10?: number | null;
  p50?: number | null;
  p90?: number | null;
  /**
   * 0.10 in the contract table, 0.15 in the block spec and on the device.
   * Read it from the payload; never hardcode either.
   */
  min_fraction_threshold: number;
  status: Open<'OK' | 'INSUFFICIENT_CANOPY'>;
  threshold_source?: string | null;
  threshold_confirmed?: boolean | null;
  source: SourceKind;
};

export type Vegetation = {
  /**
   * "relative" means every band on this block is a within-scan percentile and
   * says nothing about whether the field as a whole is healthy. A uniformly
   * stressed field has a perfectly normal internal distribution.
   *
   * VEGETATION_BLOCK_SPEC §1.2 makes rendering that caveat mandatory and
   * forbids hiding it in a tooltip. See `VEGETATION_CAVEAT` below.
   */
  interpretation_mode: Open<'relative' | 'absolute'>;
  canopy_cover: CanopyCover;
  vari: VegetationIndex;
  exg: VegetationIndex;
  tgi: VegetationIndex;
  dgci: VegetationIndex;
  /**
   * The dual-bandpass NDVI **value**, distinct from the top-level `ndvi`
   * hardware-probe block. Always null in the current build: the optical path
   * and cross-talk unmixing matrix are unfinished, and the pod raises rather
   * than returning an uncalibrated number.
   */
  ndvi: number | null;
  ndvi_status: Open<'OK' | 'GATED_HARDWARE_CALIBRATION' | 'PENDING_HARDWARE_FINALIZATION'>;
  ndvi_reason?: string | null;
};

/**
 * The exact sentence VEGETATION_BLOCK_SPEC §1.2 requires on screen whenever a
 * relative band is shown. Kept as a constant so it is greppable and cannot
 * drift into a paraphrase that loses the second half.
 */
export const VEGETATION_CAVEAT =
  'Compares parts of your field against each other. It cannot tell you whether ' +
  'the whole field is healthy.';

// ---- Thermal --------------------------------------------------------------

/**
 * Canopy temperature, and the CWSI that is gated behind reference calibration.
 *
 * `available: false` with a populated `tc_c` is the normal state on the device
 * today: the MLX90640 is connected and returning a real canopy temperature, but
 * `configs/thermal_refs.json` has no wet/dry reference pads configured, so the
 * Jones (1999) ratio has no denominator. The temperature is a measurement and
 * should be shown; the stress index is not available and must not be estimated.
 */
export type Thermal = {
  available: boolean;
  reason?: string | null;
  /** Median canopy temperature, °C. Present whenever a valid frame was captured. */
  tc_c?: number | null;
  twet_c?: number | null;
  tdry_c?: number | null;
  /** (Tc - Twet) / (Tdry - Twet), Jones (1999). Reported unclamped. */
  cwsi?: number | null;
  /** Out-of-bounds flag, because the ratio is reported unclamped. */
  flag?: Open<'NORMAL' | 'CWSI_BELOW_ZERO' | 'CWSI_ABOVE_ONE'> | null;
  thermal_source?: Open<'hardware' | 'mock'> | null;
  frame_utc?: string | null;
};

// ---- NDVI probes ----------------------------------------------------------

/** The NoIR camera hardware probe. Distinct from `vegetation.ndvi`. */
export type NdviProbe = {
  available: boolean;
  reason?: string | null;
};

/** Sentinel-2 L2A fallback, cached from Copernicus CDSE while online. */
export type NdviSatellite = {
  available: boolean;
  reason?: string | null;
  source?: string | null;
  scene_date?: string | null;
  age_days?: number | null;
  ndvi_mean?: number | null;
  ndvi_std?: number | null;
  valid_pixel_count?: number | null;
  cloud_masked_fraction?: number | null;
  /** 10 m ground sample distance — which is why small fields get a warning. */
  pixel_size_m?: number | null;
  reliability_note?: string | null;
};

// ---- Irrigation -----------------------------------------------------------

/**
 * FAO-56 Hargreaves-Samani crop water requirement.
 *
 * Everything here is derived from the ground mast's temperature history. With
 * the mast absent the whole block collapses to `available: false` plus a
 * reason, which is what the real device emits today — so every field past the
 * first two is optional, not merely nullable.
 */
export type Irrigation = {
  available: boolean;
  reason?: string | null;
  method?: Open<'fao56_hargreaves_samani'> | null;
  air_temp_c?: number | null;
  rh_pct?: number | null;
  t_min_24h_c?: number | null;
  t_max_24h_c?: number | null;
  t_mean_24h_c?: number | null;
  /** Extraterrestrial radiation, FAO-56 Eqs. 21–25. */
  ra_mj_m2_day?: number | null;
  ra_mm_day?: number | null;
  ra_source?: Open<'GPS' | 'CONFIG_LATITUDE'> | null;
  ra_latitude_deg?: number | null;
  day_of_year?: number | null;
  /** Reference evapotranspiration. */
  et0_mm_day?: number | null;
  kc?: number | null;
  /** ETc = ET0 x Kc. The number a farmer can actually use. */
  crop_et_mm_day?: number | null;
  soil1_v?: number | null;
  soil2_v?: number | null;
  battery_v?: number | null;
  samples_24h?: number | null;
  source?: SourceKind | null;
};

// ---- Detections and GPS ---------------------------------------------------

/**
 * How well the class generalised to camera rigs the model never trained on
 * (registry §5, evaluated on held-out multi-source splits).
 *
 * This is the most important field in the payload for honest presentation, and
 * it is the one a naive UI drops. `rice__bacterial_leaf_blight` scores 0.00%
 * recall on a held-out source and still arrives at 0.98 confidence. Confidence
 * is a softmax maximum; it is not an accuracy, and on this model the two are
 * close to unrelated.
 */
export type CrossSourceReliability = Open<
  'TESTED_ROBUST' | 'TESTED_WEAK' | 'TESTED_FAILED' | 'UNTESTED'
>;

export type GpsStatus = Open<'OK' | 'ABSENT'>;

/**
 * A point-tagged detection event.
 *
 * `disease[]` is the aggregate; this is the point-event list. They are
 * different things and a map wants the second. When there is no fix the entry
 * is still emitted with null coordinates — the detection is real even when the
 * position is not.
 */
export type Detection = {
  /** Double underscore separator: `rice__blast`, not `rice_blast`. */
  class: string;
  /** Calibrated softmax maximum. Never render this as an accuracy. */
  confidence: number;
  cross_source_reliability: CrossSourceReliability;
  lat: number | null;
  lon: number | null;
  /** NMEA fix quality. 0 = invalid, 1 = GPS, 2 = DGPS. */
  fix_quality?: number | null;
  hdop?: number | null;
  captured_utc: string;
  source: SourceKind;
};

export type Gps = {
  status: GpsStatus;
  point_count: number;
  /** Handheld, no RTK. Roughly 2.5 m CEP — a corner of a field, not a plant. */
  accuracy_note?: string | null;
};

// ---- Disease --------------------------------------------------------------

/**
 * One disease class, aggregated across the scan.
 *
 * Thinner than the earlier draft: there are no per-class frame counts on the
 * wire any more. The per-frame evidence lives in `crop_health` for the scan as
 * a whole, and the per-detection reliability tier lives in `detections[]`. The
 * renderer joins the two rather than inventing counts this block does not have.
 */
export type DiseaseFinding = {
  class: string;
  confidence: number;
  /** Always present, always an array, and always empty: media is pruned. */
  media_ids: string[];
  source: SourceKind;
};

// ---- Pest -----------------------------------------------------------------

/**
 * Sticky-trap ETL comparison status (contract §2.6).
 *
 * The three ordinary outcomes are BELOW / AT / ABOVE_ETL. The rest are the
 * reasons a comparison could not be made, and the second is the most valuable
 * state in the table:
 *
 *   NO_PUBLISHED_ETL              the source gives no number for this taxon
 *   NOT_SAMPLED_BY_STICKY_TRAP    a yellow card is the wrong instrument for it
 *   CARD_SATURATED                too many blobs to count reliably
 *   INVALID_MONITORING_WINDOW     days_monitored fell outside 1–7
 *   MISSING_DEPLOYMENT_TIMESTAMP  nobody recorded when the card went out
 *
 * Stem borers are caught on pheromone lures; planthoppers are counted by
 * tapping the base of a hill. A sticky-card count for either is not a low
 * number — it is a meaningless one, and a system reporting one would be
 * inventing a measurement.
 */
export type PestStatus = Open<
  | 'BELOW_ETL'
  | 'AT_ETL'
  | 'ABOVE_ETL'
  | 'NO_PUBLISHED_ETL'
  | 'NOT_SAMPLED_BY_STICKY_TRAP'
  | 'UNKNOWN_PEST'
  | 'CARD_SATURATED'
  | 'INVALID_MONITORING_WINDOW'
  | 'MISSING_DEPLOYMENT_TIMESTAMP'
>;

/**
 * One pest evaluation from a sticky trap card.
 *
 * ── Why the counting basis is on the wire ───────────────────────────────────
 * `watershed_all_blobs` means the ETL gate is the deterministic watershed blob
 * count, not the CNN's classification. That is the safety property: the
 * unverified cross-domain CNN does not decide whether a farmer sprays. It also
 * means the count *includes* debris and non-target insects, so it is a
 * conservative over-estimate against the threshold — which the UI must say,
 * because an over-estimate that looks like a measurement pushes toward spraying.
 */
export type PestFinding = {
  target_pest_context: string;
  count_basis: Open<'watershed_all_blobs' | 'direct_count'>;
  count_observed: number;
  days_monitored: number;
  /** Informational only. The ETL is cumulative per card, not per day. */
  daily_rate: number;
  threshold_value: number | null;
  threshold_unit: Open<'insects_per_trap'> | null;
  threshold_available: boolean;
  status: PestStatus;
  /** Provenance of the threshold — normally VERIFIED against the DPPQS text. */
  threshold_verification_status: VerificationStatus;
  /** Provenance of the CNN — RECALLED_UNVERIFIED, a European trap model. */
  classification_verification_status: VerificationStatus;
  total_blobs_counted?: number | null;
  classification_source?: string | null;
  morphological_distribution?: Record<string, number> | null;
};

/**
 * The disclaimer TEMPLATE_ID_REGISTRY §4.3 requires beside any trap count.
 * Constant rather than inline so it cannot be softened in one renderer only.
 */
export const TRAP_COUNT_DISCLAIMER =
  'The count is every blob the segmenter found on the card, including debris ' +
  'and insects that are not the target. It is a deliberate over-estimate ' +
  'against the threshold, not a species count.';

// ---- Actions --------------------------------------------------------------

export type ActionConfidence = Open<'high' | 'medium' | 'low'>;

/**
 * One recommended action.
 *
 * The pod emits `template_id` and a structured `params` object, not just a
 * rendered sentence, and that is the design choice that makes offline Hindi
 * possible: the app holds a table keyed on `template_id` and substitutes from
 * `params`. Deterministic, auditable, no model and no network. If the pod
 * emitted only free text, Hindi would need a runtime translation service — a
 * network-dependent feature in an offline-first product.
 *
 * `verification_status` is carried **twice**, as a first-class field and inside
 * `params`, precisely because a localised view renders from the template table
 * and might never read the English `rationale`. The safety warning must not be
 * droppable by switching language. See `src/schema/templates.ts`.
 *
 * `generated_by` is always "template" on anything the pod emits. The pod has no
 * generative layer. "llm" can only ever be set by the phone, on the cached
 * explanation, which lives beside the advisory rather than inside it.
 */
export type Action = {
  rank: number;
  template_id: string;
  /** Rendered English. Length-capped at 240 characters by the pod. */
  action: string;
  /** Length-capped at 400 characters. */
  rationale: string;
  /** The values substituted into the template. The Hindi table reads these. */
  params: Record<string, unknown>;
  verification_status: VerificationStatus;
  /** Retrievable primary source. Null on everything not WEB_VERIFIED. */
  url?: string | null;
  document_reference?: string | null;
  /** Local archive path under `docs/sources/` on the pod. */
  offline_source_file?: string | null;
  confidence: ActionConfidence;
  /** Actuation is out of scope; this must be true and must be shown. */
  advisory_only: boolean;
  generated_by: Open<'template'>;
  source: SourceKind;
};

// ---- The advisory ---------------------------------------------------------

export type Advisory = {
  schema_version: string;
  advisory_id: string;
  /**
   * The pod's SQLite rowid. Monotonic, assigned at commit, never reused, and
   * completely independent of the clock — which matters because the Nano has no
   * battery-backed RTC and a backwards clock jump is the expected behaviour on
   * every cold boot until GPS locks. `advisory_id` is a timestamp and does not
   * order safely. This is the cursor.
   */
  seq: number;
  generated_at_utc: string;
  /**
   * Which engine ran the classifier. Guarantees no silent fallback happened.
   * A production gateway refuses to serve a `mock` advisory at all.
   */
  inference_backend: InferenceBackend;
  /**
   * Whether this advisory was assembled from stored video rather than captured
   * live. Mandatory, and **a missing key must be read as `true`** on both sides:
   * the failure we care about is a seeded record labelled live, not a live
   * record labelled seeded, so a bug has to produce the safe error.
   */
  replay: boolean;
  scan: Scan;
  crop_health: CropHealth;
  growth_stage: GrowthStage;
  vegetation: Vegetation;
  thermal: Thermal;
  /** The NoIR *hardware probe*. `vegetation.ndvi` is the value. Not the same. */
  ndvi: NdviProbe;
  ndvi_satellite: NdviSatellite;
  irrigation: Irrigation;
  detections: Detection[];
  gps: Gps;
  disease: DiseaseFinding[];
  pest: PestFinding[];
  inputs: AdvisoryInput[];
  actions: Action[];
};

export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'] as const;

/**
 * Reads the provenance stamp the safe way round.
 *
 * Used everywhere instead of `advisory.replay` directly, so there is no code
 * path where a dropped field quietly renders seeded data as live measurement.
 */
export function isReplay(advisory: { replay?: boolean } | null | undefined): boolean {
  return advisory?.replay !== false;
}

/** ISO-8601, UTC, Z suffix, second resolution. No offsets, no epoch seconds. */
export const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * The looser stamp the pod uses on per-frame capture times.
 *
 * `detections[].captured_utc` arrives as `2026-09-19T13:16:09.756865+00:00` —
 * microsecond precision and a numeric offset rather than a Z. That is still an
 * unambiguous UTC instant, so it is accepted rather than flagged; it simply is
 * not the second-resolution form the document-level timestamps use.
 */
export const UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The field identifier, when the advisory id happens to carry one.
 *
 * Ids look like `2026-09-19T13:16:18Z_F01`, but the contract calls the id an
 * opaque string, so this is a display nicety and returns null the moment the
 * shape does not match rather than slicing something arbitrary off the end.
 */
export function fieldIdFromAdvisoryId(advisoryId: string): string | null {
  const m = /_([A-Za-z0-9-]{1,16})$/.exec(advisoryId);
  return m ? m[1] : null;
}
