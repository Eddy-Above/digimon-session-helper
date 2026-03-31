import type { TormentSeverity, TormentRequirements } from '../types'

interface TormentLike {
  name: string
  severity: TormentSeverity
}

export function validateTorments(
  torments: TormentLike[],
  rules?: TormentRequirements
): { isValid: boolean; message: string } {
  console.log('[validateTorments] torments:', torments?.length, torments?.map(t => ({ name: t.name, severity: t.severity })))
  console.log('[validateTorments] rules:', JSON.stringify(rules))

  if (!torments || torments.length === 0) {
    console.log('[validateTorments] FAIL: no torments')
    return { isValid: false, message: 'At least one torment is required' }
  }

  const minorCount = torments.filter(t => t.severity === 'minor').length
  const majorCount = torments.filter(t => t.severity === 'major').length
  const terribleCount = torments.filter(t => t.severity === 'terrible').length
  console.log('[validateTorments] counts: minor=%d major=%d terrible=%d', minorCount, majorCount, terribleCount)

  let severityValid: boolean
  let message = ''

  if (rules?.mode === 'custom' && rules.minCounts) {
    const { minor = 0, major = 0, terrible = 0 } = rules.minCounts
    console.log('[validateTorments] CUSTOM mode: need minor>=%d major>=%d terrible>=%d', minor, major, terrible)
    severityValid =
      minorCount >= minor &&
      majorCount >= major &&
      terribleCount >= terrible
    console.log('[validateTorments] custom severityValid:', severityValid)

    if (!severityValid) {
      const parts: string[] = []
      if (minor > 0) parts.push(`${minor} Minor`)
      if (major > 0) parts.push(`${major} Major`)
      if (terrible > 0) parts.push(`${terrible} Terrible`)
      message = `You need at least ${parts.join(' and ')} Torment(s)`
    }
  } else {
    console.log('[validateTorments] DEFAULT mode: need 2 minor OR 1 major OR 1 terrible')
    severityValid = minorCount >= 2 || majorCount >= 1 || terribleCount >= 1
    console.log('[validateTorments] default severityValid:', severityValid)
    if (!severityValid) {
      message = 'You need at least 2 Minor Torments OR 1 Major/Terrible Torment'
    }
  }

  const allNamed = torments.every(t => t.name.trim() !== '')
  console.log('[validateTorments] allNamed:', allNamed)
  if (!allNamed && torments.length > 0) {
    message = 'All torments must have a name'
  }

  const result = { isValid: severityValid && allNamed, message }
  console.log('[validateTorments] RESULT:', result)
  return result
}
