#!/usr/bin/env node
/**
 * Apply full Prisma schema to a PostgreSQL database that doesn't set search_path
 * (e.g. Filess.io). Uses a single pg connection and runs SET search_path then full schema.
 * Also creates _prisma_migrations and marks existing migrations as applied so
 * "prisma migrate deploy" works for future runs.
 */
const { Client } = require('pg');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prismaDir = path.join(__dirname, '..');
const migrationsDir = path.join(prismaDir, 'prisma', 'migrations');

async function main() {
  const fullSchemaSql = execSync(
    `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
    { cwd: prismaDir, encoding: 'utf-8' }
  );

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  const urlForLog = url.replace(/:[^:@]+@/, ':****@');
  console.log('Using database:', urlForLog.split('@')[1]?.split('/')[0] || 'unknown');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('SET search_path TO public');
    const r = await client.query('SELECT current_setting(\'search_path\') as p');
    console.log('search_path after SET:', r.rows[0].p);

    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
    );
    const schemaAlreadyApplied = tableCheck.rows.length > 0;
    if (schemaAlreadyApplied) {
      const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LIMIT 5`);
      console.log('Existing tables (sample):', tables.rows.map((r) => r.tablename).join(', '));
    } else {
      console.log('Table check: users not found in public (rowCount=', tableCheck.rowCount, ')');
    }

    if (!schemaAlreadyApplied) {
      const statements = fullSchemaSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      console.log('Executing', statements.length, 'statements...');
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt) {
          try {
            await client.query('SET search_path TO public');
            await client.query(stmt + ';');
          } catch (err) {
            console.error('Statement', i + 1, 'failed:', stmt.slice(0, 80) + '...');
            throw err;
          }
        }
      }
      // Verify tables exist in public
      const tablesAfter = await client.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      const names = tablesAfter.rows.map((r) => r.tablename);
      if (!names.includes('users')) {
        throw new Error(
          'Schema apply reported success but "users" table missing. Tables in public: ' + names.join(', ') || '(none)'
        );
      }
      console.log('Schema applied successfully. Tables in public:', names.length, '-', names.slice(0, 8).join(', ') + (names.length > 8 ? '...' : ''));
    } else {
      console.log('Schema already present, skipping apply.');
    }

    // Create _prisma_migrations and mark existing migrations as applied
    await client.query('SET search_path TO public');
    const createTable = `
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL,
        "applied_steps_count" INTEGER NOT NULL
      );
    `;
    await client.query(createTable);

    const migrationDirs = fs.readdirSync(migrationsDir)
      .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort();
    const now = new Date().toISOString();
    for (const name of migrationDirs) {
      const sqlPath = path.join(migrationsDir, name, 'migration.sql');
      const content = fs.readFileSync(sqlPath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      await client.query(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("id") DO NOTHING`,
        [
          crypto.randomUUID(),
          checksum,
          now,
          name,
          null,
          null,
          now,
          1,
        ]
      );
    }
    console.log('Migration history recorded for', migrationDirs.length, 'migrations.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
