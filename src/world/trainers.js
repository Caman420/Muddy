function ensureTrainerState(player) {
  if (!player.training) {
    player.training = {
      sessions: 0,
    };
  }
}

const trainers = {
  'training-master': {
    id: 'training-master',
    name: 'Training Master',
    roomId: 'courtyard',
    menu: [
      { key: 'offense', label: 'Offense Drill', stat: 'offense', cost: 20, gain: 1 },
      { key: 'strength', label: 'Power Lift', stat: 'strength', cost: 20, gain: 1 },
    ],
  },
  'tech-trainer': {
    id: 'tech-trainer',
    name: 'Tech Trainer',
    roomId: 'scouter-lab',
    menu: [
      { key: 'ki', label: 'Ki Compression', stat: 'ki', cost: 25, gain: 1 },
      { key: 'defense', label: 'Guard Routine', stat: 'defense', cost: 20, gain: 1 },
    ],
  },
};

function getTrainer(id) {
  return trainers[String(id || '').trim().toLowerCase()] || null;
}

function listTrainersInRoom(roomId) {
  return Object.values(trainers).filter((trainer) => trainer.roomId === roomId);
}

function renderTrainerMenu(roomId) {
  const found = listTrainersInRoom(roomId);
  if (!found.length) return 'There are no trainers here.';
  return found
    .map((trainer) => {
      const lines = trainer.menu.map((entry) => `${entry.key} - ${entry.cost} zeni (+${entry.gain} ${entry.stat})`);
      return `${trainer.name}\r\n${lines.join('\r\n')}`;
    })
    .join('\r\n\r\n');
}

function trainStat(player, roomId, key) {
  ensureTrainerState(player);
  const trainersHere = listTrainersInRoom(roomId);
  for (const trainer of trainersHere) {
    const entry = trainer.menu.find((item) => item.key === String(key || '').trim().toLowerCase());
    if (!entry) continue;
    if ((player.zeni || 0) < entry.cost) {
      return { ok: false, reason: 'Not enough zeni for that training.' };
    }
    player.zeni -= entry.cost;
    if (typeof player.stats[entry.stat] === 'number') {
      player.stats[entry.stat] += entry.gain;
    }
    player.training.sessions += 1;
    return { ok: true, trainer, entry };
  }
  return { ok: false, reason: 'That training option is not available here.' };
}

module.exports = {
  ensureTrainerState,
  trainers,
  getTrainer,
  listTrainersInRoom,
  renderTrainerMenu,
  trainStat,
};
