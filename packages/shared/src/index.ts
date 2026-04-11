export type ResourcePool = {
  current: number;
  max: number;
};

export type CharacterVitals = {
  hitPoints: ResourcePool;
  stamina: ResourcePool;
  ki: ResourcePool;
};

export type TrainingStats = {
  strength: number;
  durability: number;
  speed: number;
  kiControl: number;
};

export function formatPowerLevel(value: number): string {
  return value.toLocaleString("en-US");
}

export * from "./combat.js";
export * from "./commands.js";
export * from "./world.js";
