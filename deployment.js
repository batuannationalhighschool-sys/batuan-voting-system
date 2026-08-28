/**
 * Batuan Voting - deployment helper for Vercel.
 *
 * The VERCEL_TOKEN must be supplied by the process environment or a CI secret
 * store. This file intentionally never reads tokens from .env.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const projectName = 'batuan-voting';
const vercelApi = 'https://api.vercel.com';
const vercelToken = process.env.VERCEL_TOKEN;

if (!vercelToken) {
  console.error('VERCEL_TOKEN is not set in the process environment.');
  process.exit(1);
}

async function vercelFetch(endpoint, options = {}) {
  return fetch(`${vercelApi}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      ...options.headers,
    },
  });
}

function getAllFiles(directory, base = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...getAllFiles(fullPath, relativePath));
    else files.push({ file: relativePath, fullPath });
  }
  return files;
}

function deploymentFiles() {
  const files = [];
  const distDir = path.join(projectDir, 'dist');
  const apiDir = path.join(projectDir, 'api');

  files.push(...getAllFiles(distDir));
  if (fs.existsSync(apiDir)) files.push(...getAllFiles(apiDir, 'api'));

  for (const file of ['package.json', 'package-lock.json', 'vercel.json']) {
    const fullPath = path.join(projectDir, file);
    if (fs.existsSync(fullPath)) files.push({ file, fullPath });
  }
  return files;
}

console.log('Building frontend...');
execSync('npm run build', { stdio: 'inherit', cwd: projectDir });

const entries = deploymentFiles();
const fileManifest = [];

for (const entry of entries) {
  const content = fs.readFileSync(entry.fullPath);
  const sha = crypto.createHash('sha1').update(content).digest('hex');
  const uploadResponse = await vercelFetch('/v2/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': sha,
      'x-vercel-size': String(content.length),
    },
    body: content,
  });

  if (!uploadResponse.ok && uploadResponse.status !== 409) {
    console.error(`Failed to upload ${entry.file}: ${await uploadResponse.text()}`);
    process.exit(1);
  }

  fileManifest.push({ file: entry.file, sha, size: content.length });
  console.log(`Uploaded ${entry.file}`);
}

const deploymentResponse = await vercelFetch('/v13/deployments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: projectName,
    files: fileManifest,
    target: 'production',
    projectSettings: { framework: null },
    builds: [{ src: 'api/*.js', use: '@vercel/node' }],
    routes: [
      { src: '/api/(.*)', dest: '/api/$1' },
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' },
    ],
  }),
});

const deployment = await deploymentResponse.json();
if (!deploymentResponse.ok) {
  console.error('Deployment failed:', JSON.stringify(deployment));
  process.exit(1);
}

console.log(`Deployment created: https://${deployment.url}`);
if (deployment.alias?.length) console.log(`Production alias: https://${deployment.alias[0]}`);
