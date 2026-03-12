const path = require('path');
const { readJson, writeJson } = require('./store');

const base = path.join(__dirname, '..', 'data');
const files = {
  users: path.join(base, 'users.json'),
  steam: path.join(base, 'steam_accounts.json'),
  sessions: path.join(base, 'sessions.json'),
  settings: path.join(base, 'settings.json')
};

const defaults = {
  users: [],
  steam: [],
  sessions: [],
  settings: { siteName: 'FxzzStore', accent: '#6eff83', rules: [] }
};

function getUsers() { return readJson(files.users, defaults.users); }
function saveUsers(value) { writeJson(files.users, value); }
function getSteam() { return readJson(files.steam, defaults.steam); }
function saveSteam(value) { writeJson(files.steam, value); }
function getSessions() { return readJson(files.sessions, defaults.sessions); }
function saveSessions(value) { writeJson(files.sessions, value); }
function getSettings() { return readJson(files.settings, defaults.settings); }
function saveSettings(value) { writeJson(files.settings, value); }

module.exports = { getUsers, saveUsers, getSteam, saveSteam, getSessions, saveSessions, getSettings, saveSettings };
