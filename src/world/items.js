const items = {
  'small-senzu-fragment': {
    id: 'small-senzu-fragment',
    name: 'Small Senzu Fragment',
    kind: 'consumable',
    description: 'A tiny restorative bean fragment that heals a modest amount of HP.',
    heal: 25,
  },
  'ki-capsule': {
    id: 'ki-capsule',
    name: 'Ki Capsule',
    kind: 'consumable',
    description: 'A compact energy capsule that restores ki.',
    kiRestore: 20,
  },
  'scouter-lens': {
    id: 'scouter-lens',
    name: 'Scouter Lens',
    kind: 'vendor',
    description: 'A salvaged scouter lens. It may be valuable later.',
    value: 15,
  },
  'bandit-cloth': {
    id: 'bandit-cloth',
    name: 'Bandit Cloth',
    kind: 'vendor',
    description: 'A scrap of desert bandit cloth.',
    value: 8,
  }
};

const lootTables = {
  saibaman: [
    { itemId: 'small-senzu-fragment', chance: 0.5 },
    { itemId: 'scouter-lens', chance: 0.25 }
  ],
  bandit: [
    { itemId: 'bandit-cloth', chance: 0.6 },
    { itemId: 'ki-capsule', chance: 0.3 }
  ]
};

function getItem(itemId) {
  return items[itemId] || null;
}

module.exports = {
  items,
  lootTables,
  getItem,
};
