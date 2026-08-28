import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false, sizeLimit: '5mb' },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

let supabaseAdmin;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase server configuration is incomplete');
    }
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return supabaseAdmin;
}

function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let finished = false;

    req.on('data', (chunk) => {
      if (finished) return;
      size += chunk.length;
      if (size > MAX_FILE_SIZE) {
        finished = true;
        reject(new Error('FILE_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!finished) {
        finished = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on('aborted', () => {
      if (!finished) {
        finished = true;
        reject(new Error('REQUEST_ABORTED'));
      }
    });
    req.on('error', (error) => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
  });
}

function imageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const client = getSupabaseAdmin();
    const { data: auth, error: authError } = await client.rpc('app_get_me', { p_token: token });
    if (authError || !auth?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const contentType = req.headers['content-type']?.split(';')[0]?.toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' });
    }

    const body = await readBody(req);
    const image = imageType(body);
    if (!image || image.mimeType !== contentType) {
      return res.status(400).json({ error: 'The uploaded file is not a supported image' });
    }

    const filePath = `candidates/${randomUUID()}.${image.extension}`;
    const { error: uploadError } = await client.storage
      .from('candidate-photos')
      .upload(filePath, body, {
        contentType: image.mimeType,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = client.storage.from('candidate-photos').getPublicUrl(filePath);
    return res.status(200).json({ url: urlData.publicUrl });
  } catch (error) {
    if (error.message === 'FILE_TOO_LARGE') {
      return res.status(413).json({ error: 'Candidate photos must be 5 MB or smaller' });
    }
    console.error('Candidate photo upload error:', error.message);
    return res.status(400).json({ error: 'Candidate photo upload failed' });
  }
}
