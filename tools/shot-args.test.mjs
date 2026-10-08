import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFill } from './shot-args.mjs';

test('--fill splits a plain selector from its text', () => {
  assert.deepEqual(parseFill('#ff-pw=footprints'), { selector: '#ff-pw', text: 'footprints' });
});

test('--fill keeps an = inside the selector', () => {
  assert.deepEqual(parseFill('input[type=search]=psalm'), { selector: 'input[type=search]', text: 'psalm' });
  assert.deepEqual(parseFill('input[name="q"][type=search]=Romans 8'), { selector: 'input[name="q"][type=search]', text: 'Romans 8' });
  assert.deepEqual(parseFill('id=ff-pw=footprints'), { selector: 'id=ff-pw', text: 'footprints' });
});

test('--fill with nothing after the = clears the field', () => {
  assert.deepEqual(parseFill('textarea='), { selector: 'textarea', text: '' });
});

test('--fill without a selector or an = is refused', () => {
  assert.throws(() => parseFill('textarea'), /--fill needs <selector>=<text>/);
  assert.throws(() => parseFill('=hello'), /--fill needs <selector>=<text>/);
  assert.throws(() => parseFill('input[type=search]'), /--fill needs <selector>=<text>/);
});
