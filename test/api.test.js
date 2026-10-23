process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const { todayStr, addDays } = require('../lib/date');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => server.close());

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(username) {
  const res = await call('/auth/register', { method: 'POST', body: { username, password: 'password123' } });
  assert.equal(res.status, 201);
  return res.body.token;
}

test('登録・ログイン', async (t) => {
  await register('alice');

  await t.test('同じユーザー名は 409', async () => {
    const res = await call('/auth/register', { method: 'POST', body: { username: 'alice', password: 'password123' } });
    assert.equal(res.status, 409);
  });

  await t.test('短いパスワードは 400', async () => {
    const res = await call('/auth/register', { method: 'POST', body: { username: 'bob', password: 'short' } });
    assert.equal(res.status, 400);
  });

  await t.test('文字列以外のパスワードは 500 ではなく 400', async () => {
    const res = await call('/auth/register', { method: 'POST', body: { username: 'bob', password: 12345678 } });
    assert.equal(res.status, 400);
  });

  await t.test('正しいパスワードでログインできる', async () => {
    const res = await call('/auth/login', { method: 'POST', body: { username: 'alice', password: 'password123' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  await t.test('間違ったパスワードは 401', async () => {
    const res = await call('/auth/login', { method: 'POST', body: { username: 'alice', password: 'wrongpass' } });
    assert.equal(res.status, 401);
  });
});

test('トークン無し・不正トークンでは習慣APIを使えない', async () => {
  assert.equal((await call('/habits')).status, 401);
  assert.equal((await call('/habits', { token: 'not-a-jwt' })).status, 401);
});

test('習慣の作成・達成切り替え・ストリーク', async () => {
  const token = await register('carol');
  const today = todayStr();

  const created = await call('/habits', { method: 'POST', token, body: { name: '  読書10分  ' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, '読書10分');
  const id = created.body.id;

  await call(`/habits/${id}/toggle`, { method: 'POST', token, body: { date: addDays(today, -2) } });
  await call(`/habits/${id}/toggle`, { method: 'POST', token, body: { date: addDays(today, -1) } });
  const toggled = await call(`/habits/${id}/toggle`, { method: 'POST', token, body: {} });
  assert.equal(toggled.status, 200);
  assert.equal(toggled.body.date, today);
  assert.equal(toggled.body.done, true);
  assert.deepEqual(toggled.body.streak, { current: 3, longest: 3 });

  const list = await call('/habits', { token });
  assert.equal(list.body[0].doneToday, true);
  assert.deepEqual(list.body[0].streak, { current: 3, longest: 3 });

  const untoggled = await call(`/habits/${id}/toggle`, { method: 'POST', token, body: {} });
  assert.equal(untoggled.body.done, false);
  assert.deepEqual(untoggled.body.streak, { current: 2, longest: 2 });

  const logs = await call(`/habits/${id}/logs?days=3`, { token });
  assert.deepEqual(logs.body, [
    { date: addDays(today, -2), done: true },
    { date: addDays(today, -1), done: true },
    { date: today, done: false },
  ]);
});

test('不正な日付・未来日は 400', async () => {
  const token = await register('dave');
  const { body } = await call('/habits', { method: 'POST', token, body: { name: '筋トレ' } });

  const bad = await call(`/habits/${body.id}/toggle`, { method: 'POST', token, body: { date: '2026-02-30' } });
  assert.equal(bad.status, 400);

  const future = await call(`/habits/${body.id}/toggle`, { method: 'POST', token, body: { date: addDays(todayStr(), 1) } });
  assert.equal(future.status, 400);
});

test('他人の習慣は参照・操作・削除できない', async () => {
  const owner = await register('erin');
  const other = await register('frank');
  const { body } = await call('/habits', { method: 'POST', token: owner, body: { name: '早起き' } });

  assert.equal((await call(`/habits/${body.id}/toggle`, { method: 'POST', token: other, body: {} })).status, 404);
  assert.equal((await call(`/habits/${body.id}/logs`, { token: other })).status, 404);
  assert.equal((await call(`/habits/${body.id}`, { method: 'DELETE', token: other })).status, 404);
  assert.deepEqual((await call('/habits', { token: other })).body, []);

  assert.equal((await call(`/habits/${body.id}`, { method: 'DELETE', token: owner })).status, 204);
  assert.deepEqual((await call('/habits', { token: owner })).body, []);
});
