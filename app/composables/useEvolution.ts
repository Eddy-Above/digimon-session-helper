import type { EvolutionLine } from '../server/db/schema'
import type { DigimonStage } from '../types'

export interface EvolutionChainEntry {
  stage: DigimonStage
  species: string
  digimonId: string | null
  requirements: {
    type: 'battles' | 'xp' | 'bond' | 'item' | 'special'
    description: string
    value: number | null
    itemName: string | null
  } | null
}

export interface EvolutionProgress {
  battlesWon: number
  xpEarned: number
  bondLevel: number
  itemsCollected: string[]
}

export interface CreateEvolutionLineData {
  name: string
  description?: string
  chain: EvolutionChainEntry[]
  partnerId?: string
}

export function useEvolution() {
  const evolutionLines = ref<EvolutionLine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEvolutionLines(partnerId?: string) {
    loading.value = true
    error.value = null
    try {
      const query = partnerId ? `?partnerId=${partnerId}` : ''
      evolutionLines.value = await $fetch<EvolutionLine[]>(`/api/evolution-lines${query}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch evolution lines'
      console.error('Failed to fetch evolution lines:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchEvolutionLine(id: string): Promise<EvolutionLine | null> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<EvolutionLine>(`/api/evolution-lines/${id}`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch evolution line'
      console.error('Failed to fetch evolution line:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createEvolutionLine(data: CreateEvolutionLineData): Promise<EvolutionLine | null> {
    loading.value = true
    error.value = null
    try {
      const newLine = await $fetch<EvolutionLine>('/api/evolution-lines', {
        method: 'POST',
        body: data,
      })
      evolutionLines.value = [...evolutionLines.value, newLine]
      return newLine
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create evolution line'
      console.error('Failed to create evolution line:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateEvolutionLine(id: string, data: Partial<EvolutionLine>): Promise<EvolutionLine | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await $fetch<EvolutionLine>(`/api/evolution-lines/${id}`, {
        method: 'PUT',
        body: data,
      })
      evolutionLines.value = evolutionLines.value.map((l) => (l.id === id ? updated : l))
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update evolution line'
      console.error('Failed to update evolution line:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function deleteEvolutionLine(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/evolution-lines/${id}`, { method: 'DELETE' })
      evolutionLines.value = evolutionLines.value.filter((l) => l.id !== id)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete evolution line'
      console.error('Failed to delete evolution line:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  // Evolve to next stage
  async function evolve(evolutionLineId: string): Promise<EvolutionLine | null> {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const chain = line.chain as EvolutionChainEntry[]
    const currentIndex = line.currentStageIndex

    if (currentIndex >= chain.length - 1) {
      error.value = 'Already at maximum evolution stage'
      return null
    }

    // Check requirements for next stage
    const nextStage = chain[currentIndex + 1]
    if (nextStage.requirements) {
      const progress = line.evolutionProgress as EvolutionProgress
      const req = nextStage.requirements

      switch (req.type) {
        case 'battles':
          if (progress.battlesWon < (req.value || 0)) {
            error.value = `Need ${req.value} battles won (have ${progress.battlesWon})`
            return null
          }
          break
        case 'xp':
          if (progress.xpEarned < (req.value || 0)) {
            error.value = `Need ${req.value} XP (have ${progress.xpEarned})`
            return null
          }
          break
        case 'bond':
          if (progress.bondLevel < (req.value || 0)) {
            error.value = `Need bond level ${req.value} (have ${progress.bondLevel})`
            return null
          }
          break
        case 'item':
          if (req.itemName && !progress.itemsCollected.includes(req.itemName)) {
            error.value = `Need item: ${req.itemName}`
            return null
          }
          break
      }
    }

    // Evolution successful
    return updateEvolutionLine(evolutionLineId, {
      currentStageIndex: currentIndex + 1,
    })
  }

  // Devolve to previous stage
  async function devolve(evolutionLineId: string): Promise<EvolutionLine | null> {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    if (line.currentStageIndex <= 0) {
      error.value = 'Already at minimum evolution stage'
      return null
    }

    return updateEvolutionLine(evolutionLineId, {
      currentStageIndex: line.currentStageIndex - 1,
    })
  }

  // Update progress
  async function updateProgress(
    evolutionLineId: string,
    progressUpdate: Partial<EvolutionProgress>
  ): Promise<EvolutionLine | null> {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const currentProgress = line.evolutionProgress as EvolutionProgress
    const newProgress = {
      ...currentProgress,
      ...progressUpdate,
    }

    return updateEvolutionLine(evolutionLineId, {
      evolutionProgress: newProgress,
    })
  }

  // Add battles won
  async function addBattlesWon(evolutionLineId: string, count: number = 1) {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const progress = line.evolutionProgress as EvolutionProgress
    return updateProgress(evolutionLineId, {
      battlesWon: progress.battlesWon + count,
    })
  }

  // Add XP
  async function addXP(evolutionLineId: string, amount: number) {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const progress = line.evolutionProgress as EvolutionProgress
    return updateProgress(evolutionLineId, {
      xpEarned: progress.xpEarned + amount,
    })
  }

  // Increase bond
  async function increaseBond(evolutionLineId: string, amount: number = 1) {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const progress = line.evolutionProgress as EvolutionProgress
    return updateProgress(evolutionLineId, {
      bondLevel: progress.bondLevel + amount,
    })
  }

  // Collect item
  async function collectItem(evolutionLineId: string, itemName: string) {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) return null

    const progress = line.evolutionProgress as EvolutionProgress
    if (progress.itemsCollected.includes(itemName)) return line

    return updateProgress(evolutionLineId, {
      itemsCollected: [...progress.itemsCollected, itemName],
    })
  }

  // Get current stage info
  function getCurrentStage(evolutionLine: EvolutionLine): EvolutionChainEntry | null {
    const chain = evolutionLine.chain as EvolutionChainEntry[]
    return chain[evolutionLine.currentStageIndex] || null
  }

  // Get next stage info
  function getNextStage(evolutionLine: EvolutionLine): EvolutionChainEntry | null {
    const chain = evolutionLine.chain as EvolutionChainEntry[]
    const nextIndex = evolutionLine.currentStageIndex + 1
    return chain[nextIndex] || null
  }

  // Link a Digimon sheet to a chain entry
  async function linkDigimonToChainEntry(
    evolutionLineId: string,
    chainIndex: number,
    digimonId: string | null
  ): Promise<EvolutionLine | null> {
    const line = evolutionLines.value.find((l) => l.id === evolutionLineId)
    if (!line) {
      // Try fetching it
      const fetchedLine = await fetchEvolutionLine(evolutionLineId)
      if (!fetchedLine) return null
      const chain = [...(fetchedLine.chain as EvolutionChainEntry[])]
      if (chainIndex < 0 || chainIndex >= chain.length) return null
      chain[chainIndex] = { ...chain[chainIndex], digimonId }
      return updateEvolutionLine(evolutionLineId, { chain })
    }

    const chain = [...(line.chain as EvolutionChainEntry[])]
    if (chainIndex < 0 || chainIndex >= chain.length) return null

    chain[chainIndex] = { ...chain[chainIndex], digimonId }
    return updateEvolutionLine(evolutionLineId, { chain })
  }

  // Check if can evolve
  function canEvolve(evolutionLine: EvolutionLine): { canEvolve: boolean; reason: string } {
    const chain = evolutionLine.chain as EvolutionChainEntry[]
    const currentIndex = evolutionLine.currentStageIndex

    if (currentIndex >= chain.length - 1) {
      return { canEvolve: false, reason: 'Maximum evolution reached' }
    }

    const nextStage = chain[currentIndex + 1]
    if (!nextStage.requirements) {
      return { canEvolve: true, reason: 'Ready to evolve' }
    }

    const progress = evolutionLine.evolutionProgress as EvolutionProgress
    const req = nextStage.requirements

    switch (req.type) {
      case 'battles':
        if (progress.battlesWon < (req.value || 0)) {
          return { canEvolve: false, reason: `Need ${(req.value || 0) - progress.battlesWon} more battles` }
        }
        break
      case 'xp':
        if (progress.xpEarned < (req.value || 0)) {
          return { canEvolve: false, reason: `Need ${(req.value || 0) - progress.xpEarned} more XP` }
        }
        break
      case 'bond':
        if (progress.bondLevel < (req.value || 0)) {
          return { canEvolve: false, reason: `Need bond level ${req.value}` }
        }
        break
      case 'item':
        if (req.itemName && !progress.itemsCollected.includes(req.itemName)) {
          return { canEvolve: false, reason: `Need item: ${req.itemName}` }
        }
        break
      case 'special':
        return { canEvolve: false, reason: req.description || 'Special requirement not met' }
    }

    return { canEvolve: true, reason: 'Ready to evolve' }
  }

  return {
    evolutionLines,
    loading,
    error,
    fetchEvolutionLines,
    fetchEvolutionLine,
    createEvolutionLine,
    updateEvolutionLine,
    deleteEvolutionLine,
    evolve,
    devolve,
    updateProgress,
    addBattlesWon,
    addXP,
    increaseBond,
    collectItem,
    getCurrentStage,
    getNextStage,
    canEvolve,
    linkDigimonToChainEntry,
  }
}
