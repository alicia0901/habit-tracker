const test = require('node:test');
const assert = require('node:assert/strict');
const { todayStr, addDays, isValidDateStr } = require('../lib/date');

test('todayStr は日本時間で日付を切る(UTCでは前日でも JST では当日)', () => {
  const jst0830 = new Date('2026-10-22T23:30:00Z');
  assert.equal(todayStr(jst0830, 'Asia/Tokyo'), '2026-10-23');
  assert.equal(todayStr(jst0830, 'UTC'), '2026-10-22');
});

test('todayStr は JST 23:59 ではまだ当日', () => {
  assert.equal(todayStr(new Date('2026-10-23T14:59:00Z'), 'Asia/Tokyo'), '2026-10-23');
  assert.equal(todayStr(new Date('2026-10-23T15:00:00Z'), 'Asia/Tokyo'), '2026-10-24');
});

test('addDays は月末・年末・うるう年をまたげる', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('isValidDateStr は形式と実在日をチェックする', () => {
  assert.equal(isValidDateStr('2026-10-23'), true);
  assert.equal(isValidDateStr('2026-02-30'), false);
  assert.equal(isValidDateStr('2026/10/23'), false);
  assert.equal(isValidDateStr('20261023'), false);
  assert.equal(isValidDateStr(20261023), false);
});
