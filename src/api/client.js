/**
 * Batuan Voting — API Client (Supabase Backend)
 *
 * Drop-in replacement for the old fetch-based client.
 * Routes every api.get/post/put/patch/delete/upload call to
 * either a direct Supabase query (public reads) or an RPC (authenticated ops).
 *
 * The external interface (api.get, api.post, etc.) is IDENTICAL to the old client,
 * so NO page-level code changes are needed.
 */
import { supabase } from '@/lib/supabase';

function getToken() {
  return localStorage.getItem('auth_token');
}

// ─── GET Router ─────────────────────────────────────────────────────
async function handleGet(path) {
  const qIdx = path.indexOf('?');
  const pathname = qIdx >= 0 ? path.slice(0, qIdx) : path;
  const params = Object.fromEntries(new URLSearchParams(qIdx >= 0 ? path.slice(qIdx) : ''));

  // ── Public reads (direct Supabase queries) ─────────────────────
  if (pathname === '/positions') {
    const { data, error } = await supabase.from('positions').select('*').order('display_order');
    if (error) throw new Error(error.message);
    if (params.grade_level) {
      return data.filter(p => {
        if (!p.title.toLowerCase().includes('representative')) return true;
        return p.title.toLowerCase().includes(params.grade_level.toLowerCase());
      });
    }
    return data;
  }

  if (pathname === '/candidates') {
    const { data, error } = await supabase.from('candidates').select('*').eq('archived', false);
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/election-settings') {
    const { data, error } = await supabase.from('election_settings').select('*').limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  // ── RPCs ───────────────────────────────────────────────────────
  if (pathname === '/auth/me') {
    const { data, error } = await supabase.rpc('app_get_me', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters') {
    const { data, error } = await supabase.rpc('app_list_voters', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters/archived') {
    const { data, error } = await supabase.rpc('app_list_archived_voters', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/candidates/archived') {
    const { data, error } = await supabase.rpc('app_list_archived_candidates', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/votes/counts') {
    const { data, error } = await supabase.rpc('app_get_filtered_vote_counts', {
      p_voter_grade: params.voter_grade || null,
      p_voter_section: params.voter_section || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters/groups') {
    const { data, error } = await supabase.rpc('app_get_voter_groups');
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/stats') {
    const { data, error } = await supabase.rpc('app_get_stats', {
      p_voter_grade: params.voter_grade || null,
      p_voter_section: params.voter_section || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/election-history') {
    const { data, error } = await supabase.rpc('app_get_election_history');
    if (error) throw new Error(error.message);
    return data;
  }

  const m = pathname.match(/^\/election-history\/([^/]+)\/results$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_get_archived_results', { p_school_year: decodeURIComponent(m[1]) });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown GET route: ${pathname}`);
}

// ─── POST Router ────────────────────────────────────────────────────
async function handlePost(path, body) {
  const pathname = path.split('?')[0];

  if (pathname === '/auth/login') {
    const { data, error } = await supabase.rpc('app_login', {
      p_lrn: body.lrn, p_password: body.password,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/auth/change-password') {
    const { data, error } = await supabase.rpc('app_change_password', {
      p_token: getToken(), p_new_password: body.new_password,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters') {
    const { data, error } = await supabase.rpc('app_add_voter', {
      p_token: getToken(), p_lrn: body.lrn, p_full_name: body.full_name,
      p_grade_level: body.grade_level || null, p_section: body.section || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters/bulk') {
    const { data, error } = await supabase.rpc('app_bulk_upload_voters', {
      p_token: getToken(), p_voters: body.voters,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/voters/reset-all-voted') {
    const { data, error } = await supabase.rpc('app_reset_all_voted', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/candidates/bulk') {
    const { data, error } = await supabase.rpc('app_bulk_upload_candidates', {
      p_token: getToken(), p_candidates: body.candidates,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/votes') {
    const { data, error } = await supabase.rpc('app_submit_votes', {
      p_token: getToken(), p_votes: body.votes,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  if (pathname === '/election-history/archive') {
    const { data, error } = await supabase.rpc('app_archive_election_results', { p_token: getToken() });
    if (error) throw new Error(error.message);
    return data;
  }

  // Dynamic: /voters/:id/restore
  let m = pathname.match(/^\/voters\/([^/]+)\/restore$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_restore_voter', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  // Dynamic: /voters/:id/reset-password
  m = pathname.match(/^\/voters\/([^/]+)\/reset-password$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_reset_voter_password', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  // Dynamic: /candidates/:id/restore
  m = pathname.match(/^\/candidates\/([^/]+)\/restore$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_restore_candidate', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown POST route: ${pathname}`);
}

// ─── PUT Router ─────────────────────────────────────────────────────
async function handlePut(path, body) {
  const pathname = path.split('?')[0];

  // /voters/:id
  let m = pathname.match(/^\/voters\/([^/]+)$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_update_voter', {
      p_token: getToken(), p_id: m[1], p_lrn: body.lrn, p_full_name: body.full_name,
      p_grade_level: body.grade_level || null, p_section: body.section || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // /election-settings/:id
  m = pathname.match(/^\/election-settings\/([^/]+)$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_update_election_settings', {
      p_token: getToken(), p_id: m[1], p_data: body,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown PUT route: ${pathname}`);
}

// ─── PATCH Router ───────────────────────────────────────────────────
async function handlePatch(path) {
  const pathname = path.split('?')[0];

  // /candidates/:id/archive
  const m = pathname.match(/^\/candidates\/([^/]+)\/archive$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_archive_candidate', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown PATCH route: ${pathname}`);
}

// ─── DELETE Router ──────────────────────────────────────────────────
async function handleDelete(path) {
  const pathname = path.split('?')[0];

  // /election-history/:schoolYear
  let m = pathname.match(/^\/election-history\/([^/]+)$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_delete_election_history', { p_token: getToken(), p_school_year: decodeURIComponent(m[1]) });
    if (error) throw new Error(error.message);
    return data;
  }

  // /voters/:id/permanent
  m = pathname.match(/^\/voters\/([^/]+)\/permanent$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_permanent_delete_voter', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  // /voters/:id (archive)
  m = pathname.match(/^\/voters\/([^/]+)$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_archive_voter', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  // /candidates/:id/permanent
  m = pathname.match(/^\/candidates\/([^/]+)\/permanent$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_permanent_delete_candidate', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  // /positions/:id
  m = pathname.match(/^\/positions\/([^/]+)$/);
  if (m) {
    const { data, error } = await supabase.rpc('app_delete_position', { p_token: getToken(), p_id: m[1] });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown DELETE route: ${pathname}`);
}

// ─── File Upload Helpers ────────────────────────────────────────────
async function uploadPhotoToStorage(file) {
  if (!file || !(file instanceof File)) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('candidate-photos').upload(fileName, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from('candidate-photos').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ─── Upload (POST with FormData) ────────────────────────────────────
async function handleUpload(path, formData) {
  const pathname = path.split('?')[0];

  if (pathname === '/candidates') {
    const avatar_url = await uploadPhotoToStorage(formData.get('photo'));
    const { data, error } = await supabase.rpc('app_add_candidate', {
      p_token: getToken(),
      p_name: formData.get('name'),
      p_position_id: formData.get('position_id'),
      p_grade_level: formData.get('grade_level'),
      p_section: formData.get('section'),
      p_party_list: formData.get('party_list'),
      p_motto: formData.get('motto') || null,
      p_avatar_url: avatar_url,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown upload route: ${pathname}`);
}

// ─── Upload PUT (PUT with FormData) ─────────────────────────────────
async function handleUploadPut(path, formData) {
  const pathname = path.split('?')[0];

  const m = pathname.match(/^\/candidates\/([^/]+)$/);
  if (m) {
    const avatar_url = await uploadPhotoToStorage(formData.get('photo'));
    const { data, error } = await supabase.rpc('app_update_candidate', {
      p_token: getToken(),
      p_id: m[1],
      p_name: formData.get('name'),
      p_position_id: formData.get('position_id'),
      p_grade_level: formData.get('grade_level'),
      p_section: formData.get('section'),
      p_party_list: formData.get('party_list'),
      p_motto: formData.get('motto') || null,
      p_avatar_url: avatar_url,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  throw new Error(`Unknown uploadPut route: ${pathname}`);
}

// ─── Export same interface as the old client ─────────────────────────
const api = {
  get: (path) => handleGet(path),
  post: (path, body) => handlePost(path, body),
  put: (path, body) => handlePut(path, body),
  patch: (path, body) => handlePatch(path, body),
  delete: (path) => handleDelete(path),
  upload: (path, formData) => handleUpload(path, formData),
  uploadPut: (path, formData) => handleUploadPut(path, formData),
};

export default api;
