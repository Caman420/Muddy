# Unified Server Wiring Patch

This document records the exact remaining edits needed to make `server.js` the single fully-wired entry point.

## 1) package.json

Replace the current scaffold entry settings with:

```json
{
  "name": "muddy",
  "version": "0.1.0",
  "private": true,
  "description": "Unified DBZ-style MUD server",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "engines": {
    "node": ">=20"
  }
}
```

## 2) Add quest/trainer imports to server.js

Add these near the other world imports:

```js
const { ensureQuestState, listAvailableQuests, acceptQuest, recordQuestKill, turnInQuest, renderQuestLog } = require('./src/world/quests');
const { ensureTrainerState, renderTrainerMenu, trainStat } = require('./src/world/trainers');
```

## 3) Persist quest/trainer state

Inside `persistPlayer(player)`, add:

```js
    quests: player.quests || { active: [], completed: [] },
    training: player.training || { sessions: 0 },
```

## 4) Initialize quest/trainer state on players

Inside `createNewPlayer(...)` after progression init:

```js
  ensureQuestState(p);
  ensureTrainerState(p);
```

Inside `attachPlayer(...)` after progression init:

```js
  ensureQuestState(p);
  ensureTrainerState(p);
```

## 5) Quest reward helper

Add this helper near the progression / reward helpers:

```js
function handleQuestTurnIn(player, questId) {
  const result = turnInQuest(player, questId);
  if (!result.ok) return result.reason;
  const reward = result.quest.rewards || {};
  const expText = reward.exp ? grantExp(player, reward.exp) : '';
  player.zeni = (player.zeni || 0) + (reward.zeni || 0);
  persistPlayer(player);
  return `${result.quest.name} completed. Rewards: ${reward.exp || 0} EXP, ${reward.zeni || 0} zeni.${expText}`;
}
```

## 6) Record kills for quest progress

In `useTechniqueOnEnemy(...)`, when the enemy dies, before `removeDefeatedEnemies(...)`, add:

```js
    const completedNow = recordQuestKill(player, enemy.id);
    if (completedNow.length) {
      lines.push(`Quest objectives complete: ${completedNow.join(', ')}`);
    }
```

## 7) Trainer command helpers

Add these helpers near the other command handlers:

```js
function handleQuestList(player) {
  return renderQuestLog(player);
}

function handleQuestAccept(player, questId) {
  const result = acceptQuest(player, questId);
  if (!result.ok) return result.reason;
  persistPlayer(player);
  return `Quest accepted: ${result.quest.name}`;
}

function handleQuestBoard() {
  return listAvailableQuests()
    .map((quest) => `${quest.id} - ${quest.name}: ${quest.description}`)
    .join('\r\n');
}

function handleTrainers(player) {
  return renderTrainerMenu(player.roomId);
}

function handleTrain(player, key) {
  const result = trainStat(player, player.roomId, key);
  if (!result.ok) return result.reason;
  persistPlayer(player);
  return `${result.trainer.name} puts you through ${result.entry.label}. +${result.entry.gain} ${result.entry.stat}`;
}
```

## 8) Add commands to handleGameCommand

Extend the `help` text to include:

```text
quests, questboard, quest accept <id>, quest turnin <id>, trainers, train <stat>
```

Add these switch cases:

```js
    case 'quests': return handleQuestList(player);
    case 'questboard': return handleQuestBoard();
    case 'quest': {
      const action = String(subcmd || '').toLowerCase();
      const arg = restWords.join(' ');
      if (action === 'accept') return handleQuestAccept(player, arg);
      if (action === 'turnin' || action === 'turn-in') return handleQuestTurnIn(player, arg);
      return 'Use: quest accept <id> | quest turnin <id>';
    }
    case 'trainers': return handleTrainers(player);
    case 'train': return handleTrain(player, rest);
```

## 9) Recommended starter command flow

```text
questboard
quest accept bandit-problem
trainers
train offense
quests
```

Once the above is applied, `server.js` becomes the actual single unified server path, and `npm start` will match it.
