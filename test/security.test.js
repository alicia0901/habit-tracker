process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const app = require('../app');

test('本番環境で JWT_SECRET が未設定なら起動しない', () => {
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.JWT_SECRET;
  const result = spawnSync(process.execPath, ['-e', "require('./middleware/auth')"], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET/);
});

test('本番環境でも JWT_SECRET を設定すれば起動できる', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./middleware/auth')"], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'x' },
  });
  assert.equal(result.status, 0);
});

test('ログイン試行は15分で20回までに制限される', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  try {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nobody', password: 'wrongpass' }),
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 20), Array(20).fill(401));
    assert.equal(statuses[20], 429);
  } finally {
    server.close();
  }
});
