const { getSessions, saveSessions, getUsers } = require('../lib/db');
const { nowIso } = require('../lib/utils');

function attachAuth(req, _res, next) {
  const authToken = req.cookies?.fxzz_auth;
  if (!authToken) {
    req.user = null;
    return next();
  }

  const sessions = getSessions();
  const session = sessions.find((item) => item.token === authToken && !item.revoked);
  if (!session) {
    req.user = null;
    return next();
  }

  const users = getUsers();
  const user = users.find((item) => item.id === session.userId && item.active !== false);
  if (!user) {
    session.revoked = true;
    session.lastSeen = nowIso();
    saveSessions(sessions);
    req.user = null;
    return next();
  }

  req.user = {
    ...user,
    sessionToken: session.token,
    deviceId: session.deviceId,
    deviceLabel: session.deviceLabel,
    sessionCreatedAt: session.createdAt,
    lastSeen: session.lastSeen
  };
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Admin access only' });
  }
  next();
}

module.exports = { attachAuth, requireAuth, requireAdmin };
