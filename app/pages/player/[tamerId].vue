<script setup lang="ts">
import type { Tamer, Digimon, Encounter } from '../../server/db/schema'
import type { CombatParticipant } from '../../composables/useEncounters'
import type { EvolutionLine } from '../../server/db/schema'
import type { EvolutionChainEntry, EvolutionProgress } from '../../composables/useEvolution'
import type { DigimonStage } from '../../types'
import { STAGE_CONFIG } from '../../types'

definePageMeta({
  layout: 'player',
  title: 'Player Dashboard',
})

const route = useRoute()
const tamerId = computed(() => route.params.tamerId as string)

// State
const tamer = ref<Tamer | null>(null)
const partnerDigimon = ref<Digimon[]>([])
const evolutionLines = ref<EvolutionLine[]>([])
const activeEncounter = ref<Encounter | null>(null)
const loading = ref(true)
const lastRefresh = ref(new Date())

// Track current displayed form for each evolution chain (keyed by root Digimon ID)
const currentFormIndex = ref<Record<string, number>>({})

// Composables
const { fetchTamer, calculateDerivedStats: calcTamerStats } = useTamers()
const { fetchDigimon, calculateDerivedStats: calcDigimonStats } = useDigimon()
const { encounters, fetchEncounters, getCurrentParticipant } = useEncounters()
const { fetchEvolutionLines, getCurrentStage, getNextStage, canEvolve } = useEvolution()

// Auto-refresh every 5 seconds
let refreshInterval: ReturnType<typeof setInterval>

async function loadData() {
  loading.value = true
  try {
    // Fetch tamer
    const fetchedTamer = await fetchTamer(tamerId.value)
    tamer.value = fetchedTamer

    if (fetchedTamer) {
      // Fetch partner Digimon
      await fetchDigimon({ partnerId: fetchedTamer.id })
      partnerDigimon.value = await $fetch<Digimon[]>(`/api/digimon?partnerId=${fetchedTamer.id}`)

      // Fetch evolution lines
      const lines = await $fetch<EvolutionLine[]>(`/api/evolution-lines?partnerId=${fetchedTamer.id}`)
      evolutionLines.value = lines

      // Fetch encounters to find active one
      await fetchEncounters()
      const active = encounters.value.find((e) => e.phase === 'combat')
      if (active) {
        // Check if this tamer or their Digimon are participating
        const participants = active.participants as CombatParticipant[]
        const isParticipating = participants.some(
          (p) =>
            (p.type === 'tamer' && p.entityId === fetchedTamer.id) ||
            (p.type === 'digimon' && partnerDigimon.value.some((d) => d.id === p.entityId))
        )
        if (isParticipating) {
          activeEncounter.value = active
        } else {
          activeEncounter.value = null
        }
      } else {
        activeEncounter.value = null
      }
    }

    lastRefresh.value = new Date()
  } catch (e) {
    console.error('Failed to load player data:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  // Auto-refresh
  refreshInterval = setInterval(loadData, 5000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})

// Computed
const tamerStats = computed(() => (tamer.value ? calcTamerStats(tamer.value) : null))

const myParticipants = computed(() => {
  if (!activeEncounter.value || !tamer.value) return []
  const participants = activeEncounter.value.participants as CombatParticipant[]
  return participants.filter(
    (p) =>
      (p.type === 'tamer' && p.entityId === tamer.value!.id) ||
      (p.type === 'digimon' && partnerDigimon.value.some((d) => d.id === p.entityId))
  )
})

const currentTurnParticipant = computed(() => {
  if (!activeEncounter.value) return null
  return getCurrentParticipant(activeEncounter.value)
})

const isMyTurn = computed(() => {
  if (!currentTurnParticipant.value || !tamer.value) return false
  return myParticipants.value.some((p) => p.id === currentTurnParticipant.value!.id)
})

function getStageColor(stage: DigimonStage): string {
  const colors: Record<DigimonStage, string> = {
    fresh: 'text-digimon-stage-fresh',
    'in-training': 'text-digimon-stage-intraining',
    rookie: 'text-digimon-stage-rookie',
    champion: 'text-digimon-stage-champion',
    ultimate: 'text-digimon-stage-ultimate',
    mega: 'text-digimon-stage-mega',
    ultra: 'text-digimon-stage-ultra',
  }
  return colors[stage] || 'text-gray-400'
}

function getParticipantName(participant: CombatParticipant): string {
  if (participant.type === 'tamer') {
    return tamer.value?.name || 'Unknown'
  }
  const digimon = partnerDigimon.value.find((d) => d.id === participant.entityId)
  return digimon?.name || 'Unknown'
}

// Clear selection
const selectedTamerId = useCookie<string | null>('player-tamer-id')
function switchCharacter() {
  selectedTamerId.value = null
  navigateTo('/player')
}

// Parse rank from tag with roman or arabic numerals (e.g., "Weapon II" = 2, "Weapon 3" = 3)
function parseTagRank(tag: string, prefix: string): number {
  const romanToNumber: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
  }
  const regex = new RegExp(`^${prefix}\\s+(\\d+|[IVX]+)$`, 'i')
  const match = tag.match(regex)
  if (match) {
    const rankStr = match[1].toUpperCase()
    return romanToNumber[rankStr] || parseInt(match[1]) || 0
  }
  return 0
}

// Check if attack has a specific tag pattern
function hasTag(tags: string[], pattern: string): boolean {
  return tags.some(t => t.toLowerCase().includes(pattern.toLowerCase()))
}

// Calculate attack bonuses from tags and qualities
function getAttackBonuses(
  digimon: Digimon,
  attack: { range: 'melee' | 'ranged'; tags: string[] }
): { accuracy: number; damage: number } {
  let accuracy = 0
  let damage = 0
  const qualities = digimon.qualities || []
  const tags = attack.tags || []

  // Helper to check if digimon has a quality
  const hasQuality = (id: string) => qualities.some(q => q.id === id)

  // Data Optimization bonuses
  const dataOptQuality = qualities.find(q => q.id === 'data-optimization')
  const dataOpt = dataOptQuality?.choiceId || (digimon as any).dataOptimization
  if (dataOpt === 'close-combat') {
    if (attack.range === 'melee') accuracy += 2
    else if (attack.range === 'ranged') accuracy -= 1
  } else if (dataOpt === 'ranged-striker') {
    if (attack.range === 'ranged') accuracy += 2
  }

  // Tag-based bonuses
  for (const tag of tags) {
    // Weapon adds +Rank to both Accuracy AND Damage
    const weaponRank = parseTagRank(tag, 'Weapon')
    if (weaponRank > 0) {
      accuracy += weaponRank
      damage += weaponRank
    }

    // Certain Strike adds +2 accuracy per rank
    const certainStrikeRank = parseTagRank(tag, 'Certain Strike')
    if (certainStrikeRank > 0) {
      accuracy += certainStrikeRank * 2
    }
  }

  // Digizoid Weapon bonuses (only for [Weapon] tagged attacks)
  const hasWeaponTag = hasTag(tags, 'weapon')
  if (hasWeaponTag) {
    if (hasQuality('digizoid-weapon-chrome')) { accuracy += 2; damage += 1 }
    if (hasQuality('digizoid-weapon-black')) { accuracy += 2 }
    if (hasQuality('digizoid-weapon-brown')) { damage += 2 }
    if (hasQuality('digizoid-weapon-blue')) { accuracy += 2; damage += 2 }
    if (hasQuality('digizoid-weapon-gold')) { accuracy += 4; damage += 1 }
    if (hasQuality('digizoid-weapon-obsidian')) { accuracy += 2; damage += 2 }
    if (hasQuality('digizoid-weapon-red')) { damage += 6 }
  }

  return { accuracy, damage }
}

// Calculate attack accuracy pool (base + bonus + tag/quality bonuses)
function getAttackAccuracy(digimon: Digimon, attack: { range: 'melee' | 'ranged'; tags: string[] }): number {
  const bonusStats = (digimon as any).bonusStats || { accuracy: 0 }
  const bonuses = getAttackBonuses(digimon, attack)
  return digimon.baseStats.accuracy + (bonusStats.accuracy || 0) + bonuses.accuracy
}

// Calculate attack damage pool (base + bonus + tag/quality bonuses)
// Note: Stage bonus is NOT added to the pool - it's added to final damage after the roll
function getAttackDamage(digimon: Digimon, attack: { range: 'melee' | 'ranged'; tags: string[] }): number {
  const bonusStats = (digimon as any).bonusStats || { damage: 0 }
  const bonuses = getAttackBonuses(digimon, attack)
  return digimon.baseStats.damage + (bonusStats.damage || 0) + bonuses.damage
}

// Stage order for sorting evolution chains
const stageOrder: DigimonStage[] = ['fresh', 'in-training', 'rookie', 'champion', 'ultimate', 'mega', 'ultra']

// Group partner Digimon by evolution chains
// Returns an array of { chainId: string, forms: Digimon[] } where forms are ordered by stage
const digimonChains = computed(() => {
  const chains: { chainId: string; forms: Digimon[] }[] = []
  const processed = new Set<string>()

  for (const d of partnerDigimon.value) {
    if (processed.has(d.id)) continue

    // Collect all linked Digimon (ancestors and descendants)
    const chainMembers: Digimon[] = []
    const toVisit = [d.id]
    const visited = new Set<string>()

    while (toVisit.length > 0) {
      const currentId = toVisit.pop()!
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const current = partnerDigimon.value.find(x => x.id === currentId)
      if (!current) continue

      chainMembers.push(current)
      processed.add(currentId)

      // Add ancestor
      if (current.evolvesFromId) {
        toVisit.push(current.evolvesFromId)
      }

      // Add descendants
      for (const descendantId of current.evolutionPathIds || []) {
        toVisit.push(descendantId)
      }
    }

    // Sort by stage order
    chainMembers.sort((a, b) => {
      return stageOrder.indexOf(a.stage as DigimonStage) - stageOrder.indexOf(b.stage as DigimonStage)
    })

    // Use the first member's ID as chain identifier
    const chainId = chainMembers[0]?.id || d.id
    chains.push({ chainId, forms: chainMembers })

    // Initialize currentFormIndex if not set (default to last = highest stage)
    if (currentFormIndex.value[chainId] === undefined) {
      currentFormIndex.value[chainId] = chainMembers.length - 1
    }
  }

  return chains
})

// Get the currently displayed Digimon for a chain
function getCurrentForm(chainId: string): Digimon | null {
  const chain = digimonChains.value.find(c => c.chainId === chainId)
  if (!chain) return null
  const index = currentFormIndex.value[chainId] ?? chain.forms.length - 1
  return chain.forms[index] || null
}

// Check if can navigate to previous form (de-evolve)
function canDeEvolve(chainId: string): boolean {
  return (currentFormIndex.value[chainId] ?? 0) > 0
}

// Check if can navigate to next form (evolve)
function canEvolveForm(chainId: string): boolean {
  const chain = digimonChains.value.find(c => c.chainId === chainId)
  if (!chain) return false
  const index = currentFormIndex.value[chainId] ?? chain.forms.length - 1
  return index < chain.forms.length - 1
}

// Navigate to previous form
function deEvolve(chainId: string) {
  if (canDeEvolve(chainId)) {
    currentFormIndex.value[chainId]--
  }
}

// Navigate to next form
function evolveForm(chainId: string) {
  if (canEvolveForm(chainId)) {
    currentFormIndex.value[chainId]++
  }
}

// Check if a chain has multiple forms
function hasMultipleForms(chainId: string): boolean {
  const chain = digimonChains.value.find(c => c.chainId === chainId)
  return (chain?.forms.length || 0) > 1
}

// Get all movement types available to a Digimon based on qualities
function getMovementTypes(digimon: Digimon): { type: string; speed: number }[] {
  const stageBaseMove = calcDigimonStats(digimon).movement

  // Check for Speedy quality (adds +2 movement per rank, max 2x base)
  const speedyQuality = digimon.qualities.find(q => q.id === 'speedy')
  const speedyRanks = speedyQuality?.ranks || 0
  const speedyBonus = Math.min(speedyRanks * 2, stageBaseMove) // Can't exceed 2x base (so bonus = base max)
  const baseMove = stageBaseMove + speedyBonus

  const halfMove = Math.floor(baseMove / 2)

  // Check which Extra Movement qualities the Digimon has
  const qualityChoices = new Set(digimon.qualities.map(q => q.choiceId).filter(Boolean))
  const hasJumper = qualityChoices.has('jumper')
  const hasSwimmer = qualityChoices.has('swimmer')
  const hasDigger = qualityChoices.has('digger')
  const hasFlight = qualityChoices.has('flight')
  const hasWallclimber = qualityChoices.has('wallclimber')

  // Check for Advanced Mobility (adds RAM to speed)
  const hasAdvSwimmer = qualityChoices.has('adv-swimmer')
  const hasAdvDigger = qualityChoices.has('adv-digger')
  const hasAdvFlight = qualityChoices.has('adv-flight')
  const hasAdvWallclimber = qualityChoices.has('adv-wallclimber')
  const hasAdvJumper = qualityChoices.has('adv-jumper')

  // RAM bonus for advanced mobility
  const ramBonus = digimon.baseStats.armor || 0

  const movements: { type: string; speed: number }[] = [
    { type: 'Walk', speed: baseMove },
    // Jump: half movement by default, full with Jumper quality
    { type: 'Jump', speed: hasJumper ? (hasAdvJumper ? baseMove + ramBonus : baseMove) : halfMove },
    // Swim: half movement by default, full with Swimmer quality
    { type: 'Swim', speed: hasSwimmer ? (hasAdvSwimmer ? baseMove + ramBonus : baseMove) : halfMove },
  ]

  // Add special movement types from qualities
  if (hasDigger) {
    movements.push({ type: 'Burrow', speed: hasAdvDigger ? baseMove + ramBonus : baseMove })
  }
  if (hasFlight) {
    movements.push({ type: 'Fly', speed: hasAdvFlight ? baseMove + ramBonus : baseMove })
  }
  if (hasWallclimber) {
    movements.push({ type: 'Climb', speed: hasAdvWallclimber ? baseMove + ramBonus : baseMove })
  }

  return movements
}
</script>

<template>
  <div class="min-h-screen bg-digimon-dark-900">
    <!-- Header -->
    <header class="bg-digimon-dark-800 border-b border-digimon-dark-700 sticky top-0 z-50">
      <div class="container mx-auto px-4">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gradient-to-br from-digimon-orange-500 to-digimon-orange-700 rounded-lg flex items-center justify-center">
              <span class="text-white font-display font-bold text-sm">D</span>
            </div>
            <span class="font-display text-white font-semibold">Player View</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs text-digimon-dark-400">
              Last updated: {{ lastRefresh.toLocaleTimeString() }}
            </span>
            <button
              class="text-sm text-digimon-dark-400 hover:text-white"
              @click="loadData"
            >
              Refresh
            </button>
            <button
              class="text-sm text-digimon-dark-400 hover:text-white"
              @click="switchCharacter"
            >
              Switch
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-6">
      <div v-if="loading && !tamer" class="text-center py-12">
        <div class="text-digimon-dark-400">Loading your character...</div>
      </div>

      <div v-else-if="!tamer" class="text-center py-12">
        <div class="text-6xl mb-4">❌</div>
        <h2 class="text-xl font-semibold text-white mb-2">Character Not Found</h2>
        <button
          class="text-digimon-orange-400 hover:text-digimon-orange-300"
          @click="switchCharacter"
        >
          Select a different character
        </button>
      </div>

      <template v-else>
        <!-- Active Combat Alert -->
        <div v-if="activeEncounter" :class="[
          'mb-6 rounded-xl p-4 border-2',
          isMyTurn
            ? 'bg-digimon-orange-500/20 border-digimon-orange-500 animate-pulse'
            : 'bg-red-900/20 border-red-500/50'
        ]">
          <div class="flex items-center justify-between">
            <div>
              <h2 :class="['font-display text-lg font-semibold', isMyTurn ? 'text-digimon-orange-400' : 'text-red-400']">
                {{ isMyTurn ? "⚔️ IT'S YOUR TURN!" : '⚔️ Combat Active' }}
              </h2>
              <p class="text-digimon-dark-300 text-sm">
                {{ activeEncounter.name }} • Round {{ activeEncounter.round }}
              </p>
            </div>
            <div v-if="!isMyTurn && currentTurnParticipant" class="text-right">
              <div class="text-sm text-digimon-dark-400">Current Turn:</div>
              <div class="text-white font-semibold">
                {{ getParticipantName(currentTurnParticipant) }}
              </div>
            </div>
          </div>

          <!-- My participants in combat -->
          <div v-if="myParticipants.length > 0" class="mt-4 grid gap-3">
            <div
              v-for="participant in myParticipants"
              :key="participant.id"
              :class="[
                'bg-digimon-dark-800 rounded-lg p-3',
                participant.isActive && 'ring-2 ring-digimon-orange-500'
              ]"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold text-white">{{ getParticipantName(participant) }}</span>
                <span :class="[
                  'text-xs px-2 py-0.5 rounded capitalize',
                  participant.currentStance === 'offensive' && 'bg-red-900/50 text-red-400',
                  participant.currentStance === 'defensive' && 'bg-blue-900/50 text-blue-400',
                  participant.currentStance === 'neutral' && 'bg-gray-700 text-gray-300',
                  participant.currentStance === 'sniper' && 'bg-purple-900/50 text-purple-400',
                  participant.currentStance === 'brave' && 'bg-yellow-900/50 text-yellow-400',
                ]">
                  {{ participant.currentStance }}
                </span>
              </div>

              <!-- Health bar -->
              <div class="mb-2">
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-digimon-dark-400">HP:</span>
                  <div class="flex-1 h-2 bg-digimon-dark-600 rounded-full overflow-hidden">
                    <div
                      class="h-full transition-all duration-300"
                      :class="[
                        participant.currentWounds === 0 ? 'bg-green-500' :
                        participant.currentWounds < participant.maxWounds / 2 ? 'bg-yellow-500' :
                        participant.currentWounds < participant.maxWounds ? 'bg-orange-500' : 'bg-red-500'
                      ]"
                      :style="{ width: `${((participant.maxWounds - participant.currentWounds) / participant.maxWounds) * 100}%` }"
                    />
                  </div>
                  <span class="text-digimon-dark-300">{{ participant.maxWounds - participant.currentWounds }}/{{ participant.maxWounds }}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-4 text-xs">
                <div class="flex items-center gap-1">
                  <span class="text-digimon-dark-400">Simple:</span>
                  <div class="flex gap-0.5">
                    <div v-for="i in 2" :key="i" :class="['w-3 h-3 rounded', i <= participant.actionsRemaining.simple ? 'bg-blue-500' : 'bg-digimon-dark-600']" />
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-digimon-dark-400">Complex:</span>
                  <div :class="['w-3 h-3 rounded', participant.actionsRemaining.complex > 0 ? 'bg-purple-500' : 'bg-digimon-dark-600']" />
                </div>
              </div>

              <!-- Effects -->
              <div v-if="participant.activeEffects.length > 0" class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="effect in participant.activeEffects"
                  :key="effect.id"
                  :class="[
                    'text-xs px-1.5 py-0.5 rounded',
                    effect.type === 'buff' && 'bg-green-900/30 text-green-400',
                    effect.type === 'debuff' && 'bg-red-900/30 text-red-400',
                    effect.type === 'status' && 'bg-yellow-900/30 text-yellow-400',
                  ]"
                >
                  {{ effect.name }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main Column -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Tamer Card -->
            <div class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
              <div class="flex items-start gap-4 mb-4">
                <div class="w-20 h-20 bg-digimon-dark-700 rounded-full flex items-center justify-center text-4xl shrink-0">
                  👤
                </div>
                <div>
                  <h1 class="font-display text-2xl font-bold text-white">{{ tamer.name }}</h1>
                  <p class="text-digimon-dark-400">Age {{ tamer.age }} • {{ tamer.campaignLevel }} campaign</p>
                  <div class="flex gap-4 mt-2 text-sm">
                    <span class="text-digimon-dark-300">
                      <span class="text-digimon-dark-400">Wounds:</span>
                      {{ tamer.currentWounds }}/{{ tamerStats?.woundBoxes }}
                    </span>
                    <span class="text-digimon-dark-300">
                      <span class="text-digimon-dark-400">Inspiration:</span>
                      {{ tamer.inspiration }}/{{ tamerStats?.maxInspiration }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Attributes -->
              <div class="grid grid-cols-5 gap-2 mb-4">
                <div v-for="(value, attr) in tamer.attributes" :key="attr" class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400 uppercase">{{ attr }}</div>
                  <div class="text-lg font-semibold text-white">{{ value }}</div>
                </div>
              </div>

              <!-- Derived Stats -->
              <div class="flex flex-wrap gap-4 text-sm">
                <span><span class="text-digimon-dark-400">Speed:</span> <span class="text-white">{{ tamerStats?.speed }}</span></span>
                <span><span class="text-digimon-dark-400">Accuracy:</span> <span class="text-white">{{ tamerStats?.accuracyPool }}</span></span>
                <span><span class="text-digimon-dark-400">Dodge:</span> <span class="text-white">{{ tamerStats?.dodgePool }}</span></span>
                <span><span class="text-digimon-dark-400">Damage:</span> <span class="text-white">{{ tamerStats?.damage }}</span></span>
                <span><span class="text-digimon-dark-400">Armor:</span> <span class="text-white">{{ tamerStats?.armor }}</span></span>
              </div>
            </div>

            <!-- Partner Digimon (grouped by evolution chain) -->
            <div v-for="chain in digimonChains" :key="chain.chainId" class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
              <template v-if="getCurrentForm(chain.chainId)">
                <div class="flex items-start gap-4 mb-4">
                  <!-- Evolution navigation buttons (left) -->
                  <div v-if="hasMultipleForms(chain.chainId)" class="flex flex-col justify-center h-20">
                    <button
                      :disabled="!canDeEvolve(chain.chainId)"
                      class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      :class="canDeEvolve(chain.chainId)
                        ? 'bg-digimon-dark-700 hover:bg-digimon-dark-600 text-white'
                        : 'bg-digimon-dark-800 text-digimon-dark-600 cursor-not-allowed'"
                      title="De-evolve to previous form"
                      @click="deEvolve(chain.chainId)"
                    >
                      ◀
                    </button>
                  </div>

                  <div class="w-20 h-20 bg-digimon-dark-700 rounded-lg flex items-center justify-center text-4xl shrink-0 overflow-hidden">
                    <img
                      v-if="getCurrentForm(chain.chainId)!.spriteUrl"
                      :src="getCurrentForm(chain.chainId)!.spriteUrl!"
                      :alt="getCurrentForm(chain.chainId)!.name"
                      class="max-w-full max-h-full object-contain"
                    />
                    <span v-else>🦖</span>
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <h2 class="font-display text-xl font-semibold text-white">{{ getCurrentForm(chain.chainId)!.name }}</h2>
                      <span :class="['text-sm capitalize', getStageColor(getCurrentForm(chain.chainId)!.stage as DigimonStage)]">
                        {{ getCurrentForm(chain.chainId)!.stage }}
                      </span>
                      <!-- Form indicator for chains -->
                      <span v-if="hasMultipleForms(chain.chainId)" class="text-xs text-digimon-dark-500">
                        ({{ (currentFormIndex[chain.chainId] ?? chain.forms.length - 1) + 1 }}/{{ chain.forms.length }})
                      </span>
                    </div>
                    <p class="text-digimon-dark-400 text-sm">{{ getCurrentForm(chain.chainId)!.species }} • {{ getCurrentForm(chain.chainId)!.attribute }}</p>

                    <!-- Health -->
                    <div class="mt-2">
                      <div class="flex items-center gap-2 text-sm">
                        <span class="text-digimon-dark-400">Wounds:</span>
                        <div class="flex-1 max-w-32 h-2 bg-digimon-dark-600 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-green-500 transition-all"
                            :style="{ width: `${((calcDigimonStats(getCurrentForm(chain.chainId)!).woundBoxes - getCurrentForm(chain.chainId)!.currentWounds) / calcDigimonStats(getCurrentForm(chain.chainId)!).woundBoxes) * 100}%` }"
                          />
                        </div>
                        <span class="text-digimon-dark-300">{{ calcDigimonStats(getCurrentForm(chain.chainId)!).woundBoxes - getCurrentForm(chain.chainId)!.currentWounds }}/{{ calcDigimonStats(getCurrentForm(chain.chainId)!).woundBoxes }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Evolution navigation buttons (right) -->
                  <div v-if="hasMultipleForms(chain.chainId)" class="flex flex-col justify-center h-20">
                    <button
                      :disabled="!canEvolveForm(chain.chainId)"
                      class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      :class="canEvolveForm(chain.chainId)
                        ? 'bg-digimon-dark-700 hover:bg-digimon-dark-600 text-white'
                        : 'bg-digimon-dark-800 text-digimon-dark-600 cursor-not-allowed'"
                      title="Evolve to next form"
                      @click="evolveForm(chain.chainId)"
                    >
                      ▶
                    </button>
                  </div>
                </div>

              <!-- Stats -->
              <div class="grid grid-cols-5 gap-2 mb-4">
                <div class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400">ACC</div>
                  <div class="text-lg font-semibold text-white">{{ getCurrentForm(chain.chainId)!.baseStats.accuracy + (getCurrentForm(chain.chainId)!.bonusStats?.accuracy || 0) }}</div>
                </div>
                <div class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400">DMG</div>
                  <div class="text-lg font-semibold text-white">{{ getCurrentForm(chain.chainId)!.baseStats.damage + (getCurrentForm(chain.chainId)!.bonusStats?.damage || 0) }}</div>
                </div>
                <div class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400">DOD</div>
                  <div class="text-lg font-semibold text-white">{{ getCurrentForm(chain.chainId)!.baseStats.dodge + (getCurrentForm(chain.chainId)!.bonusStats?.dodge || 0) }}</div>
                </div>
                <div class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400">ARM</div>
                  <div class="text-lg font-semibold text-white">{{ getCurrentForm(chain.chainId)!.baseStats.armor + (getCurrentForm(chain.chainId)!.bonusStats?.armor || 0) }}</div>
                </div>
                <div class="text-center bg-digimon-dark-700 rounded-lg p-2">
                  <div class="text-xs text-digimon-dark-400">HP</div>
                  <div class="text-lg font-semibold text-white">{{ getCurrentForm(chain.chainId)!.baseStats.health + (getCurrentForm(chain.chainId)!.bonusStats?.health || 0) }}</div>
                </div>
              </div>

              <!-- Derived Stats -->
              <div class="flex flex-wrap gap-4 text-sm mb-4">
                <span><span class="text-digimon-dark-400">Agility:</span> <span class="text-white">{{ calcDigimonStats(getCurrentForm(chain.chainId)!).agility }}</span></span>
                <span><span class="text-digimon-dark-400">Body:</span> <span class="text-white">{{ calcDigimonStats(getCurrentForm(chain.chainId)!).body }}</span></span>
                <span class="relative group">
                  <span class="text-digimon-dark-400">Move: </span>
                  <span class="text-white cursor-help border-b border-dotted border-digimon-dark-500">
                    {{ getMovementTypes(getCurrentForm(chain.chainId)!)[0].speed }}m
                  </span>
                  <!-- Hover tooltip with all movement types -->
                  <div class="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                    <div class="bg-digimon-dark-800 border border-digimon-dark-600 rounded-lg p-2 shadow-lg whitespace-nowrap">
                      <div v-for="move in getMovementTypes(getCurrentForm(chain.chainId)!)" :key="move.type" class="text-sm">
                        <span class="text-digimon-dark-400">{{ move.type }}:</span>
                        <span class="text-white ml-1">{{ move.speed }}m</span>
                      </div>
                    </div>
                  </div>
                </span>
                <span><span class="text-digimon-dark-400">Stage Bonus:</span> <span class="text-white">+{{ calcDigimonStats(getCurrentForm(chain.chainId)!).stageBonus }}</span></span>
              </div>

              <!-- Attacks -->
              <div v-if="getCurrentForm(chain.chainId)!.attacks && getCurrentForm(chain.chainId)!.attacks.length > 0">
                <h3 class="text-sm font-semibold text-digimon-dark-400 mb-2">Attacks</h3>
                <div class="space-y-2">
                  <div
                    v-for="attack in getCurrentForm(chain.chainId)!.attacks"
                    :key="attack.id"
                    class="bg-digimon-dark-700 rounded-lg p-3"
                  >
                    <div class="flex items-center justify-between flex-wrap gap-2">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-white">{{ attack.name }}</span>
                        <span :class="[
                          'text-xs px-1.5 py-0.5 rounded',
                          attack.range === 'melee' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
                        ]">
                          [{{ attack.range === 'melee' ? 'Melee' : 'Ranged' }}]
                        </span>
                        <span :class="[
                          'text-xs px-1.5 py-0.5 rounded',
                          attack.type === 'damage' ? 'bg-orange-900/50 text-orange-400' : 'bg-green-900/50 text-green-400'
                        ]">
                          [{{ attack.type === 'damage' ? 'Damage' : 'Support' }}]
                        </span>
                      </div>
                      <!-- Attack Stats -->
                      <div class="flex items-center gap-3 text-sm">
                        <span class="text-cyan-400">
                          ACC: {{ getAttackAccuracy(getCurrentForm(chain.chainId)!, { range: attack.range, tags: attack.tags || [] }) }}d6
                        </span>
                        <span class="text-orange-400">
                          DMG: +{{ getAttackDamage(getCurrentForm(chain.chainId)!, { range: attack.range, tags: attack.tags || [] }) }}
                        </span>
                      </div>
                    </div>
                    <div v-if="attack.tags && attack.tags.length > 0" class="flex gap-1 mt-2 flex-wrap">
                      <span
                        v-for="tag in attack.tags"
                        :key="tag"
                        class="text-xs bg-digimon-dark-600 text-digimon-dark-300 px-2 py-0.5 rounded"
                      >
                        {{ tag }}
                      </span>
                    </div>
                    <div v-if="attack.effect" class="mt-1">
                      <span class="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">
                        Effect: {{ attack.effect }}
                      </span>
                    </div>
                    <div v-if="attack.description" class="text-sm text-digimon-dark-400 mt-1 italic">
                      {{ attack.description }}
                    </div>
                  </div>
                </div>
              </div>
              </template>
            </div>

            <!-- Evolution Lines -->
            <div v-for="line in evolutionLines" :key="line.id" class="bg-digimon-dark-800 rounded-xl p-6 border border-digimon-dark-700">
              <h3 class="font-display text-lg font-semibold text-white mb-4">{{ line.name }}</h3>

              <!-- Chain visualization -->
              <div class="flex items-center gap-2 flex-wrap mb-4">
                <template v-for="(entry, index) in (line.chain as EvolutionChainEntry[])" :key="index">
                  <div
                    :class="[
                      'px-3 py-1.5 rounded-lg text-sm font-medium border',
                      index === line.currentStageIndex
                        ? 'bg-digimon-orange-500/20 border-digimon-orange-500 text-digimon-orange-400'
                        : index < line.currentStageIndex
                          ? 'bg-green-900/20 border-green-500/30 text-green-400'
                          : 'bg-digimon-dark-700 border-digimon-dark-600 text-digimon-dark-400',
                    ]"
                  >
                    {{ entry.species }}
                  </div>
                  <span v-if="index < (line.chain as EvolutionChainEntry[]).length - 1" class="text-digimon-dark-500">→</span>
                </template>
              </div>

              <!-- Next evolution requirements -->
              <div v-if="getNextStage(line)" class="text-sm">
                <span class="text-digimon-dark-400">Next:</span>
                <span :class="['ml-1', getStageColor(getNextStage(line)!.stage)]">{{ getNextStage(line)!.species }}</span>
                <span :class="['ml-2', canEvolve(line).canEvolve ? 'text-green-400' : 'text-yellow-400']">
                  ({{ canEvolve(line).reason }})
                </span>
              </div>
              <div v-else class="text-sm text-green-400">
                Maximum evolution reached!
              </div>

              <!-- Progress -->
              <div class="flex gap-4 mt-2 text-xs text-digimon-dark-400">
                <span>Battles: {{ (line.evolutionProgress as EvolutionProgress).battlesWon }}</span>
                <span>XP: {{ (line.evolutionProgress as EvolutionProgress).xpEarned }}</span>
                <span>Bond: {{ (line.evolutionProgress as EvolutionProgress).bondLevel }}</span>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="space-y-4">
            <!-- Dice Roller -->
            <DiceRoller />

            <!-- Quick Reference -->
            <div class="bg-digimon-dark-800 rounded-xl p-4 border border-digimon-dark-700">
              <h3 class="font-display text-lg font-semibold text-white mb-3">Quick Reference</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-digimon-dark-400">Simple Actions</span>
                  <span class="text-white">2 per turn</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-digimon-dark-400">Complex Actions</span>
                  <span class="text-white">1 per turn</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-digimon-dark-400">Movement</span>
                  <span class="text-white">= Simple Action</span>
                </div>
                <div class="border-t border-digimon-dark-600 my-2" />
                <div class="text-digimon-dark-400">
                  <strong class="text-white">Attack:</strong> 3d6 + Accuracy vs 3d6 + Dodge
                </div>
                <div class="text-digimon-dark-400">
                  <strong class="text-white">Damage:</strong> Net Successes + Damage + Stage Bonus - Armor
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="tamer.notes" class="bg-digimon-dark-800 rounded-xl p-4 border border-digimon-dark-700">
              <h3 class="font-display text-lg font-semibold text-white mb-3">Notes</h3>
              <p class="text-digimon-dark-300 text-sm whitespace-pre-wrap">{{ tamer.notes }}</p>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
