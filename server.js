const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { attachAuth, requireAuth, requireAdmin } = require('./middleware/auth');
const { getUsers, saveUsers, getSteam, saveSteam, getSessions, saveSessions, getSettings } = require('./lib/db');
const { nowIso, randomToken, getClientIp, detectDevice, isRecent } = require('./lib/utils');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_COOKIE = 'fxzz_auth';

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachAuth);
app.use(express.static(path.join(__dirname, 'public')));

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    avatar: user.avatar,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    lastSeenAt: user.lastSeenAt,
    notes: user.notes,
    deviceLimit: user.deviceLimit || 1
  };
}

function updatePresence(token) {
  const sessions = getSessions();
  const session = sessions.find((item) => item.token === token && !item.revoked);
  if (session) {
    session.lastSeen = nowIso();
    saveSessions(sessions);
  }
}

function publicSessionInfo(req) {
  if (!req.user) return null;
  const sessions = getSessions();
  const activeSessions = sessions.filter((item) => item.userId === req.user.id && !item.revoked);
  const current = activeSessions.find((item) => item.token === req.user.sessionToken);
  return {
    deviceId: current?.deviceId,
    deviceLabel: current?.deviceLabel,
    loginIp: current?.ip,
    activeSessions: activeSessions.length,
    duplicateAccess: activeSessions.length > 1
  };
}

app.get('/api/bootstrap', (req, res) => {
  if (req.user) updatePresence(req.user.sessionToken);
  return res.json({
    ok: true,
    siteName: getSettings().siteName,
    user: req.user ? sanitizeUser(req.user) : null,
    session: publicSessionInfo(req)
  });
});

app.post('/api/login', (req, res) => {
  const { email, password, deviceId, deviceName } = req.body || {};
  if (!email || !password || !deviceId) {
    return res.status(400).json({ ok: false, message: 'Missing login data' });
  }

  const users = getUsers();
  const user = users.find((item) => item.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!user || user.password !== password || user.active === false) {
    return res.status(401).json({ ok: false, message: 'بيانات الدخول غير صحيحة' });
  }

  const sessions = getSessions();
  const activeSessions = sessions.filter((item) => item.userId === user.id && !item.revoked);
  const allowedSessions = user.role === 'admin' ? 3 : (user.deviceLimit || 1);
  const existingSameDevice = activeSessions.find((item) => item.deviceId === deviceId);

  if (!existingSameDevice && activeSessions.length >= allowedSessions) {
    return res.status(403).json({ ok: false, message: 'هذا الحساب مرتبط بجهاز آخر بالفعل' });
  }

  const deviceInfo = detectDevice(req.headers['user-agent'] || '');
  const token = existingSameDevice?.token || randomToken(24);
  const sessionRecord = existingSameDevice || {
    token,
    userId: user.id,
    deviceId,
    createdAt: nowIso(),
    revoked: false
  };

  sessionRecord.deviceLabel = deviceName || `${deviceInfo.type} • ${deviceInfo.browser}`;
  sessionRecord.deviceType = deviceInfo.type;
  sessionRecord.deviceOs = deviceInfo.os;
  sessionRecord.browser = deviceInfo.browser;
  sessionRecord.lastSeen = nowIso();
  sessionRecord.ip = getClientIp(req);

  if (!existingSameDevice) sessions.push(sessionRecord);

  user.lastLoginAt = nowIso();
  user.lastSeenAt = nowIso();
  saveUsers(users);
  saveSessions(sessions);

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30
  });

  return res.json({ ok: true, user: sanitizeUser(user), session: publicSessionInfo({ user: { ...user, sessionToken: token } }) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const sessions = getSessions();
  const session = sessions.find((item) => item.token === req.user.sessionToken && !item.revoked);
  if (session) {
    session.revoked = true;
    session.lastSeen = nowIso();
    saveSessions(sessions);
  }
  res.clearCookie(AUTH_COOKIE);
  return res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  updatePresence(req.user.sessionToken);
  return res.json({ ok: true, user: sanitizeUser(req.user), session: publicSessionInfo(req) });
});

app.post('/api/me/ping', requireAuth, (req, res) => {
  updatePresence(req.user.sessionToken);
  const users = getUsers();
  const user = users.find((item) => item.id === req.user.id);
  if (user) {
    user.lastSeenAt = nowIso();
    saveUsers(users);
  }
  return res.json({ ok: true });
});

app.put('/api/me/profile', requireAuth, (req, res) => {
  const { name, avatar } = req.body || {};
  const users = getUsers();
  const user = users.find((item) => item.id === req.user.id);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  if (typeof name === 'string' && name.trim()) user.name = name.trim().slice(0, 40);
  if (typeof avatar === 'string' && avatar.startsWith('/assets/avatars/')) user.avatar = avatar;
  saveUsers(users);
  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.get('/api/steam', requireAuth, (req, res) => {
  updatePresence(req.user.sessionToken);
  return res.json({ ok: true, items: getSteam() });
});

app.get('/api/rules', (_req, res) => {
  return res.json({ ok: true, rules: getSettings().rules });
});

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  updatePresence(req.user.sessionToken);
  const users = getUsers();
  const sessions = getSessions();
  const activeSessions = sessions.filter((item) => !item.revoked);
  const onlineUserIds = new Set(activeSessions.filter((item) => isRecent(item.lastSeen, 180)).map((item) => item.userId));

  const duplicateMap = {};
  activeSessions.forEach((session) => {
    duplicateMap[session.userId] = (duplicateMap[session.userId] || 0) + 1;
  });

  const cards = users.map((user) => ({
    ...sanitizeUser(user),
    status: onlineUserIds.has(user.id) ? 'online' : 'offline',
    sessions: activeSessions.filter((item) => item.userId === user.id).map((item) => ({
      deviceLabel: item.deviceLabel,
      deviceId: item.deviceId,
      browser: item.browser,
      lastSeen: item.lastSeen,
      ip: item.ip
    }))
  }));

  return res.json({
    ok: true,
    stats: {
      users: users.length,
      online: onlineUserIds.size,
      offline: Math.max(users.length - onlineUserIds.size, 0),
      duplicateAccounts: Object.values(duplicateMap).filter((count) => count > 1).length,
      steamCards: getSteam().length
    },
    users: cards,
    sessions: activeSessions.map((item) => ({
      email: users.find((u) => u.id === item.userId)?.email || 'Unknown',
      deviceLabel: item.deviceLabel,
      deviceId: item.deviceId,
      browser: item.browser,
      lastSeen: item.lastSeen,
      ip: item.ip
    }))
  });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  return res.json({ ok: true, users: getUsers().map(sanitizeUser) });
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { email, password, role = 'user', name = 'New User', avatar = '/assets/avatars/avatar-3.svg' } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, message: 'Email and password required' });
  const users = getUsers();
  if (users.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ ok: false, message: 'Email already exists' });
  }
  const user = {
    id: `u_${Date.now()}`,
    email: email.trim().toLowerCase(),
    password: String(password),
    role: role === 'admin' ? 'admin' : 'user',
    name: name.trim(),
    avatar,
    active: true,
    createdAt: nowIso(),
    lastLoginAt: null,
    lastSeenAt: null,
    deviceLimit: role === 'admin' ? 3 : 1,
    notes: ''
  };
  users.push(user);
  saveUsers(users);
  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const users = getUsers();
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  const { name, password, avatar, active, role } = req.body || {};
  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof password === 'string' && password.trim()) user.password = password.trim();
  if (typeof avatar === 'string' && avatar.startsWith('/assets/avatars/')) user.avatar = avatar;
  if (typeof active === 'boolean') user.active = active;
  if (role === 'admin' || role === 'user') user.role = role;
  user.deviceLimit = user.role === 'admin' ? 3 : 1;
  saveUsers(users);
  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  let users = getUsers();
  const exists = users.some((item) => item.id === req.params.id);
  if (!exists) return res.status(404).json({ ok: false, message: 'User not found' });
  users = users.filter((item) => item.id !== req.params.id);
  saveUsers(users);
  const sessions = getSessions().map((item) => item.userId === req.params.id ? { ...item, revoked: true, lastSeen: nowIso() } : item);
  saveSessions(sessions);
  return res.json({ ok: true });
});

app.get('/api/admin/steam', requireAdmin, (_req, res) => {
  return res.json({ ok: true, items: getSteam() });
});

app.post('/api/admin/steam', requireAdmin, (req, res) => {
  const { game, category, username, password, image, status = 'ready', note = '' } = req.body || {};
  if (!game || !username || !password || !image) return res.status(400).json({ ok: false, message: 'Missing card data' });
  const items = getSteam();
  const item = { id: `g_${Date.now()}`, game, category, username, password, image, status, note };
  items.push(item);
  saveSteam(items);
  return res.json({ ok: true, item });
});

app.put('/api/admin/steam/:id', requireAdmin, (req, res) => {
  const items = getSteam();
  const item = items.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, message: 'Card not found' });
  Object.assign(item, req.body || {});
  saveSteam(items);
  return res.json({ ok: true, item });
});

app.delete('/api/admin/steam/:id', requireAdmin, (req, res) => {
  const items = getSteam().filter((entry) => entry.id !== req.params.id);
  saveSteam(items);
  return res.json({ ok: true });
});

app.get('/api/avatars', requireAuth, (_req, res) => {
  const avatars = [
    '/assets/avatars/avatar-1.svg',
    '/assets/avatars/avatar-2.svg',
    '/assets/avatars/avatar-3.svg',
    '/assets/avatars/avatar-4.svg',
    '/assets/avatars/avatar-admin.svg'
  ];
  return res.json({ ok: true, avatars });
});

app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`FxzzStore running on http://localhost:${PORT}`);
});
