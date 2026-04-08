const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const playerFile = path.join(dataDir, 'players.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadPlayers() {
  ensureDataDir();
  if (!fs.existsSync(playerFile)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(playerFile, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Failed to load players.json', error);
    return {};
  }
}

function savePlayers(playersByName) {
  ensureDataDir();
  fs.writeFileSync(playerFile, JSON.stringify(playersByName, null, 2), 'utf8');
}

module.exports = {
  loadPlayers,
  savePlayers,
  playerFile,
};
