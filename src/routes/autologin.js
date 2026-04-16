const express = require('express');
const db = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const router = express.Router();

const TOKEN_FILE = '/tmp/rc_autologin_tokens';
const DEFAULT_PASS = process.env.DEFAULT_MAIL_PASS || 'CHANGE_ME';

router.get('/quick/:id', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT vu.email FROM virtual_users vu WHERE vu.id = ?',
      [req.params.id]
    );
    if (users.length === 0) return res.status(404).send('User not found');

    const email = users[0].email;
    const password = req.query.p || DEFAULT_PASS;
    const token = crypto.randomBytes(32).toString('hex');

    // Save token
    let tokens = {};
    try { tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch(e) {}
    tokens[token] = { user: email, pass: password, time: Math.floor(Date.now()/1000) };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o666 });

    // Redirect to webmail autologin.php (same domain = cookies work)
    const mailDomain = (process.env.HOSTNAME || 'mail.example.com').replace('mail.', '');
    res.redirect('https://webmail.' + mailDomain + '/autologin.php?t=' + token);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

module.exports = router;
