import type { Digimon } from '../server/db/schema'
import { STAGE_CONFIG, SIZE_CONFIG, type DigimonStage, type DigimonSize } from '../types'

export interface CreateDigimonData {
  name: string
  species: string
  stage: DigimonStage
  attribute: 'vaccine' | 'data' | 'virus' | 'free'
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
  attacks?: Digimon['attacks']
  qualities?: Digimon['qualities']
  dataOptimization?: string
  partnerId?: string
  isEnemy?: boolean
  notes?: string
  spriteUrl?: string
}

export function useDigimon() {
  const digimonList = ref<Digimon[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDigimon(filters?: { partnerId?: string; isEnemy?: boolean }) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams()
      if (filters?.partnerId) query.set('partnerId', filters.partnerId)
      if (filters?.isEnemy !== undefined) query.set('isEnemy', String(filters.isEnemy))

      const url = query.toString() ? `/api/digimon?${query}` : '/api/digimon'
      digimonList.value = await $fetch<Digimon[]>(url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch digimon'
      console.error('Failed to fetch digimon:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchDigimonById(id: string): Promise<Digimon | null> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<Digimon>(`/api/digimon/${id}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch digimon'
      console.error('Failed to fetch digimon:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createDigimon(data: CreateDigimonData): Promise<Digimon | null> {
    loading.value = true
    error.value = null
    try {
      const newDigimon = await $fetch<Digimon>('/api/digimon', {
        method: 'POST',
        body: data,
      })
      digimonList.value = [...digimonList.value, newDigimon]
      return newDigimon
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create digimon'
      console.error('Failed to create digimon:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateDigimon(id: string, data: Partial<Digimon>): Promise<Digimon | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await $fetch<Digimon>(`/api/digimon/${id}`, {
        method: 'PUT',
        body: data,
      })
      digimonList.value = digimonList.value.map((d) => (d.id === id ? updated : d))
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update digimon'
      console.error('Failed to update digimon:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function deleteDigimon(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/digimon/${id}`, { method: 'DELETE' })
      digimonList.value = digimonList.value.filter((d) => d.id !== id)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete digimon'
      console.error('Failed to delete digimon:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  // Calculate derived stats from base stats, stage, and size (DDA 1.4 page 111)
  function calculateDerivedStats(digimon: Digimon) {
    const { baseStats, stage, size } = digimon
    const stageConfig = STAGE_CONFIG[stage as DigimonStage]
    const sizeConfig = SIZE_CONFIG[size as DigimonSize] || SIZE_CONFIG['medium']

    // Primary Derived Stats (always round down)
    // Size affects Body and Agility differently (page 110)
    const brains = Math.floor(baseStats.accuracy / 2) + stageConfig.brainsBonus
    const body = Math.max(0, Math.floor((baseStats.health + baseStats.damage + baseStats.armor) / 3) + sizeConfig.bodyBonus)
    const agility = Math.max(0, Math.floor((baseStats.accuracy + baseStats.dodge) / 2) + sizeConfig.agilityBonus)

    // Spec Values (derived from derived stats)
    const bit = Math.floor(brains / 10) + stageConfig.stageBonus
    const cpu = Math.floor(body / 10) + stageConfig.stageBonus
    const ram = Math.floor(agility / 10) + stageConfig.stageBonus

    return {
      brains,
      body,
      agility,
      woundBoxes: baseStats.health + stageConfig.woundBonus,
      bit,
      cpu,
      ram,
      movement: stageConfig.movement,
      stageBonus: stageConfig.stageBonus,
    }
  }

  // Roll initiative for a digimon (3d6 + Agility)
  function rollInitiative(digimon: Digimon): { total: number; roll: number } {
    const derived = calculateDerivedStats(digimon)
    const roll =
      Math.floor(Math.random() * 6) + 1 +
      Math.floor(Math.random() * 6) + 1 +
      Math.floor(Math.random() * 6) + 1
    return {
      roll,
      total: roll + derived.agility,
    }
  }

  // Get stage configuration
  function getStageConfig(stage: DigimonStage) {
    return STAGE_CONFIG[stage]
  }

  return {
    digimonList,
    loading,
    error,
    fetchDigimon,
    fetchDigimonById,
    createDigimon,
    updateDigimon,
    deleteDigimon,
    calculateDerivedStats,
    rollInitiative,
    getStageConfig,
  }
}
