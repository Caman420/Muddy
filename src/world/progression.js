const racePerks = {
  human: {
    description: 'Balanced growth and disciplined recovery.',
    statBonuses: { offense: 1 },
    unlocks: ['focus-burst'],
  },
  saiyan: {
    description: 'Aggressive fighters who scale well in battle.',
    statBonuses: { strength: 1, powerLevel: 1 },
    unlocks: ['rage-spike'],
  },
  namekian: {
    description: 'Durable warriors with strong ki control.',
    statBonuses: { defense: 1, ki: 1 },
    unlocks: ['regen-stance'],
  },
  android: {
    description: 'Efficient combatants with reliable energy output.',
    statBonuses: { endurance: 1, offense: 1 },
    unlocks: ['overclock'],
  },
};

const advancedTechniques = {
  'focus-burst': {
    id: 'focus-burst',
    name: 'Focus Burst',
    requiredLevel: 3,
    description: 'A focused strike that sharpens offense.',
  },
  'rage-spike': {
    id: 'rage-spike',
    name: 'Rage Spike',
    requiredLevel: 3,
    description: 'Saiyan fury amplifies damage output.',
  },
  'regen-stance': {
    id: 'regen-stance',
    name: 'Regen Stance',
    requiredLevel: 3,
    description: 'A Namekian recovery stance that restores health.',
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    requiredLevel: 3,
    description: 'Android systems surge for better attacks.',
  },
};

function ensureProgression(player) {
  if (!player.learnedTechniques) player.learnedTechniques = [];
  if (!player.skillPoints) player.skillPoints = 0;
}

function getRacePerk(race) {
  return racePerks[String(race || '').trim().toLowerCase()] || null;
}

function applyRacePerk(player) {
  ensureProgression(player);
  const perk = getRacePerk(player.race);
  if (!perk) return;
  if (player.racePerkApplied) return;
  for (const [key, value] of Object.entries(perk.statBonuses || {})) {
    if (typeof player.stats[key] === 'number') player.stats[key] += value;
  }
  player.racePerkApplied = true;
}

function grantLevelSkillPoint(player) {
  ensureProgression(player);
  player.skillPoints += 1;
}

function getAvailableUnlocks(player) {
  ensureProgression(player);
  const perk = getRacePerk(player.race);
  if (!perk) return [];
  return (perk.unlocks || [])
    .map((id) => advancedTechniques[id])
    .filter(Boolean)
    .filter((tech) => (player.level || 1) >= tech.requiredLevel)
    .filter((tech) => !player.learnedTechniques.includes(tech.id));
}

function learnTechnique(player, techniqueId) {
  ensureProgression(player);
  const available = getAvailableUnlocks(player);
  const tech = available.find((entry) => entry.id === String(techniqueId || '').trim().toLowerCase());
  if (!tech) {
    return { ok: false, reason: 'That technique is not available.' };
  }
  if (player.skillPoints <= 0) {
    return { ok: false, reason: 'You do not have a skill point to spend.' };
  }
  player.skillPoints -= 1;
  player.learnedTechniques.push(tech.id);
  return { ok: true, technique: tech };
}

function renderProgression(player) {
  ensureProgression(player);
  const perk = getRacePerk(player.race);
  const learned = player.learnedTechniques.length ? player.learnedTechniques.join(', ') : 'none';
  const available = getAvailableUnlocks(player).map((tech) => tech.name).join(', ') || 'none';
  return [
    `Race perk: ${perk ? perk.description : 'none'}`,
    `Skill points: ${player.skillPoints}`,
    `Learned techniques: ${learned}`,
    `Available unlocks: ${available}`,
  ].join('\r\n');
}

module.exports = {
  ensureProgression,
  getRacePerk,
  applyRacePerk,
  grantLevelSkillPoint,
  getAvailableUnlocks,
  learnTechnique,
  renderProgression,
  advancedTechniques,
};
