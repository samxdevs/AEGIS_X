/**
 * Cross-source generalisation reliability (TEMPLATE_ID_REGISTRY §5).
 *
 * ── The single most important thing this app has to get right ───────────────
 * Model A reports a calibrated softmax maximum as `confidence`. That number is
 * not an accuracy, and on this model the two are close to unrelated.
 *
 * The evidence is in the registry and it is blunt. Evaluated on held-out camera
 * acquisition rigs — photographs taken with equipment the model never trained
 * against, which is what a farmer's phone and a field pod actually are —
 * `rice__bacterial_leaf_blight` recovers **0.00%** of the cases it should. The
 * real advisory captured from the device carries exactly that class at 0.9817
 * confidence. A UI that renders "98% — bacterial leaf blight" has told the
 * farmer something that is, on the evidence, almost certainly wrong, and has
 * told it to them in the most persuasive form available.
 *
 * Macro-F1 across all classes is 37.40% on held-out sources against 94.85%
 * in-distribution. That gap is residual source-identity shortcut learning: the
 * model partly learned which dataset a photo came from rather than what is
 * wrong with the plant.
 *
 * So: every detection carries its tier, the tier is rendered beside the
 * confidence, and `TESTED_FAILED` outranks a high confidence in the UI rather
 * than sitting quietly beside it.
 *
 * The standing invariant from the registry: this tier is *informational
 * provenance*. It does not alter action triggering or consensus logic on the
 * pod, and the app must not silently drop a finding because of it either. The
 * farmer decides what to do; the app makes sure they decide knowing this.
 *
 * Pure module, no React Native imports — it runs under `node --test`.
 */

import type { CrossSourceReliability } from './advisory.ts';
import { tr } from '../i18n/tr.ts';

export type TierInfo = {
  tier: CrossSourceReliability;
  /** Short chip text. Written for a farmer, not for a metrics dashboard. */
  label: string;
  /** One line explaining what the tier means about *this* finding. */
  body: string;
  /**
   * Ordering for "which of these findings should I read first". Higher means
   * the reliability caveat matters more, not that the disease is worse.
   */
  severity: number;
};

/**
 * What each tier means, in the words that go on screen.
 *
 * `UNTESTED` deliberately does not read as reassuring. Twenty of twenty-nine
 * classes had no support at all in the held-out split, so "untested" here means
 * "we have no evidence either way", which is a weaker claim than TESTED_WEAK
 * rather than a stronger one.
 */
export const TIERS: Record<string, TierInfo> = {
  TESTED_ROBUST: {
    tier: 'TESTED_ROBUST',
    label: 'HOLDS UP ON NEW CAMERAS',
    body:
      'This class was checked against photographs taken with equipment the model never learned from, and it still recognised most of them. It is the strongest evidence tier in this system.',
    severity: 1,
  },
  TESTED_WEAK: {
    tier: 'TESTED_WEAK',
    label: 'WEAK ON NEW CAMERAS',
    body:
      'On photographs from equipment the model never learned from, it recognised only some of these cases. Confirm by eye before acting.',
    severity: 2,
  },
  TESTED_FAILED: {
    tier: 'TESTED_FAILED',
    label: 'FAILED ON NEW CAMERAS',
    body:
      'On photographs from equipment the model never learned from, it almost never recognised this condition correctly. A high confidence figure here does not mean the finding is right: the two were measured to be unrelated for this class. Treat it as a prompt to look, not as a diagnosis.',
    severity: 4,
  },
  UNTESTED: {
    tier: 'UNTESTED',
    label: 'NOT TESTED',
    body:
      'This class did not appear in the independent test set at all, so there is no evidence about how it behaves on a camera the model has not seen. That is not the same as it being reliable.',
    severity: 3,
  },
};

/**
 * Per-class held-out recall, where the registry reports one.
 *
 * Only the classes §5 names carry a figure. The rest had no support in the
 * held-out split and are absent here rather than being given a zero — a zero
 * would be a measurement, and "we did not test it" is not.
 */
export const HELD_OUT_RECALL: Record<string, { recall: number; f1?: number }> = {
  sugarcane__healthy: { recall: 0.7216, f1: 0.7619 },
  wheat__yellow_rust: { recall: 0.7452, f1: 0.8037 },
  rice__normal: { recall: 0.5677, f1: 0.5824 },
  wheat__powdery_mildew: { recall: 0.354, f1: 0.3664 },
  wheat__septoria: { recall: 0.2577 },
  rice__tungro: { recall: 0.1383 },
  rice__blast: { recall: 0.0392 },
  rice__brown_spot: { recall: 0.0226 },
  rice__bacterial_leaf_blight: { recall: 0.0 },
};

/** Macro-F1 on held-out camera sources, against in-distribution. §5. */
export const MACRO_F1 = { heldOut: 0.374, inDistribution: 0.9485 } as const;

/**
 * The sentence that must accompany any confidence figure on this screen.
 *
 * Constant so it cannot be softened in one renderer and not another.
 */
export const CONFIDENCE_CAVEAT =
  'Confidence is how sure the model is of its own answer. It is not the chance ' +
  'that the answer is correct. On photographs from cameras this model never ' +
  'trained on, it recovered about a third of cases overall.';

/**
 * Tier information for a reliability string, without guessing.
 *
 * An unrecognised tier resolves to the most cautious known tier rather than to
 * a neutral one, for the same reason `presentVerification` does: a value this
 * build has not heard of must not arrive looking safer than the ones it has.
 */
export function describeReliability(tier: CrossSourceReliability | undefined | null): TierInfo {
  // Translated on the way out, so TIERS stays the registry's English.
  if (tier && TIERS[tier]) {
    const t = TIERS[tier];
    return { ...t, label: tr(t.label), body: tr(t.body) };
  }
  return {
    tier: tier ?? 'UNTESTED',
    label: tier ? tr('UNRECOGNISED ({tier})', { tier }) : tr('NO RELIABILITY STATED'),
    body: tr(
      'This finding did not state how well its class generalises to cameras the model has not seen, so nothing can be said about how much to trust it.',
    ),
    severity: 4,
  };
}

/** The held-out recall for a class, as a percentage string, or null. */
export function recallPercent(className: string): string | null {
  const entry = HELD_OUT_RECALL[className];
  if (!entry) return null;
  // One decimal, because 0.00% and 3.9% are meaningfully different claims and
  // rounding the second to 4% loses that it is nearly the first.
  return `${(entry.recall * 100).toFixed(entry.recall === 0 ? 0 : 1)}%`;
}

/**
 * Whether a finding should carry a hard warning rather than a quiet chip.
 *
 * True for TESTED_FAILED at any confidence, and for anything at high confidence
 * that is not TESTED_ROBUST — because high confidence is exactly the state in
 * which a reader stops reading the caveats.
 */
export function needsProminentCaveat(
  tier: CrossSourceReliability | undefined | null,
  confidence: number,
): boolean {
  if (tier === 'TESTED_FAILED') return true;
  if (tier === 'TESTED_ROBUST') return false;
  return confidence >= 0.9;
}
