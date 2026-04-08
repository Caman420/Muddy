const net = require('net');
const config = require('./src/config');
const starterRooms = require('./src/world/rooms');
const worldState = require('./src/world/state');
const { createStarterStats } = require('./src/world/playerFactory');
const { loadPlayers, savePlayers } = require('./src/world/storage');
const { roomSpawns, cloneEnemy } = require('./src/world/enemies');
const { getTechnique, techniques } = require('./src/world/techniques');
const {
  ensureCombatState,
  canUseTechnique,
  setTechniqueCooldown,
  computeDamage,
  spendTechniqueCost,
  scheduleRespawn,
  getRemainingCooldown,
} = require('./src/world/combat');
const {
  ensureRealtimeState,
  registerSession,
  unregisterSession,
  setCombatLoop,
  clearCombatLoop,
} = require('./src/world/realtime');

for (const room of starterRooms) {
  worldState.rooms.set(room.id, room);
}
ensureRealtimeState(worldState);
if (!worldState.enemies) worldState.enemies = new Map();
const persistedPlayers = loadPlayers();

function prompt(socket, text = '> ') {
  if (!socket.destroyed) socket.write(text);
}

function writeLine(socket, text = '') {
  if (!socket.destroyed) socket.write(`${text}\r\n`);
}

function persistPlayer(player) {
  persistedPlayers[player.name] = {
    id: player.id,
    name: player.name,
    race: player.race,
    roomId: player.roomId,
    hp: player.hp,
    maxHp: player.maxHp,
    kiPool: player.kiPool,
    maxKiPool: player.maxKiPool,
    exp: player.exp || 0,
    level: player.level || 1,
    stats: player.stats,
    cooldowns: player.cooldowns || {},
  };
  savePlayers(persistedPlayers);
}

function createNewPlayer(name, race) {
  const stats = createStarterStats(race);
  const player = {
    id: `char-${name}`,
    name,
    race,
    roomId: 'start',
    hp: 100,
    maxHp: 100,
    kiPool: 50,
    maxKiPool: 50,
    exp: 0,
    level: 1,
    stats,
    socket: null,
    buffer: '',
    cooldowns: {},
  };
  ensureCombatState(player);
  return player;
}

function attachPlayer(profile, socket) {
  const player = {
    ...profile,
    socket,
    buffer: '',
    cooldowns: profile.cooldowns || {},
  };
  ensureCombatState(player);
  return player;
}

function hydrateEnemy(enemy) {
  enemy.stats = {
    offense: enemy.offense,
    defense: enemy.defense,
    speed: enemy.speed,
    ki: enemy.powerLevel,
    strength: enemy.powerLevel,
  };
  enemy.hp = enemy.hp ?? enemy.currentHp;
  enemy.maxHp = enemy.maxHp || enemy.hp;
  enemy.kiPool = enemy.kiPool ?? enemy.currentKi;
  enemy.maxKiPool = enemy.maxKiPool || enemy.kiPool;
  ensureCombatState(enemy);
  return enemy;
}

function getEnemyForRoom(roomId) {
  if (worldState.enemies.has(roomId)) return worldState.enemies.get(roomId);
  const enemyId = roomSpawns[roomId];
  if (!enemyId) return null;
  const enemy = hydrateEnemy(cloneEnemy(enemyId));
  worldState.enemies.set(roomId, enemy);
  return enemy;
}

function renderRoom(player) {
  const room = worldState.rooms.get(player.roomId);
  if (!room) return 'You are lost in the void.';
  const exits = Object.keys(room.exits || {});
  const enemy = getEnemyForRoom(player.roomId);
  const enemyText = enemy && enemy.hp > 0 ? `Enemy: ${enemy.name} (${enemy.hp}/${enemy.maxHp} HP)` : 'Enemy: none';
  return `${room.name}\r\n${room.description}\r\nExits: ${exits.length ? exits.join(', ') : 'none'}\r\n${enemyText}`;
}

function renderStats(player) {
  const stats = player.stats;
  return [
    `Name: ${player.name}`,
    `Race: ${player.race}`,
    `Level: ${player.level}`,
    `EXP: ${player.exp}`,
    `HP: ${player.hp}/${player.maxHp}`,
    `Ki: ${player.kiPool}/${player.maxKiPool}`,
    `Power Level: ${stats.powerLevel}`,
    `STR ${stats.strength} | END ${stats.endurance} | SPD ${stats.speed}`,
    `KI ${stats.ki} | OFF ${stats.offense} | DEF ${stats.defense}`,
  ].join('\r\n');
}

function renderStatus(player) {
  const ids = ['punch', 'kick', 'blast', 'beam'];
  const cooldownLines = ids.map((id) => {
    const t = techniques[id];
    const seconds = (getRemainingCooldown(player, id) / 1000).toFixed(1);
    return `${t.name}: ${seconds}s`;
  });
  return [
    `HP ${player.hp}/${player.maxHp} | Ki ${player.kiPool}/${player.maxKiPool}`,
    ...cooldownLines,
  ].join('\r\n');
}

function grantExp(player, amount) {
  player.exp += amount;
  const target = player.level * 25;
  if (player.exp >= target) {
    player.level += 1;
    player.maxHp += 10;
    player.hp = player.maxHp;
    player.maxKiPool += 5;
    player.kiPool = player.maxKiPool;
    player.stats.powerLevel += 2;
    player.stats.strength += 1;
    player.stats.offense += 1;
    player.stats.ki += 1;
    return `\r\nYou have reached level ${player.level}!`;
  }
  return '';
}

function scheduleEnemyRespawn(roomId) {
  worldState.enemies.delete(roomId);
  scheduleRespawn(worldState, roomId, () => hydrateEnemy(cloneEnemy(roomSpawns[roomId])), 15000);
}

function handlePlayerDefeat(player) {
  player.hp = player.maxHp;
  player.kiPool = player.maxKiPool;
  player.roomId = 'start';
  persistPlayer(player);
  clearCombatLoop(worldState, player.id);
  return 'You collapse and awaken back at the Training Grounds.';
}

function enemyCounterattack(player, enemy) {
  const enemyTechnique = enemy.kiPool >= 8 ? getTechnique('blast') : getTechnique('punch');
  const check = canUseTechnique(enemy, enemyTechnique.id);
  if (!check.ok) return `${enemy.name} circles you, waiting for an opening.`;
  const technique = check.technique;
  spendTechniqueCost(enemy, technique);
  setTechniqueCooldown(enemy, technique.id, technique.cooldownMs);
  const damage = computeDamage(enemy, player, technique);
  player.hp = Math.max(0, player.hp - damage);
  let text = `${enemy.name} ${technique.verb} you for ${damage} damage.`;
  if (player.hp <= 0) {
    text += `\r\n${handlePlayerDefeat(player)}`;
  } else {
    persistPlayer(player);
  }
  return text;
}

function defeatEnemy(player, enemy) {
  const reward = enemy.expReward || 5;
  const levelText = grantExp(player, reward);
  scheduleEnemyRespawn(player.roomId);
  persistPlayer(player);
  clearCombatLoop(worldState, player.id);
  return `${enemy.name} is defeated. You gain ${reward} EXP.${levelText}\r\nThe area will repopulate soon.`;
}

function ensureRoomCombatLoop(player) {
  const enemy = getEnemyForRoom(player.roomId);
  if (!enemy || enemy.hp <= 0) {
    clearCombatLoop(worldState, player.id);
    return;
  }

  setCombatLoop(worldState, player, () => {
    const session = worldState.sessionsByPlayerId.get(player.id);
    if (!session || !session.player || session.player.roomId !== player.roomId) {
      clearCombatLoop(worldState, player.id);
      return;
    }
    const liveEnemy = getEnemyForRoom(session.player.roomId);
    if (!liveEnemy || liveEnemy.hp <= 0) {
      clearCombatLoop(worldState, player.id);
      return;
    }
    const result = enemyCounterattack(session.player, liveEnemy);
    writeLine(session.socket, `[tick] ${result}`);
    if (!session.socket.destroyed) prompt(session.socket);
  }, 2500);
}

function useTechnique(player, techniqueId) {
  const enemy = getEnemyForRoom(player.roomId);
  if (!enemy || enemy.hp <= 0) return 'There is nothing here to fight.';

  const check = canUseTechnique(player, techniqueId);
  if (!check.ok) return check.reason;

  const technique = check.technique;
  spendTechniqueCost(player, technique);
  setTechniqueCooldown(player, technique.id, technique.cooldownMs);
  const damage = computeDamage(player, enemy, technique);
  enemy.hp = Math.max(0, enemy.hp - damage);
  let text = `You ${technique.verb} ${enemy.name} for ${damage} damage.`;

  if (enemy.hp <= 0) {
    text += `\r\n${defeatEnemy(player, enemy)}`;
    return text;
  }

  persistPlayer(player);
  ensureRoomCombatLoop(player);
  return `${text}\r\n${enemy.name} prepares to retaliate.`;
}

function tryMove(player, direction) {
  const room = worldState.rooms.get(player.roomId);
  if (!room || !room.exits || !room.exits[direction]) return `You cannot go ${direction}.`;
  player.roomId = room.exits[direction];
  persistPlayer(player);
  clearCombatLoop(worldState, player.id);
  return renderRoom(player);
}

function handleCharge(player) {
  if (player.kiPool >= player.maxKiPool) return 'Your ki is already full.';
  player.kiPool = Math.min(player.maxKiPool, player.kiPool + 10);
  persistPlayer(player);
  return 'You gather your energy and recover 10 ki.';
}

function handleMeditate(player) {
  if (player.hp >= player.maxHp) return 'You are already at full health.';
  player.hp = Math.min(player.maxHp, player.hp + 12);
  persistPlayer(player);
  return 'You meditate and recover 12 HP.';
}

function handleScan(player) {
  const enemy = getEnemyForRoom(player.roomId);
  if (!enemy || enemy.hp <= 0) return 'Your scouter finds no enemy power signatures here.';
  return `${enemy.name} | PL ${enemy.powerLevel} | HP ${enemy.hp}/${enemy.maxHp} | Ki ${enemy.kiPool}/${enemy.maxKiPool}`;
}

function handleGameCommand(player, line) {
  const input = String(line || '').trim();
  const normalized = input.toLowerCase();
  if (!normalized) return '';
  if (['north', 'south', 'east', 'west', 'n', 's', 'e', 'w'].includes(normalized)) {
    const map = { n: 'north', s: 'south', e: 'east', w: 'west' };
    return tryMove(player, map[normalized] || normalized);
  }
  switch (normalized) {
    case 'help':
      return 'Commands: help, look, stats, status, punch, kick, blast, beam, charge, meditate, scan, north/south/east/west, quit';
    case 'look':
      return renderRoom(player);
    case 'stats':
      return renderStats(player);
    case 'status':
    case 'cooldowns':
      return renderStatus(player);
    case 'fight':
    case 'attack':
    case 'punch':
      return useTechnique(player, 'punch');
    case 'kick':
      return useTechnique(player, 'kick');
    case 'blast':
      return useTechnique(player, 'blast');
    case 'beam':
      return useTechnique(player, 'beam');
    case 'charge':
      return handleCharge(player);
    case 'meditate':
      return handleMeditate(player);
    case 'scan':
    case 'pl':
      return handleScan(player);
    case 'quit':
      persistPlayer(player);
      clearCombatLoop(worldState, player.id);
      player.socket.end('Goodbye.\r\n');
      return null;
    default:
      return `Unknown command: ${input}`;
  }
}

const server = net.createServer((socket) => {
  const session = { state: 'ask-name', socket, buffer: '', pendingName: null, player: null };
  socket.setEncoding('utf8');
  writeLine(socket, `${config.motd} [realtime build]`);
  writeLine(socket, 'Enter character name:');
  prompt(socket);

  socket.on('data', (chunk) => {
    session.buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = session.buffer.indexOf('\n')) !== -1) {
      const line = session.buffer.slice(0, newlineIndex).replace(/\r/g, '');
      session.buffer = session.buffer.slice(newlineIndex + 1);

      if (session.state === 'ask-name') {
        const name = String(line || '').trim().toLowerCase();
        if (!name) {
          writeLine(socket, 'Please enter a valid character name.');
          prompt(socket);
          continue;
        }
        session.pendingName = name;
        if (persistedPlayers[name]) {
          session.player = attachPlayer(persistedPlayers[name], socket);
          worldState.players.set(session.player.id, session.player);
          registerSession(worldState, session.player, session);
          session.state = 'playing';
          writeLine(socket, `Welcome back, ${session.player.name}.`);
          writeLine(socket, renderStats(session.player));
          writeLine(socket, renderRoom(session.player));
          prompt(socket);
          continue;
        }
        session.state = 'ask-race';
        writeLine(socket, 'New character. Choose race: human, saiyan, namekian, android');
        prompt(socket);
        continue;
      }

      if (session.state === 'ask-race') {
        const race = String(line || '').trim().toLowerCase();
        const allowed = new Set(['human', 'saiyan', 'namekian', 'android']);
        if (!allowed.has(race)) {
          writeLine(socket, 'Invalid race. Choose: human, saiyan, namekian, android');
          prompt(socket);
          continue;
        }
        const profile = createNewPlayer(session.pendingName, race);
        persistPlayer(profile);
        session.player = attachPlayer(profile, socket);
        worldState.players.set(session.player.id, session.player);
        registerSession(worldState, session.player, session);
        session.state = 'playing';
        writeLine(socket, `Character created: ${session.player.name} the ${session.player.race}.`);
        writeLine(socket, renderStats(session.player));
        writeLine(socket, renderRoom(session.player));
        prompt(socket);
        continue;
      }

      if (session.state === 'playing' && session.player) {
        const response = handleGameCommand(session.player, line);
        if (typeof response === 'string' && response.length) writeLine(socket, response);
        if (!socket.destroyed) prompt(socket);
      }
    }
  });

  socket.on('close', () => {
    if (session.player) {
      persistPlayer(session.player);
      unregisterSession(worldState, session.player.id);
      worldState.players.delete(session.player.id);
    }
  });

  socket.on('error', () => {
    if (session.player) {
      persistPlayer(session.player);
      unregisterSession(worldState, session.player.id);
      worldState.players.delete(session.player.id);
    }
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Muddy realtime server listening on ${config.host}:${config.port}`);
});
