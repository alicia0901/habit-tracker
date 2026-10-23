const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');

const app = express();

// Render等のリバースプロキシ配下で、レート制限がプロキシではなく利用者のIPを見るようにする
app.set('trust proxy', 1);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);

module.exports = app;
