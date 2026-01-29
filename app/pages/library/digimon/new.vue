<script setup lang="ts">
import type { CreateDigimonData } from '../../../composables/useDigimon'
import { STAGE_CONFIG, SIZE_CONFIG, type DigimonStage, type DigimonSize } from '../../../types'

definePageMeta({
  title: 'New Digimon',
})

const router = useRouter()
const { createDigimon, loading, error } = useDigimon()
const { tamers, fetchTamers } = useTamers()

onMounted(() => {
  fetchTamers()
})

const form = reactive<CreateDigimonData>({
  name: '',
  species: '',
  stage: 'rookie',
  attribute: 'data',
  family: '',
  type: '',
  size: 'medium',
  baseStats: {
    accuracy: 3,
    damage: 3,
    dodge: 3,
    armor: 3,
    health: 3,
  },
  attacks: [],
  qualities: [],
  dataOptimization: '',
  partnerId: '',
  isEnemy: false,
  notes: '',
  spriteUrl: '',
})

const stages: DigimonStage[] = ['fresh', 'in-training', 'rookie', 'champion', 'ultimate', 'mega']
const sizes: DigimonSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gigantic']
const attributes = ['vaccine', 'data', 'virus', 'free'] as const

const currentSizeConfig = computed(() => SIZE_CONFIG[form.size || 'medium'])

const currentStageConfig = computed(() => STAGE_CONFIG[form.stage])

// DP calculation - DDA 1.4 rules:
// Stats cost 1 DP per point
// Qualities have variable DP costs (can be positive, negative, or zero)
const dpUsedOnStats = computed(() => {
  return Object.values(form.baseStats).reduce((a, b) => a + b, 0)
})

const dpUsedOnQualities = computed(() => {
  return (form.qualities || []).reduce((total, q) => total + (q.dpCost || 0), 0)
})

const dpUsed = computed(() => {
  return dpUsedOnStats.value + dpUsedOnQualities.value
})

const dpRemaining = computed(() => {
  return currentStageConfig.value.dp - dpUsed.value
})

// Derived Stats calculation - DDA 1.4 rules (page 111)
const derivedStats = computed(() => {
  const { accuracy, damage, dodge, armor, health } = form.baseStats
  const stageConfig = currentStageConfig.value
  const sizeConfig = currentSizeConfig.value

  // Primary Derived Stats (always round down)
  // Size affects Body and Agility differently (page 110)
  const brains = Math.floor(accuracy / 2) + stageConfig.brainsBonus
  const body = Math.max(0, Math.floor((health + damage + armor) / 3) + sizeConfig.bodyBonus)
  const agility = Math.max(0, Math.floor((accuracy + dodge) / 2) + sizeConfig.agilityBonus)

  // Spec Values (derived from derived stats)
  const bit = Math.floor(brains / 10) + stageConfig.stageBonus
  const cpu = Math.floor(body / 10) + stageConfig.stageBonus
  const ram = Math.floor(agility / 10) + stageConfig.stageBonus

  return {
    brains,
    body,
    agility,
    bit,
    cpu,
    ram,
    woundBoxes: health + stageConfig.woundBonus,
    movement: stageConfig.movement,
    stageBonus: stageConfig.stageBonus,
  }
})

// Toggle for custom attack form
const showCustomAttackForm = ref(false)

// New attack form - DDA 1.4 structure
const newAttack = reactive({
  name: '',
  range: 'melee' as 'melee' | 'ranged',
  type: 'damage' as 'damage' | 'support',
  tags: [] as string[],
  effect: '' as string | undefined,
  description: '',
})

type Attack = NonNullable<CreateDigimonData['attacks']>[0]

function handleAddAttack(attack: Attack) {
  form.attacks = [...(form.attacks || []), attack]
}

// Tag validation rules based on DDA 1.4
interface AttackTagRule {
  id: string
  name: string
  description: string
  rangeRestriction?: 'melee' | 'ranged'
  typeRestriction?: 'damage' | 'support'
  conflictsWith?: string[]
  allowedWithSignature?: string[]
}

// Get available tags based on owned qualities AND current attack state
const availableAttackTags = computed(() => {
  const tags: Array<AttackTagRule & { disabled: boolean; disabledReason?: string }> = []
  const currentRange = newAttack.range
  const currentTags = newAttack.tags
  const hasSignatureMove = currentTags.some((t) => t.includes('Signature Move'))

  for (const quality of form.qualities || []) {
    if (quality.id === 'weapon') {
      tags.push({
        id: 'weapon',
        name: `Weapon ${quality.ranks || 1}`,
        description: `+${quality.ranks || 1} Accuracy and Damage`,
        disabled: false,
      })
    }

    if (quality.id === 'armor-piercing') {
      const hasCertainStrike = currentTags.some((t) => t.includes('Certain Strike'))
      const blocked = hasCertainStrike && !hasSignatureMove
      tags.push({
        id: 'armor-piercing',
        name: `Armor Piercing ${quality.ranks || 1}`,
        description: `Ignores ${(quality.ranks || 1) * 2} Armor`,
        conflictsWith: ['certain-strike'],
        disabled: blocked,
        disabledReason: blocked ? 'Cannot combine with Certain Strike (unless Signature Move)' : undefined,
      })
    }

    if (quality.id === 'certain-strike') {
      const hasArmorPiercing = currentTags.some((t) => t.includes('Armor Piercing'))
      const blocked = hasArmorPiercing && !hasSignatureMove
      tags.push({
        id: 'certain-strike',
        name: `Certain Strike ${quality.ranks || 1}`,
        description: 'Auto-successes on accuracy',
        conflictsWith: ['armor-piercing'],
        disabled: blocked,
        disabledReason: blocked ? 'Cannot combine with Armor Piercing (unless Signature Move)' : undefined,
      })
    }

    if (quality.id === 'charge-attack') {
      const blocked = currentRange !== 'melee'
      tags.push({
        id: 'charge-attack',
        name: 'Charge Attack',
        description: 'Move and attack as one Simple Action',
        rangeRestriction: 'melee',
        disabled: blocked,
        disabledReason: blocked ? 'Requires [Melee] attack' : undefined,
      })
    }

    if (quality.id === 'mighty-blow') {
      const blocked = currentRange !== 'melee'
      tags.push({
        id: 'mighty-blow',
        name: 'Mighty Blow',
        description: 'Stun on high damage',
        rangeRestriction: 'melee',
        disabled: blocked,
        disabledReason: blocked ? 'Requires [Melee] attack' : undefined,
      })
    }

    if (quality.id === 'signature-move') {
      const hasPoison = currentTags.some((t) => t.includes('Poison'))
      const hasHazard = currentTags.some((t) => t.includes('Hazard'))
      const hasRevitalize = currentTags.some((t) => t.includes('Revitalize'))
      const blocked = hasPoison || hasHazard || hasRevitalize
      tags.push({
        id: 'signature-move',
        name: 'Signature Move',
        description: 'Powerful attack (available Round 3+, 2 round cooldown)',
        disabled: blocked,
        disabledReason: blocked ? 'Cannot combine with Poison, Hazard, or Revitalize' : undefined,
      })
    }

    if (quality.id === 'area-attack') {
      const choiceId = quality.choiceId
      if (!choiceId || choiceId === 'blast') {
        const blocked = currentRange !== 'ranged'
        tags.push({
          id: 'area-blast',
          name: 'Area Attack: Blast',
          description: `Circle at range (3m +BIT diameter)`,
          rangeRestriction: 'ranged',
          disabled: blocked,
          disabledReason: blocked ? 'Requires [Ranged] attack' : undefined,
        })
      }
      if (!choiceId || choiceId === 'pass') {
        const blocked = currentRange !== 'melee'
        tags.push({
          id: 'area-pass',
          name: 'Area Attack: Pass',
          description: 'Charge through enemies in a line',
          rangeRestriction: 'melee',
          disabled: blocked,
          disabledReason: blocked ? 'Requires [Melee] attack' : undefined,
        })
      }
      if (!choiceId || choiceId === 'burst') {
        tags.push({ id: 'area-burst', name: 'Area Attack: Burst', description: 'Circle from user', disabled: false })
      }
      if (!choiceId || choiceId === 'close-blast') {
        tags.push({ id: 'area-close-blast', name: 'Area Attack: Close Blast', description: 'Circle adjacent to user', disabled: false })
      }
      if (!choiceId || choiceId === 'cone') {
        tags.push({ id: 'area-cone', name: 'Area Attack: Cone', description: 'Triangle from user', disabled: false })
      }
      if (!choiceId || choiceId === 'line') {
        tags.push({ id: 'area-line', name: 'Area Attack: Line', description: 'Pillar from user', disabled: false })
      }
    }
  }

  return tags
})

// Get available effect tags based on owned qualities AND attack type
const availableEffectTags = computed(() => {
  const currentType = newAttack.type
  const currentTags = newAttack.tags
  const hasSignatureMove = currentTags.some((t) => t.includes('Signature Move'))

  const effectAlignment: Record<string, 'P' | 'N' | 'NA'> = {
    'effect-vigor': 'P', 'effect-fury': 'P', 'effect-cleanse': 'P', 'effect-haste': 'P', 'effect-revitalize': 'P', 'effect-shield': 'P',
    'effect-poison': 'N', 'effect-confuse': 'N', 'effect-stun': 'N', 'effect-fear': 'N', 'effect-immobilize': 'N', 'effect-taunt': 'N',
    'effect-lifesteal': 'NA', 'effect-knockback': 'NA', 'effect-pull': 'NA',
  }
  const signatureRestricted = ['effect-poison', 'effect-hazard', 'effect-revitalize']

  return (form.qualities || [])
    .filter((q) => q.id.startsWith('effect-'))
    .map((q) => {
      const alignment = effectAlignment[q.id] || 'NA'
      let disabled = false
      let disabledReason: string | undefined

      if (alignment === 'P' && currentType !== 'support') {
        disabled = true
        disabledReason = 'Requires [Support] attack'
      } else if (alignment === 'N' && currentType !== 'damage') {
        disabled = true
        disabledReason = 'Requires [Damage] attack'
      }
      if (hasSignatureMove && signatureRestricted.includes(q.id)) {
        disabled = true
        disabledReason = 'Cannot use with Signature Move'
      }

      return { id: q.id.replace('effect-', ''), name: q.name, alignment, disabled, disabledReason }
    })
})

function addTagToAttack(tagName: string) {
  if (!newAttack.tags.includes(tagName)) {
    newAttack.tags = [...newAttack.tags, tagName]
  }
}

function removeTagFromAttack(tagName: string) {
  newAttack.tags = newAttack.tags.filter((t) => t !== tagName)
}

function addCustomAttack() {
  if (!newAttack.name) return
  form.attacks = [
    ...(form.attacks || []),
    {
      id: `attack-${Date.now()}`,
      name: newAttack.name,
      range: newAttack.range,
      type: newAttack.type,
      tags: [...newAttack.tags],
      effect: newAttack.effect || undefined,
      description: newAttack.description,
    },
  ]
  // Reset form
  newAttack.name = ''
  newAttack.range = 'melee'
  newAttack.type = 'damage'
  newAttack.tags = []
  newAttack.effect = ''
  newAttack.description = ''
  showCustomAttackForm.value = false
}

function removeAttack(index: number) {
  form.attacks = form.attacks?.filter((_, i) => i !== index) || []
}

type Quality = NonNullable<CreateDigimonData['qualities']>[0]

function handleAddQuality(quality: Quality) {
  form.qualities = [...(form.qualities || []), quality]
}

function removeQuality(index: number) {
  form.qualities = form.qualities?.filter((_, i) => i !== index) || []
}

// Sprite preview
const spriteError = ref(false)
function handleSpriteError() {
  spriteError.value = true
}
watch(() => form.spriteUrl, () => {
  spriteError.value = false
})

// Effect alignment constants - P = Support only, N = Damage only, NA = Both
const EFFECT_ALIGNMENT: Record<string, 'P' | 'N' | 'NA'> = {
  'Vigor': 'P', 'Fury': 'P', 'Cleanse': 'P', 'Haste': 'P', 'Revitalize': 'P', 'Shield': 'P',
  'Poison': 'N', 'Confuse': 'N', 'Stun': 'N', 'Fear': 'N', 'Immobilize': 'N', 'Taunt': 'N',
  'Lifesteal': 'NA', 'Knockback': 'NA', 'Pull': 'NA',
}

// Tag restrictions: which range/type they require
const TAG_RESTRICTIONS: Record<string, { range?: 'melee' | 'ranged'; type?: 'damage' | 'support' }> = {
  'Charge Attack': { range: 'melee' },
  'Mighty Blow': { range: 'melee' },
  'Area Attack: Pass': { range: 'melee' },
  'Area Attack: Blast': { range: 'ranged' },
}

// Watch for attack type changes - clear invalid effects
watch(() => newAttack.type, (newType) => {
  if (newAttack.effect) {
    const alignment = EFFECT_ALIGNMENT[newAttack.effect]
    if (alignment === 'P' && newType !== 'support') {
      newAttack.effect = ''
    } else if (alignment === 'N' && newType !== 'damage') {
      newAttack.effect = ''
    }
  }
})

// Watch for attack range changes - clear invalid tags
watch(() => newAttack.range, (newRange) => {
  newAttack.tags = newAttack.tags.filter((tag) => {
    const restriction = TAG_RESTRICTIONS[tag]
    if (restriction?.range && restriction.range !== newRange) {
      return false
    }
    return true
  })
})

// Watch for attack type changes - clear invalid tags
watch(() => newAttack.type, (newType) => {
  newAttack.tags = newAttack.tags.filter((tag) => {
    const restriction = TAG_RESTRICTIONS[tag]
    if (restriction?.type && restriction.type !== newType) {
      return false
    }
    return true
  })
})

async function handleSubmit() {
  const data = {
    ...form,
    partnerId: form.partnerId || undefined,
  }
  const created = await createDigimon(data)
  if (created) {
    router.push('/library/digimon')
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="mb-8">
      <NuxtLink to="/library/digimon" class="text-digimon-dark-400 hover:text-white text-sm mb-2 inline-block">
        &larr; Back to Digimon
      </NuxtLink>
      <h1 class="font-display text-3xl font-bold text-white">New Digimon</h1>
    </div>

    <form class="space-y-8" @submit.prevent="handleSubmit">
      <!-- Basic Info -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <h2 class="font-display text-xl font-semibold text-white mb-4">Basic Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Name</label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="e.g., Agumon"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Species</label>
            <input
              v-model="form.species"
              type="text"
              required
              placeholder="e.g., Reptile Digimon"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Stage</label>
            <select
              v-model="form.stage"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none capitalize"
            >
              <option v-for="stage in stages" :key="stage" :value="stage" class="capitalize">
                {{ stage }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Attribute</label>
            <select
              v-model="form.attribute"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none capitalize"
            >
              <option v-for="attr in attributes" :key="attr" :value="attr" class="capitalize">
                {{ attr }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Size</label>
            <select
              v-model="form.size"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none capitalize"
            >
              <option v-for="size in sizes" :key="size" :value="size" class="capitalize">
                {{ size }}
                <template v-if="SIZE_CONFIG[size].bodyBonus !== 0 || SIZE_CONFIG[size].agilityBonus !== 0">
                  (Body {{ SIZE_CONFIG[size].bodyBonus >= 0 ? '+' : '' }}{{ SIZE_CONFIG[size].bodyBonus }},
                  Agility {{ SIZE_CONFIG[size].agilityBonus >= 0 ? '+' : '' }}{{ SIZE_CONFIG[size].agilityBonus }})
                </template>
              </option>
            </select>
            <div v-if="currentSizeConfig.bodyBonus !== 0 || currentSizeConfig.agilityBonus !== 0" class="text-xs text-digimon-dark-500 mt-1">
              Body {{ currentSizeConfig.bodyBonus >= 0 ? '+' : '' }}{{ currentSizeConfig.bodyBonus }},
              Agility {{ currentSizeConfig.agilityBonus >= 0 ? '+' : '' }}{{ currentSizeConfig.agilityBonus }}
            </div>
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Family</label>
            <input
              v-model="form.family"
              type="text"
              placeholder="e.g., Dragon's Roar"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Type</label>
            <input
              v-model="form.type"
              type="text"
              placeholder="e.g., Reptile"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Partner Tamer (Optional)</label>
            <select
              v-model="form.partnerId"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            >
              <option value="">No Partner (Wild/Enemy)</option>
              <option v-for="tamer in tamers" :key="tamer.id" :value="tamer.id">
                {{ tamer.name }}
              </option>
            </select>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="form.isEnemy"
                type="checkbox"
                class="w-5 h-5 bg-digimon-dark-700 border border-digimon-dark-600 rounded
                       text-digimon-orange-500 focus:ring-digimon-orange-500"
              />
              <span class="text-white">This is an enemy Digimon</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Stage Info -->
      <div class="bg-digimon-dark-700/50 rounded-xl p-4 border border-digimon-dark-600">
        <h3 class="font-semibold text-digimon-orange-400 mb-2 capitalize">{{ form.stage }} Stage Stats</h3>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span class="text-digimon-dark-400">DP:</span>
            <span class="text-white ml-1">{{ currentStageConfig.dp }}</span>
          </div>
          <div>
            <span class="text-digimon-dark-400">Movement:</span>
            <span class="text-white ml-1">{{ currentStageConfig.movement }}</span>
          </div>
          <div>
            <span class="text-digimon-dark-400">Wound Bonus:</span>
            <span class="text-white ml-1">+{{ currentStageConfig.woundBonus }}</span>
          </div>
          <div>
            <span class="text-digimon-dark-400">Brains Bonus:</span>
            <span class="text-white ml-1">+{{ currentStageConfig.brainsBonus }}</span>
          </div>
          <div>
            <span class="text-digimon-dark-400">Attacks:</span>
            <span class="text-white ml-1">{{ currentStageConfig.attacks }}</span>
          </div>
        </div>
      </div>

      <!-- Base Stats -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <div class="flex justify-between items-center mb-4">
          <h2 class="font-display text-xl font-semibold text-white">Base Stats</h2>
          <div class="flex flex-col items-end gap-1">
            <span
              :class="[
                'text-sm px-3 py-1 rounded',
                dpRemaining === 0 && 'bg-green-900/30 text-green-400',
                dpRemaining > 0 && 'bg-yellow-900/30 text-yellow-400',
                dpRemaining < 0 && 'bg-red-900/30 text-red-400',
              ]"
            >
              {{ dpRemaining }} DP remaining
            </span>
            <span class="text-xs text-digimon-dark-400">
              Stats: {{ dpUsedOnStats }} | Qualities: {{ dpUsedOnQualities }} | Total: {{ dpUsed }} / {{ currentStageConfig.dp }}
            </span>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-4">
          <div class="text-center">
            <label class="block text-sm text-digimon-dark-400 mb-2">Accuracy</label>
            <input
              v-model.number="form.baseStats.accuracy"
              type="number"
              min="1"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-2 py-2
                     text-white text-center focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div class="text-center">
            <label class="block text-sm text-digimon-dark-400 mb-2">Damage</label>
            <input
              v-model.number="form.baseStats.damage"
              type="number"
              min="1"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-2 py-2
                     text-white text-center focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div class="text-center">
            <label class="block text-sm text-digimon-dark-400 mb-2">Dodge</label>
            <input
              v-model.number="form.baseStats.dodge"
              type="number"
              min="1"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-2 py-2
                     text-white text-center focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div class="text-center">
            <label class="block text-sm text-digimon-dark-400 mb-2">Armor</label>
            <input
              v-model.number="form.baseStats.armor"
              type="number"
              min="1"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-2 py-2
                     text-white text-center focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
          <div class="text-center">
            <label class="block text-sm text-digimon-dark-400 mb-2">Health</label>
            <input
              v-model.number="form.baseStats.health"
              type="number"
              min="1"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-2 py-2
                     text-white text-center focus:border-digimon-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <!-- Derived Stats Display -->
        <div class="mt-6 pt-4 border-t border-digimon-dark-600">
          <h3 class="text-sm font-semibold text-digimon-dark-300 mb-3">Derived Stats</h3>

          <!-- Primary Derived Stats + Spec Values -->
          <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Brains</div>
              <div class="text-lg font-bold text-cyan-400">{{ derivedStats.brains }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Body</div>
              <div class="text-lg font-bold text-orange-400">{{ derivedStats.body }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Agility</div>
              <div class="text-lg font-bold text-green-400">{{ derivedStats.agility }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">BIT</div>
              <div class="text-lg font-bold text-cyan-400">{{ derivedStats.bit }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">CPU</div>
              <div class="text-lg font-bold text-orange-400">{{ derivedStats.cpu }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">RAM</div>
              <div class="text-lg font-bold text-green-400">{{ derivedStats.ram }}</div>
            </div>
          </div>

          <!-- Combat Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Wound Boxes</div>
              <div class="text-lg font-bold text-red-400">{{ derivedStats.woundBoxes }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Movement</div>
              <div class="text-lg font-bold text-blue-400">{{ derivedStats.movement }}m</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Stage Bonus</div>
              <div class="text-lg font-bold text-purple-400">+{{ derivedStats.stageBonus }}</div>
            </div>
            <div class="bg-digimon-dark-700 rounded-lg p-3 text-center">
              <div class="text-xs text-digimon-dark-400 mb-1">Initiative</div>
              <div class="text-lg font-bold text-yellow-400">3d6 + {{ derivedStats.agility }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Attacks -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <h2 class="font-display text-xl font-semibold text-white mb-4">
          Attacks ({{ form.attacks?.length || 0 }} / {{ currentStageConfig.attacks }})
        </h2>

        <!-- Attack Selector from Database -->
        <AttackSelector
          :stage="form.stage"
          :max-attacks="currentStageConfig.attacks"
          :current-attacks="form.attacks || []"
          @add="handleAddAttack"
          @remove="removeAttack"
        />

        <!-- Custom attack toggle -->
        <div v-if="(form.attacks?.length || 0) < currentStageConfig.attacks" class="mt-4">
          <button
            v-if="!showCustomAttackForm"
            type="button"
            class="text-sm text-digimon-dark-400 hover:text-digimon-orange-400 transition-colors"
            @click="showCustomAttackForm = true"
          >
            + Create Custom Attack (not in database)
          </button>

          <!-- Custom attack form -->
          <div v-else class="border border-digimon-dark-600 rounded-lg p-4 bg-digimon-dark-750">
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-sm font-semibold text-digimon-dark-300">Create Custom Attack</h3>
              <button
                type="button"
                class="text-digimon-dark-400 hover:text-white text-sm"
                @click="showCustomAttackForm = false"
              >
                Cancel
              </button>
            </div>
            <!-- Name -->
            <div>
              <label class="text-xs text-digimon-dark-400">Attack Name</label>
              <input
                v-model="newAttack.name"
                type="text"
                placeholder="Attack name"
                class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                       text-white text-sm focus:border-digimon-orange-500 focus:outline-none mt-1"
              />
            </div>

            <!-- Range and Type (DDA 1.4 core tags) -->
            <div class="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label class="text-xs text-digimon-dark-400">[Range]</label>
                <select
                  v-model="newAttack.range"
                  class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                         text-white text-sm focus:border-digimon-orange-500 focus:outline-none mt-1"
                >
                  <option value="melee">[Melee] - Adjacent</option>
                  <option value="ranged">[Ranged] - {{ derivedStats.ram }}m (RAM)</option>
                </select>
                <p v-if="newAttack.range === 'ranged'" class="text-xs text-blue-400 mt-1">
                  Range: {{ derivedStats.ram }}m (based on RAM stat)
                </p>
                <p v-else class="text-xs text-red-400 mt-1">
                  Range: Adjacent targets only
                </p>
              </div>
              <div>
                <label class="text-xs text-digimon-dark-400">[Type]</label>
                <select
                  v-model="newAttack.type"
                  class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                         text-white text-sm focus:border-digimon-orange-500 focus:outline-none mt-1"
                >
                  <option value="damage">[Damage]</option>
                  <option value="support">[Support]</option>
                </select>
                <p class="text-xs text-digimon-dark-500 mt-1">
                  {{ newAttack.type === 'damage' ? 'Deals damage to enemies' : 'Buffs allies or debuffs enemies' }}
                </p>
              </div>
            </div>

            <!-- Quality-based Tags -->
            <div class="mt-3">
              <label class="text-xs text-digimon-dark-400">Tags (from owned qualities)</label>
              <div v-if="availableAttackTags.length === 0" class="text-xs text-digimon-dark-500 mt-1">
                No attack-modifying qualities owned. Add qualities like Weapon, Armor Piercing, Area Attack, etc.
              </div>
              <div v-else class="flex flex-wrap gap-2 mt-1">
                <button
                  v-for="tag in availableAttackTags"
                  :key="tag.id"
                  type="button"
                  :disabled="tag.disabled"
                  :class="[
                    'text-xs px-2 py-1 rounded transition-colors relative group',
                    tag.disabled
                      ? 'bg-digimon-dark-700 text-digimon-dark-500 cursor-not-allowed opacity-50'
                      : newAttack.tags.includes(tag.name)
                        ? 'bg-digimon-orange-500 text-white'
                        : 'bg-digimon-dark-600 text-digimon-dark-300 hover:bg-digimon-dark-500'
                  ]"
                  :title="tag.disabled ? tag.disabledReason : tag.description"
                  @click="!tag.disabled && (newAttack.tags.includes(tag.name) ? removeTagFromAttack(tag.name) : addTagToAttack(tag.name))"
                >
                  {{ tag.name }}
                  <span v-if="tag.rangeRestriction" class="ml-1 text-digimon-dark-500">[{{ tag.rangeRestriction === 'melee' ? 'M' : 'R' }}]</span>
                  <span
                    v-if="tag.disabled && tag.disabledReason"
                    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-red-900/90 text-red-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                  >
                    {{ tag.disabledReason }}
                  </span>
                </button>
              </div>
              <div v-if="newAttack.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                <span class="text-xs text-digimon-dark-400">Selected:</span>
                <span
                  v-for="tag in newAttack.tags"
                  :key="tag"
                  class="text-xs bg-digimon-orange-500/20 text-digimon-orange-400 px-2 py-0.5 rounded flex items-center gap-1"
                >
                  {{ tag }}
                  <button type="button" class="text-red-400 hover:text-red-300" @click="removeTagFromAttack(tag)">&times;</button>
                </span>
              </div>
            </div>

            <!-- Effect (from effect qualities) -->
            <div class="mt-3">
              <label class="text-xs text-digimon-dark-400">Effect (optional)</label>
              <div v-if="availableEffectTags.length === 0" class="text-xs text-digimon-dark-500 mt-1">
                Add effect qualities (Poison, Paralysis, etc.) to enable attack effects.
              </div>
              <div v-else class="flex flex-wrap gap-2 mt-1">
                <button
                  v-for="effect in availableEffectTags"
                  :key="effect.id"
                  type="button"
                  :disabled="effect.disabled"
                  :class="[
                    'text-xs px-2 py-1 rounded transition-colors relative group',
                    effect.disabled
                      ? 'bg-digimon-dark-700 text-digimon-dark-500 cursor-not-allowed opacity-50'
                      : newAttack.effect === effect.name
                        ? 'bg-purple-500 text-white'
                        : 'bg-digimon-dark-600 text-digimon-dark-300 hover:bg-digimon-dark-500'
                  ]"
                  :title="effect.disabled ? effect.disabledReason : `${effect.alignment === 'P' ? '[Support only]' : effect.alignment === 'N' ? '[Damage only]' : '[Any type]'}`"
                  @click="!effect.disabled && (newAttack.effect = newAttack.effect === effect.name ? '' : effect.name)"
                >
                  {{ effect.name }}
                  <span class="ml-1 text-digimon-dark-500">[{{ effect.alignment === 'P' ? 'S' : effect.alignment === 'N' ? 'D' : '±' }}]</span>
                  <span
                    v-if="effect.disabled && effect.disabledReason"
                    class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-red-900/90 text-red-200 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                  >
                    {{ effect.disabledReason }}
                  </span>
                </button>
              </div>
              <p class="text-xs text-digimon-dark-500 mt-1">
                [S] = Support only, [D] = Damage only, [±] = Any type
              </p>
            </div>

            <!-- Description -->
            <div class="mt-3">
              <label class="text-xs text-digimon-dark-400">Description (flavor text)</label>
              <textarea
                v-model="newAttack.description"
                rows="2"
                placeholder="Describe the attack's appearance and style..."
                class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                       text-white text-sm focus:border-digimon-orange-500 focus:outline-none resize-none mt-1"
              />
            </div>
            <button
              type="button"
              class="mt-3 bg-digimon-orange-500 hover:bg-digimon-orange-600 text-white px-4 py-2 rounded text-sm"
              @click="addCustomAttack"
            >
              Add Custom Attack
            </button>
          </div>
        </div>
      </div>

      <!-- Qualities -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <h2 class="font-display text-xl font-semibold text-white mb-4">Qualities</h2>
        <QualitySelector
          :stage="form.stage"
          :current-qualities="form.qualities || []"
          @add="handleAddQuality"
          @remove="removeQuality"
        />
      </div>

      <!-- Sprite -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <h2 class="font-display text-xl font-semibold text-white mb-4">Sprite / Image</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm text-digimon-dark-400 mb-1">Sprite URL</label>
            <input
              v-model="form.spriteUrl"
              type="url"
              placeholder="https://example.com/digimon-sprite.png"
              class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                     text-white focus:border-digimon-orange-500 focus:outline-none"
            />
            <p class="text-xs text-digimon-dark-500 mt-1">
              Enter a URL to a sprite or image. Common sources: Wikimon, DigimonWiki
            </p>
          </div>
          <div class="flex items-center justify-center">
            <div
              v-if="form.spriteUrl && !spriteError"
              class="w-32 h-32 bg-digimon-dark-700 rounded-lg overflow-hidden flex items-center justify-center"
            >
              <img
                :src="form.spriteUrl"
                :alt="form.name || 'Digimon sprite'"
                class="max-w-full max-h-full object-contain"
                @error="handleSpriteError"
              />
            </div>
            <div
              v-else
              class="w-32 h-32 bg-digimon-dark-700 rounded-lg flex items-center justify-center text-digimon-dark-500"
            >
              <span v-if="spriteError" class="text-red-400 text-xs text-center px-2">Failed to load image</span>
              <span v-else class="text-4xl">?</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
        <h2 class="font-display text-xl font-semibold text-white mb-4">Notes</h2>
        <textarea
          v-model="form.notes"
          rows="4"
          placeholder="Evolution requirements, special abilities, personality..."
          class="w-full bg-digimon-dark-700 border border-digimon-dark-600 rounded-lg px-3 py-2
                 text-white focus:border-digimon-orange-500 focus:outline-none resize-none"
        />
      </div>

      <!-- Error message -->
      <div v-if="error" class="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
        {{ error }}
      </div>

      <!-- Submit -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="loading"
          class="bg-digimon-orange-500 hover:bg-digimon-orange-600 disabled:opacity-50
                 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          {{ loading ? 'Creating...' : 'Create Digimon' }}
        </button>
        <NuxtLink
          to="/library/digimon"
          class="bg-digimon-dark-700 hover:bg-digimon-dark-600 text-white px-6 py-2 rounded-lg
                 font-semibold transition-colors"
        >
          Cancel
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
