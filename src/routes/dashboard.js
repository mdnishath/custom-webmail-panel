const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [domains] = await db.query('SELECT COUNT(*) as count FROM virtual_domains WHERE active=1');
    const [users] = await db.query('SELECT COUNT(*) as count FROM virtual_users WHERE active=1');
    const [aliases] = await db.query('SELECT COUNT(*) as count FROM virtual_aliases WHERE active=1');
    const [recentDomains] = await db.query(
      'SELECT * FROM virtual_domains ORDER BY created_at DESC LIMIT 5'
    );
    const [recentUsers] = await db.query(
      'SELECT vu.*, vd.name as domain_name FROM virtual_users vu JOIN virtual_domains vd ON vu.domain_id = vd.id ORDER BY vu.created_at DESC LIMIT 10'
    );

    res.render('dashboard', {
      stats: {
        domains: domains[0].count,
        users: users[0].count,
        aliases: aliases[0].count,
      },
      recentDomains,
      recentUsers,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard', { stats: { domains: 0, users: 0, aliases: 0 }, recentDomains: [], recentUsers: [] });
  }
});

module.exports = router;
