/**
 * Batuan Voting — One-Command Deployment Script
 *
 * Usage: node deployment.js
 *
 * Reads vercel_token from .env, builds the frontend,
 * and deploys the dist/ folder to Vercel via API.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const VERCEL_TOKEN = process.env.vercel_token;
const PROJECT_NAME = 'batuan-voting';
const VERCEL_API = 'https://api.vercel.com';

if (!VERCEL_TOKEN) {
  console.error('❌ vercel_token not found in .env');
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────
async function vercelFetch(endpoint, options = {}) {
  const res = await fetch(`${VERCEL_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      ...options.headers,
    },
  });
  return res;
}

function getAllFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else {
      files.push({ file: relativePath, fullPath });
    }
  }
  return files;
}

// ─── Step 1: Build ──────────────────────────────────────────────────
console.log('');
console.log('🔨 Building frontend...');
console.log('─'.repeat(50));
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
} catch (err) {
  console.error('❌ Build failed');
  process.exit(1);
}

// ─── Step 2: Upload files to Vercel ─────────────────────────────────
console.log('');
console.log('📦 Uploading files to Vercel...');
console.log('─'.repeat(50));

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Build may have failed.');
  process.exit(1);
}

const files = getAllFiles(distDir);
const fileManifest = [];

for (const f of files) {
  const content = fs.readFileSync(f.fullPath);
  const sha = crypto.createHash('sha1').update(content).digest('hex');

  const uploadRes = await vercelFetch('/v2/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha,
      'x-vercel-size': String(content.length),
    },
    body: content,
  });

  if (!uploadRes.ok && uploadRes.status !== 409) {
    const errText = await uploadRes.text();
    console.error(`❌ Failed to upload ${f.file}: ${errText}`);
    process.exit(1);
  }

  fileManifest.push({ file: f.file, sha, size: content.length });
  process.stdout.write(`  ✓ ${f.file}\n`);
}

console.log(`\n  📁 ${fileManifest.length} files uploaded`);

// ─── Step 3: Create deployment ──────────────────────────────────────
console.log('');
console.log('🚀 Creating Vercel deployment...');
console.log('─'.repeat(50));

const deployRes = await vercelFetch('/v13/deployments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: PROJECT_NAME,
    files: fileManifest,
    target: 'production',
    projectSettings: {
      framework: null,
    },
    routes: [
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' },
    ],
  }),
});

const deployData = await deployRes.json();

if (!deployRes.ok) {
  console.error('❌ Deployment failed:', JSON.stringify(deployData, null, 2));
  process.exit(1);
}

console.log('');
console.log('═'.repeat(50));
console.log('✅ DEPLOYMENT SUCCESSFUL!');
console.log('═'.repeat(50));
console.log('');
console.log(`  🌐 URL:         https://${deployData.url}`);
if (deployData.alias && deployData.alias.length > 0) {
  console.log(`  🔗 Production:  https://${deployData.alias[0]}`);
}
console.log(`  📋 Status:      ${deployData.readyState || 'DEPLOYING'}`);
console.log(`  🕐 Deployed at: ${new Date().toLocaleString()}`);
console.log('');
