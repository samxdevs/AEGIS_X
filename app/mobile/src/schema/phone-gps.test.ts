import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPhoneGpsPod } from './advisory.ts';

test('pod GPS is "not used" when the positions came from the phone', () => {
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'ABSENT' }, 'phone_gps'), true);
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'OK' }, 'phone_gps'), true);
});

test('an older advisory without gps.source keeps the status the pod gave', () => {
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'ABSENT' }, undefined), false);
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'ABSENT' }, null), false);
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'ABSENT' }, 'pod_gps'), false);
});

test('only the pod GPS input is affected, and a simulated one still says so', () => {
  assert.equal(isPhoneGpsPod({ name: 'phone_gps', status: 'OK' }, 'phone_gps'), false);
  assert.equal(isPhoneGpsPod({ name: 'pod_thermal', status: 'ABSENT' }, 'phone_gps'), false);
  assert.equal(isPhoneGpsPod({ name: 'pod_gps', status: 'MOCK_PROVISIONAL' }, 'phone_gps'), false);
});
