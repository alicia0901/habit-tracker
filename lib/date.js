const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tokyo';

// toISOString() はUTC基準のため、日本時間0〜9時の記録が前日扱いになる。利用者のタイムゾーンで日付を切る。
function todayStr(now = new Date(), timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isValidDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

module.exports = { TIMEZONE, todayStr, addDays, isValidDateStr };
