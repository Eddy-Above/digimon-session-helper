import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(databaseUrl, {
  // Disable SSL requirement for Railway
  ssl: 'allow',
  max: 1,
});

const db = drizzle(client);

console.log('Running migrations...');
await migrate(db, { migrationsFolder: './server/db/migrations' });
console.log('Migrations completed!');

await client.end();
