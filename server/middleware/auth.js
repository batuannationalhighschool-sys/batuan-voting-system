import supabase from '../db.js';

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

// The deployed frontend and the legacy Express server now use the same
// database-issued token. The service-role client validates it through the
// hardened app_get_me RPC, so this server has no duplicate JWT secret.
export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { data, error } = await supabase.rpc('app_get_me', { p_token: token });
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.authToken = token;
    req.authData = data;
    req.user = data.user;
    req.profile = data.profile || null;
    req.isAdmin = data.isAdmin === true;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  return next();
}
