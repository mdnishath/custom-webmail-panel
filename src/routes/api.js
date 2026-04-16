const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// API Auth middleware
function apiAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.apiUser = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get API token
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ? AND active = 1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username, role: rows[0].role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === Domain APIs ===
router.get('/domains', apiAuth, async (req, res) => {
  const [domains] = await db.query('SELECT * FROM virtual_domains ORDER BY name');
  res.json(domains);
});

router.post('/domains', apiAuth, async (req, res) => {
  const { name, max_accounts, max_quota_mb } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO virtual_domains (name, max_accounts, max_quota_mb) VALUES (?, ?, ?)',
      [name, max_accounts || 100, max_quota_mb || 10240]
    );
    res.json({ id: result.insertId, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/domains/:id', apiAuth, async (req, res) => {
  await db.query('DELETE FROM virtual_domains WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// === Email Account APIs ===
router.get('/emails', apiAuth, async (req, res) => {
  const [users] = await db.query(`
    SELECT vu.*, vd.name as domain_name
    FROM virtual_users vu
    JOIN virtual_domains vd ON vu.domain_id = vd.id
    ORDER BY vu.email
  `);
  res.json(users);
});

router.post('/emails', apiAuth, async (req, res) => {
  const { username, domain_id, password, quota_mb, full_name } = req.body;
  try {
    const [domain] = await db.query('SELECT name FROM virtual_domains WHERE id = ?', [domain_id]);
    if (domain.length === 0) return res.status(400).json({ error: 'Domain not found' });
    const email = `${username}@${domain[0].name}`;
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO virtual_users (domain_id, email, password, quota_mb, full_name) VALUES (?, ?, ?, ?, ?)',
      [domain_id, email, hash, quota_mb || 1024, full_name || '']
    );
    res.json({ id: result.insertId, email });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/emails/:id', apiAuth, async (req, res) => {
  await db.query('DELETE FROM virtual_users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// === Alias APIs ===
router.get('/aliases', apiAuth, async (req, res) => {
  const [aliases] = await db.query(`
    SELECT va.*, vd.name as domain_name
    FROM virtual_aliases va
    JOIN virtual_domains vd ON va.domain_id = vd.id
  `);
  res.json(aliases);
});

router.post('/aliases', apiAuth, async (req, res) => {
  const { source, domain_id, destination } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO virtual_aliases (domain_id, source, destination) VALUES (?, ?, ?)',
      [domain_id, source, destination]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === Stats API ===
router.get('/stats', apiAuth, async (req, res) => {
  const [domains] = await db.query('SELECT COUNT(*) as count FROM virtual_domains WHERE active=1');
  const [users] = await db.query('SELECT COUNT(*) as count FROM virtual_users WHERE active=1');
  const [aliases] = await db.query('SELECT COUNT(*) as count FROM virtual_aliases WHERE active=1');
  res.json({
    domains: domains[0].count,
    emails: users[0].count,
    aliases: aliases[0].count,
  });
});

module.exports = router;
