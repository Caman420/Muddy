const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function patchPackageJson(root) {
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(read(file));
  pkg.description = 'Unified DBZ-style MUD server';
  pkg.main = 'server.js';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.start = 'node server.js';
  pkg.scripts.dev = 'node --watch server.js';
  write(file, JSON.stringify(pkg, null, 2) + '\n');
  return 'patched package.json';
}

function insertOnce(content, marker, insertion, where = 'before') {
  if (content.includes(insertion.trim())) return content;
  const idx = content.indexOf(marker);
  if (idx === -1) throw new Error(`Marker not found: ${marker}`);
  if (where === 'before') {
    return content.slice(0, idx) + insertion + content.slice(idx);
  }
  return content.slice(0, idx + marker.length) + insertion + content.slice(idx + marker.length);
}

function patchServer(root) {
  const file = path.join(root, 'server.js');
  let content = read(file);

  const questImport = "const { ensureQuestState, listAvailableQuests, acceptQuest, recordQuestKill, turnInQuest, renderQuestLog } = require('./src/world/quests');\n";
  const trainerImport = "const { ensureTrainerState, renderTrainerMenu, trainStat } = require('./src/world/trainers');\n";
  content = insertOnce(content, "const { ensureProgression, applyRacePerk, grantLevelSkillPoint, learnTechnique, renderProgression } = require('./src/world/progression');\n", questImport + trainerImport, 'after');

  content = content.replace(
    /ensureProgression\(player\);\n\s+persistedPlayers\[player\.name\] = \{/,
    "ensureProgression(player);\n  ensureQuestState(player);\n  ensureTrainerState(player);\n  persistedPlayers[player.name] = {"
  );

  content = content.replace(
    /racePerkApplied: !!player\.racePerkApplied,\n\s+};/,
    "racePerkApplied: !!player.racePerkApplied,\n    quests: player.quests || { active: [], completed: [] },\n    training: player.training || { sessions: 0 },\n  };"
  );

  content = content.replace(
    /ensureProgression\(p\);\n\s+applyRacePerk\(p\);\n\s+return p;/,
    "ensureProgression(p);\n  ensureQuestState(p);\n  ensureTrainerState(p);\n  applyRacePerk(p);\n  return p;"
  );

  content = content.replace(
    /ensureProgression\(p\);\n\s+applyRacePerk\(p\);\n\s+return p;/,
    "ensureProgression(p);\n  ensureQuestState(p);\n  ensureTrainerState(p);\n  applyRacePerk(p);\n  return p;"
  );

  const helperBlock = `
function handleQuestTurnIn(player, questId) {
  const result = turnInQuest(player, questId);
  if (!result.ok) return result.reason;
  const reward = result.quest.rewards || {};
  const expText = reward.exp ? grantExp(player, reward.exp) : '';
  player.zeni = (player.zeni || 0) + (reward.zeni || 0);
  persistPlayer(player);
  return \`${result.quest.name} completed. Rewards: ${reward.exp || 0} EXP, ${reward.zeni || 0} zeni.${expText}\`;
}

function handleQuestList(player) {
  return renderQuestLog(player);
}

function handleQuestAccept(player, questId) {
  const result = acceptQuest(player, questId);
  if (!result.ok) return result.reason;
  persistPlayer(player);
  return \`Quest accepted: ${result.quest.name}\`;
}

function handleQuestBoard() {
  return listAvailableQuests()
    .map((quest) => \`${quest.id} - ${quest.name}: ${quest.description}\`)
    .join('\\r\\n');
}

function handleTrainers(player) {
  return renderTrainerMenu(player.roomId);
}

function handleTrain(player, key) {
  const result = trainStat(player, player.roomId, key);
  if (!result.ok) return result.reason;
  persistPlayer(player);
  return \`${result.trainer.name} puts you through ${result.entry.label}. +${result.entry.gain} ${result.entry.stat}\`;
}
`;
  content = insertOnce(content, 'function handleGameCommand(player, line) {', helperBlock, 'before');

  content = content.replace(
    /lines\.push\(awardLoot\(player, enemy\.id\)\);/,
    "const completedNow = recordQuestKill(player, enemy.id);\n    if (completedNow.length) {\n      lines.push(`Quest objectives complete: ${completedNow.join(', ')}`);\n    }\n    lines.push(awardLoot(player, enemy.id));"
  );

  content = content.replace(
    /case 'help': return '([^']*)';/,
    "case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv, equip <item>, unequip <slot>, gear, shop, buy <item>, sell <item>, use <item>, progress, learn <technique>, quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';"
  );

  content = content.replace(
    /case 'progress':\n    case 'skills': return handleProgress\(player\);/,
    "case 'progress':\n    case 'skills': return handleProgress(player);\n    case 'quests': return handleQuestList(player);\n    case 'questboard': return handleQuestBoard();\n    case 'quest': {\n      const action = String(subcmd || '').toLowerCase();\n      const arg = restWords.join(' ');\n      if (action === 'accept') return handleQuestAccept(player, arg);\n      if (action === 'turnin' || action === 'turn-in') return handleQuestTurnIn(player, arg);\n      return 'Use: quest accept <id> | quest turnin <id>';\n    }\n    case 'trainers': return handleTrainers(player);\n    case 'train': return handleTrain(player, rest);"
  );

  write(file, content);
  return 'patched server.js';
}

function main() {
  const root = path.resolve(__dirname, '..');
  const results = [];
  results.push(patchPackageJson(root));
  results.push(patchServer(root));
  console.log(results.join('\n'));
}

main();
