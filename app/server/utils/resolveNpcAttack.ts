import { eq } from 'drizzle-orm'
import { db, digimon, tamers, evolutionLines } from '../db'
import { EFFECT_ALIGNMENT } from '../../data/attackConstants'

interface ResolveNpcAttackParams {
  participants: any[]
  battleLog: any[]
  attackerParticipantId: string
  targetParticipantId: string
  attackId: string
  accuracySuccesses: number
  accuracyDice: number[]
  round: number
  attackerName: string
  targetName: string
}

/**
 * Auto-resolve an attack against an NPC target (rolls dodge server-side, calculates damage).
 * Does NOT deduct attacker actions — caller handles that.
 * Returns updated participants and battleLog arrays.
 */
export async function resolveNpcAttack(params: ResolveNpcAttackParams): Promise<{
  participants: any[]
  battleLog: any[]
}> {
  let { participants, battleLog } = params

  const attacker = participants.find((p: any) => p.id === params.attackerParticipantId)
  const target = participants.find((p: any) => p.id === params.targetParticipantId)
  if (!attacker || !target) {
    return { participants, battleLog }
  }

  // --- Attacker damage stats ---
  let attackBaseDamage = 0
  let armorPiercing = 0
  let attackDef: any = null

  if (attacker.type === 'digimon') {
    const [attackerDigimon] = await db.select().from(digimon).where(eq(digimon.id, attacker.entityId))
    if (attackerDigimon) {
      const baseStats = typeof attackerDigimon.baseStats === 'string'
        ? JSON.parse(attackerDigimon.baseStats) : attackerDigimon.baseStats
      const bonusStats = typeof (attackerDigimon as any).bonusStats === 'string'
        ? JSON.parse((attackerDigimon as any).bonusStats) : (attackerDigimon as any).bonusStats

      attackBaseDamage = (baseStats?.damage ?? 0) + (bonusStats?.damage ?? 0)

      if (attackerDigimon.attacks) {
        const attacks = typeof attackerDigimon.attacks === 'string'
          ? JSON.parse(attackerDigimon.attacks) : attackerDigimon.attacks
        attackDef = attacks?.find((a: any) => a.id === params.attackId)

        if (attackDef?.tags && Array.isArray(attackDef.tags)) {
          for (const tag of attackDef.tags) {
            const weaponMatch = tag.match(/^Weapon\s+(\d+|I{1,3}|IV|V)$/i)
            if (weaponMatch) {
              const romanMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 }
              attackBaseDamage += romanMap[weaponMatch[1].toUpperCase()] || parseInt(weaponMatch[1]) || 1
            }
            const apMatch = tag.match(/^Armor Piercing\s+(\d+|I{1,3}|IV|V|VI|VII|VIII|IX|X)$/i)
            if (apMatch) {
              const romanMap: Record<string, number> = {
                'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
                'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
              }
              armorPiercing = (romanMap[apMatch[1].toUpperCase()] || parseInt(apMatch[1]) || 0) * 2
            }
          }
        }
      }
    }
  }

  // --- Target dodge pool ---
  let dodgePool = 3
  if (target.type === 'digimon') {
    const [targetDigimon] = await db.select().from(digimon).where(eq(digimon.id, target.entityId))
    if (targetDigimon) {
      const baseStats = typeof targetDigimon.baseStats === 'string'
        ? JSON.parse(targetDigimon.baseStats) : targetDigimon.baseStats
      const bonusStats = typeof (targetDigimon as any).bonusStats === 'string'
        ? JSON.parse((targetDigimon as any).bonusStats) : (targetDigimon as any).bonusStats
      dodgePool = (baseStats?.dodge ?? 0) + (bonusStats?.dodge ?? 0) || 3
    }
  } else if (target.type === 'tamer') {
    const [targetTamer] = await db.select().from(tamers).where(eq(tamers.id, target.entityId))
    if (targetTamer) {
      const attrs = typeof targetTamer.attributes === 'string'
        ? JSON.parse(targetTamer.attributes) : targetTamer.attributes
      const skills = typeof targetTamer.skills === 'string'
        ? JSON.parse(targetTamer.skills) : targetTamer.skills
      dodgePool = (attrs?.agility ?? 0) + (skills?.dodge ?? 0) || 3
    }
  }
  dodgePool = Math.max(1, dodgePool - (target.dodgePenalty ?? 0))

  // Roll dodge
  const dodgeDiceResults: number[] = []
  for (let i = 0; i < dodgePool; i++) {
    dodgeDiceResults.push(Math.floor(Math.random() * 6) + 1)
  }
  const dodgeSuccesses = dodgeDiceResults.filter((d: number) => d >= 5).length

  // --- Damage calculation ---
  const netSuccesses = params.accuracySuccesses - dodgeSuccesses
  const hit = netSuccesses >= 0

  // Target armor
  let targetArmor = 0
  if (target.type === 'digimon') {
    const [targetDigimon] = await db.select().from(digimon).where(eq(digimon.id, target.entityId))
    if (targetDigimon) {
      const baseStats = typeof targetDigimon.baseStats === 'string'
        ? JSON.parse(targetDigimon.baseStats) : targetDigimon.baseStats
      const bonusStats = typeof (targetDigimon as any).bonusStats === 'string'
        ? JSON.parse((targetDigimon as any).bonusStats) : (targetDigimon as any).bonusStats
      targetArmor = (baseStats?.armor ?? 0) + (bonusStats?.armor ?? 0)

      const qualities = typeof targetDigimon.qualities === 'string'
        ? JSON.parse(targetDigimon.qualities) : targetDigimon.qualities
      const dataOpt = qualities?.find((q: any) => q.id === 'data-optimization')
      if (dataOpt?.choiceId === 'guardian') targetArmor += 2
    }
  } else if (target.type === 'tamer') {
    const [targetTamer] = await db.select().from(tamers).where(eq(tamers.id, target.entityId))
    if (targetTamer) {
      const attrs = typeof targetTamer.attributes === 'string'
        ? JSON.parse(targetTamer.attributes) : targetTamer.attributes
      const skills = typeof targetTamer.skills === 'string'
        ? JSON.parse(targetTamer.skills) : targetTamer.skills
      targetArmor = (attrs?.body ?? 0) + (skills?.endurance ?? 0)
    }
  }

  let damageDealt = 0
  if (hit) {
    const effectiveArmor = Math.max(0, targetArmor - armorPiercing)
    damageDealt = Math.max(1, attackBaseDamage + netSuccesses - effectiveArmor)
  }

  // --- Apply damage, effects, dodge penalty ---
  let appliedEffectName: string | null = null
  participants = participants.map((p: any) => {
    if (p.id === params.targetParticipantId) {
      const updated = {
        ...p,
        dodgePenalty: (p.dodgePenalty ?? 0) + 1,
      }
      if (hit) {
        updated.currentWounds = Math.min(p.maxWounds, (p.currentWounds || 0) + damageDealt)
        if (attackDef?.effect) {
          const shouldApply = attackDef.type === 'damage' ? damageDealt >= 2 : true
          if (shouldApply) {
            const effectDuration = Math.max(1, netSuccesses)
            const alignment = EFFECT_ALIGNMENT[attackDef.effect]
            const effectType = alignment === 'P' ? 'buff' : alignment === 'N' ? 'debuff' : 'status'
            updated.activeEffects = [...(p.activeEffects || []), {
              id: `effect-${Date.now()}`,
              name: attackDef.effect,
              type: effectType,
              duration: effectDuration,
              source: 'Attack',
              description: '',
            }]
            appliedEffectName = attackDef.effect
          }
        }
      }
      return updated
    }
    return p
  })

  // --- Auto-devolve check ---
  let autoDevolveLog: any = null
  const damagedTarget = participants.find((p: any) => p.id === params.targetParticipantId)
  if (damagedTarget && hit &&
      damagedTarget.currentWounds >= damagedTarget.maxWounds &&
      damagedTarget.evolutionLineId &&
      damagedTarget.woundsHistory?.length > 0) {
    const previousState = damagedTarget.woundsHistory.pop()
    if (previousState) {
      const oldEntityId = damagedTarget.entityId
      damagedTarget.entityId = previousState.entityId
      damagedTarget.maxWounds = previousState.maxWounds
      damagedTarget.currentWounds = previousState.wounds

      await db.update(evolutionLines).set({
        currentStageIndex: previousState.stageIndex,
        updatedAt: new Date(),
      }).where(eq(evolutionLines.id, damagedTarget.evolutionLineId))

      const [oldDigimon] = await db.select().from(digimon).where(eq(digimon.id, oldEntityId))
      const [newDigimon] = await db.select().from(digimon).where(eq(digimon.id, previousState.entityId))

      autoDevolveLog = {
        id: `log-${Date.now()}-autodevolve`,
        timestamp: new Date().toISOString(),
        round: params.round,
        actorId: damagedTarget.id,
        actorName: oldDigimon?.name || 'Digimon',
        action: `was knocked out and devolved to ${newDigimon?.name || 'previous form'}!`,
        target: null,
        result: `Wounds restored to ${previousState.wounds}`,
        damage: null,
        effects: ['Auto-Devolve'],
      }
    }
  }

  // --- Battle log ---
  const dodgeLogEntry = {
    id: `log-${Date.now()}-dodge`,
    timestamp: new Date().toISOString(),
    round: params.round,
    actorId: params.targetParticipantId,
    actorName: params.targetName,
    action: 'Dodge',
    target: null,
    result: `${dodgePool}d6 => [${dodgeDiceResults.join(',')}] = ${dodgeSuccesses} successes - Net: ${netSuccesses} - ${hit ? 'HIT!' : 'MISS!'}`,
    damage: hit ? damageDealt : 0,
    effects: appliedEffectName ? ['Dodge', `Applied: ${appliedEffectName}`] : ['Dodge'],
    baseDamage: attackBaseDamage,
    netSuccesses,
    targetArmor,
    armorPiercing,
    effectiveArmor: hit ? Math.max(0, targetArmor - armorPiercing) : undefined,
    finalDamage: hit ? damageDealt : 0,
    hit,
  }

  battleLog = [...battleLog, dodgeLogEntry, ...(autoDevolveLog ? [autoDevolveLog] : [])]

  return { participants, battleLog }
}
