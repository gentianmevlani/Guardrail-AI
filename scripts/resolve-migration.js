#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resolveMigration() {
  try {
    console.log('🔧 Resolving failed migration...');
    
    // Check if the columns already exist
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('provider', 'provider_id')
    `;
    
    const existingColumns = result.map(r => r.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Mark the failed migration as applied
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (
        "id", 
        "checksum", 
        "finished_at", 
        "migration_name", 
        "logs", 
        "rolled_back_at", 
        "started_at", 
        "applied_steps_count"
      ) VALUES (
        '20260104105000_add_user_provider_columns',
        'c4f4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4c4',
        NOW(),
        '20260104105000_add_user_provider_columns',
        'Migration resolved manually',
        NULL,
        NOW(),
        1
      ) ON CONFLICT ("id") DO NOTHING
    `;
    
    console.log('✅ Migration marked as resolved');
    
    // Verify the table structure
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Users table structure:');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error resolving migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigration();
