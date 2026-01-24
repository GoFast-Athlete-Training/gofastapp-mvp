import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting race_registry migration...');
  
  // Read SQL migration file
  const sqlPath = join(__dirname, '../prisma/migrations/20250120000000_expand_race_registry/migration.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
      } else {
        console.error(`❌ Error: ${error.message}`);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
      }
    }
  }
  
  console.log('✅ Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

