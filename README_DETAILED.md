# Muddy — Detailed Project README

Muddy is a custom **Dragon Ball Z–style MUD server project** being built as a single unified Node.js TCP/telnet server.

This repository has gone through several staged builds while systems were added incrementally. The current intended direction is **one canonical server entry point**:

- `server.js`

That unified server is meant to bring together:

- socket/telnet connections
- character creation and login
- rooms and movement
- PvE combat
- PvP combat
- parties and follow/assist
- loot and inventory
- gear and shops
- race perks and progression
- quests and trainers

## Current status

The repository currently contains:

- a **unified server entry** at `server.js`
- many supporting world/system modules in `src/world/`
- older staged server entry files from earlier iterations
- a patch script that updates the live repo files to finish the unification wiring

Right now, the most important practical detail is this:

### Canonical server

Use:

```bash
node server.js
```

### Intended package entry

The repository also includes a patch script that updates `package.json` and `server.js` so the unified server is fully wired and `npm start` points to the right place.

Run later from the repo root:

```bash
node scripts/apply_unified_wiring.js
```

After that, the intended normal startup is:

```bash
npm start
```

## What this project is trying to be

Muddy is intended to be a **single-server DBZ MUD foundation** with multiplayer rooms, persistent player data, scalable combat systems, progression, and content growth.

The design goal is not just a demo socket server. It is meant to become the base for:

- real-time or near-real-time MUD-style combat
- DBZ-inspired races and power growth
- PvE and PvP in shared rooms
- party play with follow and assist
- loot/equipment/economy loop
- trainer and quest content
- future expansion into skills, transformations, and more advanced world logic

## Repository structure

### Core entry points

- `server.js` — intended unified main server
- `scripts/apply_unified_wiring.js` — patch script to finish wiring quests/trainers and fix package startup
- `UNIFIED_SERVER_WIRING_PATCH.md` — in-repo description of the same wiring changes

### Config and base world files

- `src/config.js` — host/port/MOTD configuration
- `src/world/state.js` — shared in-memory world state container
- `src/world/rooms.js` — starter room data
- `src/world/roomsRuntime.js` — room occupancy and broadcast helpers
- `src/world/spawns.js` — room enemy spawn helpers
- `src/world/enemies.js` — starter enemy templates and room spawn data

### Character and account systems

- `src/world/playerFactory.js` — starter player/race stat templates
- `src/world/accounts.js` — early account/session helpers
- `src/world/storage.js` — JSON persistence helpers

### Combat systems

- `src/world/techniques.js` — base techniques like punch, kick, blast, beam
- `src/world/combat.js` — cooldowns, technique checks, damage logic, respawn helpers
- `src/world/realtime.js` — real-time session/combat tick helpers
- `src/world/pvp.js` — PvP targeting and defeat helpers
- `src/world/partyCombat.js` — assist/follow/shared reward helpers

### Multiplayer and parties

- `src/world/parties.js` — party creation, invites, membership, leader handling

### Items, inventory, and economy

- `src/world/items.js` — starter consumables and loot table definitions
- `src/world/inventory.js` — inventory helpers, loot rolls, consumable use
- `src/world/equipment.js` — equipment slots, bonuses, vendor stock helpers

### Progression and content

- `src/world/progression.js` — race perks, skill points, unlockable techniques
- `src/world/quests.js` — quest definitions and quest progress helpers
- `src/world/trainers.js` — trainer definitions and stat-training helpers

### Legacy staged server files

The repo contains several older staged server entry files from the build-up process. They are useful as historical snapshots, but they are **not** the intended long-term entry point.

Examples include:

- `muddy-server.js`
- `muddy-game-server.js`
- `muddy-battle-server.js`
- `muddy-realtime-server.js`
- `muddy-multiplayer-server.js`
- `muddy-pvp-server.js`
- `muddy-party-server.js`
- `muddy-coop-server.js`
- `muddy-loot-server.js`
- `muddy-gear-server.js`
- `muddy-progression-server.js`

These were used to add systems step by step. The project direction now is to consolidate functionality into `server.js`.

## Requirements

- Node.js 20+
- Any telnet-compatible client, or a custom TCP client

## Running the project right now

### Temporary current method

Until the wiring script is run:

```bash
node server.js
```

### Intended method after patch script

```bash
node scripts/apply_unified_wiring.js
npm start
```

## Default server behavior

The server starts a TCP listener using values from `src/config.js`.

Default behavior includes:

- listen on host `0.0.0.0`
- listen on port `4000`
- show a basic welcome flow
- create or load a character by name

## Character creation

Starter races currently include:

- human
- saiyan
- namekian
- android

Each race begins with a different stat emphasis and has a race perk/progression path.

## Starter gameplay systems

### Rooms

Starter rooms currently include locations such as:

- Training Grounds
- Central Courtyard
- Scouter Lab
- Meditation Hall

### Movement

Supported movement commands include:

- `north`, `south`, `east`, `west`
- `n`, `s`, `e`, `w`

### Basic combat techniques

Current core technique set includes:

- `punch`
- `kick`
- `blast`
- `beam`

### Recovery/support actions

- `charge`
- `meditate`
- `scan`
- `pl`

### PvP

- player targeting by name
- PvP safe toggle with `pvp on|off`
- defeat flow that sends the loser back to the start room

### Parties

- `party invite <name>`
- `party accept <name>`
- `party leave`
- `party disband`
- `party list`
- `follow <party member>`
- `unfollow`

### Inventory and items

- `inv`
- `inventory`
- `use <item>`

Starter item examples include:

- Small Senzu Fragment
- Ki Capsule
- Scouter Lens
- Bandit Cloth

### Gear and economy

- `gear`
- `equipment`
- `equip <item>`
- `unequip <slot>`
- `shop`
- `buy <item>`
- `sell <item>`

Starter runtime gear examples include:

- Basic Scouter
- Training Weights
- Guard Wraps

### Progression

- `progress`
- `skills`
- `learn <technique>`

Starter race-based unlocks currently include:

- Human: Focus Burst
- Saiyan: Rage Spike
- Namekian: Regen Stance
- Android: Overclock

## Commands currently intended for unified server

These are the main commands the unified server is built around or intended to support:

### General

- `help`
- `look`
- `stats`
- `who`
- `say <message>`

### Movement

- `north`
- `south`
- `east`
- `west`
- `n`
- `s`
- `e`
- `w`

### Combat

- `punch <target>`
- `kick <target>`
- `blast <target>`
- `beam <target>`
- `fight <target>`
- `attack <target>`
- `scan`
- `pl`
- `charge`
- `meditate`

### PvP / party

- `pvp on`
- `pvp off`
- `party invite <name>`
- `party accept <name>`
- `party leave`
- `party disband`
- `party list`
- `follow <name>`
- `unfollow`

### Inventory / items / gear

- `inv`
- `inventory`
- `use <item>`
- `gear`
- `equipment`
- `equip <item>`
- `unequip <slot>`
- `shop`
- `buy <item>`
- `sell <item>`

### Progression

- `progress`
- `skills`
- `learn <technique>`

### Quest/trainer commands intended after final wiring patch

- `quests`
- `questboard`
- `quest accept <id>`
- `quest turnin <id>`
- `trainers`
- `train <stat>`

## Persistence

Persistence is currently JSON-file based.

Expected data file location:

- `data/players.json`

Player persistence is intended to include:

- character identity
- race
- room position
- HP / ki
- EXP / level
- cooldowns
- PvP setting
- inventory
- equipment
- zeni
- learned techniques
- skill points
- quest state
- training state

## Current known gaps

This project is functional as a growing prototype, but it is not yet fully cleaned up.

### 1. package.json still needs final correction

Until the patch script is run, `package.json` still points at the old scaffold entry instead of `server.js`.

### 2. Quest/trainer wiring needs to be applied to live server file

The quest and trainer modules are in the repo, but the final unified command wiring needs to be applied to `server.js` using the patch script.

### 3. Runtime gear definitions should be centralized

Some starter gear definitions currently live inside the server entry rather than a central shared item file.

### 4. Legacy staged server files remain in repo

These are useful history, but eventually should be archived or removed once the unified server path is completely stable.

### 5. In-memory world model still limits scale

The project is still mostly using in-memory runtime state plus JSON persistence. Long-term growth will benefit from cleaner persistence separation and more formal world/entity modeling.

## Recommended next steps

### Immediate

1. Run:

```bash
node scripts/apply_unified_wiring.js
```

2. Then run:

```bash
npm start
```

3. Confirm these commands work in the unified server:

- `questboard`
- `quest accept bandit-problem`
- `quests`
- `trainers`
- `train offense`

### After that

- move runtime gear definitions into shared item data
- clean `package.json` description/versioning if needed
- archive/remove legacy staged server entry files
- add better room content and NPC data
- add more quest lines
- add trainers with race- or level-gated options
- add equipment drop tables and better loot routing
- add transformations / advanced DBZ progression
- add cleaner combat timing and event logging

## Suggested starter test flow

Once the unified wiring patch is applied:

```text
create character
look
scan
punch bandit
inv
shop
buy basic scouter
equip basic scouter
stats
progress
questboard
quest accept bandit-problem
trainers
train offense
quests
party invite <friend>
follow <friend>
```

## Summary

This repo currently represents a **single-server DBZ MUD foundation in active construction**.

The key points are:

- `server.js` is the intended unified main server
- the project already includes combat, parties, loot, gear, progression, and content modules
- the included patch script finishes the last wiring work for `server.js` and `package.json`
- once that script is run, the repo should move much closer to a clean single-entry development flow
