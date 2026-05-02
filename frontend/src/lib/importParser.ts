import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportRowInput } from '@/lib/api/importApi';

export type CrmField =
  | 'companyName' | 'solution' | 'salesStage'
  | 'estimatedRevenue' | 'probability' | 'remarks' | 'hoUpdate'
  | 'imageCount' | 'boxCount'
  | 'contactName' | 'contactPhone' | 'contactEmail'
  | 'ownerEmail';

export const CRM_FIELD_LABELS: Record<CrmField, string> = {
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

// Alias table for auto-mapping
const ALIASES: { keywords: string[]; field: CrmField }[] = [
  { keywords: ['company', 'organisation', 'organization', 'client', 'account'],      field: 'companyName' },
  { keywords: ['solution', 'product', 'service', 'category'],                         field: 'solution' },
  { keywords: ['stage', 'pipeline', 'status'],                                        field: 'salesStage' },
  { keywords: ['revenue', 'value', 'deal value', 'amount', 'estimated'],              field: 'estimatedRevenue' },
  { keywords: ['probability', 'chance', 'likelihood'],                                field: 'probability' },
  { keywords: ['remark', 'note', 'comment'],                                          field: 'remarks' },
  { keywords: ['ho update', 'head office', 'ho'],                                     field: 'hoUpdate' },
  { keywords: ['image count', 'images', 'image'],                                     field: 'imageCount' },
  { keywords: ['box count', 'boxes', 'box'],                                          field: 'boxCount' },
  { keywords: ['contact name', 'contact person', 'person', 'contact'],                field: 'contactName' },
  { keywords: ['phone', 'mobile', 'tel', 'telephone', 'contact phone'],               field: 'contactPhone' },
  { keywords: ['contact email', 'email'],                                              field: 'contactEmail' },
  { keywords: ['owner email', 'owner', 'assigned to', 'rep', 'sales rep'],            field: 'ownerEmail' },
];

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<CrmField>();

  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    let matched: CrmField | null = null;

    for (const { keywords, field } of ALIASES) {
      if (used.has(field)) continue;
      if (keywords.some(k => lower.includes(k))) {
        matched = field;
        break;
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
        header:        true,
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
    const get = (field: CrmField): string => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? (row[header] ?? '').trim() : '';
    };

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
    };
  });
}
