const worldState = require('../world/state');

function getRoomText(player) {
  const room = worldState.rooms.get(player.roomId);
  if (!room) return 'You are nowhere.\r\n';
  return `\r\n${room.name}\r\n${room.description}\r\n`;
}

function handleCommand(player, rawInput) {
  const input = String(rawInput || '').trim().toLowerCase();

  if (!input) return '';

  switch (input) {
    case 'help':
      return 'Commands: help, look, quit\r\n';
    case 'look':
      return getRoomText(player);
    case 'quit':
      player.socket.end('Goodbye.\r\n');
      return null;
    default:
      return `Unknown command: ${input}\r\n`;
  }
}

module.exports = {
  handleCommand,
  getRoomText,
};
