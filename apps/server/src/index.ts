import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  ATTACK_COOLDOWN_TICKS,
  type ActiveNpc,
  BLAST_COOLDOWN_TICKS,
  COMBAT_TICK_MS,
  type CombatStats,
  describeBlurTier,
  describeSpeedGap,
  describeSpeedTier,
  formatPowerLevel,
  GAME_NAME,
  getActionWindupTicks,
  getCooldownTickStep,
  getDodgeChance,
  getGuardEffectiveness,
  getHitChanceModifier,
  getInterruptChance,
  GUARD_COOLDOWN_TICKS,
  GUARD_DURATION_TICKS,
  getNpcActionIntervalTicks,
  moveRoom,
  parseCommand,
  type QueuedPlayerAction,
  type RoomId,
  STARTING_ROOM_ID,
  describeRoom,
  spawnRoomNpcs,
  type CharacterVitals,
  type TrainingStats
} from "@muddy/shared";

type TrainingProgress = Record<keyof TrainingStats, number>;

type PlayerSession = {
  name: string;
  currentRoomId: RoomId;
  vitals: CharacterVitals;
  combatStats: CombatStats;
  training: TrainingStats;
  trainingProgress: TrainingProgress;
  guarding: boolean;
  guardTicksRemaining: number;
  queuedAction: QueuedPlayerAction | null;
  queuedActionTicksRemaining: number;
  attackCooldownTicks: number;
  blastCooldownTicks: number;
  guardCooldownTicks: number;
  rooms: Record<RoomId, ActiveNpc[]>;
};

type PersistedPlayerState = {
  name: string;
  currentRoomId: RoomId;
  vitals: CharacterVitals;
  combatStats: CombatStats;
  training: TrainingStats;
  trainingProgress: TrainingProgress;
};

const SAVE_DIRECTORY = resolve(process.cwd(), "apps", "server", "data");
const SAVE_FILE_PATH = resolve(SAVE_DIRECTORY, "player-save.json");

const player: PlayerSession = {
  name: "Kakarot",
  currentRoomId: STARTING_ROOM_ID,
  vitals: {
    hitPoints: { current: 100, max: 100 },
    stamina: { current: 100, max: 100 },
    ki: { current: 500, max: 500 }
  },
  combatStats: {
    speed: 90
  },
  training: {
    strength: 12,
    durability: 10,
    speed: 90,
    kiControl: 14
  },
  trainingProgress: {
    strength: 0,
    durability: 0,
    speed: 0,
    kiControl: 0
  },
  guarding: false,
  guardTicksRemaining: 0,
  queuedAction: null,
  queuedActionTicksRemaining: 0,
  attackCooldownTicks: 0,
  blastCooldownTicks: 0,
  guardCooldownTicks: 0,
  rooms: {
    "earth-training-grounds": spawnRoomNpcs("earth-training-grounds"),
    "open-plains": spawnRoomNpcs("open-plains"),
    "tournament-approach": spawnRoomNpcs("tournament-approach"),
    "gravity-chamber": spawnRoomNpcs("gravity-chamber")
  }
};

let combatTicker: NodeJS.Timeout | undefined;
let dirty = false;

function ensureSaveDirectory(): void {
  mkdirSync(SAVE_DIRECTORY, { recursive: true });
}

function serializePlayer(): PersistedPlayerState {
  return {
    name: player.name,
    currentRoomId: player.currentRoomId,
    vitals: player.vitals,
    combatStats: player.combatStats,
    training: player.training,
    trainingProgress: player.trainingProgress
  };
}

function markDirty(): void {
  dirty = true;
}

function savePlayerState(force = false): void {
  if (!force && !dirty) {
    return;
  }

  ensureSaveDirectory();
  writeFileSync(SAVE_FILE_PATH, `${JSON.stringify(serializePlayer(), null, 2)}\n`, "utf8");
  dirty = false;
}

function loadPlayerState(): string | null {
  if (!existsSync(SAVE_FILE_PATH)) {
    return null;
  }

  const raw = readFileSync(SAVE_FILE_PATH, "utf8");
  const saved = JSON.parse(raw) as PersistedPlayerState;

  player.name = saved.name;
  player.currentRoomId = saved.currentRoomId;
  player.vitals = saved.vitals;
  player.combatStats = saved.combatStats;
  player.training = saved.training;
  player.trainingProgress = saved.trainingProgress;

  return `Loaded save for ${player.name} from ${SAVE_FILE_PATH}.`;
}

function getCurrentRoomNpcs(): ActiveNpc[] {
  return player.rooms[player.currentRoomId];
}

function describeCurrentRoom(): string[] {
  const lines = describeRoom(player.currentRoomId);
  const npcs = getCurrentRoomNpcs();

  if (npcs.length === 0) {
    return [...lines.slice(0, -1), "Enemies: none"];
  }

  return [
    ...lines.slice(0, -1),
    "Enemies:",
    ...npcs.map(
      (npc) =>
        `  ${npc.name} - HP ${npc.hitPoints}/${npc.maxHitPoints}, Ki ${formatPowerLevel(npc.ki)}, Speed ${npc.speed} (${describeSpeedTier(npc.speed)})${npc.engaged ? " [engaged]" : ""}`
    )
  ];
}

function findNpc(target: string): ActiveNpc | undefined {
  const normalized = target.trim().toLowerCase();
  return getCurrentRoomNpcs().find((npc) => npc.name.toLowerCase().includes(normalized));
}

function removeNpc(npcId: string): void {
  player.rooms[player.currentRoomId] = getCurrentRoomNpcs().filter((npc) => npc.id !== npcId);
}

function formatQueuedAction(): string {
  if (!player.queuedAction) {
    return "none";
  }

  switch (player.queuedAction.type) {
    case "attack":
      return `attack ${player.queuedAction.target}`;
    case "blast":
      return `blast ${player.queuedAction.target}`;
    case "guard":
      return "guard";
  }
}

function renderTraining(): string[] {
  return [
    `Training: strength ${player.training.strength} (${player.trainingProgress.strength}/5), durability ${player.training.durability} (${player.trainingProgress.durability}/5)`,
    `          speed ${player.training.speed} (${player.trainingProgress.speed}/5), ki control ${player.training.kiControl} (${player.trainingProgress.kiControl}/5)`
  ];
}

function renderStats(vitals: CharacterVitals): string[] {
  return [
    `HP: ${vitals.hitPoints.current} / ${vitals.hitPoints.max}`,
    `Stamina: ${vitals.stamina.current} / ${vitals.stamina.max}`,
    `Ki / Power Level: ${formatPowerLevel(vitals.ki.current)} / ${formatPowerLevel(vitals.ki.max)}`,
    `Speed: ${player.combatStats.speed} (${describeSpeedTier(player.combatStats.speed)})`,
    `Cooldowns: attack ${player.attackCooldownTicks}, blast ${player.blastCooldownTicks}, guard ${player.guardCooldownTicks}`,
    `Queued Action: ${formatQueuedAction()}`,
    ...renderTraining()
  ];
}

function clampVitals(): void {
  player.vitals.hitPoints.current = Math.min(player.vitals.hitPoints.max, Math.max(0, player.vitals.hitPoints.current));
  player.vitals.stamina.current = Math.min(player.vitals.stamina.max, Math.max(0, player.vitals.stamina.current));
  player.vitals.ki.current = Math.min(player.vitals.ki.max, Math.max(0, player.vitals.ki.current));
}

function syncDerivedStats(): void {
  player.combatStats.speed = player.training.speed;
  player.vitals.hitPoints.max = 100 + player.training.durability * 2;
  player.vitals.stamina.max = 100 + player.training.strength + Math.floor(player.training.speed / 3);
  player.vitals.ki.max = 500 + player.training.kiControl * 8;
  clampVitals();
  markDirty();
}

function awardTrainingGain(stat: keyof TrainingStats, amount: number, reason: string): string[] {
  const messages: string[] = [];
  player.trainingProgress[stat] += amount;

  while (player.trainingProgress[stat] >= 5) {
    player.trainingProgress[stat] -= 5;
    player.training[stat] += 1;
    syncDerivedStats();
    messages.push(`Your ${stat} improves through ${reason}. It rises to ${player.training[stat]}.`);
  }

  return messages;
}

function renderHelp(): string[] {
  return [
    "Commands:",
    "  look or l",
    "  north/south/east/west",
    "  move <direction>",
    "  where",
    "  stats",
    "  scan",
    "  meditate",
    "  charge",
    "  train dash",
    "  train weights",
    "  attack <target>",
    "  blast <target>",
    "  guard",
    "  rest",
    "Actions resolve on the combat tick, so attacks and guard are queued first.",
    "  help",
    "  quit"
  ];
}

function clearCombatPressure(): void {
  player.guarding = false;
  player.guardTicksRemaining = 0;
  player.queuedAction = null;
  player.queuedActionTicksRemaining = 0;

  for (const roomId of Object.keys(player.rooms) as RoomId[]) {
    for (const npc of player.rooms[roomId]) {
      npc.engaged = false;
      npc.guarding = false;
      npc.nextActionInTicks = getNpcActionIntervalTicks(npc.speed);
    }
  }
}

function interruptQueuedAction(sourceName: string, sourceSpeed: number): string | null {
  if (!player.queuedAction || player.queuedActionTicksRemaining <= 0) {
    return null;
  }

  const interruptChance = getInterruptChance(sourceSpeed, player.combatStats.speed);
  if (Math.random() > interruptChance) {
    return null;
  }

  const brokenAction = formatQueuedAction();
  player.queuedAction = null;
  player.queuedActionTicksRemaining = 0;
  const gains = awardTrainingGain("speed", 1, "having to recover from a broken opening");

  return [
    `${sourceName} ${describeBlurTier(sourceSpeed, player.combatStats.speed)} and breaks your ${brokenAction} windup.`,
    ...gains
  ].join("\n");
}

function tickCooldowns(): void {
  const cooldownStep = getCooldownTickStep(player.combatStats.speed);
  player.attackCooldownTicks = Math.max(0, player.attackCooldownTicks - cooldownStep);
  player.blastCooldownTicks = Math.max(0, player.blastCooldownTicks - cooldownStep);
  player.guardCooldownTicks = Math.max(0, player.guardCooldownTicks - cooldownStep);
}

function queueAction(action: QueuedPlayerAction): string[] {
  player.queuedAction = action;
  player.queuedActionTicksRemaining = getActionWindupTicks(action.type, player.combatStats.speed);
  markDirty();

  switch (action.type) {
    case "attack":
      return [
        `You set your stance and prepare to attack ${action.target}.`,
        `Action delay: ${player.queuedActionTicksRemaining} tick(s).`
      ];
    case "blast":
      return [
        `You gather Ki and line up a blast at ${action.target}.`,
        `Action delay: ${player.queuedActionTicksRemaining} tick(s).`
      ];
    case "guard":
      return [
        "You brace for impact and prepare to guard on the next exchange.",
        `Action delay: ${player.queuedActionTicksRemaining} tick(s).`
      ];
  }
}

function applyNpcCounter(npc: ActiveNpc): string[] {
  if (npc.hitPoints <= 0) {
    return [];
  }

  npc.guarding = false;
  npc.engaged = true;

  const hitChance = getHitChanceModifier(npc.speed, player.combatStats.speed);
  if (Math.random() > hitChance) {
    player.guarding = false;
    return [
      `${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)}, but you avoid the strike.`,
      ...awardTrainingGain("speed", 1, "slipping away from danger")
    ];
  }

  const dodgeChance = getDodgeChance(npc.speed, player.combatStats.speed);
  if (Math.random() < dodgeChance) {
    player.guarding = false;
    return [
      `You slip away as ${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and misses by inches.`,
      ...awardTrainingGain("speed", 1, "dodging a live exchange")
    ];
  }

  const baseDamage = Math.max(5, npc.strength);
  const actualDamage = player.guarding
    ? Math.max(2, Math.floor(baseDamage * (1 - getGuardEffectiveness(npc.speed, player.combatStats.speed))))
    : baseDamage;
  player.vitals.hitPoints.current = Math.max(0, player.vitals.hitPoints.current - actualDamage);
  player.guarding = false;
  markDirty();

  const lines = [`${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and counters for ${actualDamage} damage.`];
  lines.push(...awardTrainingGain("durability", 1, "taking real hits"));

  if (player.vitals.hitPoints.current === 0) {
    lines.push("You collapse, barely conscious. Your vitals are restored for now.");
    player.vitals.hitPoints.current = player.vitals.hitPoints.max;
    player.vitals.stamina.current = Math.max(20, Math.floor(player.vitals.stamina.max * 0.5));
    player.vitals.ki.current = Math.max(50, Math.floor(player.vitals.ki.max * 0.5));
    player.currentRoomId = STARTING_ROOM_ID;
    clearCombatPressure();
    lines.push(...describeCurrentRoom());
  }

  return lines;
}

function resolveAttack(target: string): string[] {
  const npc = findNpc(target);

  if (!npc) {
    return ["No enemy here matches that target."];
  }

  if (player.vitals.stamina.current < 10) {
    return ["You are too drained to throw a proper attack."];
  }

  const hitChance = getHitChanceModifier(player.combatStats.speed, npc.speed);
  if (Math.random() > hitChance) {
    player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 6);
    player.attackCooldownTicks = ATTACK_COOLDOWN_TICKS;
    npc.engaged = true;
    markDirty();
    return [
      `You lunge at ${npc.name}, but ${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and slips clear.`,
      ...awardTrainingGain("strength", 1, "committing to melee pressure"),
      ...applyNpcCounter(npc)
    ];
  }

  const dodgeChance = getDodgeChance(player.combatStats.speed, npc.speed);
  if (Math.random() < dodgeChance) {
    player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 6);
    player.attackCooldownTicks = ATTACK_COOLDOWN_TICKS;
    npc.engaged = true;
    markDirty();
    return [
      `${npc.name} reads the motion and dodges as you ${describeBlurTier(player.combatStats.speed, npc.speed)} into range.`,
      ...awardTrainingGain("strength", 1, "pressuring a live opponent"),
      ...applyNpcCounter(npc)
    ];
  }

  const damage = 16 + Math.floor(player.training.strength / 4);
  const finalDamage = npc.guarding
    ? Math.max(6, Math.floor(damage * (1 - getGuardEffectiveness(player.combatStats.speed, npc.speed))))
    : damage;
  player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 10);
  npc.hitPoints = Math.max(0, npc.hitPoints - finalDamage);
  npc.guarding = false;
  npc.engaged = true;
  markDirty();

  const lines = [`You ${describeBlurTier(player.combatStats.speed, npc.speed)} and strike ${npc.name} for ${finalDamage} damage.`];
  lines.push(...awardTrainingGain("strength", 1, "landing solid melee blows"));
  player.attackCooldownTicks = ATTACK_COOLDOWN_TICKS;

  if (npc.hitPoints === 0) {
    removeNpc(npc.id);
    player.vitals.stamina.current = Math.min(player.vitals.stamina.max, player.vitals.stamina.current + 8);
    player.vitals.ki.current = Math.min(player.vitals.ki.max, player.vitals.ki.current + 12);
    lines.push(`${npc.name} crashes to the ground and can no longer fight.`);
    lines.push(...awardTrainingGain("durability", 1, "winning a hard exchange"));
    return lines;
  }

  lines.push(...applyNpcCounter(npc));
  return lines;
}

function resolveBlast(target: string): string[] {
  const npc = findNpc(target);

  if (!npc) {
    return ["No enemy here matches that target."];
  }

  if (player.vitals.ki.current < 35) {
    return ["Your Ki is too low to fire a focused blast."];
  }

  const hitChance = getHitChanceModifier(player.combatStats.speed, npc.speed);
  if (Math.random() > hitChance) {
    player.vitals.ki.current = Math.max(0, player.vitals.ki.current - 20);
    player.blastCooldownTicks = BLAST_COOLDOWN_TICKS;
    npc.engaged = true;
    markDirty();
    return [
      `You fire at ${npc.name}, but ${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and evades the blast.`,
      ...awardTrainingGain("kiControl", 1, "trying to line up moving targets"),
      ...applyNpcCounter(npc)
    ];
  }

  const dodgeChance = getDodgeChance(player.combatStats.speed, npc.speed);
  if (Math.random() < dodgeChance) {
    player.vitals.ki.current = Math.max(0, player.vitals.ki.current - 20);
    player.blastCooldownTicks = BLAST_COOLDOWN_TICKS;
    npc.engaged = true;
    markDirty();
    return [
      `${npc.name} twists clear as your blast passes by in a flash.`,
      ...awardTrainingGain("kiControl", 1, "firing under pressure"),
      ...applyNpcCounter(npc)
    ];
  }

  const damage = 28 + Math.floor(player.training.kiControl / 3);
  const finalDamage = npc.guarding
    ? Math.max(10, Math.floor(damage * (1 - getGuardEffectiveness(player.combatStats.speed, npc.speed))))
    : damage;
  player.vitals.ki.current = Math.max(0, player.vitals.ki.current - 35);
  npc.hitPoints = Math.max(0, npc.hitPoints - finalDamage);
  npc.guarding = false;
  npc.engaged = true;
  markDirty();

  const lines = [`You ${describeBlurTier(player.combatStats.speed, npc.speed)} and fire a ki blast into ${npc.name} for ${finalDamage} damage.`];
  lines.push(...awardTrainingGain("kiControl", 1, "controlling your Ki in combat"));
  player.blastCooldownTicks = BLAST_COOLDOWN_TICKS;

  if (npc.hitPoints === 0) {
    removeNpc(npc.id);
    player.vitals.ki.current = Math.min(player.vitals.ki.max, player.vitals.ki.current + 20);
    lines.push(`${npc.name} is overwhelmed by the blast and drops out of the fight.`);
    lines.push(...awardTrainingGain("speed", 1, "finishing a fight cleanly"));
    return lines;
  }

  lines.push(...applyNpcCounter(npc));
  return lines;
}

function resolveMeditate(): string[] {
  clearCombatPressure();
  player.vitals.ki.current = Math.min(player.vitals.ki.max, player.vitals.ki.current + 45);
  markDirty();
  const lines = [
    "You settle your breathing and turn inward, drawing your Ki into tighter control.",
    ...awardTrainingGain("kiControl", 2, "meditation")
  ];
  lines.push(...renderStats(player.vitals));
  return lines;
}

function resolveCharge(): string[] {
  player.vitals.ki.current = Math.min(player.vitals.ki.max, player.vitals.ki.current + 30);
  player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 5);
  markDirty();
  return [
    "You focus and pull your aura upward in a sharp surge.",
    ...awardTrainingGain("kiControl", 1, "charging energy"),
    ...renderStats(player.vitals)
  ];
}

function resolveTraining(activity: "dash" | "weights"): string[] {
  clearCombatPressure();

  if (activity === "dash") {
    player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 12);
    markDirty();
    return [
      "You explode into repeated dash bursts, forcing your body to keep up with your intent.",
      ...awardTrainingGain("speed", 2, "dash drills"),
      ...renderStats(player.vitals)
    ];
  }

  player.vitals.stamina.current = Math.max(0, player.vitals.stamina.current - 10);
  markDirty();
  return [
    "You grind through weighted motions until your muscles and stance begin to harden.",
    ...awardTrainingGain("strength", 2, "weighted training"),
    ...awardTrainingGain("durability", 1, "weighted training"),
    ...renderStats(player.vitals)
  ];
}

function resolveRest(): string[] {
  clearCombatPressure();
  player.vitals.hitPoints.current = Math.min(player.vitals.hitPoints.max, player.vitals.hitPoints.current + 10);
  player.vitals.stamina.current = Math.min(player.vitals.stamina.max, player.vitals.stamina.current + 20);
  player.vitals.ki.current = Math.min(player.vitals.ki.max, player.vitals.ki.current + 30);
  markDirty();

  return [
    "You steady your breathing and recover a portion of your strength.",
    ...renderStats(player.vitals)
  ];
}

function resolveScan(): string[] {
  const npcs = getCurrentRoomNpcs();

  if (npcs.length === 0) {
    return ["You sweep the area, but no hostile power signatures remain."];
  }

  return npcs.map(
    (npc) =>
      `${npc.name}: Power Level ${formatPowerLevel(npc.ki)}, HP ${npc.hitPoints}/${npc.maxHitPoints}, Speed ${npc.speed}. ${describeSpeedGap(player.combatStats.speed, npc.speed)} They ${describeBlurTier(npc.speed, player.combatStats.speed)} to you.`
  );
}

function resolveGuard(): string[] {
  player.guarding = true;
  player.guardTicksRemaining = GUARD_DURATION_TICKS;
  player.guardCooldownTicks = GUARD_COOLDOWN_TICKS;
  markDirty();
  return ["You raise your guard and tighten your stance for the next exchange."];
}

function resolveQueuedAction(): void {
  if (!player.queuedAction) {
    return;
  }

  if (player.queuedActionTicksRemaining > 0) {
    player.queuedActionTicksRemaining -= 1;

    if (player.queuedActionTicksRemaining > 0) {
      console.log(`Your ${formatQueuedAction()} is still winding up. (${player.queuedActionTicksRemaining} tick(s) remaining)`);
      return;
    }
  }

  const queuedAction = player.queuedAction;
  player.queuedAction = null;
  player.queuedActionTicksRemaining = 0;

  let lines: string[];

  switch (queuedAction.type) {
    case "attack":
      lines = resolveAttack(queuedAction.target);
      break;
    case "blast":
      lines = resolveBlast(queuedAction.target);
      break;
    case "guard":
      lines = resolveGuard();
      break;
  }

  for (const line of lines) {
    console.log(line);
  }
}

function processCommand(raw: string): { lines: string[]; shouldQuit: boolean } {
  const command = parseCommand(raw);

  switch (command.type) {
    case "help":
      return { lines: renderHelp(), shouldQuit: false };
    case "look":
      return { lines: describeCurrentRoom(), shouldQuit: false };
    case "where":
      return { lines: [`You are in ${describeCurrentRoom()[0]}.`], shouldQuit: false };
    case "stats":
      return { lines: renderStats(player.vitals), shouldQuit: false };
    case "scan":
      return { lines: resolveScan(), shouldQuit: false };
    case "rest":
      return { lines: resolveRest(), shouldQuit: false };
    case "meditate":
      return { lines: resolveMeditate(), shouldQuit: false };
    case "charge":
      return { lines: resolveCharge(), shouldQuit: false };
    case "train":
      return { lines: resolveTraining(command.activity), shouldQuit: false };
    case "guard":
      if (player.guardCooldownTicks > 0) {
        return { lines: [`Guard is on cooldown for ${player.guardCooldownTicks} more tick(s).`], shouldQuit: false };
      }
      if (player.queuedAction) {
        return { lines: ["You are already committing to another action."], shouldQuit: false };
      }
      return { lines: queueAction({ type: "guard" }), shouldQuit: false };
    case "attack":
      if (player.attackCooldownTicks > 0) {
        return { lines: [`Attack is on cooldown for ${player.attackCooldownTicks} more tick(s).`], shouldQuit: false };
      }
      if (player.queuedAction) {
        return { lines: ["You are already committing to another action."], shouldQuit: false };
      }
      return { lines: queueAction({ type: "attack", target: command.target }), shouldQuit: false };
    case "blast":
      if (player.blastCooldownTicks > 0) {
        return { lines: [`Blast is on cooldown for ${player.blastCooldownTicks} more tick(s).`], shouldQuit: false };
      }
      if (player.queuedAction) {
        return { lines: ["You are already committing to another action."], shouldQuit: false };
      }
      return { lines: queueAction({ type: "blast", target: command.target }), shouldQuit: false };
    case "move": {
      const result = moveRoom(player.currentRoomId, command.direction);

      if (!result.ok) {
        return { lines: [result.message], shouldQuit: false };
      }

      clearCombatPressure();
      player.currentRoomId = result.room.id;
      markDirty();
      return { lines: [`You move ${command.direction}.`, ...describeCurrentRoom()], shouldQuit: false };
    }
    case "quit":
      return { lines: ["Ending session. Until next time."], shouldQuit: true };
    case "unknown":
      return {
        lines: [`Unknown command: ${command.raw}`, "Type `help` to see available commands."],
        shouldQuit: false
      };
  }
}

function performCombatTick(): void {
  const roomNpcs = getCurrentRoomNpcs();
  const engagedNpcs = roomNpcs.filter((npc) => npc.engaged && npc.hitPoints > 0);

  tickCooldowns();

  player.vitals.stamina.current += engagedNpcs.length === 0 ? 6 : 2;
  player.vitals.ki.current += engagedNpcs.length === 0 ? 8 : 3;
  player.vitals.hitPoints.current += engagedNpcs.length === 0 ? 2 : 0;
  clampVitals();
  markDirty();

  if (player.guardTicksRemaining > 0) {
    player.guardTicksRemaining -= 1;
    if (player.guardTicksRemaining === 0) {
      player.guarding = false;
      markDirty();
      console.log("Your guard window fades.");
    }
  }

  if (engagedNpcs.length === 0) {
    resolveQueuedAction();
    return;
  }

  resolveQueuedAction();

  for (const npc of engagedNpcs) {
    npc.nextActionInTicks -= 1;

    if (npc.nextActionInTicks > 0) {
      continue;
    }

    npc.nextActionInTicks = getNpcActionIntervalTicks(npc.speed);
    const usesBlast = npc.ki >= 25 && npc.blastPower > npc.strength && Math.random() >= 0.5;
    const hitChance = getHitChanceModifier(npc.speed, player.combatStats.speed);

    if (Math.random() > hitChance) {
      console.log(`${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)}, but you slip away before the hit lands.`);
      const gains = awardTrainingGain("speed", 1, "evading combat pressure");
      for (const gain of gains) {
        console.log(gain);
      }
      continue;
    }

    const dodgeChance = getDodgeChance(npc.speed, player.combatStats.speed);
    if (Math.random() < dodgeChance) {
      console.log(`You dodge as ${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} through the exchange.`);
      const gains = awardTrainingGain("speed", 1, "reactive movement");
      for (const gain of gains) {
        console.log(gain);
      }
      continue;
    }

    const baseDamage = usesBlast ? npc.blastPower : npc.strength;
    const finalDamage = player.guarding
      ? Math.max(4, Math.floor(baseDamage * (1 - getGuardEffectiveness(npc.speed, player.combatStats.speed))))
      : baseDamage;

    if (usesBlast) {
      npc.ki = Math.max(0, npc.ki - 25);
      console.log(`${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and fires a blast for ${finalDamage} damage.`);
    } else {
      npc.stamina = Math.max(0, npc.stamina - 8);
      console.log(`${npc.name} ${describeBlurTier(npc.speed, player.combatStats.speed)} and rushes you for ${finalDamage} damage.`);
    }

    const interruptMessage = interruptQueuedAction(npc.name, npc.speed);
    if (interruptMessage) {
      for (const line of interruptMessage.split("\n")) {
        console.log(line);
      }
    }

    player.vitals.hitPoints.current = Math.max(0, player.vitals.hitPoints.current - finalDamage);
    const durabilityGains = awardTrainingGain("durability", 1, "surviving live combat");
    for (const gain of durabilityGains) {
      console.log(gain);
    }

    if (player.vitals.hitPoints.current === 0) {
      console.log("You collapse under the pressure. Your body is dragged back to safety.");
      player.vitals.hitPoints.current = player.vitals.hitPoints.max;
      player.vitals.stamina.current = Math.max(20, Math.floor(player.vitals.stamina.max * 0.5));
      player.vitals.ki.current = Math.max(50, Math.floor(player.vitals.ki.max * 0.5));
      player.currentRoomId = STARTING_ROOM_ID;
      clearCombatPressure();
      markDirty();
      console.log(...describeCurrentRoom());
      break;
    }
  }

  clampVitals();
  savePlayerState();
}

async function main(): Promise<void> {
  syncDerivedStats();
  const loadMessage = loadPlayerState();
  syncDerivedStats();

  const rl = createInterface({ input, output });
  console.log(`${GAME_NAME} local server session`);
  console.log(`Welcome, ${player.name}.`);
  if (loadMessage) {
    console.log(loadMessage);
  }
  for (const line of describeCurrentRoom()) {
    console.log(line);
  }
  console.log("Type `help` to see available commands.");

  combatTicker = setInterval(performCombatTick, COMBAT_TICK_MS);

  try {
    while (true) {
      const raw = await rl.question("> ");
      const result = processCommand(raw);

      for (const line of result.lines) {
        console.log(line);
      }

      if (result.shouldQuit) {
        break;
      }
    }
  } finally {
    savePlayerState(true);
    if (combatTicker) {
      clearInterval(combatTicker);
    }
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error("Muddy server session failed.", error);
  process.exitCode = 1;
});
