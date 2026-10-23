const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStreak } = require('../lib/streak');

const TODAY = '2026-10-23';

test('記録が無ければ 0', () => {
  assert.deepEqual(computeStreak([], TODAY), { current: 0, longest: 0 });
});

test('今日まで3日連続', () => {
  assert.deepEqual(computeStreak(['2026-10-21', '2026-10-22', '2026-10-23'], TODAY), { current: 3, longest: 3 });
});

test('今日が未達成でも昨日まで連続していれば継続中', () => {
  assert.deepEqual(computeStreak(['2026-10-21', '2026-10-22'], TODAY), { current: 2, longest: 2 });
});

test('一昨日で途切れていれば current は 0、longest は残る', () => {
  assert.deepEqual(computeStreak(['2026-10-19', '2026-10-20', '2026-10-21'], TODAY), { current: 0, longest: 3 });
});

test('途中で途切れた場合は最長の連続区間を longest にする', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-22', '2026-10-23'];
  assert.deepEqual(computeStreak(dates, TODAY), { current: 2, longest: 4 });
});

test('月をまたぐ連続も数える', () => {
  assert.deepEqual(computeStreak(['2026-09-30', '2026-10-01'], '2026-10-01'), { current: 2, longest: 2 });
});

test('入力順に依存しない', () => {
  assert.deepEqual(computeStreak(['2026-10-23', '2026-10-21', '2026-10-22'], TODAY), { current: 3, longest: 3 });
});
