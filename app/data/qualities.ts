// Digimon Qualities Database - DDA 1.4
// Free Qualities (0 DP) and Negative Qualities (negative DP)

export interface QualityTemplate {
  id: string
  name: string
  type: 'free' | 'negative'
  qualityType: 'static' | 'trigger' | 'attack' // [S], [T], [A]
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
• 6: Gain Temporary Wound Boxes and Damage Bonus equal to Stage Bonus
• 3-5: No effect
• 2: Stage Bonus penalty to Armor for the battle
• 1: Stage Bonus penalty to highest stat + immediate damage equal to Stage Bonus`,
  },
  {
    id: 'ammo',
    name: 'Ammo',
    type: 'free',
    qualityType: 'attack',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: [],
    description: 'Gain use of [Ammo] tag for consecutive attacks.',
    effect: `Gain use of the [Ammo] Tag. Can use the attack up to 5 times consecutively within a round. Once out of ammo, cannot use that attack for the rest of battle. Cannot apply to [Signature Move].`,
  },
  {
    id: 'fragile-equipment',
    name: 'Fragile Equipment',
    type: 'free',
    qualityType: 'static',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: ['Weapon or Armor Quality'],
    description: 'Equipment may break but can deal extra damage.',
    effect: `Attack: Roll 1d6 on [Weapon] hit. On 1, weapon breaks. On 6, +Stage Bonus damage.
Armor: Roll 1d6 when hit. On 1, armor breaks. On 6, +Stage Bonus armor for that attack.`,
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
Size remains until devolve.`,
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
• 1: Take unalterable damage equal to Stage Bonus +1
• 6: Recover Wound Boxes equal to Stage Bonus`,
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
    qualityType: 'static',
    dpCost: 0,
    maxRanks: 1,
    prerequisites: ['Cannot have Berserker'],
    description: 'Mood meter affects stats based on combat performance.',
    effect: `Gain a Mood Meter (1d6), starting at 3.
• Land/dodge attack: +1 Mood
• Miss/get hit: -1 Mood
• Mood 5-6 (Good): +1 Dodge and Damage per point above 4
• Mood 3-4 (Neutral): No effect
• Mood 1-2 (Poor): -1 Accuracy and Armor per point below 3
Partner can use Complex Action to set Mood to 4 if at 1.`,
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
    effect: `-1 to all stats. Select two skills from a single Attribute Category (excluding Agility) to treat as Prodigious Skill.`,
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
    effect: `• Prodigious Skill: Perception for auditory checks
• Auto-fail visual checks
• Melee attacks gain [Close Blast], Ranged gain [Cone] for free
• Cannot benefit from Selective Targeting
• Single-target attacks require Tamer Complex Direct`,
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
    effect: `All base Tamer Directs suffer -2 demerit.`,
  },
  {
    id: 'rebellious-stage',
    name: 'Rebellious Stage',
    type: 'negative',
    qualityType: 'trigger',
    dpCost: -1,
    maxRanks: 1,
    prerequisites: ['Disobedient'],
    description: 'May refuse to listen to Tamer.',
    effect: `Once per round, roll 1d6. On 1, Digimon refuses orders. Tamer must make Charisma Check (Complex Action) TN 12/14/16 (Standard/Enhanced/Extreme). Pass: One Simple Action remains. Fail: Next action counts as Complex.`,
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
    effect: `Signature Move now requires a Complex Action instead of Simple Action.`,
  },
  {
    id: 'light-hit',
    name: 'Light Hit',
    type: 'negative',
    qualityType: 'attack',
    dpCost: -1,
    maxRanks: 3,
    prerequisites: ['Armor Piercing'],
    description: 'Armor Piercing requires extra successes.',
    effect: `Per Rank: Attack with Armor Piercing needs X additional Successes to trigger.`,
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
    effect: `On [Area] Attack, roll 1d6:
• 5-6: Normal
• 3-4: May hit all Digimon including allies
• 1: Only damages allies, applies negative effects to allies and positive to enemies`,
  },
  {
    id: 'underwhelming',
    name: 'Underwhelming',
    type: 'negative',
    qualityType: 'trigger',
    dpCost: -2,
    maxRanks: 2,
    prerequisites: ['Huge Power (Rank 1)', 'Overkill (Rank 2)'],
    description: 'Must reroll successful dice.',
    effect: `Rank 1: Huge Power always activates on first attack. Second attack must reroll all 5s.
Rank 2 (requires Overkill): First attack activates both. Second attack must reroll all successful Accuracy dice.`,
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
    effect: `Rank 1: After Agility triggers, must reroll all 5s on dodge.
Rank 2 (requires Avoidance): Must reroll all successful Dodge dice.`,
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
    effect: `Per Rank: Lower one Derived Stat by 1. Can only decrease stats not affected by Improved Derived Stat.`,
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
