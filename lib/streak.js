const { addDays } = require('./date');

// 今日分がまだ未達成でも、昨日までが連続していれば「継続中」として扱う
// (今日はまだ記録するチャンスが残っているため、0にリセットしない)。
function computeStreak(dateStrs, today) {
  const doneDates = new Set(dateStrs);
  if (doneDates.size === 0) return { current: 0, longest: 0 };

  let cursor = doneDates.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (doneDates.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const date of [...doneDates].sort()) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = date;
  }

  return { current, longest };
}

module.exports = { computeStreak };
