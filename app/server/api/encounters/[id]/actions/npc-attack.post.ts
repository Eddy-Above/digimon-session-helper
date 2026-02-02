import { eq } from 'drizzle-orm'
import { db, encounters } from '../../../../db'

interface NpcAttackBody {
  participantId: string
  attackId: string
  targetId: string
  accuracyRoll: number
  dodgeRoll: number
}

export default defineEventHandler(async (event) => {
  const encounterId = getRouterParam(event, 'id')
  const body = await readBody<NpcAttackBody>(event)

  if (!encounterId) {
    throw createError({
      statusCode: 400,
      message: 'Encounter ID is required',
    })
  }

  if (!body.participantId || !body.attackId || !body.targetId ||
      body.accuracyRoll === undefined || body.dodgeRoll === undefined) {
    throw createError({
      statusCode: 400,
      message: 'participantId, attackId, targetId, accuracyRoll, and dodgeRoll are required',
    })
  }

  // Fetch encounter
  const [encounter] = await db.select().from(encounters).where(eq(encounters.id, encounterId))

  if (!encounter) {
    throw createError({
      statusCode: 404,
      message: `Encounter with ID ${encounterId} not found`,
    })
  }

  // Parse JSON fields
  const parseJsonField = (field: any) => {
    if (!field) return []
    if (Array.isArray(field)) return field
    if (typeof field === 'string') {
      try {
        return JSON.parse(field)
      } catch {
        return []
      }
    }
    return []
  }

  const participants = parseJsonField(encounter.participants) || []
  const turnOrder = parseJsonField(encounter.turnOrder) || []
  const battleLog = parseJsonField(encounter.battleLog) || []

  // Validate attacker
  const actor = participants.find((p: any) => p.id === body.participantId)
  if (!actor) {
    throw createError({
      statusCode: 404,
      message: 'Attacker not found',
    })
  }

  // Validate it's attacker's turn
  const currentIndex = encounter.currentTurnIndex || 0
  const currentTurnParticipantId = turnOrder[currentIndex]
  if (actor.id !== currentTurnParticipantId) {
    throw createError({
      statusCode: 403,
      message: 'It is not this participant\'s turn',
    })
  }

  // Validate target
  const target = participants.find((p: any) => p.id === body.targetId)
  if (!target) {
    throw createError({
      statusCode: 404,
      message: 'Target not found',
    })
  }

  // Check actions
  const actionCost = 2
  if ((actor.actionsRemaining?.simple || 0) < actionCost) {
    throw createError({
      statusCode: 403,
      message: 'Not enough actions remaining',
    })
  }

  // Decrement attacker actions
  const updatedParticipants = participants.map((p: any) => {
    if (p.id === body.participantId) {
      return {
        ...p,
        actionsRemaining: {
          simple: Math.max(0, (p.actionsRemaining?.simple || 0) - actionCost),
        },
      }
    }
    return p
  })

  // Compare rolls and calculate outcome
  const hit = body.accuracyRoll >= body.dodgeRoll
  const damageDealt = hit ? 5 : 0  // TODO: Calculate actual damage from attack definition

  // Apply damage to target
  const finalParticipants = updatedParticipants.map((p: any) => {
    if (p.id === body.targetId && hit) {
      return {
        ...p,
        currentWounds: Math.min(p.maxWounds, (p.currentWounds || 0) + damageDealt),
      }
    }
    return p
  })

  // Add battle log entries
  const attackLogEntry = {
    id: `log-${Date.now()}-attack`,
    timestamp: new Date().toISOString(),
    round: encounter.round,
    actorId: actor.id,
    actorName: actor.type === 'tamer' ? `Tamer ${actor.entityId}` : `Digimon ${actor.entityId}`,
    action: 'Attack',
    target: target.type === 'tamer' ? `Tamer ${target.entityId}` : `Digimon ${target.entityId}`,
    result: `Accuracy: ${body.accuracyRoll}`,
    damage: null,
    effects: ['Attack'],
  }

  const dodgeLogEntry = {
    id: `log-${Date.now()}-dodge`,
    timestamp: new Date().toISOString(),
    round: encounter.round,
    actorId: target.id,
    actorName: target.type === 'tamer' ? `Tamer ${target.entityId}` : `Digimon ${target.entityId}`,
    action: 'Dodge',
    target: null,
    result: `Dodge: ${body.dodgeRoll} - ${hit ? 'HIT!' : 'MISS!'}`,
    damage: hit ? damageDealt : 0,
    effects: ['Dodge'],
  }

  const updatedBattleLog = [...battleLog, attackLogEntry, dodgeLogEntry]

  // Update encounter
  const updateData: any = {
    participants: JSON.stringify(finalParticipants),
    battleLog: JSON.stringify(updatedBattleLog),
    updatedAt: new Date(),
  }

  await db.update(encounters).set(updateData).where(eq(encounters.id, encounterId))

  // Return updated encounter
  const [updated] = await db.select().from(encounters).where(eq(encounters.id, encounterId))

  return {
    ...updated,
    participants: parseJsonField(updated.participants),
    turnOrder: parseJsonField(updated.turnOrder),
    battleLog: parseJsonField(updated.battleLog),
    hazards: parseJsonField(updated.hazards),
    pendingRequests: parseJsonField(updated.pendingRequests),
    requestResponses: parseJsonField(updated.requestResponses),
  }
})
