export type CombatAction = "attack" | "blast" | "guard";

export const COMBAT_TICK_MS = 2_000;
export const GUARD_DURATION_TICKS = 1;
export const ATTACK_COOLDOWN_TICKS = 1;
export const BLAST_COOLDOWN_TICKS = 2;
export const GUARD_COOLDOWN_TICKS = 1;
export const BASE_ATTACK_WINDUP_TICKS = 2;
export const BASE_BLAST_WINDUP_TICKS = 3;
export const BASE_GUARD_WINDUP_TICKS = 1;

export type QueuedPlayerAction =
  | { type: "attack"; target: string }
  | { type: "blast"; target: string }
  | { type: "guard" };

export type CombatStats = {
  speed: number;
};

export type BlurTier =
  | "matched"
  | "faster"
  | "afterimage"
  | "blur"
  | "unseen";

export type NpcTemplate = {
  id: string;
  name: string;
  description: string;
  maxHitPoints: number;
  maxStamina: number;
  maxKi: number;
  strength: number;
  blastPower: number;
  speed: number;
};

export type ActiveNpc = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  hitPoints: number;
  maxHitPoints: number;
  stamina: number;
  maxStamina: number;
  ki: number;
  maxKi: number;
  strength: number;
  blastPower: number;
  speed: number;
  guarding: boolean;
  engaged: boolean;
  nextActionInTicks: number;
};

export function createNpcFromTemplate(template: NpcTemplate): ActiveNpc {
  return {
    id: template.id,
    templateId: template.id,
    name: template.name,
    description: template.description,
    hitPoints: template.maxHitPoints,
    maxHitPoints: template.maxHitPoints,
    stamina: template.maxStamina,
    maxStamina: template.maxStamina,
    ki: template.maxKi,
    maxKi: template.maxKi,
    strength: template.strength,
    blastPower: template.blastPower,
    speed: template.speed,
    guarding: false,
    engaged: false,
    nextActionInTicks: getNpcActionIntervalTicks(template.speed)
  };
}

export function getActionBaseWindup(action: CombatAction): number {
  switch (action) {
    case "attack":
      return BASE_ATTACK_WINDUP_TICKS;
    case "blast":
      return BASE_BLAST_WINDUP_TICKS;
    case "guard":
      return BASE_GUARD_WINDUP_TICKS;
  }
}

export function getActionWindupTicks(action: CombatAction, speed: number): number {
  const baseWindup = getActionBaseWindup(action);
  const reduction = speed >= 120 ? 2 : speed >= 80 ? 1 : 0;
  return Math.max(1, baseWindup - reduction);
}

export function getCooldownTickStep(speed: number): number {
  if (speed >= 120) {
    return 2;
  }

  return 1;
}

export function getNpcActionIntervalTicks(speed: number): number {
  if (speed >= 120) {
    return 1;
  }

  if (speed >= 80) {
    return 2;
  }

  return 3;
}

export function describeSpeedTier(speed: number): string {
  if (speed >= 120) {
    return "blur-fast";
  }

  if (speed >= 80) {
    return "fast";
  }

  if (speed >= 50) {
    return "trained";
  }

  return "steady";
}

export function describeSpeedGap(playerSpeed: number, targetSpeed: number): string {
  const difference = playerSpeed - targetSpeed;

  if (difference >= 60) {
    return "You move so quickly that your target risks losing sight of you.";
  }

  if (difference >= 25) {
    return "You feel faster than your opponent, leaving sharp afterimages in the exchange.";
  }

  if (difference <= -40) {
    return "Your target moves with unnerving speed, almost vanishing between motions.";
  }

  if (difference <= -15) {
    return "Your target is faster than you and difficult to track cleanly.";
  }

  return "Your movement speed feels closely matched.";
}

export function getBlurTier(attackerSpeed: number, defenderSpeed: number): BlurTier {
  const difference = attackerSpeed - defenderSpeed;

  if (difference >= 60) {
    return "unseen";
  }

  if (difference >= 40) {
    return "blur";
  }

  if (difference >= 20) {
    return "afterimage";
  }

  if (difference >= 10) {
    return "faster";
  }

  return "matched";
}

export function getHitChanceModifier(attackerSpeed: number, defenderSpeed: number): number {
  switch (getBlurTier(defenderSpeed, attackerSpeed)) {
    case "unseen":
      return 0.45;
    case "blur":
      return 0.65;
    case "afterimage":
      return 0.8;
    case "faster":
      return 0.9;
    case "matched":
      return 1;
  }
}

export function getGuardEffectiveness(attackerSpeed: number, defenderSpeed: number): number {
  switch (getBlurTier(attackerSpeed, defenderSpeed)) {
    case "unseen":
      return 0.85;
    case "blur":
      return 0.7;
    case "afterimage":
      return 0.6;
    case "faster":
      return 0.5;
    case "matched":
      return 0.4;
  }
}

export function describeBlurTier(attackerSpeed: number, defenderSpeed: number): string {
  switch (getBlurTier(attackerSpeed, defenderSpeed)) {
    case "unseen":
      return "vanishes from sight";
    case "blur":
      return "moves as a blur";
    case "afterimage":
      return "leaves afterimages";
    case "faster":
      return "looks quicker";
    case "matched":
      return "moves at a readable pace";
  }
}

export function getInterruptChance(attackerSpeed: number, defenderSpeed: number): number {
  const difference = attackerSpeed - defenderSpeed;

  if (difference >= 50) {
    return 0.65;
  }

  if (difference >= 30) {
    return 0.45;
  }

  if (difference >= 15) {
    return 0.25;
  }

  return 0.1;
}

export function getDodgeChance(attackerSpeed: number, defenderSpeed: number): number {
  const difference = defenderSpeed - attackerSpeed;

  if (difference >= 50) {
    return 0.45;
  }

  if (difference >= 30) {
    return 0.3;
  }

  if (difference >= 15) {
    return 0.18;
  }

  return 0.08;
}
