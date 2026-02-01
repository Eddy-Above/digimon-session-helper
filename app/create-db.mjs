import postgres from 'postgres';

const adminUrl = 'postgresql://postgres:passwordlime@localhost:5432/postgres';
const client = postgres(adminUrl);

console.log('Creating database digimon_dev...');
try {
  await client`CREATE DATABASE digimon_dev;`;
  console.log('✓ Database created successfully!');
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('✓ Database already exists');
  } else {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

await client.end();
