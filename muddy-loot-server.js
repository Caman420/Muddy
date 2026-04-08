const net = require('net');
const config = require('./src/config');
const starterRooms = require('./src/world/rooms');
const worldState = require('./src/world/state');
const { createStarterStats } = require('./src/world/playerFactory');
const { loadPlayers, savePlayers } = require('./src/world/storage');
const { getTechnique } = require('./src/world/techniques');
const { getItem } = require('./src/world/items');
const { ensureCombatState, canUseTechnique, setTechniqueCooldown, computeDamage, spendTechniqueCost } = require('./src/world/combat');
const { ensureRealtimeState, registerSession, unregisterSession } = require('./src/world/realtime');
const { ensureRoomRuntime, addPlayerToRoom, removePlayerFromRoom, movePlayerRoom, getRoomPlayerIds, broadcastToRoom } = require('./src/world/roomsRuntime');
const { ensureSpawnState, getEnemiesForRoom, findEnemyInRoom, removeDefeatedEnemies, scheduleRoomRespawn } = require('./src/world/spawns');
const { findPlayerInRoom, canAttackPlayer, handlePlayerDefeat } = require('./src/world/pvp');
const { ensurePartyState, findPartyByMember, inviteToParty, acceptPartyInvite, leaveParty, disbandParty, listPartyMembers, areGrouped } = require('./src/world/parties');
const { ensurePartyCombatState, setFollowTarget, clearFollowTarget, getFollowersOf, splitPartyExp, getAssistantsInRoom } = require('./src/world/partyCombat');
const { ensureInventory, addItemToInventory, renderInventory, rollLoot, useItem } = require('./src/world/inventory');

for (const room of starterRooms) worldState.rooms.set(room.id, room);
ensureRealtimeState(worldState);
ensureRoomRuntime(worldState);
ensureSpawnState(worldState);
ensurePartyState(worldState);
ensurePartyCombatState(worldState);
const persistedPlayers = loadPlayers();

function prompt(socket, text = '> ') { if (!socket.destroyed) socket.write(text); }
function writeLine(socket, text = '') { if (!socket.destroyed) socket.write(`${text}\r\n`); }

function persistPlayer(player) {
  ensureInventory(player);
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
    pvpEnabled: player.pvpEnabled !== false,
    inventory: player.inventory || [],
  };
  savePlayers(persistedPlayers);
}

function createNewPlayer(name, race) {
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
    stats: createStarterStats(race),
    cooldowns: {},
    pvpEnabled: true,
    inventory: [],
    socket: null,
    buffer: '',
  };
  ensureCombatState(player);
  ensureInventory(player);
  return player;
}

function attachPlayer(profile, socket) {
  const player = { ...profile, socket, buffer: '', cooldowns: profile.cooldowns || {}, pvpEnabled: profile.pvpEnabled !== false, inventory: profile.inventory || [] };
  ensureCombatState(player);
  ensureInventory(player);
  return player;
}

function roomBroadcast(roomId, message, excludePlayerId = null) {
  broadcastToRoom(worldState, roomId, worldState.players, writeLine, message, excludePlayerId);
}

function grantExp(player, amount) {
  player.exp += amount;
  const need = player.level * 25;
  if (player.exp >= need) {
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

function distributePartyExp(sourcePlayer, totalExp) {
  const party = findPartyByMember(worldState, sourcePlayer.id);
  if (!party) {
    const levelText = grantExp(sourcePlayer, totalExp);
    persistPlayer(sourcePlayer);
    return `You gain ${totalExp} EXP.${levelText}`;
  }
  const shares = splitPartyExp(worldState, party, worldState.players, totalExp).filter(({ player }) => player.roomId === sourcePlayer.roomId || player.id === sourcePlayer.id);
  const results = [];
  for (const { player, exp } of shares) {
    const levelText = grantExp(player, exp);
    persistPlayer(player);
    if (player.id === sourcePlayer.id) results.push(`You gain ${exp} shared EXP.${levelText}`);
    else if (player.socket && !player.socket.destroyed) writeLine(player.socket, `You gain ${exp} shared party EXP.${levelText}`);
  }
  return results.join('\r\n');
}

function awardLoot(sourcePlayer, enemyId) {
  const party = findPartyByMember(worldState, sourcePlayer.id);
  const drops = rollLoot(enemyId);
  if (!drops.length) return 'No loot dropped.';
  const recipients = party
    ? Array.from(party.memberIds).map((id) => worldState.players.get(id)).filter((p) => p && p.roomId === sourcePlayer.roomId)
    : [sourcePlayer];
  for (const drop of drops) {
    const receiver = recipients[0];
    if (receiver) addItemToInventory(receiver, drop, 1);
  }
  recipients.forEach((p) => persistPlayer(p));
  return drops.map((id) => `${getItem(id)?.name || id} obtained.`).join('\r\n');
}

function otherPlayersText(viewer) {
  const others = getRoomPlayerIds(worldState, viewer.roomId)
    .map((id) => worldState.players.get(id))
    .filter((p) => p && p.id !== viewer.id)
    .map((p) => `${p.name}${p.pvpEnabled ? '' : ' [safe]'}${areGrouped(worldState, viewer.id, p.id) ? ' [party]' : ''}`);
  return others.length ? `Players here: ${others.join(', ')}` : 'Players here: none';
}

function enemiesText(roomId) {
  const enemies = getEnemiesForRoom(worldState, roomId).filter((e) => e.hp > 0);
  return enemies.length ? `Enemies: ${enemies.map((e) => `${e.name} [${e.uid}] ${e.hp}/${e.maxHp}`).join(' | ')}` : 'Enemies: none';
}

function renderRoom(player) {
  const room = worldState.rooms.get(player.roomId);
  const exits = Object.keys(room.exits || {});
  return [room.name, room.description, `Exits: ${exits.length ? exits.join(', ') : 'none'}`, otherPlayersText(player), enemiesText(player.roomId)].join('\r\n');
}

function renderStats(player) {
  const s = player.stats;
  return [
    `Name: ${player.name}`,
    `Race: ${player.race}`,
    `Level: ${player.level}`,
    `EXP: ${player.exp}`,
    `HP: ${player.hp}/${player.maxHp}`,
    `Ki: ${player.kiPool}/${player.maxKiPool}`,
    `PvP: ${player.pvpEnabled ? 'on' : 'off'}`,
    `Power Level: ${s.powerLevel}`,
    `STR ${s.strength} | END ${s.endurance} | SPD ${s.speed}`,
    `KI ${s.ki} | OFF ${s.offense} | DEF ${s.defense}`,
  ].join('\r\n');
}

function moveFollowers(leader, fromRoom, toRoom) {
  const followerIds = getFollowersOf(worldState, leader.id);
  for (const followerId of followerIds) {
    const follower = worldState.players.get(followerId);
    if (!follower || follower.roomId !== fromRoom) continue;
    movePlayerRoom(worldState, follower, fromRoom, toRoom);
    follower.roomId = toRoom;
    persistPlayer(follower);
    if (follower.socket && !follower.socket.destroyed) {
      writeLine(follower.socket, `You follow ${leader.name} to ${toRoom}.`);
      writeLine(follower.socket, renderRoom(follower));
      prompt(follower.socket);
    }
  }
}

function movePlayer(player, direction) {
  const room = worldState.rooms.get(player.roomId);
  if (!room.exits[direction]) return `You cannot go ${direction}.`;
  const fromRoom = player.roomId;
  const toRoom = room.exits[direction];
  movePlayerRoom(worldState, player, fromRoom, toRoom);
  player.roomId = toRoom;
  persistPlayer(player);
  moveFollowers(player, fromRoom, toRoom);
  roomBroadcast(fromRoom, `${player.name} leaves ${direction}.`, player.id);
  roomBroadcast(toRoom, `${player.name} arrives.`, player.id);
  return renderRoom(player);
}

function applyAssistDamage(attacker, enemy) {
  const party = findPartyByMember(worldState, attacker.id);
  const assistants = getAssistantsInRoom(worldState, party, worldState.players, attacker.roomId, attacker.id);
  if (!assistants.length) return { total: 0, lines: [] };
  const lines = [];
  let total = 0;
  for (const helper of assistants) {
    const tech = getTechnique('punch');
    const check = canUseTechnique(helper, 'punch');
    if (!check.ok) continue;
    spendTechniqueCost(helper, tech);
    setTechniqueCooldown(helper, tech.id, tech.cooldownMs);
    const dmg = Math.max(1, Math.floor(computeDamage(helper, enemy, tech) / 2));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    total += dmg;
    lines.push(`${helper.name} assists for ${dmg} damage.`);
    persistPlayer(helper);
  }
  return { total, lines };
}

function useTechniqueOnEnemy(player, techniqueId, targetText) {
  const enemy = findEnemyInRoom(worldState, player.roomId, targetText);
  if (!enemy) return null;
  const check = canUseTechnique(player, techniqueId);
  if (!check.ok) return check.reason;
  const technique = check.technique;
  spendTechniqueCost(player, technique);
  setTechniqueCooldown(player, technique.id, technique.cooldownMs);
  const damage = computeDamage(player, enemy, technique);
  enemy.hp = Math.max(0, enemy.hp - damage);
  let lines = [`You ${technique.verb} ${enemy.name} for ${damage} damage.`];
  roomBroadcast(player.roomId, `${player.name} ${technique.verb} ${enemy.name} for ${damage} damage.`, player.id);

  const assist = applyAssistDamage(player, enemy);
  if (assist.total > 0) {
    lines.push(...assist.lines);
    roomBroadcast(player.roomId, `${player.name}'s party adds ${assist.total} assist damage to ${enemy.name}.`, player.id);
  }

  if (enemy.hp <= 0) {
    lines.push(`${enemy.name} is defeated.`);
    roomBroadcast(player.roomId, `${enemy.name} is defeated by ${player.name}'s party.`, player.id);
    removeDefeatedEnemies(worldState, player.roomId);
    if (getEnemiesForRoom(worldState, player.roomId).length === 0) scheduleRoomRespawn(worldState, player.roomId, 15000);
    lines.push(distributePartyExp(player, enemy.expReward || 5));
    lines.push(awardLoot(player, enemy.id));
  } else {
    persistPlayer(player);
  }
  return lines.join('\r\n');
}

function useTechniqueOnPlayer(player, techniqueId, targetText) {
  const target = findPlayerInRoom(worldState, player.roomId, targetText, player.id);
  if (!target) return 'No player target here by that name.';
  if (areGrouped(worldState, player.id, target.id)) return `${target.name} is in your party.`;
  if (!player.pvpEnabled) return 'Your PvP flag is off.';
  if (!target.pvpEnabled) return `${target.name} is in safe mode.`;
  const allowed = canAttackPlayer(player, target);
  if (!allowed.ok) return allowed.reason;
  const check = canUseTechnique(player, techniqueId);
  if (!check.ok) return check.reason;
  const technique = check.technique;
  spendTechniqueCost(player, technique);
  setTechniqueCooldown(player, technique.id, technique.cooldownMs);
  const damage = computeDamage(player, target, technique);
  target.hp = Math.max(0, target.hp - damage);
  let text = `You ${technique.verb} ${target.name} for ${damage} damage.`;
  writeLine(target.socket, `${player.name} ${technique.verb} you for ${damage} damage.`);
  roomBroadcast(player.roomId, `${player.name} ${technique.verb} ${target.name} for ${damage} damage.`, player.id);
  if (target.hp <= 0) {
    const result = handlePlayerDefeat(player, target);
    movePlayerRoom(worldState, target, player.roomId, 'start');
    text += `\r\n${result.message}`;
    text += `\r\n${distributePartyExp(player, result.reward)}`;
    writeLine(target.socket, 'You were defeated and wake up back at the Training Grounds.');
    roomBroadcast(player.roomId, `${target.name} is defeated by ${player.name}.`, player.id);
    persistPlayer(target);
  }
  persistPlayer(player);
  persistPlayer(target);
  return text;
}

function useTechnique(player, techniqueId, targetText) {
  if (targetText) {
    const pvpResult = useTechniqueOnPlayer(player, techniqueId, targetText);
    if (pvpResult !== 'No player target here by that name.') return pvpResult;
  }
  const pveResult = useTechniqueOnEnemy(player, techniqueId, targetText);
  if (pveResult) return pveResult;
  return 'No valid target here.';
}

function handleScan(player) {
  const enemies = getEnemiesForRoom(worldState, player.roomId).filter((e) => e.hp > 0);
  const players = getRoomPlayerIds(worldState, player.roomId).map((id) => worldState.players.get(id)).filter((p) => p && p.id !== player.id).map((p) => `${p.name} | PL ${p.stats.powerLevel} | HP ${p.hp}/${p.maxHp} | PvP ${p.pvpEnabled ? 'on' : 'off'}${areGrouped(worldState, player.id, p.id) ? ' | PARTY' : ''}`);
  const lines = [];
  if (players.length) lines.push(...players);
  if (enemies.length) lines.push(...enemies.map((e) => `${e.name} [${e.uid}] | PL ${e.powerLevel} | HP ${e.hp}/${e.maxHp} | Ki ${e.kiPool}/${e.maxKiPool}`));
  return lines.length ? lines.join('\r\n') : 'Your scouter finds no targets here.';
}

function handleSay(player, input) {
  const msg = input.slice(4).trim();
  if (!msg) return 'Say what?';
  roomBroadcast(player.roomId, `${player.name} says: ${msg}`, player.id);
  return `You say: ${msg}`;
}

function handleWho() {
  const names = Array.from(worldState.players.values()).map((p) => `${p.name}${p.pvpEnabled ? '' : ' [safe]'}`);
  return names.length ? `Online: ${names.join(', ')}` : 'Online: none';
}

function handlePvpToggle(player, value) {
  if (!value) return `PvP is currently ${player.pvpEnabled ? 'on' : 'off'}.`;
  const normalized = value.toLowerCase();
  if (normalized === 'on') player.pvpEnabled = true;
  else if (normalized === 'off') player.pvpEnabled = false;
  else return 'Use: pvp on|off';
  persistPlayer(player);
  return `PvP is now ${player.pvpEnabled ? 'on' : 'off'}.`;
}

function handlePartyInvite(player, targetText) {
  const target = findPlayerInRoom(worldState, player.roomId, targetText, player.id);
  if (!target) return 'No player target here by that name.';
  inviteToParty(worldState, player, target);
  writeLine(target.socket, `${player.name} invites you to a party. Type: party accept ${player.name}`);
  return `You invite ${target.name} to your party.`;
}

function handlePartyAccept(player, inviterText) {
  const inviter = findPlayerInRoom(worldState, player.roomId, inviterText, player.id) || Array.from(worldState.players.values()).find((p) => p && p.name.toLowerCase() === String(inviterText || '').trim().toLowerCase());
  if (!inviter) return 'That inviter is not online.';
  const result = acceptPartyInvite(worldState, player, inviter);
  if (!result.ok) return result.reason;
  writeLine(inviter.socket, `${player.name} joins your party.`);
  return `You join ${inviter.name}'s party.`;
}

function handlePartyLeave(player) {
  const party = findPartyByMember(worldState, player.id);
  if (!party) return 'You are not in a party.';
  clearFollowTarget(worldState, player.id);
  const wasLeader = party.leaderId === player.id;
  leaveParty(worldState, player.id);
  return wasLeader ? 'You leave the party. Leadership passes if members remain.' : 'You leave the party.';
}

function handlePartyDisband(player) {
  const result = disbandParty(worldState, player.id);
  if (!result) return 'You are not in a party.';
  if (!result.ok) return result.reason;
  return 'You disband the party.';
}

function handlePartyList(player) {
  const members = listPartyMembers(worldState, worldState.players, player.id);
  if (!members) return 'You are not in a party.';
  return members.map((m) => `${m.name}${m.leader ? ' [leader]' : ''} | room ${m.roomId} | HP ${m.hp}/${m.maxHp}`).join('\r\n');
}

function handleFollow(player, leaderText) {
  const leader = findPlayerInRoom(worldState, player.roomId, leaderText, player.id);
  if (!leader) return 'No player target here by that name.';
  if (!areGrouped(worldState, player.id, leader.id)) return 'You can only follow a party member.';
  setFollowTarget(worldState, player.id, leader.id);
  return `You now follow ${leader.name}.`;
}

function handleUnfollow(player) { clearFollowTarget(worldState, player.id); return 'You stop following.'; }
function handleInventory(player) { return renderInventory(player); }
function handleUse(player, itemText) {
  const key = String(itemText || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!key) return 'Use what?';
  const result = useItem(player, key);
  if (!result.ok) return result.reason;
  persistPlayer(player);
  return result.text;
}

function handleGameCommand(player, line) {
  const input = String(line || '').trim();
  const normalized = input.toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('say ')) return handleSay(player, input);
  if (['north', 'south', 'east', 'west', 'n', 's', 'e', 'w'].includes(normalized)) {
    const map = { n: 'north', s: 'south', e: 'east', w: 'west' };
    return movePlayer(player, map[normalized] || normalized);
  }
  const [cmd, subcmd, ...restWords] = input.split(/\s+/);
  const rest = [subcmd, ...restWords].filter(Boolean).join(' ');
  switch (cmd.toLowerCase()) {
    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv, use <item>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';
    case 'look': return renderRoom(player);
    case 'stats': return renderStats(player);
    case 'who': return handleWho();
    case 'scan':
    case 'pl': return handleScan(player);
    case 'inv':
    case 'inventory': return handleInventory(player);
    case 'use': return handleUse(player, rest);
    case 'pvp': return handlePvpToggle(player, rest);
    case 'follow': return handleFollow(player, rest);
    case 'unfollow': return handleUnfollow(player);
    case 'party': {
      const action = String(subcmd || '').toLowerCase();
      const arg = restWords.join(' ');
      if (action === 'invite') return handlePartyInvite(player, arg);
      if (action === 'accept') return handlePartyAccept(player, arg);
      if (action === 'leave') return handlePartyLeave(player);
      if (action === 'disband') return handlePartyDisband(player);
      if (action === 'list') return handlePartyList(player);
      return 'Use: party invite|accept|leave|disband|list';
    }
    case 'punch':
    case 'fight':
    case 'attack': return useTechnique(player, 'punch', rest);
    case 'kick': return useTechnique(player, 'kick', rest);
    case 'blast': return useTechnique(player, 'blast', rest);
    case 'beam': return useTechnique(player, 'beam', rest);
    case 'charge': player.kiPool = Math.min(player.maxKiPool, player.kiPool + 10); persistPlayer(player); return 'You gather your energy and recover ki.';
    case 'meditate': player.hp = Math.min(player.maxHp, player.hp + 12); persistPlayer(player); return 'You meditate and recover health.';
    case 'quit': persistPlayer(player); player.socket.end('Goodbye.\r\n'); return null;
    default: return `Unknown command: ${input}`;
  }
}

const server = net.createServer((socket) => {
  const session = { state: 'ask-name', socket, buffer: '', pendingName: null, player: null };
  socket.setEncoding('utf8');
  writeLine(socket, `${config.motd} [loot build]`);
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
        if (!name) { writeLine(socket, 'Please enter a valid character name.'); prompt(socket); continue; }
        session.pendingName = name;
        if (persistedPlayers[name]) session.player = attachPlayer(persistedPlayers[name], socket);
        else {
          session.state = 'ask-race';
          writeLine(socket, 'New character. Choose race: human, saiyan, namekian, android');
          prompt(socket);
          continue;
        }
      } else if (session.state === 'ask-race') {
        const race = String(line || '').trim().toLowerCase();
        const allowed = new Set(['human', 'saiyan', 'namekian', 'android']);
        if (!allowed.has(race)) { writeLine(socket, 'Invalid race. Choose: human, saiyan, namekian, android'); prompt(socket); continue; }
        const profile = createNewPlayer(session.pendingName, race);
        persistPlayer(profile);
        session.player = attachPlayer(profile, socket);
      } else if (session.state === 'playing' && session.player) {
        const response = handleGameCommand(session.player, line);
        if (typeof response === 'string' && response.length) writeLine(socket, response);
        if (!socket.destroyed) prompt(socket);
        continue;
      }
      if (session.player) {
        session.state = 'playing';
        worldState.players.set(session.player.id, session.player);
        registerSession(worldState, session.player, session);
        addPlayerToRoom(worldState, session.player, session.player.roomId);
        writeLine(socket, `Welcome, ${session.player.name}.`);
        writeLine(socket, renderStats(session.player));
        writeLine(socket, renderRoom(session.player));
        roomBroadcast(session.player.roomId, `${session.player.name} enters the area.`, session.player.id);
        prompt(socket);
      }
    }
  });

  function cleanup() {
    if (session.player) {
      persistPlayer(session.player);
      clearFollowTarget(worldState, session.player.id);
      leaveParty(worldState, session.player.id);
      removePlayerFromRoom(worldState, session.player.id, session.player.roomId);
      roomBroadcast(session.player.roomId, `${session.player.name} has disconnected.`, session.player.id);
      unregisterSession(worldState, session.player.id);
      worldState.players.delete(session.player.id);
    }
  }
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

server.listen(config.port, config.host, () => {
  console.log(`Muddy loot server listening on ${config.host}:${config.port}`);
});
