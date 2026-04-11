export type Direction = "north" | "south" | "east" | "west";

export type ParsedCommand =
  | { type: "help" }
  | { type: "look" }
  | { type: "stats" }
  | { type: "where" }
  | { type: "scan" }
  | { type: "rest" }
  | { type: "guard" }
  | { type: "meditate" }
  | { type: "charge" }
  | { type: "train"; activity: "dash" | "weights" }
  | { type: "quit" }
  | { type: "move"; direction: Direction }
  | { type: "attack"; target: string }
  | { type: "blast"; target: string }
  | { type: "unknown"; raw: string };

const DIRECTION_ALIASES: Record<string, Direction> = {
  n: "north",
  north: "north",
  s: "south",
  south: "south",
  e: "east",
  east: "east",
  w: "west",
  west: "west"
};

export function parseCommand(raw: string): ParsedCommand {
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return { type: "look" };
  }

  if (normalized === "help" || normalized === "?") {
    return { type: "help" };
  }

  if (normalized === "look" || normalized === "l") {
    return { type: "look" };
  }

  if (normalized === "stats") {
    return { type: "stats" };
  }

  if (normalized === "where") {
    return { type: "where" };
  }

  if (normalized === "scan") {
    return { type: "scan" };
  }

  if (normalized === "rest") {
    return { type: "rest" };
  }

  if (normalized === "guard") {
    return { type: "guard" };
  }

  if (normalized === "meditate") {
    return { type: "meditate" };
  }

  if (normalized === "charge") {
    return { type: "charge" };
  }

  if (normalized === "quit" || normalized === "exit") {
    return { type: "quit" };
  }

  const [verb, arg] = normalized.split(/\s+/, 2);

  if (verb === "move" && arg && arg in DIRECTION_ALIASES) {
    return { type: "move", direction: DIRECTION_ALIASES[arg] };
  }

  if (normalized in DIRECTION_ALIASES) {
    return { type: "move", direction: DIRECTION_ALIASES[normalized] };
  }

  if (verb === "attack" && arg) {
    return { type: "attack", target: arg };
  }

  if (verb === "blast" && arg) {
    return { type: "blast", target: arg };
  }

  if (verb === "train" && (arg === "dash" || arg === "weights")) {
    return { type: "train", activity: arg };
  }

  return { type: "unknown", raw };
}
