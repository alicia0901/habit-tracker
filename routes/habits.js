const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return toDateStr(d);
}

// 連続達成日数(ストリーク)を計算する。
// 今日分がまだ未達成でも、昨日までが連続していれば「継続中」として扱う
// (今日はまだ記録するチャンスが残っているため、0にリセットしない)。
function computeStreak(habitId) {
  const rows = db
    .prepare('SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC')
    .all(habitId);
  const doneDates = new Set(rows.map((r) => r.date));
  if (doneDates.size === 0) return { current: 0, longest: 0 };

  const today = toDateStr(new Date());
  let cursor = doneDates.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (doneDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sortedAsc = [...doneDates].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const date of sortedAsc) {
    if (prev && addDays(prev, 1) === date) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = date;
  }

  return { current, longest };
}

router.get('/', (req, res) => {
  const habits = db
    .prepare('SELECT id, name, created_at FROM habits WHERE user_id = ? ORDER BY created_at')
    .all(req.userId);

  const today = toDateStr(new Date());
  const result = habits.map((h) => {
    const doneToday = !!db
      .prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?')
      .get(h.id, today);
    return { ...h, doneToday, streak: computeStreak(h.id) };
  });

  res.json(result);
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '習慣名を入力してください' });
  }
  const result = db
    .prepare('INSERT INTO habits (user_id, name) VALUES (?, ?)')
    .run(req.userId, name.trim());
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), doneToday: false, streak: { current: 0, longest: 0 } });
});

function assertOwnedHabit(userId, habitId) {
  return db.prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?').get(habitId, userId);
}

router.delete('/:id', (req, res) => {
  if (!assertOwnedHabit(req.userId, req.params.id)) {
    return res.status(404).json({ error: '習慣が見つかりません' });
  }
  db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// 指定日の達成/未達成を切り替える(未指定なら今日)
router.post('/:id/toggle', (req, res) => {
  if (!assertOwnedHabit(req.userId, req.params.id)) {
    return res.status(404).json({ error: '習慣が見つかりません' });
  }
  const date = (req.body && req.body.date) || toDateStr(new Date());
  const existing = db
    .prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?')
    .get(req.params.id, date);

  if (existing) {
    db.prepare('DELETE FROM habit_logs WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)').run(req.params.id, date);
  }

  res.json({ date, done: !existing, streak: computeStreak(req.params.id) });
});

// 直近N日分(既定30日)の達成状況(ヒートマップ表示用)
router.get('/:id/logs', (req, res) => {
  if (!assertOwnedHabit(req.userId, req.params.id)) {
    return res.status(404).json({ error: '習慣が見つかりません' });
  }
  const days = Math.min(Number(req.query.days) || 30, 365);
  const today = toDateStr(new Date());
  const since = addDays(today, -(days - 1));

  const rows = db
    .prepare('SELECT date FROM habit_logs WHERE habit_id = ? AND date >= ? ORDER BY date')
    .all(req.params.id, since);
  const doneDates = new Set(rows.map((r) => r.date));

  const calendar = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(since, i);
    calendar.push({ date, done: doneDates.has(date) });
  }

  res.json(calendar);
});

module.exports = router;
