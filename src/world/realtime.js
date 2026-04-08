function ensureRealtimeState(worldState) {
  if (!worldState.sessionsByPlayerId) worldState.sessionsByPlayerId = new Map();
  if (!worldState.activeIntervals) worldState.activeIntervals = new Map();
}

function registerSession(worldState, player, session) {
  ensureRealtimeState(worldState);
  worldState.sessionsByPlayerId.set(player.id, session);
}

function unregisterSession(worldState, playerId) {
  ensureRealtimeState(worldState);
  worldState.sessionsByPlayerId.delete(playerId);
  const interval = worldState.activeIntervals.get(playerId);
  if (interval) {
    clearInterval(interval);
    worldState.activeIntervals.delete(playerId);
  }
}

function setCombatLoop(worldState, player, callback, tickMs = 2000) {
  ensureRealtimeState(worldState);
  const existing = worldState.activeIntervals.get(player.id);
  if (existing) clearInterval(existing);
  const interval = setInterval(callback, tickMs);
  worldState.activeIntervals.set(player.id, interval);
}

function clearCombatLoop(worldState, playerId) {
  ensureRealtimeState(worldState);
  const interval = worldState.activeIntervals.get(playerId);
  if (interval) {
    clearInterval(interval);
    worldState.activeIntervals.delete(playerId);
  }
}

module.exports = {
  ensureRealtimeState,
  registerSession,
  unregisterSession,
  setCombatLoop,
  clearCombatLoop,
};
