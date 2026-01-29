<script setup lang="ts">
import { QUALITY_DATABASE, getFreeQualities, getNegativeQualities, getMaxNegativeDP, type QualityTemplate } from '../data/qualities'
import type { DigimonStage } from '../types'

interface Quality {
  id: string
  name: string
  type: 'static' | 'trigger' | 'attack'
  dpCost: number
  description: string
  effect: string
  ranks?: number
}

interface Props {
  stage: DigimonStage
  currentQualities: Quality[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'add', quality: Quality): void
  (e: 'remove', index: number): void
}>()

const showSelector = ref(false)
const searchQuery = ref('')
const filterType = ref<'all' | 'free' | 'negative'>('all')

const maxNegativeDP = computed(() => getMaxNegativeDP(props.stage))

const currentNegativeDP = computed(() => {
  return props.currentQualities
    .filter((q) => {
      const template = QUALITY_DATABASE.find((t) => t.id === q.id)
      return template?.type === 'negative'
    })
    .reduce((sum, q) => sum + q.dpCost, 0)
})

const hasFreeQuality = computed(() => {
  return props.currentQualities.some((q) => {
    const template = QUALITY_DATABASE.find((t) => t.id === q.id)
    return template?.type === 'free'
  })
})

const availableQualities = computed(() => {
  let qualities = QUALITY_DATABASE

  if (filterType.value === 'free') {
    qualities = getFreeQualities()
  } else if (filterType.value === 'negative') {
    qualities = getNegativeQualities()
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    qualities = qualities.filter(
      (q) =>
        q.name.toLowerCase().includes(query) ||
        q.description.toLowerCase().includes(query) ||
        q.effect.toLowerCase().includes(query)
    )
  }

  // Filter out already selected qualities and unavailable ones
  return qualities.filter((q) => {
    // Already have this quality
    if (props.currentQualities.some((cq) => cq.id === q.id)) return false

    // Can only have one free quality
    if (q.type === 'free' && hasFreeQuality.value) return false

    // Check negative DP limit
    if (q.type === 'negative') {
      const newTotal = Math.abs(currentNegativeDP.value) + Math.abs(q.dpCost)
      if (newTotal > maxNegativeDP.value) return false
    }

    return true
  })
})

function selectQuality(template: QualityTemplate) {
  const quality: Quality = {
    id: template.id,
    name: template.name,
    type: template.qualityType,
    dpCost: template.dpCost,
    description: template.description,
    effect: template.effect,
    ranks: 1,
  }
  emit('add', quality)
  showSelector.value = false
}

function getTypeColor(qualityType: string) {
  switch (qualityType) {
    case 'static':
      return 'bg-blue-900/30 text-blue-400'
    case 'trigger':
      return 'bg-yellow-900/30 text-yellow-400'
    case 'attack':
      return 'bg-red-900/30 text-red-400'
    default:
      return 'bg-digimon-dark-600 text-digimon-dark-300'
  }
}

function getCategoryColor(type: 'free' | 'negative') {
  return type === 'free'
    ? 'bg-green-900/30 text-green-400'
    : 'bg-purple-900/30 text-purple-400'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Summary -->
    <div class="flex gap-4 text-sm">
      <div>
        <span class="text-digimon-dark-400">Free Quality:</span>
        <span :class="hasFreeQuality ? 'text-green-400' : 'text-digimon-dark-500'" class="ml-1">
          {{ hasFreeQuality ? '1/1' : '0/1' }}
        </span>
      </div>
      <div>
        <span class="text-digimon-dark-400">Negative DP:</span>
        <span class="text-purple-400 ml-1">
          {{ Math.abs(currentNegativeDP) }}/{{ maxNegativeDP }}
        </span>
      </div>
    </div>

    <!-- Current Qualities -->
    <div v-if="currentQualities.length > 0" class="space-y-2">
      <div
        v-for="(quality, index) in currentQualities"
        :key="quality.id"
        class="bg-digimon-dark-700 rounded-lg p-3 flex justify-between items-start"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-white">{{ quality.name }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded uppercase', getTypeColor(quality.type)]">
              {{ quality.type }}
            </span>
            <span
              :class="[
                'text-xs px-2 py-0.5 rounded',
                quality.dpCost === 0 ? 'bg-green-900/30 text-green-400' : 'bg-purple-900/30 text-purple-400'
              ]"
            >
              {{ quality.dpCost === 0 ? 'Free' : `${quality.dpCost} DP` }}
            </span>
          </div>
          <p class="text-sm text-digimon-dark-400 mt-1">{{ quality.description }}</p>
          <p class="text-xs text-digimon-dark-300 mt-2 whitespace-pre-line">{{ quality.effect }}</p>
        </div>
        <button
          type="button"
          class="text-red-400 hover:text-red-300 text-sm ml-2"
          @click="emit('remove', index)"
        >
          Remove
        </button>
      </div>
    </div>

    <!-- Add Quality Button -->
    <div v-if="!showSelector">
      <button
        type="button"
        class="w-full border-2 border-dashed border-digimon-dark-600 rounded-lg p-4
               text-digimon-dark-400 hover:border-digimon-dark-500 hover:text-digimon-dark-300
               transition-colors"
        @click="showSelector = true"
      >
        + Add Quality
      </button>
    </div>

    <!-- Quality Selector -->
    <div v-else class="border border-digimon-dark-600 rounded-lg p-4 bg-digimon-dark-750">
      <div class="flex justify-between items-center mb-4">
        <h4 class="font-semibold text-white">Select Quality</h4>
        <button
          type="button"
          class="text-digimon-dark-400 hover:text-white"
          @click="showSelector = false"
        >
          ✕
        </button>
      </div>

      <!-- Search and filter -->
      <div class="flex gap-2 mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search qualities..."
          class="flex-1 bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                 text-white text-sm focus:border-digimon-orange-500 focus:outline-none"
        />
        <select
          v-model="filterType"
          class="bg-digimon-dark-700 border border-digimon-dark-600 rounded px-3 py-2
                 text-white text-sm focus:border-digimon-orange-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="free">Free (0 DP)</option>
          <option value="negative">Negative (-DP)</option>
        </select>
      </div>

      <!-- Quality list -->
      <div class="max-h-64 overflow-y-auto space-y-2">
        <button
          v-for="quality in availableQualities"
          :key="quality.id"
          type="button"
          class="w-full text-left bg-digimon-dark-700 hover:bg-digimon-dark-600 rounded-lg p-3
                 transition-colors"
          @click="selectQuality(quality)"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-white">{{ quality.name }}</span>
            <span :class="['text-xs px-2 py-0.5 rounded uppercase', getTypeColor(quality.qualityType)]">
              {{ quality.qualityType }}
            </span>
            <span :class="['text-xs px-2 py-0.5 rounded', getCategoryColor(quality.type)]">
              {{ quality.type === 'free' ? 'Free' : `${quality.dpCost} DP` }}
            </span>
            <span v-if="quality.maxRanks > 1" class="text-xs text-digimon-dark-400">
              ({{ quality.maxRanks }} ranks)
            </span>
          </div>
          <p class="text-xs text-digimon-dark-400 mt-1">{{ quality.description }}</p>
          <p v-if="quality.prerequisites.length > 0" class="text-xs text-yellow-400/70 mt-1">
            Requires: {{ quality.prerequisites.join(', ') }}
          </p>
        </button>

        <div v-if="availableQualities.length === 0" class="text-center py-4 text-digimon-dark-400">
          No qualities available
        </div>
      </div>
    </div>
  </div>
</template>
