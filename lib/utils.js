const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function randomToken(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

function simpleHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function detectDevice(userAgent = '') {
  const ua = userAgent.toLowerCase();
  const isTablet = /ipad|tablet|playbook|silk/.test(ua);
  const isMobile = /android|iphone|ipod|mobile|blackberry|iemobile|opera mini/.test(ua);

  let type = 'Desktop';
  if (isTablet) type = 'Tablet';
  else if (isMobile) type = 'Mobile';

  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = 'Unknown Browser';
  if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

  return { type, os, browser };
}

function isRecent(isoDate, seconds = 180) {
  if (!isoDate) return false;
  return Date.now() - new Date(isoDate).getTime() <= seconds * 1000;
}

module.exports = { nowIso, randomToken, simpleHash, getClientIp, detectDevice, isRecent };
