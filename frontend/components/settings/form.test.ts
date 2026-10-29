import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Settings } from '@/lib/types';
import {
  SETTINGS_FIELDS, firstError, hasChanges, sameForm, settingsPatch, settingsServerErrors, toForm, validateSettings,
} from './form.ts';

const BASE: Settings = {
  group_name: 'Fruitfull Footprints',
  tagline: 'A private home for our small group.',
  meeting_day: 'Wednesday',
  meeting_time: '7pm',
  meeting_place: 'Rachel’s porch',
  since_year: 2023,
};

test('an untouched form is valid and patches nothing', () => {
  const f = toForm(BASE);
  assert.equal(f.since_year, '2023');
  assert.deepEqual(validateSettings(f), {});
  assert.deepEqual(settingsPatch(f, BASE), {});
  assert.ok(sameForm(f, toForm(BASE)));
  assert.equal(hasChanges(f, BASE), false, 'Save has nothing to send');
});

test('Save has something to send only when a value differs once trimmed', () => {
  const f = toForm(BASE);
  assert.equal(hasChanges({ ...f, group_name: ' Fruitfull Footprints  ', since_year: '2023 ' }, BASE), false, 'whitespace alone');
  assert.equal(hasChanges({ ...f, meeting_day: 'Thursday' }, BASE), true);
  assert.equal(hasChanges({ ...f, meeting_day: 'Thursday' }, { ...BASE, meeting_day: 'Thursday' }), false, 'back to what’s saved');
  assert.equal(hasChanges({ ...f, tagline: '' }, BASE), true, 'clearing the tagline');
  // Anything that won't validate still counts, so Save is there to explain why.
  assert.equal(hasChanges({ ...f, since_year: '' }, BASE), true);
  assert.equal(hasChanges({ ...f, since_year: '20x3' }, BASE), true);
});

test('the patch holds only changed, trimmed values', () => {
  const f = { ...toForm(BASE), group_name: '  Porch People ', meeting_time: '7pm', since_year: ' 2021 ', tagline: '' };
  assert.deepEqual(settingsPatch(f, BASE), { group_name: 'Porch People', since_year: 2021, tagline: '' });
});

test('settings validation', () => {
  const f = { ...toForm(BASE), group_name: '  ', meeting_time: '', meeting_place: ' ', since_year: '23' };
  const e = validateSettings(f);
  assert.deepEqual(Object.keys(e).sort(), ['group_name', 'meeting_place', 'meeting_time', 'since_year']);
  assert.equal(firstError(SETTINGS_FIELDS, e), 'group_name');
  assert.ok(validateSettings({ ...toForm(BASE), since_year: '1899' }).since_year);
  assert.ok(validateSettings({ ...toForm(BASE), since_year: '2101' }).since_year);
  assert.equal(validateSettings({ ...toForm(BASE), tagline: '' }).tagline, undefined, 'tagline may be blank');
});

test('settings 422s map onto fields, and anything else onto `other`', () => {
  assert.deepEqual(settingsServerErrors({ since_year: ['The since year field must be between 1900 and 2100.'], nope: ['x'], also: ['y'] }), {
    since_year: 'The since year field must be between 1900 and 2100.',
    other: 'x y',
  });
  assert.deepEqual(settingsServerErrors({ meeting_place: ['The meeting place field is required.'] }), {
    meeting_place: 'The meeting place field is required.',
  });
  assert.deepEqual(settingsServerErrors({ empty: [] }), {});
  assert.deepEqual(settingsServerErrors(undefined), {});
});
