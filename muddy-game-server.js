const net = require('net');
const config = require('./src/config');
const starterRooms = require('./src/world/rooms');
const worldState = require('./src/world/state');
const { createStarterStats } = require('./src/world/playerFactory');
const { loadPlayers, savePlayers } = require('./src/world/storage');
const { roomSpawns, cloneEnemy } = require('./src/world/enemies');

for (const room of starterRooms) {
  worldState.rooms.set(room.id, room);
}

const persistedPlayers = loadPlayers();

function prompt(socket, text = '> ') {
  if (!socket.destroyed) socket.write(text);
}

function writeLine(socket, text = '') {
  if (!socket.destroyed) socket.write(`${text}\r\n`);
}

function getEnemyForRoom(roomId) {
  if (!worldState.enemies) worldState.enemies = new Map();
  if (worldState.enemies.has(roomId)) {
    return worldState.enemies.get(roomId);
  }
  const enemyId = roomSpawns[roomId];
  if (!enemyId) return null;
  const enemy = cloneEnemy(enemyId);
  if (!enemy) return null;
  worldState.enemies.set(roomId, enemy);
  return enemy;
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
  };
  savePlayers(persistedPlayers);
}

function createNewPlayer(name, race) {
  const stats = createStarterStats(race);
  return {
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
  };
}

function attachPlayer(profile, socket) {
  return {
    ...profile,
    socket,
    buffer: '',
  };
}

function renderRoom(player) {
  const room = worldState.rooms.get(player.roomId);
  if (!room) return 'You are lost in the void.';
  const exits = Object.keys(room.exits || {});
  const exitText = exits.length ? exits.join(', ') : 'none';
  const enemy = getEnemyForRoom(player.roomId);
  const enemyText = enemy && enemy.currentHp > 0
    ? `Enemy: ${enemy.name} (${enemy.currentHp}/${enemy.maxHp ?? enemy.hp} HP)`
    : 'Enemy: none';
  return `${room.name}\r\n${room.description}\r\nExits: ${exitText}\r\n${enemyText}`;
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

function tryMove(player, direction) {
  const room = worldState.rooms.get(player.roomId);
  if (!room || !room.exits || !room.exits[direction]) {
    return `You cannot go ${direction}.`;
  }
  player.roomId = room.exits[direction];
  persistPlayer(player);
  return renderRoom(player);
}

function playerAttackDamage(player) {
  return Math.max(1, player.stats.strength + player.stats.offense - 4);
}

function enemyAttackDamage(enemy) {
  return Math.max(1, enemy.offense - 2);
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
    return `\r\nYou have reached level ${player.level}!`; 
  }
  return '';
}

function handleFight(player) {
  const enemy = getEnemyForRoom(player.roomId);
  if (!enemy || enemy.currentHp <= 0) {
    return 'There is nothing here to fight.';
  }

  const playerDamage = playerAttackDamage(player);
  enemy.currentHp = Math.max(0, enemy.currentHp - playerDamage);
  let text = `You hit ${enemy.name} for ${playerDamage} damage.`;

  if (enemy.currentHp <= 0) {
    const levelText = grantExp(player, enemy.expReward || 5);
    text += `\r\n${enemy.name} is defeated. You gain ${enemy.expReward || 5} EXP.${levelText}`;
    persistPlayer(player);
    return text;
  }

  const retaliation = enemyAttackDamage(enemy);
  player.hp = Math.max(0, player.hp - retaliation);
  text += `\r\n${enemy.name} hits you for ${retaliation} damage.`;

  if (player.hp <= 0) {
    player.hp = player.maxHp;
    player.kiPool = player.maxKiPool;
    player.roomId = 'start';
    text += '\r\nYou were beaten and wake up back at the Training Grounds.';
  }

  persistPlayer(player);
  return text;
}

function handleCharge(player) {
  if (player.kiPool >= player.maxKiPool) {
    return 'Your ki is already full.';
  }
  const gain = Math.min(10, player.maxKiPool - player.kiPool);
  player.kiPool += gain;
  persistPlayer(player);
  return `You focus and recover ${gain} ki.`;
}

function handleMeditate(player) {
  const heal = Math.min(12, player.maxHp - player.hp);
  if (heal <= 0) {
    return 'You are already at full health.';
  }
  player.hp += heal;
  persistPlayer(player);
  return `You meditate and recover ${heal} HP.`;
}

function handleScan(player) {
  const enemy = getEnemyForRoom(player.roomId);
  if (!enemy || enemy.currentHp <= 0) {
    return 'Your scouter finds no enemy power signatures here.';
  }
  return `${enemy.name} | PL ${enemy.powerLevel} | HP ${enemy.currentHp}/${enemy.maxHp ?? enemy.hp}`;
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
      return 'Commands: help, look, stats, fight, charge, meditate, scan, north/south/east/west, quit';
    case 'look':
      return renderRoom(player);
    case 'stats':
      return renderStats(player);
    case 'fight':
    case 'attack':
      return handleFight(player);
    case 'charge':
      return handleCharge(player);
    case 'meditate':
      return handleMeditate(player);
    case 'scan':
    case 'pl':
      return handleScan(player);
    case 'quit':
      persistPlayer(player);
      player.socket.end('Goodbye.\r\n');
      return null;
    default:
      return `Unknown command: ${input}`;
  }
}

const server = net.createServer((socket) => {
  const session = {
    state: 'ask-name',
    socket,
    buffer: '',
    pendingName: null,
    player: null,
  };

  socket.setEncoding('utf8');
  writeLine(socket, `${config.motd} [persistent combat build]`);
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
        session.state = 'playing';
        writeLine(socket, `Character created: ${session.player.name} the ${session.player.race}.`);
        writeLine(socket, renderStats(session.player));
        writeLine(socket, renderRoom(session.player));
        prompt(socket);
        continue;
      }

      if (session.state === 'playing' && session.player) {
        const response = handleGameCommand(session.player, line);
        if (typeof response === 'string' && response.length) {
          writeLine(socket, response);
        }
        if (!socket.destroyed) prompt(socket);
      }
    }
  });

  socket.on('close', () => {
    if (session.player) {
      persistPlayer(session.player);
      worldState.players.delete(session.player.id);
    }
  });

  socket.on('error', () => {
    if (session.player) {
      persistPlayer(session.player);
      worldState.players.delete(session.player.id);
    }
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Muddy game server listening on ${config.host}:${config.port}`);
});
