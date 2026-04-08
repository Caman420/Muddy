import { createNpcFromTemplate, type ActiveNpc, type NpcTemplate } from "./combat.js";
import type { Direction } from "./commands.js";

export const GAME_NAME = "Muddy";
export const STARTING_ROOM_ID = "earth-training-grounds";
export const STARTING_ROOM_NAME = "Earth Training Grounds";

export type RoomId =
  | "earth-training-grounds"
  | "open-plains"
  | "tournament-approach"
  | "gravity-chamber";

export type Room = {
  id: RoomId;
  name: string;
  description: string;
  exits: Partial<Record<Direction, RoomId>>;
  npcTemplates: NpcTemplate[];
};

const WORLD_MAP: Record<RoomId, Room> = {
  "earth-training-grounds": {
    id: "earth-training-grounds",
    name: "Earth Training Grounds",
    description:
      "A wide circle of packed earth marked by old sparring scars. The air hums with discipline and rising power levels.",
    exits: {
      east: "open-plains",
      south: "gravity-chamber"
    },
    npcTemplates: [
      {
        id: "trainee",
        name: "Trainee",
        description: "A focused young fighter working through basic forms and reaction drills.",
        maxHitPoints: 60,
        maxStamina: 50,
        maxKi: 120,
        strength: 9,
        blastPower: 14,
        speed: 45
      }
    ]
  },
  "open-plains": {
    id: "open-plains",
    name: "Open Plains",
    description:
      "Rolling grassland stretches toward the horizon. It is ideal for dash drills, pursuit work, and explosive beam testing.",
    exits: {
      west: "earth-training-grounds",
      north: "tournament-approach"
    },
    npcTemplates: [
      {
        id: "wild-fighter",
        name: "Wild Fighter",
        description: "A rough brawler testing raw power with little discipline but lots of aggression.",
        maxHitPoints: 85,
        maxStamina: 70,
        maxKi: 150,
        strength: 14,
        blastPower: 18,
        speed: 70
      }
    ]
  },
  "tournament-approach": {
    id: "tournament-approach",
    name: "Tournament Approach",
    description:
      "Stone steps and banners line the road toward the arena. Fighters pass through here sizing each other up before matches.",
    exits: {
      south: "open-plains"
    },
    npcTemplates: [
      {
        id: "arena-scout",
        name: "Arena Scout",
        description: "A sharp-eyed tournament scout who studies power levels and punishes sloppy openings.",
        maxHitPoints: 95,
        maxStamina: 80,
        maxKi: 180,
        strength: 15,
        blastPower: 22,
        speed: 95
      }
    ]
  },
  "gravity-chamber": {
    id: "gravity-chamber",
    name: "Gravity Chamber",
    description:
      "The chamber walls groan under adjustable gravity. Every movement here feels heavier, slower, and far more productive.",
    exits: {
      north: "earth-training-grounds"
    },
    npcTemplates: [
      {
        id: "gravity-drone",
        name: "Gravity Drone",
        description: "A training drone built to strike cleanly and force disciplined movement under pressure.",
        maxHitPoints: 110,
        maxStamina: 90,
        maxKi: 200,
        strength: 18,
        blastPower: 24,
        speed: 120
      }
    ]
  }
};

export function getRoom(roomId: RoomId): Room {
  return WORLD_MAP[roomId];
}

export function getStartingRoom(): Room {
  return getRoom(STARTING_ROOM_ID);
}

export function formatExits(room: Room): string {
  const exits = Object.keys(room.exits);
  return exits.length > 0 ? exits.join(", ") : "none";
}

export function describeRoom(roomId: RoomId): string[] {
  const room = getRoom(roomId);
  const enemies = spawnRoomNpcs(roomId).map((npc) => npc.name).join(", ");

  return [
    room.name,
    room.description,
    `Exits: ${formatExits(room)}`,
    `Enemies: ${enemies || "none"}`
  ];
}

export function spawnRoomNpcs(roomId: RoomId): ActiveNpc[] {
  return getRoom(roomId).npcTemplates.map((template) => createNpcFromTemplate(template));
}

export function moveRoom(currentRoomId: RoomId, direction: Direction): {
  ok: true;
  room: Room;
} | {
  ok: false;
  message: string;
} {
  const currentRoom = getRoom(currentRoomId);
  const nextRoomId = currentRoom.exits[direction];

  if (!nextRoomId) {
    return {
      ok: false,
      message: `You cannot go ${direction} from here.`
    };
  }

  return {
    ok: true,
    room: getRoom(nextRoomId)
  };
}
