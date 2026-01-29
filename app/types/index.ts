// =====================================
// Digimon Digital Adventure 1.4 Types
// =====================================

// === Enums ===

export type DigimonStage =
  | 'fresh'
  | 'in-training'
  | 'rookie'
  | 'champion'
  | 'ultimate'
  | 'mega'
  | 'ultra'

export type DigimonAttribute = 'vaccine' | 'data' | 'virus' | 'free'

export type DigimonFamily =
  | 'dark-empire'
  | 'deep-savers'
  | 'dragons-roar'
  | 'jungle-troopers'
  | 'metal-empire'
  | 'nature-spirits'
  | 'nightmare-soldiers'
  | 'unknown'
  | 'virus-busters'
  | 'wind-guardians'

export type QualityTypeTag = 'static' | 'trigger' | 'attack'

export type AttackRange = 'melee' | 'ranged'
export type AttackType = 'damage' | 'support'
export type AttackArea = 'single' | 'blast' | 'burst' | 'line' | 'cone'

export type Stance = 'neutral' | 'defensive' | 'offensive' | 'sniper' | 'brave'
export type ActionType = 'simple' | 'complex'

export type TormentSeverity = 'minor' | 'major' | 'terrible'

export type CampaignLevel = 'standard' | 'enhanced' | 'extreme'

// === Stage Configuration ===

export interface StageConfig {
  stage: DigimonStage
  dp: number
  movement: number
  woundBonus: number
  brains: number
  attacks: number
  stageBonus: number
}

export const STAGE_CONFIG: Record<DigimonStage, StageConfig> = {
  'fresh': { stage: 'fresh', dp: 5, movement: 2, woundBonus: 0, brains: 0, attacks: 1, stageBonus: 0 },
  'in-training': { stage: 'in-training', dp: 15, movement: 4, woundBonus: 1, brains: 1, attacks: 2, stageBonus: 0 },
  'rookie': { stage: 'rookie', dp: 25, movement: 6, woundBonus: 2, brains: 3, attacks: 2, stageBonus: 1 },
  'champion': { stage: 'champion', dp: 40, movement: 8, woundBonus: 5, brains: 5, attacks: 3, stageBonus: 2 },
  'ultimate': { stage: 'ultimate', dp: 55, movement: 10, woundBonus: 7, brains: 7, attacks: 4, stageBonus: 3 },
  'mega': { stage: 'mega', dp: 70, movement: 12, woundBonus: 10, brains: 10, attacks: 5, stageBonus: 4 },
  'ultra': { stage: 'ultra', dp: 85, movement: 14, woundBonus: 12, brains: 12, attacks: 6, stageBonus: 5 },
}

// === Tamer Types ===

export interface TamerAttributes {
  agility: number
  body: number
  charisma: number
  intelligence: number
  willpower: number
}

export interface TamerSkills {
  // Agility
  dodge: number
  fight: number
  stealth: number
  // Body
  athletics: number
  endurance: number
  featsOfStrength: number
  // Charisma
  manipulate: number
  perform: number
  persuasion: number
  // Intelligence
  computer: number
  survival: number
  knowledge: number
  // Willpower
  perception: number
  decipherIntent: number
  bravery: number
}

export interface TamerDerivedStats {
  woundBoxes: number      // Body + Endurance (min 2)
  speed: number           // Agility + Survival
  accuracyPool: number    // Agility + Fight
  dodgePool: number       // Agility + Dodge
  armor: number           // Body + Endurance
  damage: number          // Body + Fight
}

export interface Aspect {
  id: string
  name: string
  description: string
  type: 'major' | 'minor'
  usesRemaining: number   // Major: 1, Minor: 2
}

export interface Torment {
  id: string
  name: string
  description: string
  severity: TormentSeverity
  totalBoxes: number      // Minor: 5, Major: 7, Terrible: 10
  markedBoxes: number
}

export interface Tamer {
  id: string
  name: string
  age: number
  campaignLevel: CampaignLevel
  attributes: TamerAttributes
  skills: TamerSkills
  derivedStats: TamerDerivedStats
  aspects: Aspect[]
  torments: Torment[]
  specialOrders: string[] // IDs of unlocked special orders
  inspiration: number
  maxInspiration: number  // = Willpower (min 1)
  xp: number
  equipment: string[]
  partnerDigimonIds: string[]
  currentWounds: number
  notes: string
  createdAt: Date
  updatedAt: Date
}

// === Digimon Types ===

export interface DigimonBaseStats {
  accuracy: number
  damage: number
  dodge: number
  armor: number
  health: number
}

export interface DigimonDerivedStats {
  // Primary Derived Stats (page 111)
  brains: number          // (Accuracy / 2) + Brains Bonus
  body: number            // ((Health + Damage + Armor) / 3) + Size Bonus
  agility: number         // ((Accuracy + Dodge) / 2) + Size Bonus
  woundBoxes: number      // Health + Wound Box Bonus
  // Spec Values (page 111)
  bit: number             // (Brains / 10) + Stage Bonus
  cpu: number             // (Body / 10) + Stage Bonus
  ram: number             // (Agility / 10) + Stage Bonus
  // Movement
  movement: number        // Base Movement from Stage + modifiers
}

export interface Attack {
  id: string
  name: string
  range: AttackRange      // [Melee] or [Ranged] - free tag
  type: AttackType        // [Damage] or [Support] - free tag
  tags: string[]          // Quality-based tags (e.g., "Weapon II", "Charge Attack", "Area Attack: Burst 3")
  effect?: string         // Optional effect tag (e.g., "Paralysis", "Poison 3")
  description: string     // Flavor text
}

export interface Quality {
  id: string
  name: string
  type: QualityTypeTag | QualityTypeTag[]
  dpCost: number
  description: string
  effect: string
  ranks?: number
  choiceId?: string
  choiceName?: string
}

export interface Digimon {
  id: string
  name: string
  species: string         // e.g., "Agumon", "Greymon"
  stage: DigimonStage
  attribute: DigimonAttribute
  family: DigimonFamily
  type: string            // e.g., "Dinosaur", "Dragon"
  baseStats: DigimonBaseStats
  derivedStats: DigimonDerivedStats
  attacks: Attack[]
  qualities: Quality[]
  dataOptimization: string | null  // e.g., "close-combat", "ranged-striker"
  baseDP: number          // DP used for building
  bonusDP: number         // Earned through play
  currentWounds: number
  currentStance: Stance
  evolutionPathIds: string[]  // IDs of evolutions this can evolve to
  partnerId: string | null    // Tamer ID if partnered
  isEnemy: boolean
  notes: string
  spriteUrl: string | null
  createdAt: Date
  updatedAt: Date
}

// === Encounter Types ===

export interface CombatParticipant {
  id: string
  type: 'tamer' | 'digimon'
  entityId: string        // Reference to Tamer or Digimon ID
  initiative: number
  initiativeRoll: number  // The 3d6 roll result
  actionsRemaining: {
    simple: number
    complex: number       // 1 complex = 2 simple
  }
  currentStance: Stance
  activeEffects: ActiveEffect[]
  isActive: boolean       // Currently taking turn
  hasActed: boolean       // Has completed turn this round
}

export interface ActiveEffect {
  id: string
  name: string
  type: 'buff' | 'debuff' | 'status'
  duration: number        // Rounds remaining
  source: string          // Who applied it
  description: string
}

export interface Encounter {
  id: string
  name: string
  description: string
  round: number
  phase: 'setup' | 'initiative' | 'combat' | 'ended'
  participants: CombatParticipant[]
  turnOrder: string[]     // Participant IDs in initiative order
  currentTurnIndex: number
  battleLog: BattleLogEntry[]
  hazards: EnvironmentHazard[]
  createdAt: Date
  updatedAt: Date
}

export interface BattleLogEntry {
  id: string
  timestamp: Date
  round: number
  actorId: string
  actorName: string
  action: string
  target: string | null
  result: string
  damage: number | null
  effects: string[]
}

export interface EnvironmentHazard {
  id: string
  name: string
  description: string
  effect: string
  affectedArea: string
  duration: number | null  // null = permanent
}

// === Campaign Types ===

export interface Campaign {
  id: string
  name: string
  description: string
  level: CampaignLevel
  tamers: string[]        // Tamer IDs
  encounters: string[]    // Encounter IDs
  currentEncounterId: string | null
  createdAt: Date
  updatedAt: Date
}

// === Utility Functions ===

export function calculateTamerDerivedStats(
  attributes: TamerAttributes,
  skills: TamerSkills
): TamerDerivedStats {
  return {
    woundBoxes: Math.max(2, attributes.body + skills.endurance),
    speed: attributes.agility + skills.survival,
    accuracyPool: attributes.agility + skills.fight,
    dodgePool: attributes.agility + skills.dodge,
    armor: attributes.body + skills.endurance,
    damage: attributes.body + skills.fight,
  }
}

export function calculateDigimonDerivedStats(
  baseStats: DigimonBaseStats,
  stage: DigimonStage,
  sizeBonus: number = 0
): DigimonDerivedStats {
  const config = STAGE_CONFIG[stage]

  // Primary Derived Stats (page 111) - always round down
  const brains = Math.floor(baseStats.accuracy / 2) + config.brains
  const body = Math.floor((baseStats.health + baseStats.damage + baseStats.armor) / 3) + sizeBonus
  const agility = Math.floor((baseStats.accuracy + baseStats.dodge) / 2) + sizeBonus

  // Spec Values (page 111) - derived from derived stats
  const bit = Math.floor(brains / 10) + config.stageBonus
  const cpu = Math.floor(body / 10) + config.stageBonus
  const ram = Math.floor(agility / 10) + config.stageBonus

  return {
    brains,
    body,
    agility,
    woundBoxes: baseStats.health + config.woundBonus,
    bit,
    cpu,
    ram,
    movement: config.movement,
  }
}

export function rollInitiative(agility: number): { total: number; roll: number } {
  // 3d6 + Agility
  const roll = Math.floor(Math.random() * 6) + 1 +
               Math.floor(Math.random() * 6) + 1 +
               Math.floor(Math.random() * 6) + 1
  return { total: roll + agility, roll }
}

export function getTormentBoxCount(severity: TormentSeverity): number {
  switch (severity) {
    case 'minor': return 5
    case 'major': return 7
    case 'terrible': return 10
  }
}
