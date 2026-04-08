const net = require('net');
const config = require('./src/config');
const starterRooms = require('./src/world/rooms');
const worldState = require('./src/world/state');
const { createStarterStats } = require('./src/world/playerFactory');
const { loadPlayers, savePlayers } = require('./src/world/storage');
const { getTechnique } = require('./src/world/techniques');
const { ensureCombatState, canUseTechnique, setTechniqueCooldown, computeDamage, spendTechniqueCost } = require('./src/world/combat');
const { ensureRealtimeState, registerSession, unregisterSession } = require('./src/world/realtime');
const { ensureRoomRuntime, addPlayerToRoom, removePlayerFromRoom, movePlayerRoom, getRoomPlayerIds, broadcastToRoom } = require('./src/world/roomsRuntime');
const { ensureSpawnState, getEnemiesForRoom, findEnemyInRoom, removeDefeatedEnemies, scheduleRoomRespawn } = require('./src/world/spawns');
const { findPlayerInRoom, canAttackPlayer, handlePlayerDefeat } = require('./src/world/pvp');
const { ensurePartyState, findPartyByMember, inviteToParty, acceptPartyInvite, leaveParty, disbandParty, listPartyMembers, areGrouped } = require('./src/world/parties');

for (const room of starterRooms) worldState.rooms.set(room.id, room);
ensureRealtimeState(worldState);
ensureRoomRuntime(worldState);
ensureSpawnState(worldState);
ensurePartyState(worldState);
const persistedPlayers = loadPlayers();

function prompt(socket, text = '> ') { if (!socket.destroyed) socket.write(text); }
function writeLine(socket, text = '') { if (!socket.destroyed) socket.write(`${text}\r\n`); }

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
    cooldowns: player.cooldowns || {},
    pvpEnabled: player.pvpEnabled !== false,
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
    socket: null,
    buffer: '',
  };
  ensureCombatState(player);
  return player;
}

function attachPlayer(profile, socket) {
  const player = { ...profile, socket, buffer: '', cooldowns: profile.cooldowns || {}, pvpEnabled: profile.pvpEnabled !== false };
  ensureCombatState(player);
  return player;
}

function otherPlayersText(viewer) {
  const others = getRoomPlayerIds(worldState, viewer.roomId)
    .map((id) => worldState.players.get(id))
    .filter((p) => p && p.id !== viewer.id)
    .map((p) => {
      const grouped = areGrouped(worldState, viewer.id, p.id);
      return `${p.name}${p.pvpEnabled ? '' : ' [safe]'}${grouped ? ' [party]' : ''}`;
    });
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

function roomBroadcast(roomId, message, excludePlayerId = null) {
  broadcastToRoom(worldState, roomId, worldState.players, writeLine, message, excludePlayerId);
}

function movePlayer(player, direction) {
  const room = worldState.rooms.get(player.roomId);
  if (!room.exits[direction]) return `You cannot go ${direction}.`;
  const fromRoom = player.roomId;
  const toRoom = room.exits[direction];
  movePlayerRoom(worldState, player, fromRoom, toRoom);
  player.roomId = toRoom;
  persistPlayer(player);
  roomBroadcast(fromRoom, `${player.name} leaves ${direction}.`, player.id);
  roomBroadcast(toRoom, `${player.name} arrives.`, player.id);
  return renderRoom(player);
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
  let text = `You ${technique.verb} ${enemy.name} for ${damage} damage.`;
  roomBroadcast(player.roomId, `${player.name} ${technique.verb} ${enemy.name} for ${damage} damage.`, player.id);
  if (enemy.hp <= 0) {
    const reward = enemy.expReward || 5;
    const levelText = grantExp(player, reward);
    text += `\r\n${enemy.name} is defeated. You gain ${reward} EXP.${levelText}`;
    roomBroadcast(player.roomId, `${enemy.name} is defeated by ${player.name}.`, player.id);
    removeDefeatedEnemies(worldState, player.roomId);
    if (getEnemiesForRoom(worldState, player.roomId).length === 0) scheduleRoomRespawn(worldState, player.roomId, 15000);
  }
  persistPlayer(player);
  return text;
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
    const levelText = grantExp(player, 0);
    movePlayerRoom(worldState, target, player.roomId, 'start');
    text += `\r\n${result.message} You gain ${result.reward} EXP.${levelText}`;
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
  const players = getRoomPlayerIds(worldState, player.roomId)
    .map((id) => worldState.players.get(id))
    .filter((p) => p && p.id !== player.id)
    .map((p) => `${p.name} | PL ${p.stats.powerLevel} | HP ${p.hp}/${p.maxHp} | PvP ${p.pvpEnabled ? 'on' : 'off'}${areGrouped(worldState, player.id, p.id) ? ' | PARTY' : ''}`);
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
    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, pvp [on|off], party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';
    case 'look': return renderRoom(player);
    case 'stats': return renderStats(player);
    case 'who': return handleWho();
    case 'scan':
    case 'pl': return handleScan(player);
    case 'pvp': return handlePvpToggle(player, rest);
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
  writeLine(socket, `${config.motd} [party build]`);
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
        if (persistedPlayers[name]) {
          session.player = attachPlayer(persistedPlayers[name], socket);
        } else {
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
  console.log(`Muddy party server listening on ${config.host}:${config.port}`);
});
