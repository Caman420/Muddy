# Muddy Blueprint

## Vision

Muddy is a private multiplayer Dragon Ball Z MUD for family and friends.

The game focuses on:

- real-time combat
- training-based progression instead of levels
- Ki as both energy and Power Level
- Speed as a defining combat stat that can make characters blur or vanish from sight
- persistent multiplayer world progression

There are no character levels, no XP bars, and no stat points awarded on level up. Players grow by training, fighting, surviving, traveling, and mastering techniques through repeated use.

## Core Design Rules

- Progress is earned through actions, not levels.
- Public character strength is primarily expressed through Ki / Power Level.
- Fast characters should feel terrifying, evasive, and difficult to track.
- Technique mastery matters as much as raw numbers.
- Repetition should help growth, but mindless spam should be inefficient.
- The first playable version should be small, stable, and genuinely fun.

## Visible Character Sheet

Players primarily see three resources:

- Hit Points
- Stamina
- Ki

Example display:

```text
Name: Kakarot
Race: Saiyan
HP: 820 / 820
Stamina: 460 / 460
Ki / Power Level: 12,400 / 12,400
State: Calm
```

### Resource Meaning

- `Hit Points`: physical health, injuries, knockout threshold
- `Stamina`: physical exertion, melee pressure, dashing, chasing, blocking, recovery pacing
- `Ki`: energy reserve, power output, sensing strength, suppression strength, transformation fuel, public Power Level

## Hidden Combat Attributes

These are trained by use and shape combat under the hood:

- `speed`
- `strength`
- `durability`
- `ki_control`
- `combat_sense`

Each technique also has its own mastery value.

### Hidden Attribute Roles

- `speed`: action speed, chase, dodge, interrupt timing, visibility thresholds
- `strength`: melee damage, knockback, grapple pressure
- `durability`: mitigation, resistance, HP growth influence
- `ki_control`: charging efficiency, suppression quality, ki cost efficiency, technique precision
- `combat_sense`: tracking, counter timing, ki reading, awareness against high-speed enemies

## Progression Model

There are no levels.

Growth comes from meaningful repeated actions in the right context.

### Growth Sources

- melee combat trains strength, stamina, combat sense
- taking damage trains durability and combat sense
- surviving close fights grants bonus durability growth
- dashing and chasing train speed and stamina
- meditation trains ki and ki control
- charging trains ki control and some ki growth
- beam use trains ki and technique mastery
- sparring trains broad combat growth with lower risk
- weighted and gravity training train strength, stamina, durability
- pursuing faster enemies can strongly train speed

### Growth Formula Direction

Every valid training action produces a small gain:

```text
gain = base_gain * difficulty_mod * variety_mod * fatigue_mod * context_mod
```

Where:

- `difficulty_mod` rewards stronger opponents and harder training
- `variety_mod` reduces repeated low-value spam
- `fatigue_mod` reduces efficiency during overtraining
- `context_mod` boosts growth for gravity, danger, sparring, pursuit, and similar conditions

### Anti-Grind Rules

- repeating the same safe action too often quickly decays rewards
- weak targets provide sharply reduced gains after early growth
- tougher contexts increase gains
- fatigue lowers training efficiency over time
- some breakthroughs require challenge conditions, not just repetition

## Resource Growth Rules

Visible resources grow based on training patterns and hidden attribute development.

### Hit Points

HP increases from:

- repeated harsh combat
- surviving damage
- durability growth
- endurance-heavy training

### Stamina

Stamina increases from:

- movement
- sparring
- combos
- long fights
- physical training

### Ki

Ki increases from:

- meditation
- charging
- energy combat
- sensing practice
- suppression/control practice
- transformation use once unlocked

Ki is also Power Level. When Ki rises, the world should feel it.

## Combat Model

Combat is real-time and tick-based.

### Server Tick

Recommended first implementation:

- one combat simulation tick every `250ms`

Each tick resolves:

- action timers
- movement changes
- channeling/charging
- cooldown updates
- damage resolution
- status effects
- resource regeneration

### Action Structure

Actions should include:

- windup time
- execution moment
- cooldown
- stamina cost and/or ki cost
- range requirement
- interrupt rules

Example actions:

- `attack <target>`
- `combo <target>`
- `guard`
- `dash <target>`
- `blast <target>`
- `charge`
- `sense`
- `retreat`

### Resource Usage in Combat

- `HP` is lost when attacks land
- `Stamina` is spent on physical pressure, movement, blocks, and evasive actions
- `Ki` is spent on energy techniques, sensing, suppression, transformations, and some advanced movement

### Combat Rhythm Goal

Fights should feel like:

- pressure with melee
- reposition with speed
- defend and counter
- charge or conserve Ki
- burst with energy attacks
- overwhelm weaker perception with higher speed

## Speed System

Speed is one of the most important hidden stats in the game.

It affects:

- action windup
- dodge timing
- chase and escape
- interrupt success
- combo continuation
- visual tracking by opponents

### Visibility Thresholds

Speed gaps should change what slower players can perceive:

- `0-19%`: normal tracking
- `20-39%`: difficult to follow
- `40-59%`: afterimages
- `60-89%`: blur movement
- `90%+`: target may lose visual track entirely

### Gameplay Effects

As the speed gap grows, slower opponents should suffer:

- reduced hit accuracy
- worse counter timing
- target lock failures
- delayed reaction windows

### Counters to Extreme Speed

High speed should be powerful, not unbeatable.

Counters include:

- `sense`
- high `combat_sense`
- defensive stances
- predictive techniques
- area attacks
- superior ki reading

## Ki and Power Level

Ki is the most public signal of character power.

### Ki Functions

- fuels energy techniques
- determines sensing intensity
- powers transformations
- influences intimidation and presence
- serves as displayed Power Level

### Scan and Sense

Examples of game messaging:

- `Power Level: 3,220`
- `You sense a sharp rise in ki nearby.`
- `Their power is being suppressed.`
- `You cannot fully read their energy.`

### Suppression

Players should eventually be able to suppress power output.

Suppression can:

- hide true Ki from scans
- reduce intimidation footprint
- create ambush or deception play
- trade visibility for reduced active output while suppressed

## Technique Mastery

Each technique improves through use rather than through a general skill point system.

Examples:

- `punch`
- `kick`
- `dash`
- `guard`
- `blast`
- `kamehameha`
- `solar flare`

Technique mastery may improve:

- damage
- speed
- efficiency
- control
- success rate
- secondary effects

This gives each character a history defined by what they actually practice.

## Race Plan

Recommended MVP races:

- Saiyan
- Human
- Namekian

### Saiyan

- strong gains under battle pressure
- strong transformation path later
- high-risk, high-reward growth identity

### Human

- strong technique learning
- efficient control
- disciplined training identity

### Namekian

- balanced survivability
- strong sensing
- regeneration path later

Additional races for later:

- Android
- Majin
- Frieza race

## MVP World Slice

The first version should be intentionally small.

### Zones

- Earth Training Grounds
- Open Plains
- Tournament Approach
- Gravity Chamber

### NPC Types

- trainee
- wild fighter
- martial artist
- elite sparring partner

This is enough to validate:

- movement
- chat
- training
- PvE combat
- persistence
- multiplayer presence

## MVP Commands

### World and Social

- `look`
- `move <dir>`
- `say <message>`
- `tell <player> <message>`
- `stats`
- `scan <target>`
- `sense`

### Training

- `meditate`
- `charge`
- `train dash`
- `train weights`
- `spar <target>`
- `rest`

### Combat

- `attack <target>`
- `combo <target>`
- `guard`
- `dash <target>`
- `blast <target>`
- `retreat`

## Unlock Philosophy

No feature should require character levels.

Unlocks should come from conditions.

Examples:

- repeated dash use under combat pressure unlocks advanced movement
- sustained beam training unlocks stronger energy techniques
- harsh battle survival unlocks elite growth paths
- race-specific story and combat conditions unlock transformations

## Technical Architecture

Recommended stack:

- `Node.js`
- `TypeScript`
- `WebSocket` for real-time gameplay
- `PostgreSQL` for persistent data
- optional `Redis` later for scaling and ephemeral state

### Monorepo Layout

```text
/apps
  /server
  /client
/packages
  /shared
  /content
  /protocol
/docs
  muddy-blueprint.md
```

### apps/server

Responsibilities:

- authentication
- player sessions
- world state
- room movement
- combat simulation
- training systems
- persistence
- chat routing

Suggested internal modules:

```text
apps/server/src/
  config/
  server/
  auth/
  world/
  combat/
  training/
  players/
  chat/
  persistence/
  content/
  utils/
```

### apps/client

First client can be a simple web-based text client.

Responsibilities:

- login flow
- command input
- room output log
- combat feed
- stat display
- target display

### packages/shared

Shared domain types:

- player state
- room state
- action definitions
- combat formulas
- resource models

### packages/content

Game content definitions:

- races
- zones
- NPCs
- techniques
- training definitions

### packages/protocol

Shared message schema for WebSocket communication:

- client commands
- server events
- state snapshots
- combat event payloads

## Database Blueprint

PostgreSQL should store persistent character and world data.

### Initial Tables

#### users

```text
id
username
password_hash
created_at
last_login_at
```

#### characters

```text
id
user_id
name
race
current_room_id
hp_current
hp_max
stamina_current
stamina_max
ki_current
ki_max
speed
strength
durability
ki_control
combat_sense
is_online
created_at
updated_at
```

#### character_techniques

```text
id
character_id
technique_key
mastery_value
unlocked
last_used_at
```

#### rooms

```text
id
zone_key
room_key
name
description
```

#### npcs

```text
id
npc_key
room_id
state_json
respawn_at
```

#### training_history

```text
id
character_id
action_key
context_key
gain_summary_json
created_at
```

#### combat_logs

```text
id
character_id
target_type
target_id
event_key
event_data_json
created_at
```

### Persistence Notes

- room layout and static content can live in code or content files first
- player state should save on important changes and on disconnect
- combat logs can be trimmed later if needed

## WebSocket Event Model

The client sends commands and receives state/event updates.

### Client to Server

- `auth.login`
- `character.create`
- `character.select`
- `command.input`

### Server to Client

- `auth.ok`
- `character.snapshot`
- `room.snapshot`
- `chat.message`
- `combat.event`
- `combat.snapshot`
- `training.result`
- `system.message`
- `error.message`

### Example Command Payload

```json
{
  "type": "command.input",
  "payload": {
    "raw": "blast trainee"
  }
}
```

### Example Combat Event Payload

```json
{
  "type": "combat.event",
  "payload": {
    "actor": "Kakarot",
    "target": "Bandit",
    "action": "blast",
    "result": "hit",
    "hpDamage": 84,
    "staminaCost": 0,
    "kiCost": 40
  }
}
```

## Simulation Systems

### Room Model

The world should be room-based for the MUD structure, but combat messaging should make movement feel fast and anime-like.

Room state includes:

- players present
- NPCs present
- exits
- active combatants
- environmental flags such as gravity modifiers

### Training Context System

Actions should be evaluated in context:

- safe training
- sparring
- real combat
- low gravity
- high gravity
- pursuit
- near defeat

This context feeds growth modifiers and unlock checks.

### Recovery Model

Characters naturally regenerate:

- small HP recovery out of combat
- moderate stamina recovery at rest
- limited Ki recovery by default

Meditation and charging should be the main ways to recover Ki meaningfully.

## Milestones

### Milestone 1: Playable Foundation

- repo scaffold
- auth
- character creation
- room movement
- chat
- basic persistence

### Milestone 2: Combat Prototype

- combat tick loop
- targeting
- attack, combo, guard, dash, blast
- HP, Stamina, Ki costs and regeneration

### Milestone 3: Training System

- meditation
- charge
- dash training
- weights
- sparring
- growth formulas and anti-spam logic

### Milestone 4: Speed and Sensing

- speed thresholds
- blur/unseeable messaging
- scan and sense
- suppression system

### Milestone 5: Content Expansion

- more rooms
- more NPCs
- more techniques
- race-specific unlocks

## First Build Recommendation

The first real coding target should be:

- one server
- one lightweight web client
- login and character creation
- one training area
- one enemy type
- six core commands
- save/load support

That keeps scope tight while preserving the identity of the game.

## Immediate Next Tasks

1. scaffold the monorepo layout
2. define shared TypeScript types
3. create the initial PostgreSQL schema
4. implement a minimal WebSocket server
5. implement command parsing and room movement
6. add the first combat tick loop

