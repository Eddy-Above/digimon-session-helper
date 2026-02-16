import { eq } from 'drizzle-orm'
import { db, encounters, digimon, evolutionLines } from '../../../../db'
import { STAGE_CONFIG } from '../../../../../types'
import type { DigimonStage } from '../../../../../types'

interface DigivolveBody {
  participantId: string
  targetChainIndex: number
}

export default defineEventHandler(async (event) => {
  const encounterId = getRouterParam(event, 'id')
  const body = await readBody<DigivolveBody>(event)

  if (!encounterId) {
    throw createError({ statusCode: 400, message: 'Encounter ID is required' })
  }

  if (!body.participantId || body.targetChainIndex === undefined) {
    throw createError({ statusCode: 400, message: 'participantId and targetChainIndex are required' })
  }

  // Fetch encounter
  const [encounter] = await db.select().from(encounters).where(eq(encounters.id, encounterId))
  if (!encounter) {
    throw createError({ statusCode: 404, message: 'Encounter not found' })
  }

  const parseJsonField = (field: any) => {
    if (!field) return []
    if (Array.isArray(field)) return field
    if (typeof field === 'string') {
      try { return JSON.parse(field) } catch { return [] }
    }
    return []
  }

  let participants = parseJsonField(encounter.participants)
  const turnOrder = parseJsonField(encounter.turnOrder)
  const battleLog = parseJsonField(encounter.battleLog)

  // Find participant
  const participant = participants.find((p: any) => p.id === body.participantId)
  if (!participant) {
    throw createError({ statusCode: 404, message: 'Participant not found' })
  }

  if (participant.type !== 'digimon') {
    throw createError({ statusCode: 400, message: 'Only digimon can digivolve' })
  }

  if (!participant.evolutionLineId) {
    throw createError({ statusCode: 400, message: 'Participant has no evolution line' })
  }

  // Validate participant can act (direct turn or partner tamer's turn)
  const currentIndex = encounter.currentTurnIndex || 0
  const currentTurnParticipantId = turnOrder[currentIndex]
  let canAct = participant.id === currentTurnParticipantId
  let tamerParticipant: any = null

  if (participant.type === 'digimon') {
    const [digimonEntity] = await db.select().from(digimon).where(eq(digimon.id, participant.entityId))
    if (digimonEntity?.partnerId) {
      tamerParticipant = participants.find(
        (p: any) => p.type === 'tamer' && p.entityId === digimonEntity.partnerId
      )
      if (tamerParticipant && tamerParticipant.id === currentTurnParticipantId) {
        canAct = true
      }
    }
  }

  if (!canAct) {
    throw createError({ statusCode: 400, message: 'Participant cannot act right now' })
  }

  // Determine who pays the action cost: tamer for partner digimon, digimon itself for NPCs
  const actingParticipant = tamerParticipant ?? participant
  const isNpc = !tamerParticipant

  // Check action cost (1 simple action from tamer or digimon)
  if ((actingParticipant.actionsRemaining?.simple || 0) < 1) {
    throw createError({ statusCode: 400, message: 'Not enough actions to digivolve' })
  }

  // Fetch evolution line
  const [evoLine] = await db.select().from(evolutionLines).where(eq(evolutionLines.id, participant.evolutionLineId))
  if (!evoLine) {
    throw createError({ statusCode: 404, message: 'Evolution line not found' })
  }

  const chain = typeof evoLine.chain === 'string' ? JSON.parse(evoLine.chain) : evoLine.chain
  const currentStageIndex = (isNpc && (participant as any).npcStageIndex !== undefined)
    ? (participant as any).npcStageIndex
    : evoLine.currentStageIndex

  // Validate target chain index
  if (body.targetChainIndex < 0 || body.targetChainIndex >= chain.length) {
    throw createError({ statusCode: 400, message: 'Target chain index out of range' })
  }

  // Validate current stage index (guard against stale/corrupted DB value)
  if (currentStageIndex < 0 || currentStageIndex >= chain.length) {
    throw createError({ statusCode: 500, message: `Evolution line has invalid currentStageIndex: ${currentStageIndex} (chain length: ${chain.length})` })
  }

  const targetEntry = chain[body.targetChainIndex]
  const currentEntry = chain[currentStageIndex]

  // Determine if this is evolve or devolve
  const isEvolve = targetEntry.evolvesFromIndex === currentStageIndex
  const isDevolve = currentEntry.evolvesFromIndex === body.targetChainIndex

  if (!isEvolve && !isDevolve) {
    throw createError({ statusCode: 400, message: 'Target must be a direct child (evolve) or parent (devolve) of current form' })
  }

  if (isEvolve && !targetEntry.isUnlocked) {
    throw createError({ statusCode: 400, message: 'Target evolution stage is locked' })
  }

  // Only one digivolve attempt per turn (evolving only, devolving is always allowed)
  if (isEvolve && actingParticipant.hasAttemptedDigivolve) {
    throw createError({ statusCode: 400, message: 'Already attempted digivolution this turn' })
  }

  // Fetch new digimon to get stats
  const [newDigimon] = await db.select().from(digimon).where(eq(digimon.id, targetEntry.digimonId))
  if (!newDigimon) {
    throw createError({ statusCode: 404, message: 'Target digimon not found in library' })
  }

  // Calculate new max wounds
  const baseStats = typeof newDigimon.baseStats === 'string' ? JSON.parse(newDigimon.baseStats) : newDigimon.baseStats
  const bonusStats = typeof newDigimon.bonusStats === 'string' ? JSON.parse(newDigimon.bonusStats) : newDigimon.bonusStats
  const newStage = (newDigimon.stage || targetEntry.stage) as DigimonStage
  const stageConfig = STAGE_CONFIG[newStage]
  const newMaxWounds = (baseStats?.health || 0) + (bonusStats?.health || 0) + (stageConfig?.woundBonus || 0)

  // Update participant
  const oldName = currentEntry.species
  const newName = targetEntry.species

  participants = participants.map((p: any) => {
    const isActingParticipant = p.id === actingParticipant.id
    const isDigivolving = p.id === body.participantId

    if (!isActingParticipant && !isDigivolving) return p

    // Build action-cost changes (apply to acting participant — tamer or NPC digimon)
    const actionChanges = isActingParticipant
      ? {
          actionsRemaining: { simple: Math.max(0, (p.actionsRemaining?.simple || 0) - 1) },
          ...(isEvolve ? { hasAttemptedDigivolve: true } : {}),
        }
      : {}

    // Build evolution changes (apply to the digivolving participant)
    let evoChanges: any = {}
    if (isDigivolving) {
      if (isEvolve) {
        // Evolve: store current wounds in history, full heal
        const woundsHistory = [...(p.woundsHistory || [])]
        woundsHistory.push({
          stageIndex: currentStageIndex,
          wounds: p.currentWounds || 0,
          entityId: p.entityId,
          maxWounds: p.maxWounds,
        })
        evoChanges = {
          entityId: newDigimon.id,
          maxWounds: newMaxWounds,
          currentWounds: 0,
          woundsHistory,
          ...(isNpc ? { npcStageIndex: body.targetChainIndex } : {}),
        }
      } else {
        // Devolve: restore wounds from history
        const woundsHistory = [...(p.woundsHistory || [])]
        const previousState = woundsHistory.pop()
        evoChanges = {
          entityId: previousState?.entityId || newDigimon.id,
          maxWounds: previousState?.maxWounds || newMaxWounds,
          currentWounds: previousState?.wounds ?? 0,
          woundsHistory,
          ...(isNpc ? { npcStageIndex: previousState?.stageIndex ?? body.targetChainIndex } : {}),
        }
      }
    }

    return { ...p, ...actionChanges, ...evoChanges }
  })

  // Update evolution line currentStageIndex (skip for NPCs, they track stage on participant)
  if (!isNpc) {
    await db.update(evolutionLines).set({
      currentStageIndex: body.targetChainIndex,
      updatedAt: new Date(),
    }).where(eq(evolutionLines.id, participant.evolutionLineId))
  }

  // Add battle log entry
  const logEntry = {
    id: `log-${Date.now()}-digivolve`,
    timestamp: new Date().toISOString(),
    round: encounter.round || 0,
    actorId: body.participantId,
    actorName: oldName,
    action: isEvolve ? `digivolved to ${newName}!` : `devolved to ${newName}!`,
    target: null,
    result: isEvolve ? 'Full heal' : `Wounds restored to ${participants.find((p: any) => p.id === body.participantId)?.currentWounds || 0}`,
    damage: null,
    effects: [],
  }

  // Update encounter
  await db.update(encounters).set({
    participants: JSON.stringify(participants),
    battleLog: JSON.stringify([...battleLog, logEntry]),
    updatedAt: new Date(),
  }).where(eq(encounters.id, encounterId))

  const [updated] = await db.select().from(encounters).where(eq(encounters.id, encounterId))

  if (!updated) {
    throw createError({ statusCode: 500, message: 'Failed to retrieve encounter after update' })
  }

  return {
    ...updated,
    participants: parseJsonField(updated.participants),
    turnOrder: parseJsonField(updated.turnOrder),
    battleLog: parseJsonField(updated.battleLog),
    pendingRequests: parseJsonField(updated.pendingRequests),
    requestResponses: parseJsonField(updated.requestResponses),
    hazards: parseJsonField(updated.hazards),
  }
})
