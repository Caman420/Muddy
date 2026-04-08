function ensureRoomRuntime(worldState) {
  if (!worldState.roomOccupants) worldState.roomOccupants = new Map();
}

function ensureRoomSet(worldState, roomId) {
  ensureRoomRuntime(worldState);
  if (!worldState.roomOccupants.has(roomId)) {
    worldState.roomOccupants.set(roomId, new Set());
  }
  return worldState.roomOccupants.get(roomId);
}

function addPlayerToRoom(worldState, player, roomId) {
  const occupants = ensureRoomSet(worldState, roomId);
  occupants.add(player.id);
}

function removePlayerFromRoom(worldState, playerId, roomId) {
  ensureRoomRuntime(worldState);
  const occupants = worldState.roomOccupants.get(roomId);
  if (!occupants) return;
  occupants.delete(playerId);
  if (occupants.size === 0) {
    worldState.roomOccupants.delete(roomId);
  }
}

function movePlayerRoom(worldState, player, fromRoomId, toRoomId) {
  if (fromRoomId) removePlayerFromRoom(worldState, player.id, fromRoomId);
  addPlayerToRoom(worldState, player, toRoomId);
}

function getRoomPlayerIds(worldState, roomId) {
  ensureRoomRuntime(worldState);
  return Array.from(worldState.roomOccupants.get(roomId) || []);
}

function broadcastToRoom(worldState, roomId, playersById, writer, message, excludePlayerId = null) {
  const ids = getRoomPlayerIds(worldState, roomId);
  for (const playerId of ids) {
    if (excludePlayerId && playerId === excludePlayerId) continue;
    const player = playersById.get(playerId);
    if (!player || !player.socket || player.socket.destroyed) continue;
    writer(player.socket, message);
  }
}

module.exports = {
  ensureRoomRuntime,
  addPlayerToRoom,
  removePlayerFromRoom,
  movePlayerRoom,
  getRoomPlayerIds,
  broadcastToRoom,
};
