const net = require('net');
const config = require('./config');
const worldState = require('./world/state');
const { handleCommand, getRoomText } = require('./commands');

let nextPlayerId = 1;

const server = net.createServer((socket) => {
  const playerId = `player-${nextPlayerId++}`;
  const player = {
    id: playerId,
    name: playerId,
    roomId: 'start',
    socket,
    buffer: '',
  };

  worldState.players.set(playerId, player);

  socket.setEncoding('utf8');
  socket.write(`${config.motd}\r\nType 'help' for commands.\r\n`);
  socket.write(getRoomText(player));
  socket.write('> ');

  socket.on('data', (chunk) => {
    player.buffer += chunk;

    let newlineIndex;
    while ((newlineIndex = player.buffer.indexOf('\n')) !== -1) {
      const line = player.buffer.slice(0, newlineIndex).replace(/\r/g, '');
      player.buffer = player.buffer.slice(newlineIndex + 1);

      const response = handleCommand(player, line);
      if (typeof response === 'string' && response.length) {
        socket.write(response);
      }

      if (!socket.destroyed) {
        socket.write('> ');
      }
    }
  });

  socket.on('close', () => {
    worldState.players.delete(playerId);
  });

  socket.on('error', () => {
    worldState.players.delete(playerId);
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Muddy listening on ${config.host}:${config.port}`);
});
