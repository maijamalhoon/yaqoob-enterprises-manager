/**
 * Production Automated Database Backup Script
 * Paginates beyond 1,000 rows, verifies row counts against live database,
 * and saves immutable backup archives.
 *
 * NOTE: SUPABASE_SERVICE_ROLE_KEY is passed exclusively via CI secrets.
 * NEVER hardcode keys or place them in client-accessible files.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function runBackup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided as environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('--- Starting Yaqoob Ledger Backup ---');
  console.log(`Connecting to: ${supabaseUrl}`);

  // 1. Get exact total count
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Failed to get transaction count:', countError);
    process.exit(1);
  }

  const totalCount = count || 0;
  console.log(`Live database has ${totalCount} transactions.`);

  // 2. Paginate in batches of 1,000 rows
  const PAGE_SIZE = 1000;
  let offset = 0;
  const allRows: any[] = [];

  while (offset < totalCount || totalCount === 0) {
    console.log(`Fetching rows ${offset} to ${offset + PAGE_SIZE - 1}...`);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('device_entry_time', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`Error fetching batch at offset ${offset}:`, error);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    offset += data.length;
  }

  // 3. Verify Row Count Integrity
  if (allRows.length !== totalCount) {
    console.error(
      `INTEGRITY FAILURE: Retrieved ${allRows.length} rows, but database reported ${totalCount} rows!`
    );
    process.exit(1);
  }

  console.log(`Successfully verified and retrieved all ${allRows.length} records.`);

  // 4. Save archive
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `yaqoob_ledger_backup_${timestamp}.json`);

  const backupPayload = {
    metadata: {
      exportedAt: new Date().toISOString(),
      rowCount: allRows.length,
      supabaseUrl,
      version: '2.0.0',
    },
    data: allRows,
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`Backup archive successfully created at: ${backupFile}`);
  console.log('--- Backup Completed Successfully ---');
}

runBackup().catch((err) => {
  console.error('Unhandled backup failure:', err);
  process.exit(1);
});
