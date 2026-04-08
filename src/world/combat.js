const { getTechnique } = require('./techniques');

function now() {
  return Date.now();
}

function ensureCombatState(entity) {
  if (!entity.cooldowns) entity.cooldowns = {};
  if (!entity.combat) {
    entity.combat = {
      lastActionAt: 0,
    };
  }
}

function getRemainingCooldown(entity, techniqueId, currentTime = now()) {
  ensureCombatState(entity);
  const readyAt = entity.cooldowns[techniqueId] || 0;
  return Math.max(0, readyAt - currentTime);
}

function isTechniqueReady(entity, techniqueId, currentTime = now()) {
  return getRemainingCooldown(entity, techniqueId, currentTime) <= 0;
}

function setTechniqueCooldown(entity, techniqueId, cooldownMs, currentTime = now()) {
  ensureCombatState(entity);
  entity.cooldowns[techniqueId] = currentTime + cooldownMs;
  entity.combat.lastActionAt = currentTime;
}

function computeDamage(attacker, defender, technique) {
  const statValue = attacker.stats?.[technique.stat] || attacker[technique.stat] || 1;
  const offense = attacker.stats?.offense || attacker.offense || 1;
  const defense = defender.stats?.defense || defender.defense || 0;
  const speed = attacker.stats?.speed || attacker.speed || 1;
  const raw = technique.baseDamage + statValue + Math.floor(offense / 2) + Math.floor(speed / 4);
  return Math.max(1, raw - Math.floor(defense / 2));
}

function canUseTechnique(entity, techniqueId, currentTime = now()) {
  const technique = getTechnique(techniqueId);
  if (!technique) {
    return { ok: false, reason: 'Unknown technique.' };
  }

  ensureCombatState(entity);
  const remaining = getRemainingCooldown(entity, techniqueId, currentTime);
  if (remaining > 0) {
    return { ok: false, reason: `${technique.name} cooldown: ${(remaining / 1000).toFixed(1)}s` };
  }

  const kiPool = entity.kiPool ?? entity.currentKi ?? 0;
  if (kiPool < technique.kiCost) {
    return { ok: false, reason: `Not enough ki for ${technique.name}.` };
  }

  return { ok: true, technique };
}

function spendTechniqueCost(entity, technique) {
  if (typeof entity.kiPool === 'number') {
    entity.kiPool = Math.max(0, entity.kiPool - technique.kiCost);
  } else if (typeof entity.currentKi === 'number') {
    entity.currentKi = Math.max(0, entity.currentKi - technique.kiCost);
  }
}

function scheduleRespawn(worldState, roomId, templateFactory, respawnMs = 15000) {
  if (!worldState.enemyRespawns) worldState.enemyRespawns = new Map();
  if (worldState.enemyRespawns.has(roomId)) return;

  const timeout = setTimeout(() => {
    worldState.enemies.set(roomId, templateFactory());
    worldState.enemyRespawns.delete(roomId);
  }, respawnMs);

  worldState.enemyRespawns.set(roomId, timeout);
}

module.exports = {
  now,
  ensureCombatState,
  getRemainingCooldown,
  isTechniqueReady,
  setTechniqueCooldown,
  computeDamage,
  canUseTechnique,
  spendTechniqueCost,
  scheduleRespawn,
};
