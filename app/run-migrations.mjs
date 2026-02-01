import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(databaseUrl, {
  ssl: 'allow',
});

const sqlFile = path.join(process.cwd(), 'init-db.sql');
const sql = fs.readFileSync(sqlFile, 'utf-8');

console.log('Executing database initialization...');
try {
  await client.unsafe(sql);
  console.log('✓ Database tables created successfully!');
} catch (error) {
  console.error('✗ Error creating tables:', error.message);
  process.exit(1);
}

await client.end();
