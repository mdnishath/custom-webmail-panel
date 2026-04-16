const express = require('express');
const bcrypt = require('bcrypt');
const { execSync } = require('child_process');
const db = require('../db');
const router = express.Router();

// List email accounts
router.get('/', async (req, res) => {
  try {
    const [domains] = await db.query('SELECT * FROM virtual_domains WHERE active=1 ORDER BY name');
    const domainFilter = req.query.domain || '';
    let query = `
      SELECT vu.*, vd.name as domain_name
      FROM virtual_users vu
      JOIN virtual_domains vd ON vu.domain_id = vd.id
    `;
    const params = [];
    if (domainFilter) {
      query += ' WHERE vu.domain_id = ?';
      params.push(domainFilter);
    }
    query += ' ORDER BY vu.email';
    const [users] = await db.query(query, params);
    res.render('emails', { users, domains, domainFilter, error: req.query.error || null, success: req.query.success || null });
  } catch (err) {
    console.error(err);
    res.render('emails', { users: [], domains: [], domainFilter: '', error: 'Failed to load', success: null });
  }
});

// Add email account
router.post('/add', async (req, res) => {
  const { username, domain_id, password, quota_mb, full_name } = req.body;
  try {
    const [domain] = await db.query('SELECT * FROM virtual_domains WHERE id = ? AND active=1', [domain_id]);
    if (domain.length === 0) throw new Error('Domain not found or inactive');

    // Check account limit
    const [countResult] = await db.query(
      'SELECT COUNT(*) as c FROM virtual_users WHERE domain_id = ?', [domain_id]
    );
    if (countResult[0].c >= domain[0].max_accounts) {
      throw new Error(`Domain account limit reached (${domain[0].max_accounts})`);
    }

    // Validate username
    if (!/^[a-zA-Z0-9._%+-]+$/.test(username)) {
      throw new Error('Invalid email username');
    }

    const email = `${username.toLowerCase()}@${domain[0].name}`;

    // Check if exists
    const [existing] = await db.query('SELECT id FROM virtual_users WHERE email = ?', [email]);
    if (existing.length > 0) throw new Error('Email address already exists');

    // Hash password using bcrypt (BLF-CRYPT for Dovecot)
    const hash = await bcrypt.hash(password, 12);

    await db.query(
      'INSERT INTO virtual_users (domain_id, email, password, quota_mb, full_name) VALUES (?, ?, ?, ?, ?)',
      [domain_id, email, hash, quota_mb || 1024, full_name || '']
    );

    // Create maildir
    try {
      execSync(`mkdir -p /var/mail/vhosts/${domain[0].name}/${username.toLowerCase()}`);
      execSync(`chown -R vmail:vmail /var/mail/vhosts/${domain[0].name}/${username.toLowerCase()}`);
    } catch (e) {
      console.warn('Could not create maildir:', e.message);
    }

    res.redirect('/emails?success=Email account created: ' + email);
  } catch (err) {
    console.error(err);
    res.redirect('/emails?error=' + encodeURIComponent(err.message));
  }
});

// Reset password
router.post('/:id/reset-password', async (req, res) => {
  const { new_password } = req.body;
  try {
    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE virtual_users SET password = ? WHERE id = ?', [hash, req.params.id]);
    res.redirect('/emails?success=Password reset successfully');
  } catch (err) {
    res.redirect('/emails?error=' + err.message);
  }
});

// Toggle active
router.post('/:id/toggle', async (req, res) => {
  try {
    await db.query('UPDATE virtual_users SET active = NOT active WHERE id = ?', [req.params.id]);
    res.redirect('/emails');
  } catch (err) {
    res.redirect('/emails?error=' + err.message);
  }
});

// Update quota
router.post('/:id/quota', async (req, res) => {
  const { quota_mb } = req.body;
  try {
    await db.query('UPDATE virtual_users SET quota_mb = ? WHERE id = ?', [quota_mb, req.params.id]);
    res.redirect('/emails?success=Quota updated');
  } catch (err) {
    res.redirect('/emails?error=' + err.message);
  }
});

// Delete account
router.post('/:id/delete', async (req, res) => {
  try {
    await db.query('DELETE FROM virtual_users WHERE id = ?', [req.params.id]);
    res.redirect('/emails?success=Account deleted');
  } catch (err) {
    res.redirect('/emails?error=' + err.message);
  }
});

module.exports = router;
