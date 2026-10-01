/**
 * The classifier's 29 class strings, and what to call them on a screen.
 *
 * Defined on the model side in one place only (`configs/classes.py`), where
 * NUM_CLASSES resolves from the length of the list rather than being a literal,
 * so it cannot drift from it. This file is the display half of that list and
 * must stay in step with it.
 *
 * Two documents in the model repo assert 31 classes. They are stale — the
 * legacy taxonomy had two extra rice stem-borer classes that were dropped when
 * the data behind them turned out to be paywalled. The code is authoritative.
 *
 * ── The separator ───────────────────────────────────────────────────────────
 * A **double** underscore separates crop from condition: `rice__blast`. The
 * condition itself uses single underscores: `rice__bacterial_leaf_blight`.
 * Splitting on a single underscore gives the wrong crop, silently.
 */

import { msg, tr } from '../i18n/tr.ts';

export type ClassCategory = 'healthy' | 'disease' | 'pest_damage' | 'reject';

export type ClassInfo = {
  /** Crop as a farmer would say it. Null for `not_crop`. */
  crop: string | null;
  category: ClassCategory;
  /** The condition on its own, without the crop. */
  condition: string;
};

/**
 * Indices are the model's column order and are load-bearing on the pod side.
 * They are kept here so a mismatch is greppable, not because the app uses them.
 *
 *   HEALTHY_COLS  [0, 11, 12, 23]
 *   NOTCROP_COL   28
 *   CROP_COLS     0-27   — not_crop excluded, which is what makes the energy
 *                          out-of-distribution score meaningful
 *   DISEASE_COLS  [1..10, 13..22, 24..27]
 */
export const CLASS_INFO: Record<string, ClassInfo> = {
  // -- Rice ---------------------------------------------------------------
  rice__normal: { crop: 'Rice', category: 'healthy', condition: 'Healthy' },
  rice__bacterial_leaf_blight: { crop: 'Rice', category: 'disease', condition: 'Bacterial leaf blight' },
  rice__bacterial_leaf_streak: { crop: 'Rice', category: 'disease', condition: 'Bacterial leaf streak' },
  rice__bacterial_panicle_blight: { crop: 'Rice', category: 'disease', condition: 'Bacterial panicle blight' },
  rice__blast: { crop: 'Rice', category: 'disease', condition: 'Rice blast' },
  rice__brown_spot: { crop: 'Rice', category: 'disease', condition: 'Brown spot' },
  rice__downy_mildew: { crop: 'Rice', category: 'disease', condition: 'Downy mildew' },
  rice__tungro: { crop: 'Rice', category: 'disease', condition: 'Tungro virus' },
  rice__hispa: { crop: 'Rice', category: 'pest_damage', condition: 'Rice hispa damage' },
  rice__leaf_roller: { crop: 'Rice', category: 'pest_damage', condition: 'Leaf roller damage' },
  rice__yellow_stem_borer: { crop: 'Rice', category: 'pest_damage', condition: 'Yellow stem borer damage' },

  // -- Sugarcane ----------------------------------------------------------
  sugarcane__healthy: { crop: 'Sugarcane', category: 'healthy', condition: 'Healthy' },
  /**
   * Grouped with the healthy classes by the model, correctly — dried leaf is
   * not a disease, so it does not belong in DISEASE_COLS.
   *
   * But "your sugarcane is healthy" is the wrong sentence to show a farmer when
   * the model has detected dried leaves, which can mean water stress,
   * senescence or nutrient deficiency. `dryLeafCaveat` below is why this entry
   * carries its own handling rather than falling through with the others.
   */
  sugarcane__dried_leaf: { crop: 'Sugarcane', category: 'healthy', condition: 'Dried leaf' },
  sugarcane__mosaic: { crop: 'Sugarcane', category: 'disease', condition: 'Mosaic virus' },
  sugarcane__red_rot: { crop: 'Sugarcane', category: 'disease', condition: 'Red rot' },
  sugarcane__rust: { crop: 'Sugarcane', category: 'disease', condition: 'Rust' },
  sugarcane__yellow_leaf: { crop: 'Sugarcane', category: 'disease', condition: 'Yellow leaf disease' },
  sugarcane__smut: { crop: 'Sugarcane', category: 'disease', condition: 'Smut' },
  sugarcane__pokkah_boeng: { crop: 'Sugarcane', category: 'disease', condition: 'Pokkah boeng' },
  sugarcane__grassy_shoot: { crop: 'Sugarcane', category: 'disease', condition: 'Grassy shoot' },
  sugarcane__brown_spot: { crop: 'Sugarcane', category: 'disease', condition: 'Brown spot' },
  sugarcane__banded_chlorosis: { crop: 'Sugarcane', category: 'disease', condition: 'Banded chlorosis' },
  sugarcane__sett_rot: { crop: 'Sugarcane', category: 'disease', condition: 'Sett rot' },

  // -- Wheat --------------------------------------------------------------
  wheat__healthy: { crop: 'Wheat', category: 'healthy', condition: 'Healthy' },
  wheat__yellow_rust: { crop: 'Wheat', category: 'disease', condition: 'Yellow (stripe) rust' },
  wheat__brown_rust: { crop: 'Wheat', category: 'disease', condition: 'Brown (leaf) rust' },
  wheat__septoria: { crop: 'Wheat', category: 'disease', condition: 'Septoria leaf blotch' },
  wheat__powdery_mildew: { crop: 'Wheat', category: 'disease', condition: 'Powdery mildew' },

  // -- Reject -------------------------------------------------------------
  not_crop: { crop: null, category: 'reject', condition: 'Not a crop' },
};

export const CLASS_COUNT = Object.keys(CLASS_INFO).length;

/**
 * The class that must not be rendered as a clean bill of health.
 *
 * Kept as a named constant rather than inlined so the special case is greppable
 * from both the renderer and the schema.
 */
export const DRIED_LEAF_CLASS = 'sugarcane__dried_leaf';

/**
 * What to say instead of "healthy" for that class. Not a diagnosis — it names
 * the three ordinary things dried leaves can mean and sends the farmer to look.
 */
export const DRIED_LEAF_CAVEAT =
  'Dried leaf detected. This is not a disease. It can follow water stress, ' +
  'normal crop stage, or a nutrient shortage. Check irrigation and crop stage.';

/**
 * Crop and condition for a class string, without guessing.
 *
 * An unknown class returns the raw string with its underscores opened out,
 * rather than a fabricated crop name. The model side can add a class and ship
 * before this table catches up; that should look unfamiliar on screen, not
 * wrong.
 */
export function describeClass(raw: string): ClassInfo & { known: boolean; label: string } {
  const known = CLASS_INFO[raw];
  if (known) {
    // Names are translated here, at the one place every screen gets them.
    const crop = known.crop ? tr(known.crop) : null;
    const condition = tr(known.condition);
    return {
      ...known,
      crop,
      condition,
      known: true,
      label: crop ? `${crop} · ${condition}` : condition,
    };
  }
  return {
    crop: null,
    category: 'disease',
    condition: raw.replace(/__/g, ' · ').replace(/_/g, ' '),
    known: false,
    label: raw.replace(/__/g, ' · ').replace(/_/g, ' '),
  };
}

/** Display names for the pest taxa the trap reports. */
const TAXON_NAMES: Record<string, string> = {
  sugarcane_whitefly_woolly_aphid: msg('Sugarcane whitefly and woolly aphid'),
  yellow_stem_borer: msg('Yellow stem borer'),
  thrips: msg('Thrips'),
  aphid: msg('Aphid'),
  whitefly: msg('Whitefly'),
  brown_planthopper: msg('Brown planthopper'),
  leaf_roller: msg('Leaf roller'),
  hispa: msg('Hispa'),
};

/**
 * Taxon strings from the pest registry, opened out for display. A taxon this
 * table does not name keeps its registry spelling rather than a guessed name.
 */
export function describeTaxon(raw: string): string {
  if (TAXON_NAMES[raw]) return tr(TAXON_NAMES[raw]);
  const s = raw.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
