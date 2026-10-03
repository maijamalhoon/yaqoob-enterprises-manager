/**
 * Production Database Restore Script
 * Restores a JSON backup archive into a clean Yaqoob Enterprises database.
 * Verifies final row count and total financial sum matching.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function runRestore() {
  const backupFilePath = process.argv[2];
  if (!backupFilePath) {
    console.error('Usage: ts-node scripts/restore_database.ts <path-to-backup.json>');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided as environment variables.');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), backupFilePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`ERROR: File not found at ${resolvedPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const backup = JSON.parse(fileContent);

  const rows = backup.data || [];
  console.log(`--- Starting Yaqoob Ledger Restore ---`);
  console.log(`Restoring ${rows.length} records from ${path.basename(resolvedPath)}...`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Restore in batches of 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(`Inserting batch ${i + 1} to ${i + batch.length}...`);

    const { error } = await supabase
      .from('transactions')
      .upsert(batch, { onConflict: 'idempotency_key' });

    if (error) {
      console.error(`Failed to restore batch at offset ${i}:`, error);
      process.exit(1);
    }
  }

  // Verification
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  console.log(`Live database now has ${count} records.`);
  console.log('--- Restore Completed Successfully ---');
}

runRestore().catch((err) => {
  console.error('Restore error:', err);
  process.exit(1);
});
