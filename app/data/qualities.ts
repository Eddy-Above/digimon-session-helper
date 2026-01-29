// Digimon Qualities Database - DDA 1.4
// Free Qualities (0 DP) and Negative Qualities (negative DP)

export type QualityTypeTag = 'static' | 'trigger' | 'attack' // [S], [T], [A]

export interface QualityTemplate {
  id: string
  name: string
  type: 'free' | 'negative'
  qualityType: QualityTypeTag | QualityTypeTag[] // [S], [T], [A] or combinations like [S, T]
  dpCost: number
  maxRanks: number
  prerequisites: string[]
  effect: string
  description: string
}

export const QUALITY_DATABASE: QualityTemplate[] = [
  // === FREE QUALITIES (0 DP) ===
  {
    id: 'job-well-done',
    name: 'A Job Well Done',
    type: 'free',
    qualityType: 'trigger',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Roll 1d6 at start of combat for random benefit or penalty.',
    effect: `At the start of combat, roll 1d6:
• 6: Gain Temporary Wound Boxes equal to Stage Bonus, and Damage Bonus equal to Stage Bonus for the battle. Temporary Wound Boxes may stack with other qualities.
• 3-5: No effect.
• 2: Stage Bonus penalty to Armor for the battle. Applies even if the Digimon evolves.
• 1: Stage Bonus penalty to highest stat, and immediate damage equal to Stage Bonus. Applies even if the Digimon evolves, persists for the battle.`,
  },
  {
    id: 'ammo',
    name: 'Ammo',
    type: 'free',
    qualityType: 'attack',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Gain use of [Ammo] tag for consecutive attacks (up to 5 times).',
    effect: `Gain use of the [Ammo] Tag. Can only be applied to a move with three Attack Tags, including [Damage/Support] [Melee/Ranged]. Allows the move to be used up to 5 times consecutively within a round. Once out of ammo, cannot use that attack for the rest of battle. Cannot apply to [Signature Move].`,
  },
  {
    id: 'fragile-equipment',
    name: 'Fragile Equipment',
    type: 'free',
    qualityType: ['static', 'attack'],
    dpCost: 0,
    maxRanks: 1,
    prerequisites: ['Weapon or Armor Increasing Quality'],
    description: 'Equipment may break but can deal extra damage. Check cannot be rerolled.',
    effect: `Attack ([Weapon] Tagged):
• Roll 1d6 on successful hit. On 1, weapon breaks and all [Weapon] attacks cannot be used for the battle. On 6, +Stage Bonus damage for that attack.

Armor (Applied to Digimon):
• Roll 1d6 when hit. On 1, armor breaks and no longer benefits from Armor-improving Qualities for the battle. On 6, +Stage Bonus Armor against that attack.`,
  },
  {
    id: 'inconsistent-size',
    name: 'Inconsistent Size',
    type: 'free',
    qualityType: 'trigger',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Random size upon evolution.',
    effect: `Upon evolution, roll 1d6:
• 1-2: Medium
• 3-4: Large
• 5-6: Huge
Size remains until end of combat and devolve. Size cannot be changed.`,
  },
  {
    id: 'violent-overwrite',
    name: 'Violent Overwrite',
    type: 'free',
    qualityType: 'trigger',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Random damage or healing each round.',
    effect: `At start of every round, roll 1d6:
• 1: Take unalterable damage equal to Stage Bonus +1.
• 6: Recover Wound Boxes equal to Stage Bonus.`,
  },
  {
    id: 'merciful-mode',
    name: 'Merciful Mode',
    type: 'free',
    qualityType: 'static',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Attacks are non-lethal by default.',
    effect: `All attacks are non-lethal by default. Must declare lethal intent to delete enemies. Cannot take Offensive Stance.`,
  },
  {
    id: 'positive-reinforcement',
    name: 'Positive Reinforcement',
    type: 'free',
    qualityType: ['static', 'trigger'],
    dpCost: 0,
    maxRanks: 1,
    prerequisites: ['Cannot have Berserker'],
    description: 'Mood meter affects stats based on combat performance.',
    effect: `Gain a Mood Meter (1d6), starting at 3.
• Land or dodge attack: +1 Mood
• Miss attack or get hit: -1 Mood

Mood Effects:
• Mood 5-6 (Good): +1 Dodge and Damage per point above 4 (e.g., Mood 6 = +2 Dodge/Damage)
• Mood 3-4 (Neutral): No effect
• Mood 1-2 (Poor): -1 Accuracy and Armor per point below 3 (e.g., Mood 2 = -1 Accuracy/Armor)

If Mood drops to 1, Partner may use Complex Action to set Mood to 4.`,
  },
  {
    id: 'mind-over-matter',
    name: 'Mind over Matter',
    type: 'free',
    qualityType: 'static',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Trade stats for Prodigious Skills.',
    effect: `-1 to all stats. Select two skills from a single Attribute Category (excluding Agility) to treat as Prodigious Skill. Both must come from the same category.

Example: If Body selected, choose two from Athletics, Endurance, or Feats of Strength.`,
  },
  {
    id: 'justice-is-blind',
    name: 'Justice is Blind',
    type: 'free',
    qualityType: 'static',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Blind Digimon with unique combat rules.',
    effect: `• Prodigious Skill: Perception for auditory checks and challenging Hide in Plain Sight (without demerit)
• Auto-fail any visual-based checks
• Melee attacks gain [Close Blast] for free, Ranged attacks gain [Cone] for free
• May have multiple instances of above tags, but cannot buy other [Area Attack] tags
• Cannot benefit from Selective Targeting
• Single-target attacks require Tamer Complex Direct (not counted as Bolstered)`,
  },

  // === NEGATIVE QUALITIES (Negative DP) ===
  {
    id: 'bulky',
    name: 'Bulky',
    type: 'negative',
    qualityType: 'static',
    dpCost: -1,
    maxRanks: 3,
    prerequisites: [],
    description: 'Reduced movement speed.',
    effect: `Per Rank: Base Movement lowered by 3. Cannot take if Movement would drop to 1 or lower.`,
  },
  {
    id: 'vulnerable',
    name: 'Vulnerable',
    type: 'negative',
    qualityType: 'static',
    dpCost: -2,
    maxRanks: 1,
    prerequisites: [],
    description: 'Negative effects last longer, positive effects shorter.',
    effect: `Incoming [Negative Effects] duration +1. Incoming [Positive Effects] duration -1.`,
  },
  {
    id: 'disobedient',
    name: 'Disobedient',
    type: 'negative',
    qualityType: 'static',
    dpCost: -1,
    maxRanks: 1,
    prerequisites: [],
    description: 'Tamer Directs are less effective.',
    effect: `All base Tamer Directs suffer -2 demerit. Example: Tamer with 4 Charisma directing Accuracy gives +2 instead of +4.`,
  },
  {
    id: 'rebellious-stage',
    name: 'Rebellious Stage',
    type: 'negative',
    qualityType: ['static', 'trigger'],
    dpCost: -1,
    maxRanks: 1,
    prerequisites: ['Disobedient'],
    description: 'May refuse to listen to Tamer.',
    effect: `Once per round, roll 1d6. On 1, Digimon refuses orders.

Tamer must make Charisma Check (Complex Action):
• TN 12 (Standard), 14 (Enhanced), 16 (Extreme)
• Pass: One Simple Action remains, control Digimon normally
• Fail: Digimon's next action counts as Complex Action`,
  },
  {
    id: 'full-action',
    name: 'Full Action',
    type: 'negative',
    qualityType: 'attack',
    dpCost: -3,
    maxRanks: 1,
    prerequisites: ['Signature Move'],
    description: 'Signature Move requires Complex Action.',
    effect: `Gain use of [Full Action] tag, must apply to Signature Move. Makes the attack require a Complex Action instead of Simple Action.`,
  },
  {
    id: 'light-hit',
    name: 'Light Hit',
    type: 'negative',
    qualityType: 'attack',
    dpCost: -1,
    maxRanks: 3,
    prerequisites: ['Armor Piercing Rank X'],
    description: 'Armor Piercing requires extra successes.',
    effect: `Must be attached to Attack with Armor Piercing. Per Rank: Attack needs X additional Successes for Armor Piercing to trigger.`,
  },
  {
    id: 'klutz',
    name: 'Klutz',
    type: 'negative',
    qualityType: 'static',
    dpCost: -2,
    maxRanks: 1,
    prerequisites: ['Selective Targeting'],
    description: 'Area attacks may hit allies.',
    effect: `On [Area] Attack, roll 1d6 (ignores Selective Targeting):
• 5-6: Works as normal
• 3-4: May hit every Digimon present, including allies
• 1: Only damages allies and applies negative effects to them, while applying positive effects to enemies`,
  },
  {
    id: 'underwhelming',
    name: 'Underwhelming',
    type: 'negative',
    qualityType: 'trigger',
    dpCost: -2,
    maxRanks: 2,
    prerequisites: ['Huge Power (Rank 1)', 'Overkill (Rank 2)'],
    description: 'Must reroll successful dice. Only applies to [Damage] attacks.',
    effect: `Rank 1 (requires Huge Power): Huge Power always activates on first attack. Second attack must reroll all 5s, take second result.

Rank 2 (requires Overkill): First attack activates both Huge Power and Overkill. Second attack must reroll all successful Accuracy dice, take second result.`,
  },
  {
    id: 'broadside',
    name: 'Broadside',
    type: 'negative',
    qualityType: 'trigger',
    dpCost: -2,
    maxRanks: 2,
    prerequisites: ['Agility (Rank 1)', 'Avoidance (Rank 2)'],
    description: 'Must reroll successful dodge dice.',
    effect: `Rank 1 (requires Agility): After Agility triggers, must reroll all 5s on next dodge, take second result.

Rank 2 (requires Avoidance): After Agility and Avoidance trigger, must reroll all successful Dodge dice, take second result.`,
  },
  {
    id: 'decreased-derived-stat',
    name: 'Decreased Derived Stat',
    type: 'negative',
    qualityType: 'static',
    dpCost: -1,
    maxRanks: 5,
    prerequisites: ['Improved Derived Stat'],
    description: 'Lower a Derived Stat.',
    effect: `Per Rank: Lower one Derived Stat by 1. Can only decrease Derived Stats not affected by Improved Derived Stat.`,
  },
]

// Negative Quality limits by stage
export const NEGATIVE_QUALITY_LIMITS: Record<string, number> = {
  'fresh': 0,
  'in-training': 0,
  'rookie': 1,
  'champion': 2,
  'ultimate': 3,
  'mega': 4,
  'ultra': 5,
}

// Get qualities by type
export function getQualitiesByType(type: 'free' | 'negative'): QualityTemplate[] {
  return QUALITY_DATABASE.filter((q) => q.type === type)
}

// Get free qualities
export function getFreeQualities(): QualityTemplate[] {
  return getQualitiesByType('free')
}

// Get negative qualities
export function getNegativeQualities(): QualityTemplate[] {
  return getQualitiesByType('negative')
}

// Get max negative DP for a stage
export function getMaxNegativeDP(stage: string): number {
  return NEGATIVE_QUALITY_LIMITS[stage] || 0
}

// Search qualities
export function searchQualities(query: string): QualityTemplate[] {
  const lower = query.toLowerCase()
  return QUALITY_DATABASE.filter(
    (q) =>
      q.name.toLowerCase().includes(lower) ||
      q.description.toLowerCase().includes(lower) ||
      q.effect.toLowerCase().includes(lower)
  )
}

// Helper to get quality type tags as array
export function getQualityTypeTags(qualityType: QualityTypeTag | QualityTypeTag[]): QualityTypeTag[] {
  return Array.isArray(qualityType) ? qualityType : [qualityType]
}
