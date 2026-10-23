const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);

app.listen(PORT, () => {
  console.log(`habit-tracker listening on http://localhost:${PORT}`);
});
