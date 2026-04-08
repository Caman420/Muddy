const starterRooms = [
  {
    id: 'start',
    name: 'Training Grounds',
    description: 'Packed earth, old sparring posts, and scuffed stones mark a place where beginners learn to fight.',
    exits: {
      north: 'courtyard',
      east: 'scouter-lab',
    },
  },
  {
    id: 'courtyard',
    name: 'Central Courtyard',
    description: 'A broad open space surrounded by weathered walls. Fighters stretch here before drills.',
    exits: {
      south: 'start',
      east: 'meditation-hall',
    },
  },
  {
    id: 'scouter-lab',
    name: 'Scouter Lab',
    description: 'Tables of cracked lenses and humming devices line the walls. Prototype scouters flicker in standby.',
    exits: {
      west: 'start',
    },
  },
  {
    id: 'meditation-hall',
    name: 'Meditation Hall',
    description: 'The room is still and quiet, built for focus, ki control, and recovery.',
    exits: {
      west: 'courtyard',
    },
  },
];

module.exports = starterRooms;
