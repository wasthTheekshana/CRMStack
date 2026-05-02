import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportRowInput } from '@/lib/api/importApi';

// Standard CRM fields
export type StandardCrmField =
  | 'companyName' | 'solution' | 'salesStage'
  | 'estimatedRevenue' | 'probability' | 'remarks' | 'hoUpdate'
  | 'imageCount' | 'boxCount'
  | 'contactName' | 'contactPhone' | 'contactEmail'
  | 'ownerEmail';

// Custom fields use "custom:<fieldId>" keys
export type CrmField = StandardCrmField | `custom:${string}`;

export const CRM_FIELD_LABELS: Record<StandardCrmField, string> = {
  companyName:      'Company Name',
  solution:         'Solution',
  salesStage:       'Sales Stage',
  estimatedRevenue: 'Estimated Revenue',
  probability:      'Probability',
  remarks:          'Remarks',
  hoUpdate:         'HO Update',
  imageCount:       'Image Count',
  boxCount:         'Box Count',
  contactName:      'Contact Name',
  contactPhone:     'Contact Phone',
  contactEmail:     'Contact Email',
  ownerEmail:       'Owner Email',
};

export interface ColumnMapping {
  [spreadsheetHeader: string]: CrmField | null;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows:    Record<string, string>[];
}

// IMPORTANT: More specific (longer) keywords must come before generic ones.
// contactPhone and contactEmail come BEFORE contactName so "contact phone"/"contact email"
// don't accidentally match the loose "contact" keyword.
const STANDARD_ALIASES: { keywords: string[]; field: StandardCrmField }[] = [
  { keywords: ['company', 'organisation', 'organization', 'client', 'account'],       field: 'companyName' },
  { keywords: ['solution', 'product', 'service', 'category'],                          field: 'solution' },
  { keywords: ['stage', 'pipeline', 'status'],                                         field: 'salesStage' },
  { keywords: ['revenue', 'value', 'deal value', 'amount', 'estimated'],               field: 'estimatedRevenue' },
  { keywords: ['probability', 'chance', 'likelihood'],                                 field: 'probability' },
  { keywords: ['remark', 'note', 'comment'],                                           field: 'remarks' },
  { keywords: ['ho update', 'head office', 'ho'],                                      field: 'hoUpdate' },
  { keywords: ['image count', 'images', 'image'],                                      field: 'imageCount' },
  { keywords: ['box count', 'boxes', 'box'],                                           field: 'boxCount' },
  // contactPhone and contactEmail before contactName — prevents "contact" from grabbing them first
  { keywords: ['contact phone', 'phone', 'mobile', 'tel', 'telephone'],                field: 'contactPhone' },
  { keywords: ['contact email'],                                                        field: 'contactEmail' },
  { keywords: ['contact name', 'contact person', 'contact', 'person'],                 field: 'contactName' },
  { keywords: ['email'],                                                                field: 'contactEmail' },
  { keywords: ['owner email', 'owner', 'assigned to', 'rep', 'sales rep'],             field: 'ownerEmail' },
];

export function autoMapColumns(
  headers: string[],
  customFields: { id: string; name: string }[] = []
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<CrmField>();

  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    let matched: CrmField | null = null;

    // 1. Check standard fields
    for (const { keywords, field } of STANDARD_ALIASES) {
      if (used.has(field)) continue;
      if (keywords.some(k => lower.includes(k))) {
        matched = field;
        break;
      }
    }

    // 2. Check admin-configured custom fields (exact name match)
    if (!matched) {
      for (const cf of customFields) {
        const key: CrmField = `custom:${cf.id}`;
        if (used.has(key)) continue;
        if (lower === cf.name.toLowerCase().trim()) {
          matched = key;
          break;
        }
      }
    }

    mapping[header] = matched;
    if (matched) used.add(matched);
  }

  return mapping;
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header:         true,
        skipEmptyLines: true,
        complete: (result) => {
          resolve({
            headers: result.meta.fields ?? [],
            rows:    result.data,
          });
        },
        error: reject,
      });
    });
  }

  // xlsx / xls
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: 'array' });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const raw    = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
  const rows = raw.map(r => {
    const row: Record<string, string> = {};
    for (const key of headers) {
      row[key] = String(r[key] ?? '');
    }
    return row;
  });

  return { headers, rows };
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ImportRowInput[] {
  return rows.map(row => {
    const get = (field: StandardCrmField): string => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? (row[header] ?? '').trim() : '';
    };

    // Collect custom field values
    const customFields: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field?.startsWith('custom:')) {
        const fieldId = field.slice(7);
        const val = (row[header] ?? '').trim();
        if (val) customFields[fieldId] = val;
      }
    }

    return {
      companyName:      get('companyName'),
      solution:         get('solution'),
      salesStage:       get('salesStage'),
      estimatedRevenue: get('estimatedRevenue'),
      probability:      get('probability'),
      remarks:          get('remarks'),
      hoUpdate:         get('hoUpdate'),
      imageCount:       get('imageCount'),
      boxCount:         get('boxCount'),
      contactName:      get('contactName'),
      contactPhone:     get('contactPhone'),
      contactEmail:     get('contactEmail'),
      ownerEmail:       get('ownerEmail'),
      customFields,
    };
  });
}
