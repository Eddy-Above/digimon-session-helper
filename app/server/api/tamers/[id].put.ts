import { eq } from 'drizzle-orm'
import { db, tamers, type Tamer } from '../../db'
import { parseTamerData } from '../../utils/parsers'

type UpdateTamerBody = Partial<Omit<Tamer, 'id' | 'createdAt' | 'updatedAt'>>

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTamerBody>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Tamer ID is required',
    })
  }

  // Check if tamer exists
  const [existing] = await db.select().from(tamers).where(eq(tamers.id, id))

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Tamer with ID ${id} not found`,
    })
  }

  // Update tamer - ensure JSON fields are properly serialized
  const updateData: any = {
    ...body,
    updatedAt: new Date(),
  }

  // Stringify JSON fields for storage (check !== undefined to handle empty arrays/objects)
  if (body.attributes !== undefined) updateData.attributes = JSON.stringify(body.attributes)
  else updateData.attributes = existing.attributes

  if (body.skills !== undefined) updateData.skills = JSON.stringify(body.skills)
  else updateData.skills = existing.skills

  if (body.aspects !== undefined) updateData.aspects = JSON.stringify(body.aspects)
  else updateData.aspects = existing.aspects

  if (body.torments !== undefined) updateData.torments = JSON.stringify(body.torments)
  else updateData.torments = existing.torments

  if (body.equipment !== undefined) updateData.equipment = JSON.stringify(body.equipment)
  else updateData.equipment = existing.equipment

  if (body.specialOrders !== undefined) updateData.specialOrders = JSON.stringify(body.specialOrders)
  else updateData.specialOrders = existing.specialOrders

  if (body.xpBonuses !== undefined) updateData.xpBonuses = JSON.stringify(body.xpBonuses)
  else updateData.xpBonuses = existing.xpBonuses

  console.log('[PUT /api/tamers/:id] Updating tamer:', { id, name: body.name })

  await db.update(tamers).set(updateData).where(eq(tamers.id, id))

  // Return updated tamer
  const [updated] = await db.select().from(tamers).where(eq(tamers.id, id))
  return parseTamerData(updated)
})
