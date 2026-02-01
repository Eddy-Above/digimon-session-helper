import { db, tamers } from '../../db'
import { parseTamerData } from '../../utils/parsers'

export default defineEventHandler(async () => {
  const allTamers = await db.select().from(tamers)
  return allTamers.map(parseTamerData)
})
