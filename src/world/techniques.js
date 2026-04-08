const techniques = {
  punch: {
    id: 'punch',
    name: 'Punch',
    kind: 'melee',
    kiCost: 0,
    cooldownMs: 1200,
    baseDamage: 6,
    stat: 'strength',
    verb: 'drives a punch into',
  },
  kick: {
    id: 'kick',
    name: 'Kick',
    kind: 'melee',
    kiCost: 0,
    cooldownMs: 1400,
    baseDamage: 7,
    stat: 'speed',
    verb: 'snaps a kick into',
  },
  blast: {
    id: 'blast',
    name: 'Ki Blast',
    kind: 'ki',
    kiCost: 8,
    cooldownMs: 2200,
    baseDamage: 11,
    stat: 'ki',
    verb: 'fires a ki blast at',
  },
  beam: {
    id: 'beam',
    name: 'Energy Beam',
    kind: 'ki',
    kiCost: 16,
    cooldownMs: 4200,
    baseDamage: 20,
    stat: 'ki',
    verb: 'unleashes an energy beam at',
  },
};

function getTechnique(id) {
  return techniques[String(id || '').trim().toLowerCase()] || null;
}

module.exports = {
  techniques,
  getTechnique,
};
