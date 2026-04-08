const { getItem } = require('./items');

function ensureEquipment(player) {
  if (!player.equipment) {
    player.equipment = {
      scouter: null,
      armor: null,
      accessory: null,
    };
  }
}

function getEquipmentSlots() {
  return ['scouter', 'armor', 'accessory'];
}

function equipItem(player, itemId) {
  ensureEquipment(player);
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: 'Unknown item.' };
  if (item.kind !== 'equipment') return { ok: false, reason: 'That item cannot be equipped.' };
  const slot = item.slot;
  if (!slot) return { ok: false, reason: 'This item has no slot.' };
  const previous = player.equipment[slot] || null;
  player.equipment[slot] = itemId;
  return { ok: true, slot, previous, item };
}

function unequipItem(player, slot) {
  ensureEquipment(player);
  const normalized = String(slot || '').trim().toLowerCase();
  if (!getEquipmentSlots().includes(normalized)) {
    return { ok: false, reason: 'Invalid slot.' };
  }
  const previous = player.equipment[normalized];
  if (!previous) return { ok: false, reason: 'Nothing equipped there.' };
  player.equipment[normalized] = null;
  return { ok: true, itemId: previous, slot: normalized };
}

function getEquipmentBonuses(player) {
  ensureEquipment(player);
  const totals = {
    powerLevel: 0,
    strength: 0,
    endurance: 0,
    speed: 0,
    ki: 0,
    offense: 0,
    defense: 0,
  };

  for (const slot of getEquipmentSlots()) {
    const itemId = player.equipment[slot];
    if (!itemId) continue;
    const item = getItem(itemId);
    if (!item || !item.bonuses) continue;
    for (const [key, value] of Object.entries(item.bonuses)) {
      if (typeof totals[key] === 'number') totals[key] += value;
    }
  }

  return totals;
}

function renderEquipment(player) {
  ensureEquipment(player);
  return getEquipmentSlots()
    .map((slot) => {
      const itemId = player.equipment[slot];
      const item = itemId ? getItem(itemId) : null;
      return `${slot}: ${item ? item.name : 'empty'}`;
    })
    .join('\r\n');
}

const vendorStock = [
  { itemId: 'basic-scouter', price: 30 },
  { itemId: 'training-weights', price: 25 },
  { itemId: 'guard-wraps', price: 20 },
  { itemId: 'small-senzu-fragment', price: 12 },
  { itemId: 'ki-capsule', price: 15 },
];

function renderVendorStock() {
  return vendorStock
    .map((entry) => {
      const item = getItem(entry.itemId);
      return `${item ? item.name : entry.itemId} - ${entry.price} zeni`;
    })
    .join('\r\n');
}

function findVendorEntry(query) {
  const normalized = String(query || '').trim().toLowerCase();
  return vendorStock.find((entry) => {
    const item = getItem(entry.itemId);
    return entry.itemId === normalized || (item && item.name.toLowerCase() === normalized) || (item && item.name.toLowerCase().includes(normalized));
  }) || null;
}

module.exports = {
  ensureEquipment,
  equipItem,
  unequipItem,
  getEquipmentBonuses,
  renderEquipment,
  renderVendorStock,
  findVendorEntry,
};
