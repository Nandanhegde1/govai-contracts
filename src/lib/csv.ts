import type { Contract } from './types';

const csvEscape = (s: string | number | undefined | null): string => {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function contractsToCsv(contracts: Contract[]): string {
  const headers = [
    'award_id', 'recipient', 'amount_usd', 'agency', 'sub_agency',
    'naics_code', 'naics_desc', 'pop_state', 'start_date', 'end_date',
    'matched_keywords', 'description',
  ];
  const rows = contracts.map((c) => [
    c.award_id, c.recipient, c.amount, c.agency, c.sub_agency,
    c.naics_code ?? '', c.naics_desc ?? '', c.pop_state ?? '',
    c.start_date, c.end_date,
    (c.matched_keywords || []).join('|'),
    c.description,
  ].map(csvEscape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function contractsToJson(contracts: Contract[], meta: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...meta, count: contracts.length, contracts }, null, 2);
}
