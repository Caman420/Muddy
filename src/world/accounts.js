const { createPlayerProfile } = require('./playerFactory');

const accounts = new Map();

function hasAccount(name) {
  return accounts.has(String(name || '').trim().toLowerCase());
}

function getAccount(name) {
  return accounts.get(String(name || '').trim().toLowerCase()) || null;
}

function createAccount({ name, race }) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) {
    throw new Error('Name is required.');
  }
  if (accounts.has(key)) {
    throw new Error('That name is already taken.');
  }

  const profile = createPlayerProfile({
    id: `char-${key}`,
    name: key,
    race,
  });

  accounts.set(key, profile);
  return profile;
}

function attachSession(profile, socket) {
  return {
    ...profile,
    socket,
    buffer: '',
    sessionState: 'playing',
  };
}

module.exports = {
  hasAccount,
  getAccount,
  createAccount,
  attachSession,
};
