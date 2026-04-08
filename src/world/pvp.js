function findPlayerInRoom(worldState, roomId, query, excludePlayerId = null) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;

  for (const player of worldState.players.values()) {
    if (!player || player.roomId !== roomId) continue;
    if (excludePlayerId && player.id === excludePlayerId) continue;
    if (player.name.toLowerCase() === normalized) return player;
    if (player.name.toLowerCase().includes(normalized)) return player;
  }

  return null;
}

function canAttackPlayer(attacker, target) {
  if (!attacker || !target) {
    return { ok: false, reason: 'Invalid target.' };
  }
  if (attacker.id === target.id) {
    return { ok: false, reason: 'You cannot attack yourself.' };
  }
  if (attacker.roomId !== target.roomId) {
    return { ok: false, reason: 'That player is not here.' };
  }
  if (target.hp <= 0) {
    return { ok: false, reason: 'That player is already down.' };
  }
  return { ok: true };
}

function handlePlayerDefeat(attacker, target) {
  const reward = Math.max(5, Math.floor((target.level || 1) * 4));
  attacker.exp = (attacker.exp || 0) + reward;
  target.hp = target.maxHp;
  target.kiPool = target.maxKiPool;
  target.roomId = 'start';
  return {
    reward,
    message: `${target.name} is defeated and wakes up back at the Training Grounds.`,
  };
}

module.exports = {
  findPlayerInRoom,
  canAttackPlayer,
  handlePlayerDefeat,
};
