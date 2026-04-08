export declare const GAME_NAME = "Muddy";
export declare const STARTING_ROOM_NAME = "Earth Training Grounds";
export type ResourcePool = {
    current: number;
    max: number;
};
export type CharacterVitals = {
    hitPoints: ResourcePool;
    stamina: ResourcePool;
    ki: ResourcePool;
};
export declare function formatPowerLevel(value: number): string;
