import { eq } from 'drizzle-orm'
import { db, encounters, digimon, tamers } from '../../../../db'

interface AttackActionBody {
  participantId: string
  attackId: string
  targetId: string
  accuracyDicePool: number
  accuracySuccesses: number
  accuracyDiceResults: number[]
  tamerId: string
  bolstered?: boolean
  bolsterType?: 'damage-accuracy' | 'bit-cpu'
}

export default defineEventHandler(async (event) => {
  const encounterId = getRouterParam(event, 'id')
  const body = await readBody<AttackActionBody>(event)

  if (!encounterId) {
    throw createError({
      statusCode: 400,
      message: 'Encounter ID is required',
    })
  }

  if (!body.participantId || !body.attackId || !body.targetId || !body.tamerId ||
      body.accuracyDicePool === undefined || body.accuracySuccesses === undefined ||
      !body.accuracyDiceResults) {
    throw createError({
      statusCode: 400,
      message: 'participantId, attackId, targetId, accuracyDicePool, accuracySuccesses, accuracyDiceResults, and tamerId are required',
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
  const pendingRequests = parseJsonField(encounter.pendingRequests) || []

  // Validate participant exists and is active
  const actor = participants.find((p: any) => p.id === body.participantId)
  if (!actor) {
    throw createError({
      statusCode: 404,
      message: 'Participant not found',
    })
  }

  // Check if participant can act (direct turn or partner digimon on tamer's turn)
  const currentIndex = encounter.currentTurnIndex || 0
  const currentTurnParticipantId = turnOrder[currentIndex]

  let canAct = actor.id === currentTurnParticipantId

  // If actor is a digimon and it's not directly their turn,
  // check if it's their partner tamer's turn
  if (!canAct && actor.type === 'digimon') {
    // Find current turn participant
    const currentTurnParticipant = participants.find((p: any) => p.id === currentTurnParticipantId)

    // Check if current participant is a tamer
    if (currentTurnParticipant?.type === 'tamer') {
      // Look up digimon to get partnerId
      const [digimonEntity] = await db.select().from(digimon).where(eq(digimon.id, actor.entityId))

      if (digimonEntity?.partnerId === currentTurnParticipant.entityId) {
        canAct = true
      }
    }
  }

  if (!canAct) {
    throw createError({
      statusCode: 403,
      message: 'It is not this participant\'s turn',
    })
  }

  // Validate target exists
  const target = participants.find((p: any) => p.id === body.targetId)
  if (!target) {
    throw createError({
      statusCode: 404,
      message: 'Target not found',
    })
  }

  // Bolster validation (digimon only)
  if (body.bolstered && actor.type === 'digimon') {
    // Check battle-wide bolster limit (max 2 per digimon per battle)
    if ((actor.digimonBolsterCount ?? 0) >= 2) {
      throw createError({
        statusCode: 403,
        message: 'Digimon has already bolstered the maximum of 2 times this battle',
      })
    }

    // Check BIT/CPU bolster cooldown (once every 2 rounds)
    if (body.bolsterType === 'bit-cpu' && actor.lastBitCpuBolsterRound !== undefined) {
      if (encounter.round - actor.lastBitCpuBolsterRound < 2) {
        throw createError({
          statusCode: 403,
          message: 'BIT/CPU bolster can only be used once every 2 rounds',
        })
      }
    }

    // Check for Signature tag (cannot bolster Signature attacks)
    if (actor.type === 'digimon') {
      const [actorDigimon] = await db.select().from(digimon).where(eq(digimon.id, actor.entityId))
      if (actorDigimon?.attacks) {
        const attacks = typeof actorDigimon.attacks === 'string'
          ? JSON.parse(actorDigimon.attacks) : actorDigimon.attacks
        const attackDef = attacks?.find((a: any) => a.id === body.attackId)
        if (attackDef?.tags?.some((t: string) => t.toLowerCase().includes('signature'))) {
          throw createError({
            statusCode: 403,
            message: 'Cannot bolster a Signature Move',
          })
        }
      }
    }
  }

  // Attacks cost 1 simple action, or 2 if bolstered
  const actionCostSimple = body.bolstered ? 2 : 1

  // Validate participant has enough actions
  if ((actor.actionsRemaining?.simple || 0) < actionCostSimple) {
    throw createError({
      statusCode: 403,
      message: 'Not enough actions remaining',
    })
  }

  // Create new participant with decremented actions and tracked used attack
  // Dodge penalty is incremented later when dodge response is processed (responses.post.ts)
  // Also consume any "Directed" effect on the attacker (bonus was applied client-side to accuracy pool)
  const updatedParticipants = participants.map((p: any) => {
    if (p.id === body.participantId) {
      const updated: any = {
        ...p,
        actionsRemaining: {
          simple: Math.max(0, (p.actionsRemaining?.simple || 0) - actionCostSimple),
        },
        usedAttackIds: [...(p.usedAttackIds || []), body.attackId],
        activeEffects: (p.activeEffects || []).filter((e: any) => e.name !== 'Directed'),
      }
      // Track bolster usage for digimon
      if (body.bolstered && p.type === 'digimon') {
        updated.digimonBolsterCount = (p.digimonBolsterCount ?? 0) + 1
        if (body.bolsterType === 'bit-cpu') {
          updated.lastBitCpuBolsterRound = encounter.round
        }
      }
      return updated
    }
    return p
  })

  // Add battle log entry for the attack
  const attackLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    round: encounter.round,
    actorId: actor.id,
    actorName: actor.type === 'tamer' ? `Tamer ${actor.entityId}` : `Digimon ${actor.entityId}`,
    action: 'Attack',
    target: target.type === 'tamer' ? `Tamer ${target.entityId}` : `Digimon ${target.entityId}`,
    result: `${body.accuracyDicePool}d6 => [${body.accuracyDiceResults.join(',')}] = ${body.accuracySuccesses} successes`,
    damage: null,
    effects: ['Attack', 'Accuracy Roll'],
  }

  const updatedBattleLog = [...battleLog, attackLogEntry]

  // Auto-miss: 0 accuracy successes = automatic miss, no dodge request needed
  if (body.accuracySuccesses === 0) {
    const missLogEntry = {
      id: `log-${Date.now()}-miss`,
      timestamp: new Date().toISOString(),
      round: encounter.round,
      actorId: actor.id,
      actorName: actor.type === 'tamer' ? `Tamer ${actor.entityId}` : `Digimon ${actor.entityId}`,
      action: 'Attack Result',
      target: target.type === 'tamer' ? `Tamer ${target.entityId}` : `Digimon ${target.entityId}`,
      result: 'AUTO MISS - 0 accuracy successes',
      damage: 0,
      effects: ['Miss'],
      hit: false,
    }

    updatedBattleLog.push(missLogEntry)

    const updateData: any = {
      participants: JSON.stringify(updatedParticipants),
      battleLog: JSON.stringify(updatedBattleLog),
      updatedAt: new Date(),
    }

    await db.update(encounters).set(updateData).where(eq(encounters.id, encounterId))

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
  }

  // Determine targetTamerId based on whether target is NPC or player
  let targetTamerId: string | null = null
  let targetDigimon: any = null  // Declare outside if block for reuse

  if (target.type === 'tamer') {
    targetTamerId = target.entityId
  } else if (target.type === 'digimon') {
    // Check if this is an NPC enemy or a player's partner digimon
    const [targetDigimonQuery] = await db.select().from(digimon).where(eq(digimon.id, target.entityId))
    targetDigimon = targetDigimonQuery
    if (targetDigimon?.isEnemy) {
      // NPC enemy - use 'GM' as targetTamerId
      targetTamerId = 'GM'
    } else {
      // Player's partner digimon - use the partner's tamer ID
      targetTamerId = targetDigimon?.partnerId || null
    }
  }

  // Get attacker name
  let attackerName = 'Unknown'
  let attackerDigimonEntity = null

  if (actor.type === 'tamer') {
    // Query tamer table for name
    const [tamerEntity] = await db.select().from(tamers).where(eq(tamers.id, actor.entityId))
    attackerName = tamerEntity?.name || `Tamer ${actor.entityId}`
  } else if (actor.type === 'digimon') {
    // Query digimon table for name
    const [digimonEntity] = await db.select().from(digimon).where(eq(digimon.id, actor.entityId))
    attackerDigimonEntity = digimonEntity
    attackerName = digimonEntity?.name || `Digimon ${actor.entityId}`
  }

  // Get target name
  let targetNameStr = 'Unknown'
  if (target.type === 'tamer') {
    const [tamerEntity] = await db.select().from(tamers).where(eq(tamers.id, target.entityId))
    targetNameStr = tamerEntity?.name || `Tamer ${target.entityId}`
  } else if (target.type === 'digimon') {
    // targetDigimon was already queried on line 157
    targetNameStr = targetDigimon?.name || `Digimon ${target.entityId}`
  }

  // Get attack name from the digimon's attacks array
  let attackNameStr = body.attackId  // Fallback to ID
  if (actor.type === 'digimon' && attackerDigimonEntity?.attacks) {
    // Parse attacks if it's a JSON string
    const attacks = typeof attackerDigimonEntity.attacks === 'string'
      ? JSON.parse(attackerDigimonEntity.attacks)
      : attackerDigimonEntity.attacks

    const attackObj = attacks.find((a: any) => a.id === body.attackId)
    attackNameStr = attackObj?.name || body.attackId
  }

  const dodgeRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'dodge-roll',
    targetTamerId: targetTamerId,
    targetParticipantId: target.id,
    timestamp: new Date().toISOString(),
    data: {
      attackId: body.attackId,
      attackName: attackNameStr,
      attackerName: attackerName,
      attackerParticipantId: body.participantId,
      attackerEntityId: actor.entityId,
      targetName: targetNameStr,
      targetEntityId: target.entityId,
      // Store accuracy dice data for later comparison when dodge response comes in
      accuracyDicePool: body.accuracyDicePool,
      accuracySuccesses: body.accuracySuccesses,
      accuracyDiceResults: body.accuracyDiceResults,
      // Pre-increment dodge penalty for this specific roll
      dodgePenalty: target.dodgePenalty ?? 0,
      // Bolster bonuses (stored for damage/effect calculation in responses.post.ts)
      bolstered: body.bolstered || false,
      bolsterType: body.bolsterType || null,
      bolsterDamageBonus: body.bolstered && body.bolsterType === 'damage-accuracy' ? 2 : 0,
      bolsterBitCpuBonus: body.bolstered && body.bolsterType === 'bit-cpu' ? 1 : 0,
    },
  }

  const updatedRequests = [...pendingRequests, dodgeRequest]

  // Update encounter
  const updateData: any = {
    participants: JSON.stringify(updatedParticipants),
    battleLog: JSON.stringify(updatedBattleLog),
    pendingRequests: JSON.stringify(updatedRequests),
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
