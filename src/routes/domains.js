const fs = require('fs');
const express = require('express');
const { execSync } = require('child_process');
const db = require('../db');
const router = express.Router();

// List domains
router.get('/', async (req, res) => {
  try {
    const [domains] = await db.query(`
      SELECT vd.*,
        (SELECT COUNT(*) FROM virtual_users WHERE domain_id = vd.id) as user_count,
        (SELECT COUNT(*) FROM virtual_aliases WHERE domain_id = vd.id) as alias_count
      FROM virtual_domains vd ORDER BY vd.created_at DESC
    `);
    res.render('domains', { domains, error: req.query.error || null, success: req.query.success || null });
  } catch (err) {
    console.error(err);
    res.render('domains', { domains: [], error: 'Failed to load domains', success: null });
  }
});

// Add domain
router.post('/add', async (req, res) => {
  const { name, max_accounts, max_quota_mb } = req.body;
  try {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(name)) {
      throw new Error('Invalid domain name');
    }

    await db.query(
      'INSERT INTO virtual_domains (name, max_accounts, max_quota_mb) VALUES (?, ?, ?)',
      [name.toLowerCase(), max_accounts || 100, max_quota_mb || 10240]
    );

    // Create mail directory
    try {
      execSync('mkdir -p /var/mail/vhosts/' + name.toLowerCase());
      execSync('chown -R vmail:vmail /var/mail/vhosts/' + name.toLowerCase());
    } catch (e) {
      console.warn('Could not create mail directory:', e.message);
    }

    // Generate DKIM keys
    try {
      const keyDir = '/etc/opendkim/keys/' + name.toLowerCase();
      execSync('mkdir -p ' + keyDir);
      execSync('opendkim-genkey -b 2048 -d ' + name.toLowerCase() + ' -D ' + keyDir + ' -s mail -v 2>&1');
      execSync('chown opendkim:opendkim ' + keyDir + '/mail.private');
      execSync('chmod 600 ' + keyDir + '/mail.private');

      // Update OpenDKIM config
      const keyTableEntry = 'mail._domainkey.' + name.toLowerCase() + ' ' + name.toLowerCase() + ':mail:' + keyDir + '/mail.private';
      const signingEntry = '*@' + name.toLowerCase() + ' mail._domainkey.' + name.toLowerCase();

      let kt = ''; try { kt = fs.readFileSync('/etc/opendkim/KeyTable', 'utf8'); } catch(e) {}
      let st = ''; try { st = fs.readFileSync('/etc/opendkim/SigningTable', 'utf8'); } catch(e) {}
      let th = ''; try { th = fs.readFileSync('/etc/opendkim/TrustedHosts', 'utf8'); } catch(e) {}

      if (!kt.includes(name.toLowerCase())) fs.appendFileSync('/etc/opendkim/KeyTable', keyTableEntry + '\n');
      if (!st.includes(name.toLowerCase())) fs.appendFileSync('/etc/opendkim/SigningTable', signingEntry + '\n');
      if (!th.includes(name.toLowerCase())) fs.appendFileSync('/etc/opendkim/TrustedHosts', '*.' + name.toLowerCase() + '\n');

      // Save to DB
      const pubKey = fs.readFileSync(keyDir + '/mail.txt', 'utf8');
      const [dom] = await db.query('SELECT id FROM virtual_domains WHERE name = ?', [name.toLowerCase()]);
      await db.query('UPDATE virtual_domains SET dkim_public_key = ?, dkim_selector = ? WHERE id = ?', [pubKey, 'mail', dom[0].id]);

      execSync('systemctl restart opendkim');
    } catch (e) {
      console.warn('DKIM generation failed:', e.message);
    }

    res.redirect('/domains?success=Domain added with DKIM');
  } catch (err) {
    console.error(err);
    const [domains] = await db.query('SELECT * FROM virtual_domains ORDER BY created_at DESC');
    res.render('domains', { domains, error: err.message, success: null });
  }
});

// Toggle domain active status
router.post('/:id/toggle', async (req, res) => {
  try {
    await db.query('UPDATE virtual_domains SET active = NOT active WHERE id = ?', [req.params.id]);
    res.redirect('/domains');
  } catch (err) {
    res.redirect('/domains?error=' + err.message);
  }
});

// Delete domain
router.post('/:id/delete', async (req, res) => {
  try {
    const [domain] = await db.query('SELECT name FROM virtual_domains WHERE id = ?', [req.params.id]);
    if (domain.length > 0) {
      await db.query('DELETE FROM virtual_domains WHERE id = ?', [req.params.id]);
    }
    res.redirect('/domains?success=Domain deleted');
  } catch (err) {
    res.redirect('/domains?error=' + err.message);
  }
});

// Domain DNS info - auto generates all required records with DKIM
router.get('/:id/dns', async (req, res) => {
  try {
    const [domain] = await db.query('SELECT * FROM virtual_domains WHERE id = ?', [req.params.id]);
    if (domain.length === 0) return res.redirect('/domains?error=Domain not found');

    let dkimValue = null;
    try {
      const keyFile = '/etc/opendkim/keys/' + domain[0].name + '/mail.txt';
      const raw = fs.readFileSync(keyFile, 'utf8');
      // Parse: remove header/footer, quotes, whitespace
      dkimValue = raw
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('"') || line.startsWith('p='))
        .join('')
        .replace(/"/g, '')
        .replace(/\t/g, '')
        .replace(/\s{2,}/g, '')
        .trim();
      // If parsing failed, try raw extraction
      if (!dkimValue || dkimValue.length < 50) {
        dkimValue = raw.replace(/mail\._domainkey.*?IN.*?TXT.*?\(\s*/s, '')
          .replace(/\s*\)\s*;.*/s, '')
          .replace(/"/g, '')
          .replace(/\s+/g, '')
          .trim();
      }
    } catch(e) {
      dkimValue = null;
    }

    res.render('dns', { domain: domain[0], dkimValue });
  } catch (err) {
    res.redirect('/domains?error=' + err.message);
  }
});

module.exports = router;
