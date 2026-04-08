const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function patchServer(root) {
  const file = path.join(root, 'server.js');
  let content = read(file);

  if (!content.includes('function resolveItemData(')) {
    const marker = "function getItemRuntime(id) { return runtimeItems[id] || originalGetItem(id); }\n";
    const insertion = "\nfunction resolveItemData(id) {\n  return getItemRuntime(id);\n}\n\nfunction resolveEquipableItem(player, itemText) {\n  const key = normalizeKey(itemText);\n  if (!key) return null;\n  ensureInventory(player);\n  const has = (player.inventory || []).some((entry) => entry.itemId === key && entry.qty > 0);\n  if (!has) return null;\n  const item = resolveItemData(key);\n  if (!item) return null;\n  return { key, item };\n}\n";
    content = content.replace(marker, marker + insertion);
  }

  content = content.replace(
    "  const result = equipItem(player, key);\n  if (!result.ok) return result.reason;",
    "  const resolved = resolveEquipableItem(player, itemText);\n  if (!resolved) return 'You do not have that item.';\n  const item = resolved.item;\n  if (item.kind !== 'equipment') return 'That item cannot be equipped.';\n  const slotName = item.slot;\n  if (!slotName) return 'This item has no slot.';\n  const previous = player.equipment[slotName] || null;\n  player.equipment[slotName] = resolved.key;\n  const result = { ok: true, item, slot: slotName, previous };"
  );

  content = content.replace(
    "    lines.push('Quest objectives complete: ' + completedNow.join(', '));",
    "    const newlyCompleted = completedNow.filter((id) => !player.quests.completed.includes(id));\n      if (newlyCompleted.length) lines.push('Quest objectives complete: ' + newlyCompleted.join(', '));"
  );

  content = content.replaceAll('You drives a punch into', 'You drive a punch into');
  content = content.replaceAll('You fires a ki blast at', 'You fire a ki blast at');
  content = content.replaceAll('You unleashes an energy beam at', 'You unleash an energy beam at');
  content = content.replaceAll('You snaps a kick into', 'You snap a kick into');

  content = content.replace(
    "  if (normalized.startsWith('say ')) return handleSay(player, input);",
    "  if (normalized.startsWith('say ')) return handleSay(player, input);\n  if (normalized === 'eq') return handleEquipment(player);\n  if (normalized === 'i' || normalized === 'in') return handleInventory(player);\n  if (normalized.startsWith('wear ')) return handleEquip(player, input.slice(5));"
  );

  content = content.replace(
    "    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv, equip <item>, unequip <slot>, gear, shop, buy <item>, sell <item>, use <item>, progress, learn <technique>, quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';",
    "    case 'help': return 'Commands: help, look, stats, who, say <msg>, scan, inv/i/in, equip <item>, wear <item>, eq, unequip <slot>, gear, shop, buy <item>, sell <item>, use <item>, progress, learn <technique>, quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>, pvp [on|off], follow <party member>, unfollow, party invite <name>, party accept <name>, party leave, party disband, party list, punch <target>, kick <target>, blast <target>, beam <target>, north/south/east/west, charge, meditate, quit';"
  );

  content = content.replace(
    "      return 'Use: quest accept <id> | quest turnin <id>';",
    "      return 'Use: quest accept <id> | quest turnin <id>';"
  );

  write(file, content);
  return 'patched server.js';
}

function main() {
  const root = path.resolve(__dirname, '..');
  console.log(patchServer(root));
}

main();
