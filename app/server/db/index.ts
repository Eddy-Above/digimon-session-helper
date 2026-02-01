import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Get database URL from environment or use default
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Create Postgres connection
const client = postgres(databaseUrl)

// Create Drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema for use in other files
export * from './schema'
