import { computed } from 'vue'
import type { DigimonStage, EddySoulRules } from '../types/index'
import { BASE_STAT_RANGES } from '../types/index'

export function useBaseStatRanges(
  stage: () => DigimonStage,
  eddySoulRules: () => EddySoulRules | undefined
) {
  const statRange = computed(() => {
    if (!eddySoulRules()?.baseStatRangesEnabled) return null
    return BASE_STAT_RANGES[stage()] ?? null
  })

  const statMin = computed(() => statRange.value?.min ?? 1)
  const statMax = computed(() => statRange.value?.max ?? undefined)
  const isRangeActive = computed(() => statRange.value !== null)

  return { statRange, statMin, statMax, isRangeActive }
}
