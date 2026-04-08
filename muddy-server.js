const net = require('net');
const config = require('./src/config');
const starterRooms = require('./src/world/rooms');
const worldState = require('./src/world/state');
const { hasAccount, getAccount, createAccount, attachSession } = require('./src/world/accounts');

for (const room of starterRooms) {
  worldState.rooms.set(room.id, room);
}

function prompt(socket, text = '> ') {
  if (!socket.destroyed) socket.write(text);
}

function writeLine(socket, text = '') {
  if (!socket.destroyed) socket.write(`${text}\r\n`);
}

function renderRoom(player) {
  const room = worldState.rooms.get(player.roomId);
  if (!room) return 'You are lost in the void.';
  const exits = Object.keys(room.exits || {});
  const exitText = exits.length ? exits.join(', ') : 'none';
  return `${room.name}\r\n${room.description}\r\nExits: ${exitText}`;
}

function renderStats(player) {
  const stats = player.stats;
  return [
    `Name: ${player.name}`,
    `Race: ${player.race}`,
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
  return renderRoom(player);
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
      return 'Commands: help, look, stats, north/south/east/west, quit';
    case 'look':
      return renderRoom(player);
    case 'stats':
      return renderStats(player);
    case 'quit':
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
  writeLine(socket, config.motd);
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
        if (hasAccount(name)) {
          const profile = getAccount(name);
          session.player = attachSession(profile, socket);
          worldState.players.set(session.player.id, session.player);
          session.state = 'playing';
          writeLine(socket, `Welcome back, ${session.player.name}.`);
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

        try {
          const profile = createAccount({ name: session.pendingName, race });
          session.player = attachSession(profile, socket);
          worldState.players.set(session.player.id, session.player);
          session.state = 'playing';
          writeLine(socket, `Character created: ${session.player.name} the ${session.player.race}.`);
          writeLine(socket, renderStats(session.player));
          writeLine(socket, renderRoom(session.player));
        } catch (error) {
          writeLine(socket, error.message || 'Could not create character.');
          session.state = 'ask-name';
          writeLine(socket, 'Enter character name:');
        }

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
      worldState.players.delete(session.player.id);
    }
  });

  socket.on('error', () => {
    if (session.player) {
      worldState.players.delete(session.player.id);
    }
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Muddy playable server listening on ${config.host}:${config.port}`);
});
