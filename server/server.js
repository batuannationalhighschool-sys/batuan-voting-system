import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import pool from './db.js';
import { generateToken, requireAuth, requireAdmin } from './middleware/auth.js';

// Multer config for candidate photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .jpg, .jpeg, .png, and .webp files are allowed'));
  },
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ─── Auth Routes ────────────────────────────────────────────────

// Login with LRN (students) or username (admin)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { lrn, password } = req.body;
    if (!lrn || !password) {
      return res.status(400).json({ error: 'LRN and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE lrn = ?', [lrn]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid LRN or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid LRN or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, lrn: user.lrn, full_name: user.full_name },
      must_change_password: !!user.must_change_password,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change password (for forced password change on first login)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [password_hash, req.user.id]
    );

    // Generate a new token
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const token = generateToken(rows[0]);

    res.json({ success: true, token });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [profiles] = await pool.query(
      'SELECT full_name, has_voted, grade_level, section FROM profiles WHERE user_id = ?',
      [req.user.id]
    );
    const [roles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [req.user.id]
    );

    const profile = profiles[0] || null;
    const isAdmin = roles.some(r => r.role === 'admin');

    res.json({
      user: { id: req.user.id, lrn: req.user.lrn, full_name: req.user.full_name },
      profile,
      isAdmin,
      must_change_password: !!req.user.must_change_password,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// ─── Voter Management (Admin only) ─────────────────────────────

// List all voters
app.get('/api/voters', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.lrn, u.full_name, u.must_change_password, u.created_at,
             p.grade_level, p.section, p.has_voted
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('List voters error:', err);
    res.status(500).json({ error: 'Failed to fetch voters' });
  }
});

// Add a new voter
app.post('/api/voters', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { lrn, full_name, grade_level, section } = req.body;
    if (!lrn || !full_name) {
      return res.status(400).json({ error: 'LRN and full name are required' });
    }
    if (!/^\d{12}$/.test(lrn)) {
      return res.status(400).json({ error: 'LRN must be exactly 12 digits (numbers only)' });
    }

    // Check if LRN already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE lrn = ?', [lrn]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'LRN already registered' });
    }

    const id = uuidv4();
    // Default password = LRN
    const password_hash = await bcrypt.hash(lrn, 10);

    await pool.query(
      'INSERT INTO users (id, lrn, password_hash, full_name, must_change_password) VALUES (?, ?, ?, ?, 1)',
      [id, lrn, password_hash, full_name]
    );

    // Create profile
    await pool.query(
      'INSERT INTO profiles (id, user_id, full_name, grade_level, section) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, full_name, grade_level || null, section || null]
    );

    // Assign voter role
    await pool.query(
      'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
      [uuidv4(), id, 'voter']
    );

    res.json({ id, lrn, full_name, grade_level, section });
  } catch (err) {
    console.error('Add voter error:', err);
    res.status(500).json({ error: 'Failed to add voter' });
  }
});

// Update voter info
app.put('/api/voters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { lrn, full_name, grade_level, section } = req.body;
    if (!lrn || !full_name) {
      return res.status(400).json({ error: 'LRN and full name are required' });
    }
    if (!/^\d{12}$/.test(lrn)) {
      return res.status(400).json({ error: 'LRN must be exactly 12 digits (numbers only)' });
    }

    // Check for duplicate LRN (excluding current user)
    const [existing] = await pool.query('SELECT id FROM users WHERE lrn = ? AND id != ?', [lrn, req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'LRN already in use by another account' });
    }

    await pool.query(
      'UPDATE users SET lrn = ?, full_name = ? WHERE id = ?',
      [lrn, full_name, req.params.id]
    );

    await pool.query(
      'UPDATE profiles SET full_name = ?, grade_level = ?, section = ? WHERE user_id = ?',
      [full_name, grade_level || null, section || null, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update voter error:', err);
    res.status(500).json({ error: 'Failed to update voter' });
  }
});

// Delete a voter
app.delete('/api/voters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // This cascades to profiles, user_roles, and votes due to FK constraints
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete voter error:', err);
    res.status(500).json({ error: 'Failed to delete voter' });
  }
});

// Reset voter password back to LRN
app.post('/api/voters/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT lrn FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    const password_hash = await bcrypt.hash(rows[0].lrn, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
      [password_hash, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ─── Positions ──────────────────────────────────────────────────

app.get('/api/positions', async (req, res) => {
  try {
    const { grade_level } = req.query;
    let sql = 'SELECT * FROM positions';
    const params = [];

    sql += ' ORDER BY display_order';
    let [rows] = await pool.query(sql, params);

    // If grade_level provided, filter Grade Representative positions
    // so voters only see the representative slot for their own grade
    if (grade_level) {
      rows = rows.filter(p => {
        // Keep non-representative positions as-is
        if (!p.title.toLowerCase().includes('representative')) return true;
        // For representative positions, only keep the one matching the voter's grade
        return p.title.toLowerCase().includes(grade_level.toLowerCase());
      });
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Create a position (admin)
app.post('/api/positions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, display_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = uuidv4();
    await pool.query(
      'INSERT INTO positions (id, title, display_order) VALUES (?, ?, ?)',
      [id, title, display_order || 0]
    );

    res.json({ id, title, display_order });
  } catch (err) {
    console.error('Add position error:', err);
    res.status(500).json({ error: 'Failed to add position' });
  }
});

// Delete a position (admin)
app.delete('/api/positions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM positions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// ─── Candidates ─────────────────────────────────────────────────

app.get('/api/candidates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM candidates');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

app.post('/api/candidates', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { name, position_id, grade_level, section, party_list, motto } = req.body;
    if (!name || !position_id || !grade_level || !section || !party_list) {
      return res.status(400).json({ error: 'Name, position, grade level, section, and party list are required' });
    }

    const id = uuidv4();
    const avatar_url = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.query(
      'INSERT INTO candidates (id, name, position_id, grade_level, section, party_list, motto, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, position_id, grade_level, section, party_list, motto || null, avatar_url]
    );

    res.json({ id, name, position_id, grade_level, section, party_list, motto, avatar_url });
  } catch (err) {
    console.error('Add candidate error:', err);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

app.put('/api/candidates/:id', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { name, position_id, grade_level, section, party_list, motto } = req.body;
    if (!name || !position_id || !grade_level || !section || !party_list) {
      return res.status(400).json({ error: 'Name, position, grade level, section, and party list are required' });
    }

    let avatar_url = undefined;
    if (req.file) {
      avatar_url = `/uploads/${req.file.filename}`;
    }

    const fields = ['name = ?', 'position_id = ?', 'grade_level = ?', 'section = ?', 'party_list = ?', 'motto = ?'];
    const values = [name, position_id, grade_level, section, party_list, motto || null];

    if (avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(avatar_url);
    }

    values.push(req.params.id);
    await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update candidate error:', err);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

app.delete('/api/candidates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

// ─── Votes ──────────────────────────────────────────────────────

app.post('/api/votes', requireAuth, async (req, res) => {
  try {
    const { votes } = req.body;

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: 'No votes provided' });
    }

    // Check if user is admin
    const [roles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ? AND role = ?',
      [req.user.id, 'admin']
    );
    if (roles.length > 0) {
      return res.status(403).json({ error: 'Administrators are not allowed to vote' });
    }

    // Fetch voter profile (grade_level)
    const [profiles] = await pool.query(
      'SELECT grade_level, section FROM profiles WHERE user_id = ?',
      [req.user.id]
    );
    const voterProfile = profiles[0] || {};

    // ── Validate max_votes per position ────────────────────────────────────
    // Count how many votes are submitted per position
    const votesByPosition = {};
    for (const vote of votes) {
      if (!votesByPosition[vote.position_id]) votesByPosition[vote.position_id] = [];
      votesByPosition[vote.position_id].push(vote.candidate_id);
    }

    // Fetch position max_votes for all involved positions
    const positionIds = Object.keys(votesByPosition);
    const [positionRows] = await pool.query(
      `SELECT id, title, max_votes FROM positions WHERE id IN (${positionIds.map(() => '?').join(',')})`,
      positionIds
    );
    const positionMap = {};
    for (const p of positionRows) positionMap[p.id] = p;

    for (const [posId, candIds] of Object.entries(votesByPosition)) {
      const pos = positionMap[posId];
      if (!pos) return res.status(400).json({ error: 'Invalid position' });

      if (candIds.length > pos.max_votes) {
        return res.status(400).json({
          error: `You can only vote for up to ${pos.max_votes} candidate(s) for ${pos.title}`
        });
      }

      // ── Grade Representative restriction ────────────────────────────
      if (pos.title.toLowerCase().includes('representative')) {
        if (!voterProfile.grade_level) {
          return res.status(403).json({ error: 'Your grade level must be set to vote for Grade Representatives' });
        }
        // Verify each candidate for this position matches voter's grade level
        for (const candId of candIds) {
          const [cands] = await pool.query(
            'SELECT grade_level FROM candidates WHERE id = ?',
            [candId]
          );
          if (cands.length === 0) return res.status(400).json({ error: 'Invalid candidate' });
          if (cands[0].grade_level !== voterProfile.grade_level) {
            return res.status(403).json({
              error: `Grade Representatives: you may only vote for candidates from your grade level (${voterProfile.grade_level})`
            });
          }
        }
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const vote of votes) {
        const id = uuidv4();
        await connection.query(
          'INSERT INTO votes (id, voter_id, candidate_id, position_id) VALUES (?, ?, ?, ?)',
          [id, req.user.id, vote.candidate_id, vote.position_id]
        );
      }

      // Mark profile as voted
      await connection.query(
        'UPDATE profiles SET has_voted = 1 WHERE user_id = ?',
        [req.user.id]
      );

      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'You have already voted for one of the selected candidates' });
      }
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit votes' });
  }
});

app.get('/api/votes/counts', async (req, res) => {
  try {
    const { voter_grade, voter_section } = req.query;

    // If no voter filters, use the fast view
    if (!voter_grade && !voter_section) {
      const [rows] = await pool.query('SELECT * FROM vote_counts ORDER BY display_order, vote_count DESC');
      return res.json(rows);
    }

    // Build a filtered query joining votes → profiles to filter by voter's grade/section
    let conditions = [];
    let params = [];

    if (voter_grade) {
      conditions.push('pr.grade_level = ?');
      params.push(voter_grade);
    }
    if (voter_section) {
      conditions.push('pr.section = ?');
      params.push(voter_section);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(`
      SELECT
        c.id AS candidate_id,
        c.name AS candidate_name,
        c.position_id,
        c.party_list,
        c.grade_level,
        c.section,
        c.motto,
        p.title AS position_title,
        p.display_order,
        COUNT(v.id) AS vote_count
      FROM candidates c
      JOIN positions p ON c.position_id = p.id
      LEFT JOIN (
        SELECT v2.candidate_id, v2.id
        FROM votes v2
        JOIN profiles pr ON pr.user_id = v2.voter_id
        ${whereClause}
      ) v ON v.candidate_id = c.id
      GROUP BY c.id, c.name, c.position_id, c.party_list, c.grade_level,
               c.section, c.motto, p.title, p.display_order
      ORDER BY p.display_order, vote_count DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('Vote counts error:', err);
    res.status(500).json({ error: 'Failed to fetch vote counts' });
  }
});

// Get unique voter grade levels and sections (for Results page filter dropdowns)
app.get('/api/voters/groups', async (req, res) => {
  try {
    const [grades] = await pool.query(
      'SELECT DISTINCT grade_level FROM profiles WHERE grade_level IS NOT NULL AND grade_level != "" ORDER BY grade_level'
    );
    const [sections] = await pool.query(
      'SELECT DISTINCT grade_level, section FROM profiles WHERE section IS NOT NULL AND section != "" ORDER BY grade_level, section'
    );
    res.json({
      gradeLevels: grades.map(r => r.grade_level),
      sections: sections.map(r => ({ grade_level: r.grade_level, section: r.section })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voter groups' });
  }
});

// ─── Election Settings ──────────────────────────────────────────

app.get('/api/election-settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM election_settings LIMIT 1');
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch election settings' });
  }
});

app.put('/api/election-settings/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, name, school_year, election_date, voting_start, voting_end } = req.body;

    const fields = [];
    const values = [];

    if (status)        { fields.push('status = ?');        values.push(status); }
    if (name)          { fields.push('name = ?');          values.push(name); }
    if (school_year)   { fields.push('school_year = ?');   values.push(school_year); }
    if (election_date) { fields.push('election_date = ?'); values.push(election_date); }
    if (voting_start)  { fields.push('voting_start = ?');  values.push(voting_start); }
    if (voting_end)    { fields.push('voting_end = ?');    values.push(voting_end); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.query(
      `UPDATE election_settings SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update election settings' });
  }
});

// ─── Stats ──────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const [[{ voterCount }]] = await pool.query(
      `SELECT COUNT(*) as voterCount FROM profiles p
       INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'voter'`
    );
    const [[{ votedCount }]] = await pool.query(
      `SELECT COUNT(*) as votedCount FROM profiles p
       INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'voter'
       WHERE p.has_voted = 1`
    );
    const [[{ totalVotes }]] = await pool.query(
      'SELECT COUNT(*) as totalVotes FROM votes'
    );
    const [[{ positionCount }]] = await pool.query(
      'SELECT COUNT(*) as positionCount FROM positions'
    );

    res.json({ voterCount, votedCount, totalVotes, positionCount });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Auto-End Scheduler ─────────────────────────────────────────
// Runs every 60 seconds. Automatically marks 'ongoing' elections as
// 'completed' once the current date+time has passed election_date + voting_end.

async function autoEndElections() {
  try {
    // Get all currently ongoing elections
    const [ongoing] = await pool.query(
      "SELECT id, name, election_date, voting_end FROM election_settings WHERE status = 'ongoing'"
    );

    const now = new Date();

    for (const election of ongoing) {
      // Build the end datetime by combining election_date and voting_end
      const dateStr = election.election_date instanceof Date
        ? election.election_date.toISOString().slice(0, 10)
        : String(election.election_date).slice(0, 10);

      const endDateTime = new Date(`${dateStr}T${election.voting_end}`);

      if (now >= endDateTime) {
        await pool.query(
          "UPDATE election_settings SET status = 'completed' WHERE id = ?",
          [election.id]
        );
        console.log(`[Auto-End] Election "${election.name}" (${election.id}) automatically completed at ${now.toLocaleString()}.`);
      }
    }
  } catch (err) {
    console.error('[Auto-End] Scheduler error:', err.message);
  }
}

// Run immediately on startup, then every 60 seconds
autoEndElections();
setInterval(autoEndElections, 60 * 1000);

// ─── Start ──────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Batuan Voting API server running on http://localhost:${PORT}`);
  console.log('[Auto-End] Election auto-end scheduler is active (checks every 60s).');
});
