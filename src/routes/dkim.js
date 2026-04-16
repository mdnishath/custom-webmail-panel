const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [domains] = await db.query('SELECT * FROM virtual_domains WHERE active=1 ORDER BY name');
    res.render('dkim', { domains, error: req.query.error || null, success: req.query.success || null });
  } catch (err) {
    res.render('dkim', { domains: [], error: err.message, success: null });
  }
});

// View DKIM key
router.get('/view/:id', async (req, res) => {
  try {
    const [domain] = await db.query('SELECT * FROM virtual_domains WHERE id = ?', [req.params.id]);
    if (domain.length === 0) throw new Error('Domain not found');
    
    let dkimValue = '';
    const keyFile = '/etc/opendkim/keys/' + domain[0].name + '/mail.txt';
    try {
      const raw = fs.readFileSync(keyFile, 'utf8');
      // Extract clean value
      dkimValue = raw.replace(/mail\._domainkey\s+IN\s+TXT\s+\(\s+/,'').replace(/\s*\)\s*;.*$/s,'').replace(/"/g,'').replace(/\s+/g,'').replace(/\t/g,'');
    } catch(e) {
      dkimValue = domain[0].dkim_public_key || 'Key not found. Generate DKIM first.';
    }
    
    res.render('dkim-view', { domain: domain[0], dkimValue });
  } catch (err) {
    res.redirect('/dkim?error=' + encodeURIComponent(err.message));
  }
});

// Generate DKIM keys
router.post('/generate/:id', async (req, res) => {
  try {
    const [domain] = await db.query('SELECT * FROM virtual_domains WHERE id = ?', [req.params.id]);
    if (domain.length === 0) throw new Error('Domain not found');

    const domainName = domain[0].name;
    const selector = 'mail';
    const keyDir = '/etc/opendkim/keys/' + domainName;

    execSync('mkdir -p ' + keyDir);
    execSync('opendkim-genkey -b 2048 -d ' + domainName + ' -D ' + keyDir + ' -s ' + selector + ' -v 2>&1');
    execSync('chown opendkim:opendkim ' + keyDir + '/' + selector + '.private');
    execSync('chmod 600 ' + keyDir + '/' + selector + '.private');

    const publicKey = fs.readFileSync(keyDir + '/' + selector + '.txt', 'utf8');

    await db.query('UPDATE virtual_domains SET dkim_selector = ?, dkim_public_key = ? WHERE id = ?', [selector, publicKey, req.params.id]);

    // Update OpenDKIM config
    const keyTableEntry = selector + '._domainkey.' + domainName + ' ' + domainName + ':' + selector + ':' + keyDir + '/' + selector + '.private';
    const signingTableEntry = '*@' + domainName + ' ' + selector + '._domainkey.' + domainName;

    // Read existing, remove old entries for this domain, add new
    let keyTable = '';
    let signingTable = '';
    try { keyTable = fs.readFileSync('/etc/opendkim/KeyTable', 'utf8'); } catch(e) {}
    try { signingTable = fs.readFileSync('/etc/opendkim/SigningTable', 'utf8'); } catch(e) {}

    keyTable = keyTable.split('\n').filter(l => !l.includes(domainName)).join('\n');
    signingTable = signingTable.split('\n').filter(l => !l.includes(domainName)).join('\n');

    fs.writeFileSync('/etc/opendkim/KeyTable', (keyTable.trim() + '\n' + keyTableEntry + '\n').trim() + '\n');
    fs.writeFileSync('/etc/opendkim/SigningTable', (signingTable.trim() + '\n' + signingTableEntry + '\n').trim() + '\n');

    const trustedHosts = fs.readFileSync('/etc/opendkim/TrustedHosts', 'utf8');
    if (!trustedHosts.includes(domainName)) {
      fs.appendFileSync('/etc/opendkim/TrustedHosts', '*.' + domainName + '\n');
    }

    execSync('systemctl restart opendkim');

    res.redirect('/dkim/view/' + req.params.id);
  } catch (err) {
    console.error(err);
    res.redirect('/dkim?error=' + encodeURIComponent(err.message));
  }
});

module.exports = router;
