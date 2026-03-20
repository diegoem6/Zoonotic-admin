const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminHash) {
      return res.status(500).json({ error: 'Servidor no configurado. Definir ADMIN_PASSWORD_HASH en .env' });
    }

    if (username !== adminUsername) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const valid = await bcrypt.compare(password, adminHash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET || 'default_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, username, role: 'admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me - verify token and return user info
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

module.exports = router;
