/**
 * Tamer skills constants and mappings
 * Extracted from duplicated form pages
 */

import type { SkillRenames } from '../types'

export const skillsByAttribute = {
  agility: ['dodge', 'fight', 'stealth'],
  body: ['athletics', 'endurance', 'featsOfStrength'],
  charisma: ['manipulate', 'perform', 'persuasion'],
  intelligence: ['computer', 'survival', 'knowledge'],
  willpower: ['perception', 'decipherIntent', 'bravery'],
} as const

export const skillLabels: Record<string, string> = {
  dodge: 'Dodge',
  fight: 'Fight',
  stealth: 'Stealth',
  athletics: 'Athletics',
  endurance: 'Endurance',
  featsOfStrength: 'Feats of Strength',
  manipulate: 'Manipulate',
  perform: 'Perform',
  persuasion: 'Persuasion',
  computer: 'Computer',
  survival: 'Survival',
  knowledge: 'Knowledge',
  perception: 'Perception',
  decipherIntent: 'Decipher Intent',
  bravery: 'Bravery',
}

export const attributes = ['agility', 'body', 'charisma', 'intelligence', 'willpower'] as const
export type Attribute = typeof attributes[number]
export type SkillName = keyof typeof skillLabels

export function getResolvedSkillLabels(renames?: SkillRenames): Record<string, string> {
  if (!renames || Object.keys(renames).length === 0) return skillLabels
  const resolved = { ...skillLabels }
  for (const [key, customName] of Object.entries(renames)) {
    if (key in resolved && customName && customName.trim()) {
      resolved[key] = customName.trim()
    }
  }
  return resolved
}
