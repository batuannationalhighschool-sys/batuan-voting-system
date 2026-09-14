// READ-ONLY audit probe. Never prints secret values.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const URL_ = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const PAT = env['supabase_PAT'];
const VERCEL = env['vercel_token'];
const sb = createClient(URL_, ANON);
const redact = s => (s || '').replace(/eyJ[\w.-]+/g, '<jwt>').replace(/sbp_[\w]+/g, '<pat>');

// ---- 1. Anonymous public reads ----
for (const [label, fn] of [
  ['positions', () => sb.from('positions').select('id,title,max_votes').order('display_order')],
  ['candidates', () => sb.from('candidates').select('id,name,grade_level,section,party_list,archived').limit(200)],
  ['election_settings', () => sb.from('election_settings').select('*').limit(1)],
  ['votes DIRECT (should fail)', () => sb.from('votes').select('id').limit(1)],
  ['profiles DIRECT (should fail)', () => sb.from('profiles').select('user_id').limit(1)],
  ['users DIRECT (should fail)', () => sb.from('users').select('id,password_hash').limit(1)],
  ['user_roles DIRECT (should fail)', () => sb.from('user_roles').select('*').limit(1)],
  ['ballot_submissions DIRECT (should fail)', () => sb.from('ballot_submissions').select('*').limit(1)],
  ['election_results_archive', () => sb.from('election_results_archive').select('id,election_name,school_year').limit(5)],
]) {
  const { data, error } = await fn();
  if (error) console.log(`READ ${label}: DENIED (${error.message.slice(0, 70)})`);
  else console.log(`READ ${label}: allowed, ${Array.isArray(data) ? data.length + ' rows' : 'single'}`);
}

// ---- 2. Anonymous RPC rejections (no writes attempted) ----
for (const [label, fn] of [
  ['app_submit_votes empty token', () => sb.rpc('app_submit_votes', { p_token: '', p_votes: [] })],
  ['app_add_candidate bad token', () => sb.rpc('app_add_candidate', { p_token: 'x'.repeat(10), p_name: 'AUDIT-PROBE', p_position_id: '00000000-0000-0000-0000-000000000000', p_grade_level: 'Grade 8', p_section: 'X', p_party_list: 'AUDIT' })],
  ['app_list_voters bad token', () => sb.rpc('app_list_voters', { p_token: 'x'.repeat(10) })],
  ['app_reset_all_voted bad token', () => sb.rpc('app_reset_all_voted', { p_token: 'x'.repeat(10) })],
  ['app_update_election_settings bad token', () => sb.rpc('app_update_election_settings', { p_token: 'x'.repeat(10), p_id: '00000000-0000-0000-0000-000000000000', p_data: {} })],
  ['app_archive_election_results bad token', () => sb.rpc('app_archive_election_results', { p_token: 'x'.repeat(10), p_election_name: 'AUDIT', p_school_year: '2099-2100' })],
  ['app_delete_election_history bad token', () => sb.rpc('app_delete_election_history', { p_token: 'x'.repeat(10), p_school_year: '2099-2100' })],
  ['app_rename_party_list bad token', () => sb.rpc('app_rename_party_list', { p_token: 'x'.repeat(10), p_old_party_list: 'A', p_new_party_list: 'B' })],
  ['app_rename_section bad token', () => sb.rpc('app_rename_section', { p_token: 'x'.repeat(10), p_grade_level: 'Grade 8', p_old_section: 'A', p_new_section: 'B' })],
  ['app_auto_manage_elections anon', () => sb.rpc('app_auto_manage_elections')],
  ['app_login empty creds', () => sb.rpc('app_login', { p_lrn: '', p_password: '' })],
]) {
  try {
    const { data, error } = await fn();
    if (error) console.log(`RPC ${label}: REJECTED (${error.message.slice(0, 70)})`);
    else console.log(`RPC ${label}: !!! ALLOWED !!! ${JSON.stringify(data).slice(0, 60)}`);
  } catch (e) { console.log(`RPC ${label}: THREW ${redact(e.message).slice(0, 70)}`); }
}

// ---- 3. Storage anon access ----
{
  const { data, error } = await sb.storage.from('candidate-photos').list('candidates', { limit: 3 });
  console.log(`STORAGE anon list candidate-photos: ${error ? 'DENIED (' + error.message.slice(0, 50) + ')' : 'ALLOWED, ' + data.length + ' objects'}`);
  const { error: upErr } = await sb.storage.from('candidate-photos').upload('audit-probe/should-fail.txt', Buffer.from('x'), { contentType: 'text/plain' });
  console.log(`STORAGE anon upload: ${upErr ? 'DENIED (' + upErr.message.slice(0, 50) + ')' : '!!! ALLOWED !!!'}`);
}
console.log('PART1 DONE');
