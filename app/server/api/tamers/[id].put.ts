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
    // Stringify JSON fields for storage
    attributes: body.attributes ? JSON.stringify(body.attributes) : existing.attributes,
    skills: body.skills ? JSON.stringify(body.skills) : existing.skills,
    aspects: body.aspects ? JSON.stringify(body.aspects) : existing.aspects,
    torments: body.torments ? JSON.stringify(body.torments) : existing.torments,
    equipment: body.equipment ? JSON.stringify(body.equipment) : existing.equipment,
    specialOrders: body.specialOrders ? JSON.stringify(body.specialOrders) : existing.specialOrders,
    xpBonuses: body.xpBonuses ? JSON.stringify(body.xpBonuses) : existing.xpBonuses,
    updatedAt: new Date(),
  }

  console.log('[PUT /api/tamers/:id] Updating tamer:', { id, name: body.name })

  await db.update(tamers).set(updateData).where(eq(tamers.id, id))

  // Return updated tamer
  const [updated] = await db.select().from(tamers).where(eq(tamers.id, id))
  return parseTamerData(updated)
})
