import { db, digimon, type NewDigimon } from '../../db'
import { generateId } from '../../utils/id'
import {
  type DigimonStage,
  type DigimonAttribute,
  type DigimonSize,
  STAGE_CONFIG,
} from '../../../types'

interface CreateDigimonBody {
  name: string
  species: string
  stage: DigimonStage
  attribute: DigimonAttribute
  family: string
  type?: string
  size?: DigimonSize
  baseStats: {
    accuracy: number
    damage: number
    dodge: number
    armor: number
    health: number
  }
  attacks?: Array<{
    id: string
    name: string
    range: 'melee' | 'ranged'
    type: 'damage' | 'support'
    tags: string[]
    effect?: string
    description: string
  }>
  qualities?: Array<{
    id: string
    name: string
    type: 'static' | 'trigger' | 'attack' | Array<'static' | 'trigger' | 'attack'>
    dpCost: number
    description: string
    effect: string
    ranks?: number
    choiceId?: string
    choiceName?: string
  }>
  dataOptimization?: string
  bonusDP?: number
  partnerId?: string
  isEnemy?: boolean
  notes?: string
  spriteUrl?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateDigimonBody>(event)

  // Validate required fields (type is optional)
  if (!body.name || !body.species || !body.stage || !body.attribute || !body.family || !body.baseStats) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: name, species, stage, attribute, family, baseStats',
    })
  }

  // Validate stage
  if (!STAGE_CONFIG[body.stage]) {
    throw createError({
      statusCode: 400,
      message: `Invalid stage: ${body.stage}`,
    })
  }

  const id = generateId()
  const now = new Date()
  const stageConfig = STAGE_CONFIG[body.stage]

  const newDigimon: NewDigimon = {
    id,
    name: body.name,
    species: body.species,
    stage: body.stage,
    attribute: body.attribute,
    family: body.family,
    type: body.type || null,
    size: body.size || 'medium',
    baseStats: body.baseStats,
    attacks: body.attacks || [],
    qualities: body.qualities || [],
    dataOptimization: body.dataOptimization || null,
    baseDP: stageConfig.dp,
    bonusDP: body.bonusDP || 0,
    currentWounds: 0,
    currentStance: 'neutral',
    evolutionPathIds: [],
    evolvesFromId: null,
    partnerId: body.partnerId || null,
    isEnemy: body.isEnemy || false,
    notes: body.notes || '',
    spriteUrl: body.spriteUrl || null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.insert(digimon).values(newDigimon)
  } catch (e) {
    console.error('Database insert error:', e)
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : 'Database insert failed',
    })
  }

  return newDigimon
})
