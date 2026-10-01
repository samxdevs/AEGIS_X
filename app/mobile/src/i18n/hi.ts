/**
 * Hindi for every English string the app wraps in `tr()` or `msg()`, keyed by
 * the English exactly as it is written in the code.
 *
 * Split by area so each file stays reviewable; `hi.test.ts` checks the merged
 * table covers every string, keeps every `{placeholder}`, and has no entry
 * nothing uses. The offline advice itself (actions and their reasons) has its
 * own Hindi in `schema/templates.ts` and is not repeated here.
 *
 * Written for this app; worth a read-through by a Hindi-speaking agronomist
 * before it goes in front of farmers.
 */

import { FINDINGS } from './hi/findings.ts';
import { PESTS_STATUS } from './hi/pests-status.ts';
import { POD } from './hi/pod.ts';
import { READINGS } from './hi/readings.ts';
import { SCAN } from './hi/scan.ts';
import { SCREENS } from './hi/screens.ts';

export const HI: Record<string, string> = {
  ...SCREENS,
  ...POD,
  ...SCAN,
  ...FINDINGS,
  ...READINGS,
  ...PESTS_STATUS,
};
