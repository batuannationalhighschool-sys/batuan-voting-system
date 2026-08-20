import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import supabase from './db.js';
import { generateToken, requireAuth, requireAdmin } from './middleware/auth.js';

// Multer config — temporary in-memory storage before uploading to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .jpg, .jpeg, .png, and .webp files are allowed'));
  },
});

// Helper: upload file buffer to Supabase Storage
async function uploadToSupabaseStorage(fileBuffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const fileName = `${uuidv4()}${ext}`;
  const { data, error } = await supabase.storage
    .from('candidate-photos')
    .upload(fileName, fileBuffer, {
      contentType: `image/${ext.replace('.', '')}`,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('candidate-photos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Auth Routes ────────────────────────────────────────────────

// Login with LRN (students) or username (admin)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { lrn, password } = req.body;
    if (!lrn || !password) {
      return res.status(400).json({ error: 'LRN and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('lrn', lrn)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid LRN or password' });
    }

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
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash, must_change_password: false })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    // Generate a new token
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    const token = generateToken(updatedUser);

    res.json({ success: true, token });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, has_voted, grade_level, section')
      .eq('user_id', req.user.id);

    if (profileError) throw profileError;

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', req.user.id);

    if (roleError) throw roleError;

    const profile = profiles?.[0] || null;
    const isAdmin = roles?.some(r => r.role === 'admin') || false;

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
    // Get all users with voter role
    const { data: voterRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'voter');

    if (roleError) throw roleError;

    const voterIds = voterRoles.map(r => r.user_id);
    if (voterIds.length === 0) return res.json([]);

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, lrn, full_name, must_change_password, created_at')
      .in('id', voterIds)
      .order('created_at', { ascending: false });

    if (userError) throw userError;

    // Get profiles for these users
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, grade_level, section, has_voted')
      .in('user_id', voterIds)
      .eq('archived', false);

    if (profileError) throw profileError;

    const profileMap = {};
    for (const p of profiles) profileMap[p.user_id] = p;

    const rows = users
      .filter(u => profileMap[u.id])
      .map(u => ({
        ...u,
        grade_level: profileMap[u.id]?.grade_level || null,
        section: profileMap[u.id]?.section || null,
        has_voted: profileMap[u.id]?.has_voted || false,
      }));

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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('lrn', lrn);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'LRN already registered' });
    }

    const id = uuidv4();
    // Default password = LRN
    const password_hash = await bcrypt.hash(lrn, 10);

    const { error: userError } = await supabase
      .from('users')
      .insert({ id, lrn, password_hash, full_name, must_change_password: true });

    if (userError) throw userError;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: uuidv4(),
        user_id: id,
        full_name,
        grade_level: grade_level || null,
        section: section || null,
      });

    if (profileError) throw profileError;

    // Assign voter role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ id: uuidv4(), user_id: id, role: 'voter' });

    if (roleError) throw roleError;

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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('lrn', lrn)
      .neq('id', req.params.id);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'LRN already in use by another account' });
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ lrn, full_name })
      .eq('id', req.params.id);

    if (userError) throw userError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name, grade_level: grade_level || null, section: section || null })
      .eq('user_id', req.params.id);

    if (profileError) throw profileError;

    res.json({ success: true });
  } catch (err) {
    console.error('Update voter error:', err);
    res.status(500).json({ error: 'Failed to update voter' });
  }
});

// Archive a voter (soft delete)
app.delete('/api/voters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq('user_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Archive voter error:', err);
    res.status(500).json({ error: 'Failed to archive voter' });
  }
});

// Get archived voters
app.get('/api/voters/archived', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get all users with voter role
    const { data: voterRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'voter');

    if (roleError) throw roleError;

    const voterIds = voterRoles.map(r => r.user_id);
    if (voterIds.length === 0) return res.json([]);

    // Get archived profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, grade_level, section, has_voted, archived_at')
      .in('user_id', voterIds)
      .eq('archived', true)
      .order('archived_at', { ascending: false });

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) return res.json([]);

    const archivedUserIds = profiles.map(p => p.user_id);

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, lrn, full_name, created_at')
      .in('id', archivedUserIds);

    if (userError) throw userError;

    const userMap = {};
    for (const u of users) userMap[u.id] = u;

    const rows = profiles.map(p => ({
      id: p.user_id,
      lrn: userMap[p.user_id]?.lrn || null,
      full_name: p.full_name,
      grade_level: p.grade_level || null,
      section: p.section || null,
      has_voted: p.has_voted || false,
      archived_at: p.archived_at,
      created_at: userMap[p.user_id]?.created_at || null,
    }));

    res.json(rows);
  } catch (err) {
    console.error('List archived voters error:', err);
    res.status(500).json({ error: 'Failed to fetch archived voters' });
  }
});

// Restore an archived voter
app.post('/api/voters/:id/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ archived: false, archived_at: null })
      .eq('user_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Restore voter error:', err);
    res.status(500).json({ error: 'Failed to restore voter' });
  }
});

// Permanently delete an archived voter
app.delete('/api/voters/:id/permanent', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Hard delete from users table - cascades to profiles, user_roles, votes
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Permanent delete voter error:', err);
    res.status(500).json({ error: 'Failed to permanently delete voter' });
  }
});

// Reset all voters' voting status (set has_voted = false for all profiles & clear votes)
app.post('/api/voters/reset-all-voted', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ has_voted: false });

    if (profileErr) throw profileErr;

    // Delete all recorded votes
    const { error: votesErr } = await supabase
      .from('votes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (votesErr) throw votesErr;

    res.json({ success: true, message: 'All voters voting status reset successfully' });
  } catch (err) {
    console.error('Reset all voters error:', err);
    res.status(500).json({ error: 'Failed to reset voters voting status' });
  }
});

// Bulk-upload voters via JSON array
app.post('/api/voters/bulk', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { voters: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Expected a non-empty "voters" array' });
    }

    const inserted = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const { lrn, full_name, grade_level, section } = rows[i] ?? {};
      const rowLabel = `Row ${i + 1}`;

      if (!lrn || !full_name) {
        errors.push({ row: rowLabel, reason: 'LRN and full name are required' });
        continue;
      }
      const cleanLrn = String(lrn).replace(/\D/g, '');
      if (!/^\d{12}$/.test(cleanLrn)) {
        errors.push({ row: rowLabel, lrn: cleanLrn, reason: 'LRN must be exactly 12 digits' });
        continue;
      }

      // Skip existing LRNs
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('lrn', cleanLrn);

      if (existing && existing.length > 0) {
        skipped.push({ lrn: cleanLrn, full_name });
        continue;
      }

      const id = uuidv4();
      const password_hash = await bcrypt.hash(cleanLrn, 10);

      const { error: userError } = await supabase
        .from('users')
        .insert({ id, lrn: cleanLrn, password_hash, full_name: String(full_name).slice(0, 100), must_change_password: true });

      if (userError) {
        errors.push({ row: rowLabel, lrn: cleanLrn, reason: userError.message });
        continue;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: uuidv4(),
          user_id: id,
          full_name: String(full_name).slice(0, 100),
          grade_level: grade_level ? String(grade_level).slice(0, 50) : null,
          section: section ? String(section).slice(0, 50) : null,
        });

      if (profileError) {
        errors.push({ row: rowLabel, lrn: cleanLrn, reason: profileError.message });
        continue;
      }

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ id: uuidv4(), user_id: id, role: 'voter' });

      if (roleError) {
        errors.push({ row: rowLabel, lrn: cleanLrn, reason: roleError.message });
        continue;
      }

      inserted.push({ lrn: cleanLrn, full_name });
    }

    res.json({ inserted: inserted.length, skipped: skipped.length, errors: errors.length, skippedList: skipped, errorList: errors });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// Reset voter password back to LRN
app.post('/api/voters/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('lrn')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    const password_hash = await bcrypt.hash(user.lrn, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash, must_change_password: true })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

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

    const { data: rows, error } = await supabase
      .from('positions')
      .select('*')
      .order('display_order');

    if (error) throw error;

    let filtered = rows;

    // If grade_level provided, filter Grade Representative positions
    // so voters only see the representative slot for their own grade
    if (grade_level) {
      filtered = rows.filter(p => {
        // Keep non-representative positions as-is
        if (!p.title.toLowerCase().includes('representative')) return true;
        // For representative positions, only keep the one matching the voter's grade
        return p.title.toLowerCase().includes(grade_level.toLowerCase());
      });
    }

    res.json(filtered);
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
    const { error } = await supabase
      .from('positions')
      .insert({ id, title, display_order: display_order || 0 });

    if (error) throw error;

    res.json({ id, title, display_order });
  } catch (err) {
    console.error('Add position error:', err);
    res.status(500).json({ error: 'Failed to add position' });
  }
});

// Delete a position (admin)
app.delete('/api/positions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// ─── Candidates ─────────────────────────────────────────────────

app.get('/api/candidates', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('archived', false);

    if (error) throw error;
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
    let avatar_url = null;

    if (req.file) {
      avatar_url = await uploadToSupabaseStorage(req.file.buffer, req.file.originalname);
    }

    const { error } = await supabase
      .from('candidates')
      .insert({
        id,
        name,
        position_id,
        grade_level,
        section,
        party_list,
        motto: motto || null,
        avatar_url,
      });

    if (error) throw error;

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

    const updateData = {
      name,
      position_id,
      grade_level,
      section,
      party_list,
      motto: motto || null,
    };

    if (req.file) {
      updateData.avatar_url = await uploadToSupabaseStorage(req.file.buffer, req.file.originalname);
    }

    const { error: updateError } = await supabase
      .from('candidates')
      .update(updateData)
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    const { data: updated, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    res.json(updated);
  } catch (err) {
    console.error('Update candidate error:', err);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// Archive a candidate (soft delete)
app.patch('/api/candidates/:id/archive', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('candidates')
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Archive candidate error:', err);
    res.status(500).json({ error: 'Failed to archive candidate' });
  }
});

// Get archived candidates
app.get('/api/candidates/archived', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('candidates')
      .select('*, positions(title)')
      .eq('archived', true)
      .order('archived_at', { ascending: false });

    if (error) throw error;
    const result = (rows || []).map(c => ({
      ...c,
      position_title: c.positions?.title || null,
    }));
    res.json(result);
  } catch (err) {
    console.error('List archived candidates error:', err);
    res.status(500).json({ error: 'Failed to fetch archived candidates' });
  }
});

// Restore an archived candidate
app.post('/api/candidates/:id/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('candidates')
      .update({ archived: false, archived_at: null })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Restore candidate error:', err);
    res.status(500).json({ error: 'Failed to restore candidate' });
  }
});

// Permanently delete an archived candidate
app.delete('/api/candidates/:id/permanent', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Permanent delete candidate error:', err);
    res.status(500).json({ error: 'Failed to permanently delete candidate' });
  }
});

// Bulk-upload candidates via JSON array
app.post('/api/candidates/bulk', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { candidates: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Expected a non-empty "candidates" array' });
    }

    // Fetch all positions to match position titles to position_id
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select('id, title');

    if (posError) throw posError;

    const positionMap = {};
    for (const p of (positions || [])) {
      positionMap[p.title.trim().toLowerCase()] = p.id;
    }

    const inserted = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const { name, position, grade_level, section, party_list, motto } = rows[i] ?? {};
      const rowLabel = `Row ${i + 1}`;

      const cleanName = String(name || '').trim();
      const cleanPos = String(position || '').trim();
      const cleanGrade = String(grade_level || '').trim();
      const cleanSec = String(section || '').trim();
      const cleanParty = String(party_list || '').trim();
      const cleanMotto = String(motto || '').trim();

      if (!cleanName || !cleanPos || !cleanGrade || !cleanSec || !cleanParty) {
        errors.push({ row: rowLabel, name: cleanName, reason: 'Name, position, grade level, section, and party list are required' });
        continue;
      }

      const positionId = positionMap[cleanPos.toLowerCase()];
      if (!positionId) {
        errors.push({ row: rowLabel, name: cleanName, reason: `Position "${cleanPos}" does not exist in position list` });
        continue;
      }

      // Check if candidate with same name and position already exists (and not archived)
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('name', cleanName)
        .eq('position_id', positionId)
        .eq('archived', false);

      if (existing && existing.length > 0) {
        skipped.push({ name: cleanName, position: cleanPos });
        continue;
      }

      const id = uuidv4();
      const { error: insertError } = await supabase
        .from('candidates')
        .insert({
          id,
          name: cleanName.slice(0, 100),
          position_id: positionId,
          grade_level: cleanGrade.slice(0, 50),
          section: cleanSec.slice(0, 50),
          party_list: cleanParty.slice(0, 100),
          motto: cleanMotto ? cleanMotto.slice(0, 200) : null,
          archived: false,
        });

      if (insertError) {
        errors.push({ row: rowLabel, name: cleanName, reason: insertError.message });
        continue;
      }

      inserted.push({ name: cleanName, position: cleanPos });
    }

    res.json({
      inserted: inserted.length,
      skipped: skipped.length,
      errors: errors.length,
      skippedList: skipped,
      errorList: errors,
    });
  } catch (err) {
    console.error('Bulk upload candidates error:', err);
    res.status(500).json({ error: 'Bulk upload candidates failed' });
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
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('role', 'admin');

    if (roles && roles.length > 0) {
      return res.status(403).json({ error: 'Administrators are not allowed to vote' });
    }

    // ── Check if election status is ongoing ─────────────────────────────
    const { data: settingsRows } = await supabase
      .from('election_settings')
      .select('status, name, election_date, voting_start')
      .limit(1);

    const election = settingsRows?.[0];
    if (!election || election.status !== 'ongoing') {
      if (election?.status === 'upcoming') {
        return res.status(403).json({
          error: 'Voting is not open yet. The administrator has set this election as Upcoming.'
        });
      } else {
        return res.status(403).json({
          error: 'Voting is closed. This election is not currently active.'
        });
      }
    }

    // Fetch voter profile (grade_level)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('grade_level, section')
      .eq('user_id', req.user.id);

    const voterProfile = profiles?.[0] || {};

    // ── Validate max_votes per position ────────────────────────────────────
    const votesByPosition = {};
    for (const vote of votes) {
      if (!votesByPosition[vote.position_id]) votesByPosition[vote.position_id] = [];
      votesByPosition[vote.position_id].push(vote.candidate_id);
    }

    // Fetch position max_votes for all involved positions
    const positionIds = Object.keys(votesByPosition);
    const { data: positionRows, error: posError } = await supabase
      .from('positions')
      .select('id, title, max_votes')
      .in('id', positionIds);

    if (posError) throw posError;

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
          const { data: cands } = await supabase
            .from('candidates')
            .select('grade_level')
            .eq('id', candId);

          if (!cands || cands.length === 0) return res.status(400).json({ error: 'Invalid candidate' });
          if (cands[0].grade_level !== voterProfile.grade_level) {
            return res.status(403).json({
              error: `Grade Representatives: you may only vote for candidates from your grade level (${voterProfile.grade_level})`
            });
          }
        }
      }
    }

    // Use the RPC function for atomic vote submission
    const { error: rpcError } = await supabase.rpc('submit_votes', {
      p_voter_id: req.user.id,
      p_votes: votes,
    });

    if (rpcError) {
      // Check for unique constraint violation (duplicate vote)
      if (rpcError.message && rpcError.message.includes('unique') || rpcError.code === '23505') {
        return res.status(400).json({ error: 'You have already voted for one of the selected candidates' });
      }
      throw rpcError;
    }

    res.json({ success: true });
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
      const { data: rows, error } = await supabase
        .from('vote_counts')
        .select('*')
        .order('display_order')
        .order('vote_count', { ascending: false });

      if (error) throw error;
      return res.json(rows);
    }

    // Efficient DB-level filtering: get matching voter IDs, then count their votes
    // 1. Get voter IDs whose profile matches the grade/section filter (active voters only)
    let profilesQuery = supabase
      .from('profiles')
      .select('user_id')
      .eq('archived', false);
    if (voter_grade) profilesQuery = profilesQuery.eq('grade_level', voter_grade);
    if (voter_section) profilesQuery = profilesQuery.eq('section', voter_section);

    const { data: filteredProfiles, error: profError } = await profilesQuery;
    if (profError) throw profError;

    const filteredVoterIds = filteredProfiles.map(p => p.user_id);

    // 2. Get all candidates with position info
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, name, position_id, party_list, grade_level, section, motto, positions!inner(title, display_order)');
    if (candError) throw candError;

    // 3. Count votes per candidate from filtered voters only (fetched from DB in batches)
    const voteCountMap = {};
    if (filteredVoterIds.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < filteredVoterIds.length; i += CHUNK) {
        const chunk = filteredVoterIds.slice(i, i + CHUNK);
        const { data: votes, error: vErr } = await supabase
          .from('votes')
          .select('candidate_id')
          .in('voter_id', chunk);
        if (vErr) throw vErr;
        for (const v of votes) {
          voteCountMap[v.candidate_id] = (voteCountMap[v.candidate_id] || 0) + 1;
        }
      }
    }

    // 4. Build response rows
    const rows = candidates.map(c => ({
      candidate_id: c.id,
      candidate_name: c.name,
      position_id: c.position_id,
      party_list: c.party_list,
      grade_level: c.grade_level,
      section: c.section,
      motto: c.motto,
      position_title: c.positions.title,
      display_order: c.positions.display_order,
      vote_count: voteCountMap[c.id] || 0,
    }));

    rows.sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return b.vote_count - a.vote_count;
    });

    res.json(rows);
  } catch (err) {
    console.error('Vote counts error:', err);
    res.status(500).json({ error: 'Failed to fetch vote counts' });
  }
});

// Get unique voter grade levels and sections (for Results page filter dropdowns)
app.get('/api/voters/groups', async (req, res) => {
  try {
    const { data: allProfiles, error } = await supabase
      .from('profiles')
      .select('grade_level, section')
      .not('grade_level', 'is', null)
      .neq('grade_level', '')
      .order('grade_level')
      .order('section');

    if (error) throw error;

    const gradeLevels = [...new Set(allProfiles.map(r => r.grade_level))];
    const sections = allProfiles
      .filter(r => r.section && r.section !== '')
      .map(r => ({ grade_level: r.grade_level, section: r.section }));

    // Deduplicate sections
    const uniqueSections = [];
    const seen = new Set();
    for (const s of sections) {
      const key = `${s.grade_level}-${s.section}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSections.push(s);
      }
    }

    res.json({ gradeLevels, sections: uniqueSections });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voter groups' });
  }
});

// ─── Election Settings ──────────────────────────────────────────

app.get('/api/election-settings', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('election_settings')
      .select('*')
      .limit(1);

    if (error) throw error;
    res.json(rows?.[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch election settings' });
  }
});

app.put('/api/election-settings/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, name, school_year, election_date, voting_start, voting_end, school_name, auto_end_enabled } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name;
    if (school_year) updateData.school_year = school_year;
    if (election_date) updateData.election_date = election_date;
    if (voting_start) updateData.voting_start = voting_start;
    if (voting_end) updateData.voting_end = voting_end;
    if (school_name !== undefined) updateData.school_name = school_name;
    if (auto_end_enabled !== undefined) updateData.auto_end_enabled = !!auto_end_enabled;

    // If setting to upcoming and election_date is in the past, auto-update election_date to today's date
    if (status === 'upcoming' && !election_date) {
      const { data: curr } = await supabase.from('election_settings').select('election_date').eq('id', req.params.id).single();
      if (curr && curr.election_date) {
        const currDateStr = curr.election_date instanceof Date ? curr.election_date.toISOString().slice(0, 10) : String(curr.election_date).slice(0, 10);
        const todayStr = new Date().toLocaleDateString('sv-SE');
        if (currDateStr < todayStr) {
          updateData.election_date = todayStr;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { error } = await supabase
      .from('election_settings')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update election settings' });
  }
});

// ─── Stats ──────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const { voter_grade, voter_section } = req.query;

    // Get user IDs with voter role
    const { data: voterRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'voter');

    const voterIds = voterRoles?.map(r => r.user_id) || [];

    // Query active voter profiles (filtered by grade/section if specified)
    let profilesQuery = supabase
      .from('profiles')
      .select('user_id, has_voted, grade_level, section')
      .in('user_id', voterIds.length > 0 ? voterIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('archived', false);

    if (voter_grade) profilesQuery = profilesQuery.eq('grade_level', voter_grade);
    if (voter_section) profilesQuery = profilesQuery.eq('section', voter_section);

    const { data: activeProfiles, error: profErr } = await profilesQuery;
    if (profErr) throw profErr;

    const voterCount = activeProfiles?.length || 0;
    const votedCount = activeProfiles?.filter(p => p.has_voted)?.length || 0;

    // Get total votes cast
    let totalVotes = 0;
    if (!voter_grade && !voter_section) {
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true });
      totalVotes = count || 0;
    } else {
      const filteredVoterIds = (activeProfiles || []).map(p => p.user_id);
      if (filteredVoterIds.length > 0) {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .in('voter_id', filteredVoterIds);
        totalVotes = count || 0;
      }
    }

    // Get position count relevant to this grade or total
    const { data: allPositions } = await supabase
      .from('positions')
      .select('id, title');

    const positionCount = (allPositions || []).filter(p => {
      if (!voter_grade) return true;
      if (!p.title.startsWith('Grade ')) return true;
      return p.title.toLowerCase().includes(voter_grade.toLowerCase());
    }).length;

    res.json({
      voterCount,
      votedCount,
      totalVotes,
      positionCount,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Auto Election Scheduler (Start & End) ───────────────────────────
// Runs every 10 seconds.
// 1. Auto-starts UPCOMING elections when current time reaches or passes voting_start.
// 2. Auto-completes ONGOING elections when current time reaches or passes voting_end (if auto_end_enabled = true).

function parseLocalDate(dateVal, timeVal) {
  if (!dateVal || !timeVal) return null;
  const dateStr = dateVal instanceof Date ? dateVal.toISOString().slice(0, 10) : String(dateVal).slice(0, 10);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes, seconds = 0] = String(timeVal).split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

async function autoManageElections() {
  try {
    const now = new Date();

    // ── 1. Auto-Start Upcoming Elections ──
    const { data: upcoming, error: upcomingErr } = await supabase
      .from('election_settings')
      .select('id, name, election_date, voting_start, voting_end')
      .eq('status', 'upcoming');

    if (upcomingErr) throw upcomingErr;

    for (const election of (upcoming || [])) {
      const startDateTime = parseLocalDate(election.election_date, election.voting_start);
      const endDateTime = parseLocalDate(election.election_date, election.voting_end);

      if (!startDateTime || !endDateTime) continue;

      // If current time has reached start time and has not passed end time, auto-start!
      if (now >= startDateTime && now < endDateTime) {
        const { error: updateError } = await supabase
          .from('election_settings')
          .update({ status: 'ongoing' })
          .eq('id', election.id);

        if (updateError) throw updateError;
        console.log(`[Auto-Start] Election "${election.name}" (${election.id}) automatically STARTED at ${now.toLocaleString()}.`);
      }
    }

    // ── 2. Auto-End Ongoing Elections ──
    const { data: ongoing, error: ongoingErr } = await supabase
      .from('election_settings')
      .select('id, name, election_date, voting_end, auto_end_enabled')
      .eq('status', 'ongoing');

    if (ongoingErr) throw ongoingErr;

    for (const election of (ongoing || [])) {
      if (election.auto_end_enabled === false) continue;

      const endDateTime = parseLocalDate(election.election_date, election.voting_end);
      if (!endDateTime) continue;

      if (now >= endDateTime) {
        const { error: updateError } = await supabase
          .from('election_settings')
          .update({ status: 'completed' })
          .eq('id', election.id);

        if (updateError) throw updateError;
        console.log(`[Auto-End] Election "${election.name}" (${election.id}) automatically COMPLETED at ${now.toLocaleString()}.`);
      }
    }
  } catch (err) {
    console.error('[Auto-Scheduler] Error:', err.message);
  }
}

// Run immediately on startup, then check every 10 seconds
autoManageElections();
setInterval(autoManageElections, 10 * 1000);

// ─── Auto-Migration: ensure required columns exist ───────────────
async function runMigrations() {
  const tables = [
    {
      name: 'profiles',
      checkCol: 'archived',
      sql: [
        'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;',
        'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;',
      ],
    },
    {
      name: 'candidates',
      checkCol: 'archived',
      sql: [
        'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;',
        'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;',
      ],
    },
    {
      name: 'election_settings',
      checkCol: 'school_name',
      sql: [
        "ALTER TABLE election_settings ADD COLUMN IF NOT EXISTS school_name VARCHAR(150) DEFAULT 'Batuan National High School — Batuan, Bohol, Philippines';",
      ],
    },
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table.name).select(table.checkCol).limit(1);
      const needsMigration = error && (
        error.message.includes('does not exist') ||
        error.code === '42703'
      );

      if (needsMigration) {
        console.log(`[Migration] Adding missing columns to ${table.name} table...`);
        console.log(`[Migration] Please run this SQL in your Supabase SQL Editor:`);
        table.sql.forEach(s => console.log(`  ${s}`));
      } else {
        console.log(`[Migration] ${table.name} columns OK.`);
      }
    } catch (err) {
      console.warn(`[Migration] Could not verify ${table.name} columns:`, err.message);
    }
  }
}

// ─── Start ──────────────────────────────────────────────────────

runMigrations().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Batuan Voting API server running on http://localhost:${PORT}`);
    console.log('[Auto-End] Election auto-end scheduler is active (checks every 60s).');
  });
});
