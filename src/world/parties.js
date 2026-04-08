function ensurePartyState(worldState) {
  if (!worldState.parties) worldState.parties = new Map();
  if (!worldState.partyInvites) worldState.partyInvites = new Map();
}

function createParty(worldState, leader) {
  ensurePartyState(worldState);
  const id = `party-${leader.id}`;
  const party = {
    id,
    leaderId: leader.id,
    memberIds: new Set([leader.id]),
  };
  worldState.parties.set(id, party);
  return party;
}

function findPartyByMember(worldState, playerId) {
  ensurePartyState(worldState);
  for (const party of worldState.parties.values()) {
    if (party.memberIds.has(playerId)) return party;
  }
  return null;
}

function inviteToParty(worldState, inviter, target) {
  ensurePartyState(worldState);
  worldState.partyInvites.set(target.id, inviter.id);
}

function acceptPartyInvite(worldState, player, inviter) {
  ensurePartyState(worldState);
  const invite = worldState.partyInvites.get(player.id);
  if (invite !== inviter.id) {
    return { ok: false, reason: 'No pending invite from that player.' };
  }

  let party = findPartyByMember(worldState, inviter.id);
  if (!party) party = createParty(worldState, inviter);
  party.memberIds.add(player.id);
  worldState.partyInvites.delete(player.id);
  return { ok: true, party };
}

function leaveParty(worldState, playerId) {
  ensurePartyState(worldState);
  const party = findPartyByMember(worldState, playerId);
  if (!party) return null;
  party.memberIds.delete(playerId);
  if (party.leaderId === playerId) {
    const next = Array.from(party.memberIds)[0] || null;
    party.leaderId = next;
  }
  if (party.memberIds.size === 0) {
    worldState.parties.delete(party.id);
  }
  return party;
}

function disbandParty(worldState, leaderId) {
  ensurePartyState(worldState);
  const party = findPartyByMember(worldState, leaderId);
  if (!party) return null;
  if (party.leaderId !== leaderId) {
    return { ok: false, reason: 'Only the leader can disband the party.' };
  }
  worldState.parties.delete(party.id);
  return { ok: true, party };
}

function listPartyMembers(worldState, playersById, playerId) {
  const party = findPartyByMember(worldState, playerId);
  if (!party) return null;
  return Array.from(party.memberIds)
    .map((id) => playersById.get(id))
    .filter(Boolean)
    .map((player) => ({
      name: player.name,
      roomId: player.roomId,
      hp: player.hp,
      maxHp: player.maxHp,
      leader: player.id === party.leaderId,
    }));
}

function areGrouped(worldState, playerAId, playerBId) {
  const party = findPartyByMember(worldState, playerAId);
  return !!party && party.memberIds.has(playerBId);
}

module.exports = {
  ensurePartyState,
  createParty,
  findPartyByMember,
  inviteToParty,
  acceptPartyInvite,
  leaveParty,
  disbandParty,
  listPartyMembers,
  areGrouped,
};
