const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

// Login action
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT * FROM admin_users WHERE username = ? AND active = 1', [username]
    );
    if (rows.length === 0) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    const user = rows[0];

    // First login - password is placeholder
    if (user.password.includes('placeholder')) {
      // Set new password on first login
      const hash = await bcrypt.hash(password, 12);
      await db.query('UPDATE admin_users SET password = ? WHERE id = ?', [hash, user.id]);
      req.session.user = { id: user.id, username: user.username, role: user.role };
      await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);
      return res.redirect('/dashboard');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    req.session.user = { id: user.id, username: user.username, role: user.role };
    await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'Server error' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

// Change password
router.post('/change-password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  const { current_password, new_password } = req.body;
  try {
    const [rows] = await db.query('SELECT password FROM admin_users WHERE id = ?', [req.session.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE admin_users SET password = ? WHERE id = ?', [hash, req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
