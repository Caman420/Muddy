import {
  GAME_NAME,
  describeRoom,
  formatPowerLevel,
  parseCommand,
  spawnRoomNpcs,
  STARTING_ROOM_ID,
  type CharacterVitals
} from "@muddy/shared";

const starterVitals: CharacterVitals = {
  hitPoints: { current: 100, max: 100 },
  stamina: { current: 100, max: 100 },
  ki: { current: 500, max: 500 }
};

console.log(`${GAME_NAME} client bootstrap`);
console.log(`Spawn room: ${describeRoom(STARTING_ROOM_ID)[0]}`);
console.log(`Starting power level: ${formatPowerLevel(starterVitals.ki.current)}`);
console.log(`Command parser demo: ${parseCommand("move east").type}`);
console.log(`Enemies in starting room: ${spawnRoomNpcs(STARTING_ROOM_ID).map((npc) => npc.name).join(", ")}`);
