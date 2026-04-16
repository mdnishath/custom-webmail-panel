const express = require('express');
const db = require('../db');
const router = express.Router();

// List groups
router.get('/', async (req, res) => {
  try {
    const [groups] = await db.query(`
      SELECT g.*,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM email_groups g ORDER BY g.name
    `);
    res.render('groups', { groups, error: req.query.error || null, success: req.query.success || null });
  } catch (err) {
    res.render('groups', { groups: [], error: err.message, success: null });
  }
});

// View group members
router.get('/:id', async (req, res) => {
  try {
    const [group] = await db.query('SELECT * FROM email_groups WHERE id = ?', [req.params.id]);
    if (group.length === 0) return res.redirect('/groups?error=Group not found');

    const [members] = await db.query(`
      SELECT vu.*, vd.name as domain_name, gm.id as membership_id
      FROM group_members gm
      JOIN virtual_users vu ON gm.user_id = vu.id
      JOIN virtual_domains vd ON vu.domain_id = vd.id
      WHERE gm.group_id = ?
      ORDER BY vu.email
    `, [req.params.id]);

    const [allUsers] = await db.query(`
      SELECT vu.*, vd.name as domain_name
      FROM virtual_users vu
      JOIN virtual_domains vd ON vu.domain_id = vd.id
      WHERE vu.id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?)
      ORDER BY vu.email
    `, [req.params.id]);

    const [allGroups] = await db.query('SELECT * FROM email_groups ORDER BY name');

    res.render('group-view', {
      group: group[0], members, allUsers, allGroups,
      error: req.query.error || null, success: req.query.success || null
    });
  } catch (err) {
    res.redirect('/groups?error=' + encodeURIComponent(err.message));
  }
});

// Create group
router.post('/add', async (req, res) => {
  const { name, color, description } = req.body;
  try {
    await db.query('INSERT INTO email_groups (name, color, description) VALUES (?, ?, ?)',
      [name, color || '#6c757d', description || '']);
    res.redirect('/groups?success=Group created: ' + name);
  } catch (err) {
    res.redirect('/groups?error=' + encodeURIComponent(err.message));
  }
});

// Delete group
router.post('/:id/delete', async (req, res) => {
  try {
    await db.query('DELETE FROM email_groups WHERE id = ?', [req.params.id]);
    res.redirect('/groups?success=Group deleted');
  } catch (err) {
    res.redirect('/groups?error=' + err.message);
  }
});

// Add member
router.post('/:id/add-member', async (req, res) => {
  const { user_id } = req.body;
  try {
    await db.query('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
      [req.params.id, user_id]);
    res.redirect('/groups/' + req.params.id + '?success=Member added');
  } catch (err) {
    res.redirect('/groups/' + req.params.id + '?error=' + err.message);
  }
});

// Add multiple members
router.post('/:id/add-members', async (req, res) => {
  let { user_ids } = req.body;
  try {
    if (!Array.isArray(user_ids)) user_ids = [user_ids];
    for (const uid of user_ids) {
      await db.query('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
        [req.params.id, uid]);
    }
    res.redirect('/groups/' + req.params.id + '?success=' + user_ids.length + ' members added');
  } catch (err) {
    res.redirect('/groups/' + req.params.id + '?error=' + err.message);
  }
});

// Remove member
router.post('/:id/remove-member/:membershipId', async (req, res) => {
  try {
    await db.query('DELETE FROM group_members WHERE id = ?', [req.params.membershipId]);
    res.redirect('/groups/' + req.params.id + '?success=Member removed');
  } catch (err) {
    res.redirect('/groups/' + req.params.id + '?error=' + err.message);
  }
});

// Copy all emails in group
router.get('/:id/emails', async (req, res) => {
  try {
    const [members] = await db.query(`
      SELECT vu.email FROM group_members gm
      JOIN virtual_users vu ON gm.user_id = vu.id
      WHERE gm.group_id = ? ORDER BY vu.email
    `, [req.params.id]);
    res.json(members.map(m => m.email));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
