const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const router = express.Router();

// 公開環境でのパスワード総当たりと、bcryptハッシュ計算を使った負荷攻撃を抑える
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: '試行回数が多すぎます。しばらく待ってから再度お試しください' },
  }),
);

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  const name = typeof username === 'string' ? username.trim() : '';
  if (
    !name ||
    name.length > USERNAME_MAX ||
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    return res.status(400).json({
      error: `ユーザー名(${USERNAME_MAX}文字以内)と${PASSWORD_MIN}〜${PASSWORD_MAX}文字のパスワードを入力してください`,
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (existing) {
    return res.status(409).json({ error: 'そのユーザー名はすでに使われています' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(name, passwordHash);

  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, username: name });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

module.exports = router;
