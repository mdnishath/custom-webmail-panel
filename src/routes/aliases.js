const express = require('express');
const db = require('../db');
const router = express.Router();

// List aliases
router.get('/', async (req, res) => {
  try {
    const [aliases] = await db.query(`
      SELECT va.*, vd.name as domain_name
      FROM virtual_aliases va
      JOIN virtual_domains vd ON va.domain_id = vd.id
      ORDER BY va.source
    `);
    const [domains] = await db.query('SELECT * FROM virtual_domains WHERE active=1 ORDER BY name');
    res.render('aliases', { aliases, domains, error: null, success: null });
  } catch (err) {
    res.render('aliases', { aliases: [], domains: [], error: err.message, success: null });
  }
});

// Add alias
router.post('/add', async (req, res) => {
  const { source_user, domain_id, destination } = req.body;
  try {
    const [domain] = await db.query('SELECT name FROM virtual_domains WHERE id = ?', [domain_id]);
    if (domain.length === 0) throw new Error('Domain not found');
    const source = `${source_user}@${domain[0].name}`;
    await db.query(
      'INSERT INTO virtual_aliases (domain_id, source, destination) VALUES (?, ?, ?)',
      [domain_id, source, destination]
    );
    res.redirect('/aliases?success=Alias created');
  } catch (err) {
    res.redirect('/aliases?error=' + encodeURIComponent(err.message));
  }
});

// Delete alias
router.post('/:id/delete', async (req, res) => {
  try {
    await db.query('DELETE FROM virtual_aliases WHERE id = ?', [req.params.id]);
    res.redirect('/aliases?success=Alias deleted');
  } catch (err) {
    res.redirect('/aliases?error=' + err.message);
  }
});

module.exports = router;
