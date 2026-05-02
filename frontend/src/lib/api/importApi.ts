import { apiFetch } from '@/config/api';

export interface ImportRowInput {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: string;
  probability:      string;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       string;
  boxCount:         string;
  contactName:      string;
  contactPhone:     string;
  contactEmail:     string;
  ownerEmail:       string;
  customFields:     Record<string, string>;
}

export interface ParsedLeadData {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: number;
  probability:      number;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       number;
  boxCount:         number;
  contacts:         { name: string; phone: string; email: string; isPrimary: boolean }[];
  ownerId:          string;
  ownerEmail:       string;
}

export interface ExistingLeadInfo {
  id:          string;
  companyName: string;
  salesStage:  string;
  ownerId:     string;
  ownerEmail:  string;
}

export interface PreviewRow {
  index:         number;
  status:        'new' | 'duplicate';
  parsed:        ParsedLeadData;
  existingLead?: ExistingLeadInfo;
  warnings:      string[];
}

export interface PreviewResponse {
  totalNew:        number;
  totalDuplicates: number;
  rows:            PreviewRow[];
}

export interface ConfirmRowInput {
  index:       number;
  action:      'create' | 'update' | 'skip';
  existingId?: string;
  data:        ParsedLeadData;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors:  { row: number; reason: string }[];
}

export async function previewImport(rows: ImportRowInput[]): Promise<PreviewResponse> {
  return apiFetch<PreviewResponse>('/api/leads/import/preview', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export async function confirmImport(rows: ConfirmRowInput[]): Promise<ImportResult> {
  return apiFetch<ImportResult>('/api/leads/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}
