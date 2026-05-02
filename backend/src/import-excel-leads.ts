/**
 * Import leads from Excel → PostgreSQL
 *
 * File: leads-all-2026-04-13 (1).xlsx
 * Usage: npx tsx scripts/import-excel-leads.ts
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING (won't duplicate).
 */

import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'dokcrm',
  user:     process.env.DB_USER     || 'dokcrm',
  password: process.env.DB_PASSWORD || 'dokcrm@local123',
});

// ── Stage normalizer (handles casing inconsistencies) ────────────────────────
const VALID_STAGES: Record<string, string> = {
  'on hold':        'On Hold',
  'meeting pending':'Meeting Pending',
  'proposal sent':  'Proposal Sent',
  'negotiated':     'Negotiated',
  'verbal yes':     'Verbal Yes',
  'closed & won':   'Closed & Won',
};

function normalizeStage(raw: string): string {
  const key = (raw || '').trim().toLowerCase();
  return VALID_STAGES[key] || 'On Hold';
}

// ── Solution mapper (abbreviations → standard DB values) ────────────────────
function normalizeSolution(raw: string): string {
  const s = (raw || '').trim();
  const map: Record<string, string> = {
    'Digital Archiving':        'Digital Archiving',
    'DA':                       'Digital Archiving',
    'Document Management':      'Document Management',
    'DMS':                      'Document Management',
    'Records Management':       'Records Management',
    'Business Process Management': 'Business Process Management',
    'Workflow Automation':      'Workflow Automation',
    // Combo / non-standard → Other
    'DA/DMS':                   'Other',
    'PA/DA':                    'Other',
    'PA / DA':                  'Other',
    'PA':                       'Other',
    'SS':                       'Other',
    'PA/Staff Outscoring':      'Other',
    'Staff Outsorcing':         'Other',
  };
  return map[s] || 'Other';
}

// ── Parse "Additional Contacts" string into contact objects ──────────────────
// Format in Excel: "Name | Title / Name | Title"
function parseAdditionalContacts(raw: string): Array<{ id: string; name: string; phone: string; email: string; designation: string; isPrimary: boolean }> {
  if (!raw || !raw.trim()) return [];

  return raw
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const [name, designation] = entry.split('|').map(s => s.trim());
      return {
        id:          `extra-${Date.now()}-${i}`,
        name:        name || '',
        phone:       '',
        email:       '',
        designation: designation || '',
        isPrimary:   false,
      };
    });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const filePath = path.join(__dirname, '../../leads-all-2026-04-13 (1).xlsx');
  console.log('\n📂 Reading Excel file...');

  const wb   = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets['Leads'],
    { defval: '' }
  );
  console.log(`   Found ${rows.length} rows\n`);

  // ── Load users from DB (need owner_id from email) ──────────────────────────
  const usersResult = await pool.query(
    'SELECT id, email FROM users'
  );
  const emailToId: Record<string, string> = {};
  for (const u of usersResult.rows) {
    emailToId[u.email.toLowerCase()] = u.id;
  }
  console.log(`👤 Users in DB: ${usersResult.rows.length}`);
  console.log('   Mapped emails:', Object.keys(emailToId));

  // ── Import leads ──────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;
  const unmappedOwners = new Set<string>();

  for (const row of rows) {
    const ownerEmail = (row['Owner Email'] as string || '').toLowerCase();
    const ownerId    = emailToId[ownerEmail];

    if (!ownerId) {
      unmappedOwners.add(ownerEmail);
      errors++;
      continue;
    }

    // Build contacts JSONB array
    const primaryContact = {
      id:          'primary',
      name:        (row['Primary Contact Name']  as string) || '',
      phone:       (row['Primary Contact Phone'] as string) || '',
      email:       (row['Primary Contact Email'] as string) || '',
      designation: '',
      isPrimary:   true,
    };

    const additionalContacts = parseAdditionalContacts(row['Additional Contacts'] as string);
    const contacts = [primaryContact, ...additionalContacts];

    const salesStage      = normalizeStage(row['Sales Stage'] as string);
    const solution        = normalizeSolution(row['Solution'] as string);
    const estimatedRevenue = parseFloat((row['Estimated Revenue'] as string || '0').toString().replace(/,/g, '')) || 0;
    const probability     = parseInt((row['Probability (%)'] as string || '0').toString()) || 0;

    // Parse dates
    const createdAt = row['Created Date']
      ? new Date(row['Created Date'] as string).toISOString()
      : new Date().toISOString();
    const updatedAt = row['Updated Date']
      ? new Date(row['Updated Date'] as string).toISOString()
      : new Date().toISOString();

    try {
      const result = await pool.query(
        `INSERT INTO leads
           (company_name, solution, contacts, sales_stage, image_count, box_count,
            estimated_revenue, probability, remarks, ho_update,
            owner_id, owner_email, is_deleted, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,$13,$14)
         ON CONFLICT DO NOTHING`,
        [
          (row['Company Name']  as string) || '',
          solution,
          JSON.stringify(contacts),
          salesStage,
          parseInt((row['Image Count'] as string || '0').toString()) || 0,
          parseInt((row['Box Count']   as string || '0').toString()) || 0,
          estimatedRevenue,
          probability,
          (row['Remarks']   as string) || '',
          (row['H/O Update'] as string) || '',
          ownerId,
          ownerEmail,
          createdAt,
          updatedAt,
        ]
      );
      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  ❌ Error on row "${row['Company Name']}":`, (err as Error).message);
      errors++;
    }
  }

  console.log('\n✅ Import complete!');
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped} (already exist)`);
  console.log(`   Errors   : ${errors}`);

  if (unmappedOwners.size > 0) {
    console.log('\n⚠️  Owner emails NOT found in users table:');
    unmappedOwners.forEach(e => console.log(`   - ${e}`));
    console.log('   Fix: create these users in the DB first, then re-run.');
  }

  // Show solution mapping summary
  console.log('\n📊 Solutions after mapping:');
  const solutionCount: Record<string, number> = {};
  for (const row of rows) {
    const mapped = normalizeSolution(row['Solution'] as string);
    solutionCount[mapped] = (solutionCount[mapped] || 0) + 1;
  }
  Object.entries(solutionCount).sort((a, b) => b[1] - a[1])
    .forEach(([s, n]) => console.log(`   ${s}: ${n}`));

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
