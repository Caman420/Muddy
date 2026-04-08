const { lootTables, getItem } = require('./items');

function ensureInventory(player) {
  if (!player.inventory) player.inventory = [];
}

function addItemToInventory(player, itemId, qty = 1) {
  ensureInventory(player);
  const existing = player.inventory.find((entry) => entry.itemId === itemId);
  if (existing) existing.qty += qty;
  else player.inventory.push({ itemId, qty });
}

function renderInventory(player) {
  ensureInventory(player);
  if (!player.inventory.length) return 'Inventory: empty';
  return player.inventory.map((entry) => {
    const item = getItem(entry.itemId);
    return `${item ? item.name : entry.itemId} x${entry.qty}`;
  }).join('\r\n');
}

function rollLoot(enemyId) {
  const table = lootTables[enemyId] || [];
  const drops = [];
  for (const entry of table) {
    if (Math.random() <= entry.chance) drops.push(entry.itemId);
  }
  return drops;
}

function useItem(player, itemId) {
  ensureInventory(player);
  const slot = player.inventory.find((entry) => entry.itemId === itemId && entry.qty > 0);
  if (!slot) return { ok: false, reason: 'You do not have that item.' };
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  if (item.kind !== 'consumable') return { ok: false, reason: 'That item is not usable.' };

  slot.qty -= 1;
  if (slot.qty <= 0) {
    player.inventory = player.inventory.filter((entry) => entry !== slot);
  }

  if (item.heal) {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + item.heal);
    return { ok: true, text: `${item.name} restores ${player.hp - before} HP.` };
  }

  if (item.kiRestore) {
    const before = player.kiPool;
    player.kiPool = Math.min(player.maxKiPool, player.kiPool + item.kiRestore);
    return { ok: true, text: `${item.name} restores ${player.kiPool - before} ki.` };
  }

  return { ok: false, reason: 'That item has no effect.' };
}

module.exports = {
  ensureInventory,
  addItemToInventory,
  renderInventory,
  rollLoot,
  useItem,
};
