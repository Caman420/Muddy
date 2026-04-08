function ensurePartyCombatState(worldState) {
  if (!worldState.partyFollow) worldState.partyFollow = new Map();
}

function setFollowTarget(worldState, followerId, leaderId) {
  ensurePartyCombatState(worldState);
  worldState.partyFollow.set(followerId, leaderId);
}

function clearFollowTarget(worldState, followerId) {
  ensurePartyCombatState(worldState);
  worldState.partyFollow.delete(followerId);
}

function getFollowersOf(worldState, leaderId) {
  ensurePartyCombatState(worldState);
  const ids = [];
  for (const [followerId, targetLeaderId] of worldState.partyFollow.entries()) {
    if (targetLeaderId === leaderId) ids.push(followerId);
  }
  return ids;
}

function splitPartyExp(worldState, party, playersById, totalExp) {
  if (!party) return [];
  const onlineMembers = Array.from(party.memberIds)
    .map((id) => playersById.get(id))
    .filter(Boolean);
  if (!onlineMembers.length) return [];

  const share = Math.max(1, Math.floor(totalExp / onlineMembers.length));
  return onlineMembers.map((player) => ({ player, exp: share }));
}

function getAssistantsInRoom(worldState, party, playersById, roomId, attackerId) {
  if (!party) return [];
  return Array.from(party.memberIds)
    .filter((id) => id !== attackerId)
    .map((id) => playersById.get(id))
    .filter((player) => player && player.roomId === roomId && player.hp > 0);
}

module.exports = {
  ensurePartyCombatState,
  setFollowTarget,
  clearFollowTarget,
  getFollowersOf,
  splitPartyExp,
  getAssistantsInRoom,
};
