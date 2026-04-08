function ensureQuestState(player) {
  if (!player.quests) {
    player.quests = {
      active: [],
      completed: [],
    };
  }
}

const questDefs = {
  'bandit-problem': {
    id: 'bandit-problem',
    name: 'Bandit Problem',
    giver: 'training-master',
    description: 'Defeat 2 Desert Bandits in the courtyard.',
    objective: { enemyId: 'bandit', count: 2 },
    rewards: { exp: 20, zeni: 15 },
  },
  'scouter-scraps': {
    id: 'scouter-scraps',
    name: 'Scouter Scraps',
    giver: 'tech-trainer',
    description: 'Defeat 2 Saibamen and recover battlefield scraps.',
    objective: { enemyId: 'saibaman', count: 2 },
    rewards: { exp: 22, zeni: 20 },
  },
};

function getQuest(id) {
  return questDefs[String(id || '').trim().toLowerCase()] || null;
}

function listAvailableQuests() {
  return Object.values(questDefs);
}

function hasQuest(player, questId) {
  ensureQuestState(player);
  return player.quests.active.some((q) => q.id === questId) || player.quests.completed.includes(questId);
}

function acceptQuest(player, questId) {
  ensureQuestState(player);
  const quest = getQuest(questId);
  if (!quest) return { ok: false, reason: 'Unknown quest.' };
  if (hasQuest(player, quest.id)) return { ok: false, reason: 'You already have or completed that quest.' };
  player.quests.active.push({ id: quest.id, progress: 0 });
  return { ok: true, quest };
}

function recordQuestKill(player, enemyId) {
  ensureQuestState(player);
  const completedNow = [];
  for (const active of player.quests.active) {
    const quest = getQuest(active.id);
    if (!quest) continue;
    if (quest.objective.enemyId !== enemyId) continue;
    active.progress += 1;
    if (active.progress >= quest.objective.count) {
      completedNow.push(quest.id);
    }
  }
  return completedNow;
}

function turnInQuest(player, questId) {
  ensureQuestState(player);
  const active = player.quests.active.find((q) => q.id === questId);
  if (!active) return { ok: false, reason: 'That quest is not active.' };
  const quest = getQuest(questId);
  if (!quest) return { ok: false, reason: 'Unknown quest.' };
  if (active.progress < quest.objective.count) {
    return { ok: false, reason: 'That quest is not complete yet.' };
  }
  player.quests.active = player.quests.active.filter((q) => q.id !== questId);
  player.quests.completed.push(questId);
  return { ok: true, quest };
}

function renderQuestLog(player) {
  ensureQuestState(player);
  const activeLines = player.quests.active.map((entry) => {
    const quest = getQuest(entry.id);
    if (!quest) return entry.id;
    return `${quest.name}: ${entry.progress}/${quest.objective.count}`;
  });
  return [
    `Active quests: ${activeLines.length ? '' : 'none'}`,
    ...(activeLines.length ? activeLines : []),
    `Completed quests: ${player.quests.completed.length ? player.quests.completed.join(', ') : 'none'}`,
  ].join('\r\n');
}

module.exports = {
  ensureQuestState,
  questDefs,
  getQuest,
  listAvailableQuests,
  hasQuest,
  acceptQuest,
  recordQuestKill,
  turnInQuest,
  renderQuestLog,
};
