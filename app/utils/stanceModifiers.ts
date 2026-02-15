export function applyStanceToAccuracy(pool: number, stance: string): number {
  if (stance === 'defensive') return Math.ceil(pool / 2)
  if (stance === 'offensive') return Math.floor(pool * 1.5)
  return pool
}

export function applyStanceToDodge(pool: number, stance: string): number {
  if (stance === 'defensive') return Math.floor(pool * 1.5)
  if (stance === 'offensive') return Math.ceil(pool / 2)
  return pool
}
