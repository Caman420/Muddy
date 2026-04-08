const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function insertOnce(content, marker, insertion, where = 'before') {
  if (content.includes(insertion.trim())) return content;
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error('Marker not found: ' + marker);
  if (where === 'before') return content.slice(0, idx) + insertion + content.slice(idx);
  return content.slice(0, idx + marker.length) + insertion + content.slice(idx + marker.length);
}

function patchServer(root) {
  const file = path.join(root, 'server.js');
  let content = read(file);

  const helperBlock = [
    '',
    'function handleAdminShutdown(player, secret) {',
    "  const expected = process.env.MUDDY_ADMIN_SHUTDOWN_KEY || '';",
    "  const provided = String(secret || '').trim();",
    "  if (!expected) return 'Shutdown key is not configured on the server.';",
    "  if (!provided) return 'Usage: admin shutdown <key>';",
    "  if (provided !== expected) return 'Invalid shutdown key.';",
    "  for (const livePlayer of worldState.players.values()) {",
    '    try {',
    '      persistPlayer(livePlayer);',
    '      if (livePlayer.socket && !livePlayer.socket.destroyed) {',
    "        writeLine(livePlayer.socket, 'Server shutdown initiated by admin.');",
    "        livePlayer.socket.end('Server is shutting down. Goodbye.\\r\\n');",
    '      }',
    '    } catch (error) {',
    "      console.error('Shutdown save error for player', livePlayer?.name, error);",
    '    }',
    '  }',
    "  setTimeout(() => process.exit(0), 250);",
    "  return 'Admin shutdown accepted. Server is stopping.';",
    '}',
    ''
  ].join('\n');

  content = insertOnce(content, 'function handleGameCommand(player, line) {', helperBlock, 'before');

  content = content.replace(
    "    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv, equip <item>, unequip <slot>, gear, shop, buy <item>, sell <item>, use <item>, progress, learn <technique>, quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';",
    "    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv, equip <item>, unequip <slot>, gear, shop, buy <item>, sell <item>, use <item>, progress, learn <technique>, quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit, admin shutdown <key>';"
  );

  const adminCase = [
    "    case 'admin': {",
    "      const action = String(subcmd || '').toLowerCase();",
    "      const arg = restWords.join(' ');",
    "      if (action === 'shutdown') return handleAdminShutdown(player, arg);",
    "      return 'Use: admin shutdown <key>';",
    '    }'
  ].join('\n');

  content = content.replace(
    "    case 'party': {",
    adminCase + "\n    case 'party': {"
  );

  write(file, content);
  return 'patched server.js';
}

function main() {
  const root = path.resolve(__dirname, '..');
  console.log(patchServer(root));
}

main();
