const worldState = {
  rooms: new Map([
    ['start', {
      id: 'start',
      name: 'Training Grounds',
      description: 'A simple starting room for testing connections and commands.',
      exits: {},
    }],
  ]),
  players: new Map(),
};

module.exports = worldState;
