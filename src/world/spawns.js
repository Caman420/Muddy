const { roomSpawns, cloneEnemy } = require('./enemies');
const { ensureCombatState } = require('./combat');

function ensureSpawnState(worldState) {
  if (!worldState.roomEnemyLists) worldState.roomEnemyLists = new Map();
  if (!worldState.enemyRespawns) worldState.enemyRespawns = new Map();
}

function hydrateEnemy(enemy, roomId, index) {
  enemy.uid = `${roomId}:${enemy.id}:${index}`;
  enemy.stats = {
    offense: enemy.offense,
    defense: enemy.defense,
    speed: enemy.speed,
    ki: enemy.powerLevel,
    strength: enemy.powerLevel,
  };
  enemy.hp = enemy.hp ?? enemy.currentHp;
  enemy.maxHp = enemy.maxHp || enemy.hp;
  enemy.kiPool = enemy.kiPool ?? enemy.currentKi;
  enemy.maxKiPool = enemy.maxKiPool || enemy.kiPool;
  ensureCombatState(enemy);
  return enemy;
}

function buildSpawnList(roomId) {
  const spec = roomSpawns[roomId];
  if (!spec) return [];
  const ids = Array.isArray(spec) ? spec : [spec];
  return ids.map((enemyId, index) => hydrateEnemy(cloneEnemy(enemyId), roomId, index + 1)).filter(Boolean);
}

function getEnemiesForRoom(worldState, roomId) {
  ensureSpawnState(worldState);
  if (!worldState.roomEnemyLists.has(roomId)) {
    worldState.roomEnemyLists.set(roomId, buildSpawnList(roomId));
  }
  return worldState.roomEnemyLists.get(roomId) || [];
}

function findEnemyInRoom(worldState, roomId, query) {
  const enemies = getEnemiesForRoom(worldState, roomId);
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return enemies.find((enemy) => enemy.hp > 0) || null;
  }
  return enemies.find((enemy) => enemy.hp > 0 && (enemy.uid.toLowerCase() === normalized || enemy.name.toLowerCase().includes(normalized))) || null;
}

function removeDefeatedEnemies(worldState, roomId) {
  const enemies = getEnemiesForRoom(worldState, roomId);
  const alive = enemies.filter((enemy) => enemy.hp > 0);
  worldState.roomEnemyLists.set(roomId, alive);
  return alive;
}

function scheduleRoomRespawn(worldState, roomId, respawnMs = 15000) {
  ensureSpawnState(worldState);
  if (worldState.enemyRespawns.has(roomId)) return;
  const timer = setTimeout(() => {
    worldState.roomEnemyLists.set(roomId, buildSpawnList(roomId));
    worldState.enemyRespawns.delete(roomId);
  }, respawnMs);
  worldState.enemyRespawns.set(roomId, timer);
}

module.exports = {
  ensureSpawnState,
  getEnemiesForRoom,
  findEnemyInRoom,
  removeDefeatedEnemies,
  scheduleRoomRespawn,
};
