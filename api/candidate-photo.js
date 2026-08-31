import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false, sizeLimit: '10mb' },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function detectImageType(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 2) return null;

  // JPEG / JPG / JFIF (FF D8)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  // PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  // GIF (GIF87a or GIF89a)
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }

  // WebP (RIFF .... WEBP)
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  // AVIF / HEIC / HEIF (.... ftyp avif/avis/heic/heix/mif1)
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand === 'avif' || brand === 'avis') {
      return { extension: 'avif', mimeType: 'image/avif' };
    }
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1' || brand === 'msf1') {
      return { extension: 'heic', mimeType: 'image/heic' };
    }
  }

  // BMP (BM)
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { extension: 'bmp', mimeType: 'image/bmp' };
  }

  // SVG (<svg or <?xml)
  const prefix = buffer.subarray(0, 100).toString('utf8').trim().toLowerCase();
  if (prefix.startsWith('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) {
    return { extension: 'svg', mimeType: 'image/svg+xml' };
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

    const body = await readBody(req);
    if (!body || body.length === 0) {
      return res.status(400).json({ error: 'No image data received' });
    }

    const image = detectImageType(body);
    if (!image) {
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
      return res.status(413).json({ error: 'Candidate photos must be 10 MB or smaller' });
    }
    console.error('Candidate photo upload error:', error.message);
    return res.status(400).json({ error: error.message || 'Candidate photo upload failed' });
  }
}

