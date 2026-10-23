const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { todayStr, addDays, isValidDateStr } = require('../lib/date');
const { computeStreak } = require('../lib/streak');

const router = express.Router();
router.use(requireAuth);

function streakFor(habitId, today) {
  const dates = db
    .prepare('SELECT date FROM habit_logs WHERE habit_id = ?')
    .all(habitId)
    .map((r) => r.date);
  return computeStreak(dates, today);
}

router.get('/', (req, res) => {
  const habits = db
    .prepare('SELECT id, name, created_at FROM habits WHERE user_id = ? ORDER BY created_at')
    .all(req.userId);

  const today = todayStr();
  const result = habits.map((h) => {
    const doneToday = !!db
      .prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?')
      .get(h.id, today);
    return { ...h, doneToday, streak: streakFor(h.id, today) };
  });

  res.json(result);
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
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
  const today = todayStr();
  const date = (req.body && req.body.date) || today;
  if (!isValidDateStr(date)) {
    return res.status(400).json({ error: '日付は YYYY-MM-DD 形式で指定してください' });
  }
  if (date > today) {
    return res.status(400).json({ error: '未来の日付は記録できません' });
  }

  const existing = db
    .prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?')
    .get(req.params.id, date);

  if (existing) {
    db.prepare('DELETE FROM habit_logs WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)').run(req.params.id, date);
  }

  res.json({ date, done: !existing, streak: streakFor(req.params.id, today) });
});

// 直近N日分(既定30日)の達成状況(ヒートマップ表示用)
router.get('/:id/logs', (req, res) => {
  if (!assertOwnedHabit(req.userId, req.params.id)) {
    return res.status(404).json({ error: '習慣が見つかりません' });
  }
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const since = addDays(todayStr(), -(days - 1));

  const rows = db
    .prepare('SELECT date FROM habit_logs WHERE habit_id = ? AND date >= ?')
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
