const enemies = {
  saibaman: {
    id: 'saibaman',
    name: 'Saibaman',
    hp: 45,
    maxHp: 45,
    kiPool: 10,
    maxKiPool: 10,
    powerLevel: 4,
    offense: 4,
    defense: 3,
    speed: 4,
    expReward: 8,
  },
  bandit: {
    id: 'bandit',
    name: 'Desert Bandit',
    hp: 55,
    maxHp: 55,
    kiPool: 5,
    maxKiPool: 5,
    powerLevel: 5,
    offense: 5,
    defense: 4,
    speed: 4,
    expReward: 10,
  },
};

const roomSpawns = {
  courtyard: 'bandit',
  'scouter-lab': 'saibaman',
};

function cloneEnemy(enemyId) {
  const template = enemies[enemyId];
  if (!template) return null;
  return {
    ...template,
    currentHp: template.hp,
    currentKi: template.kiPool,
  };
}

module.exports = {
  enemies,
  roomSpawns,
  cloneEnemy,
};
