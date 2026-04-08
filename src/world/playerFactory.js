function createStarterStats(race = 'human') {
  const normalizedRace = String(race || 'human').trim().toLowerCase();

  const templates = {
    human: {
      powerLevel: 5,
      strength: 5,
      endurance: 5,
      speed: 5,
      ki: 5,
      offense: 5,
      defense: 5,
    },
    saiyan: {
      powerLevel: 6,
      strength: 6,
      endurance: 5,
      speed: 5,
      ki: 4,
      offense: 6,
      defense: 4,
    },
    namekian: {
      powerLevel: 5,
      strength: 4,
      endurance: 6,
      speed: 4,
      ki: 6,
      offense: 4,
      defense: 6,
    },
    android: {
      powerLevel: 6,
      strength: 5,
      endurance: 6,
      speed: 4,
      ki: 3,
      offense: 5,
      defense: 6,
    },
  };

  return templates[normalizedRace] || templates.human;
}

function createPlayerProfile({ id, name, race }) {
  const stats = createStarterStats(race);

  return {
    id,
    name,
    race: (race || 'human').toLowerCase(),
    roomId: 'start',
    socket: null,
    buffer: '',
    sessionState: 'playing',
    hp: 100,
    maxHp: 100,
    kiPool: 50,
    maxKiPool: 50,
    stats,
  };
}

module.exports = {
  createStarterStats,
  createPlayerProfile,
};
