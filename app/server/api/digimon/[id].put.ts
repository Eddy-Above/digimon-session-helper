import { eq, inArray } from 'drizzle-orm'
import { db, digimon, type Digimon } from '../../db'

type UpdateDigimonBody = Partial<Omit<Digimon, 'id' | 'createdAt' | 'updatedAt'>>

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateDigimonBody>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Digimon ID is required',
    })
  }

  // Check if digimon exists
  const [existing] = await db.select().from(digimon).where(eq(digimon.id, id))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Digimon with ID ${id} not found`,
    })
  }

  // Two-way sync for evolution links
  const now = new Date()

  // Handle evolutionPathIds changes (evolves to)
  if (body.evolutionPathIds !== undefined) {
    const oldPaths = existing.evolutionPathIds || []
    const newPaths = body.evolutionPathIds || []

    // Find removed IDs (were in old, not in new)
    const removedIds = oldPaths.filter((pathId) => !newPaths.includes(pathId))
    // Find added IDs (in new, not in old)
    const addedIds = newPaths.filter((pathId) => !oldPaths.includes(pathId))

    // For removed IDs: clear their evolvesFromId if it points to this Digimon
    if (removedIds.length > 0) {
      const removedDigimon = await db.select().from(digimon).where(inArray(digimon.id, removedIds))
      for (const d of removedDigimon) {
        if (d.evolvesFromId === id) {
          await db.update(digimon).set({ evolvesFromId: null, updatedAt: now }).where(eq(digimon.id, d.id))
        }
      }
    }

    // For added IDs: set their evolvesFromId to this Digimon
    if (addedIds.length > 0) {
      await db.update(digimon).set({ evolvesFromId: id, updatedAt: now }).where(inArray(digimon.id, addedIds))
    }
  }

  // Handle evolvesFromId changes (evolves from)
  if (body.evolvesFromId !== undefined && body.evolvesFromId !== existing.evolvesFromId) {
    const oldFromId = existing.evolvesFromId
    const newFromId = body.evolvesFromId

    // Remove this ID from old parent's evolutionPathIds
    if (oldFromId) {
      const [oldParent] = await db.select().from(digimon).where(eq(digimon.id, oldFromId))
      if (oldParent) {
        const updatedPaths = (oldParent.evolutionPathIds || []).filter((pathId) => pathId !== id)
        await db.update(digimon).set({ evolutionPathIds: updatedPaths, updatedAt: now }).where(eq(digimon.id, oldFromId))
      }
    }

    // Add this ID to new parent's evolutionPathIds
    if (newFromId) {
      const [newParent] = await db.select().from(digimon).where(eq(digimon.id, newFromId))
      if (newParent) {
        const updatedPaths = [...(newParent.evolutionPathIds || []), id]
        // Avoid duplicates
        const uniquePaths = [...new Set(updatedPaths)]
        await db.update(digimon).set({ evolutionPathIds: uniquePaths, updatedAt: now }).where(eq(digimon.id, newFromId))
      }
    }
  }

  // Update digimon
  const updateData = {
    ...body,
    updatedAt: now,
  }

  await db.update(digimon).set(updateData).where(eq(digimon.id, id))

  // Return updated digimon
  const [updated] = await db.select().from(digimon).where(eq(digimon.id, id))
  return updated
})
