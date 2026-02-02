import { eq } from 'drizzle-orm'
import { db, encounters, digimon, tamers } from '../../../../db'

interface NpcAttackBody {
  participantId: string
  attackId: string
  targetId: string
  accuracyDicePool: number
  accuracySuccesses: number
  accuracyDiceResults: number[]
  dodgeDicePool: number
  dodgeSuccesses: number
  dodgeDiceResults: number[]
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
      body.accuracyDicePool === undefined || body.accuracySuccesses === undefined || !body.accuracyDiceResults ||
      body.dodgeDicePool === undefined || body.dodgeSuccesses === undefined || !body.dodgeDiceResults) {
    throw createError({
      statusCode: 400,
      message: 'participantId, attackId, targetId, and all accuracy/dodge dice data (dicePool, successes, diceResults) are required',
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

  // Validate attacker can act (direct turn or partner digimon on tamer's turn)
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

  // Validate target
  const target = participants.find((p: any) => p.id === body.targetId)
  if (!target) {
    throw createError({
      statusCode: 404,
      message: 'Target not found',
    })
  }

  // Check actions
  const actionCost = 1
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

  // Compare successes and calculate outcome
  const netSuccesses = body.accuracySuccesses - body.dodgeSuccesses
  const hit = netSuccesses >= 0

  // Look up attacker's digimon to get base damage and attack definition
  const [attackerDigimon] = await db.select().from(digimon).where(eq(digimon.id, actor.entityId))

  let attackBaseDamage = 0
  let armorPiercing = 0
  console.log('[NPC-ATTACK] Attacker digimon:', attackerDigimon?.name, 'baseStats:', attackerDigimon?.baseStats, 'bonusStats:', (attackerDigimon as any)?.bonusStats)
  if (attackerDigimon) {
    // Base damage comes from digimon stats
    attackBaseDamage = (attackerDigimon.baseStats?.damage ?? 0) + ((attackerDigimon as any).bonusStats?.damage ?? 0)
    console.log('[NPC-ATTACK] Base damage calc: ', attackerDigimon.baseStats?.damage, '+', (attackerDigimon as any)?.bonusStats?.damage, '=', attackBaseDamage)

    // Parse attacks array to get tag bonuses
    if (attackerDigimon.attacks) {
      const attacks = typeof attackerDigimon.attacks === 'string'
        ? JSON.parse(attackerDigimon.attacks)
        : attackerDigimon.attacks

      const attackDef = attacks?.find((a: any) => a.id === body.attackId)
      console.log('[NPC-ATTACK] Attack definition:', attackDef?.name, 'tags:', attackDef?.tags)

      if (attackDef?.tags && Array.isArray(attackDef.tags)) {
        for (const tag of attackDef.tags) {
          // Weapon tags add to both accuracy AND damage
          const weaponMatch = tag.match(/^Weapon\s+(\d+|I{1,3}|IV|V)$/i)
          if (weaponMatch) {
            const rankStr = weaponMatch[1]
            const romanMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 }
            const rank = romanMap[rankStr.toUpperCase()] || parseInt(rankStr) || 1
            console.log('[NPC-ATTACK] Weapon tag match:', tag, 'rank:', rank, 'adding to damage')
            attackBaseDamage += rank  // Add weapon rank to damage
          }

          // Extract Armor Piercing from tags
          const apMatch = tag.match(/^Armor Piercing\s+(\d+|I{1,3}|IV|V|VI|VII|VIII|IX|X)$/i)
          if (apMatch) {
            const rankStr = apMatch[1]
            const romanMap: Record<string, number> = {
              'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
              'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
            }
            const rank = romanMap[rankStr.toUpperCase()] || parseInt(rankStr) || 0
            armorPiercing = rank * 2  // Each rank ignores 2 armor
          }
        }
      }
    }
  }

  console.log('[NPC-ATTACK] Final attackBaseDamage before armor calc:', attackBaseDamage)

  // Fetch target's armor
  let targetArmor = 0
  if (target.type === 'digimon') {
    const [targetDigimon] = await db.select().from(digimon).where(eq(digimon.id, target.entityId))
    if (targetDigimon) {
      targetArmor = (targetDigimon.baseStats?.armor ?? 0) + ((targetDigimon as any).bonusStats?.armor ?? 0)
      console.log('[NPC-ATTACK] Target armor calc:', targetDigimon.baseStats?.armor, '+', (targetDigimon as any)?.bonusStats?.armor, '=', targetArmor)
    }
  } else if (target.type === 'tamer') {
    const [targetTamer] = await db.select().from(tamers).where(eq(tamers.id, target.entityId))
    if (targetTamer) {
      const body = targetTamer.attributes?.body ?? 0
      const endurance = targetTamer.skills?.endurance ?? 0
      targetArmor = body + endurance
    }
  }

  // Calculate damage with armor and minimum damage of 1 on successful hits
  let damageDealt = 0
  if (hit) {
    const effectiveArmor = Math.max(0, targetArmor - armorPiercing)
    damageDealt = Math.max(1, attackBaseDamage + netSuccesses - effectiveArmor)
  }

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

  // Get attacker name
  let attackerName = 'Unknown'
  if (actor.type === 'tamer') {
    const [tamerEntity] = await db.select().from(tamers).where(eq(tamers.id, actor.entityId))
    attackerName = tamerEntity?.name || `Tamer ${actor.entityId}`
  } else if (actor.type === 'digimon') {
    // We already queried attackerDigimon above, reuse it
    attackerName = attackerDigimon?.name || `Digimon ${actor.entityId}`
  }

  // Get target name
  let targetName = 'Unknown'
  if (target.type === 'tamer') {
    const [targetTamer] = await db.select().from(tamers).where(eq(tamers.id, target.entityId))
    targetName = targetTamer?.name || `Tamer ${target.entityId}`
  } else if (target.type === 'digimon') {
    // Query target digimon for name
    const [targetDigimon] = await db.select().from(digimon).where(eq(digimon.id, target.entityId))
    targetName = targetDigimon?.name || `Digimon ${target.entityId}`
  }

  // Add battle log entries
  const attackLogEntry = {
    id: `log-${Date.now()}-attack`,
    timestamp: new Date().toISOString(),
    round: encounter.round,
    actorId: actor.id,
    actorName: attackerName,
    action: 'Attack',
    target: targetName,
    result: `${body.accuracyDicePool}d6 => [${body.accuracyDiceResults.join(',')}] = ${body.accuracySuccesses} successes`,
    damage: null,
    effects: ['Attack'],
  }

  const dodgeLogEntry = {
    id: `log-${Date.now()}-dodge`,
    timestamp: new Date().toISOString(),
    round: encounter.round,
    actorId: target.id,
    actorName: targetName,
    action: 'Dodge',
    target: null,
    result: `${body.dodgeDicePool}d6 => [${body.dodgeDiceResults.join(',')}] = ${body.dodgeSuccesses} successes - Net: ${netSuccesses} - ${hit ? 'HIT!' : 'MISS!'}`,
    damage: hit ? damageDealt : 0,
    effects: ['Dodge'],

    // Damage calculation breakdown
    baseDamage: attackBaseDamage,
    netSuccesses: netSuccesses,
    targetArmor: targetArmor,
    armorPiercing: armorPiercing,
    effectiveArmor: hit ? Math.max(0, targetArmor - armorPiercing) : undefined,
    finalDamage: hit ? damageDealt : 0,
    hit: hit,
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
