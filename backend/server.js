require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const auth = require('./middleware/auth');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Protected routes
app.use('/api/clients',       auth, require('./routes/clients'));
app.use('/api/collaborators', auth, require('./routes/collaborators'));
app.use('/api/projects',      auth, require('./routes/projects'));
app.use('/api/expenses',      auth, require('./routes/expenses'));
app.use('/api/taxes',         auth, require('./routes/taxes'));
app.use('/api/billing',       auth, require('./routes/billing'));
app.use('/api/cashflow',      auth, require('./routes/cashflow'));
app.use('/api/dolar',         auth, require('./routes/dolar'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.warn('⚠️  ADMIN_PASSWORD_HASH not set in .env! Run: node scripts/createAdmin.js');
  }
});
