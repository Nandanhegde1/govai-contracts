import contractsData from '../data/contracts.json';
import opportunitiesData from '../data/opportunities.json';
import type { Contract, Opportunity } from './types';

interface DataFile {
  generated_at: string;
  count: number;
  window: { start: string; end: string };
  contracts: Contract[];
}

interface OppFile {
  generated_at: string;
  last_success_at?: string;
  last_attempt_at?: string;
  count: number;
  note?: string;
  window?: { posted_from: string; posted_to: string };
  opportunities: Opportunity[];
}

const data = contractsData as unknown as DataFile;
const oppData = opportunitiesData as unknown as OppFile;

export function getAll(): Contract[] {
  return data.contracts;
}

export function getMeta(): Pick<DataFile, 'generated_at' | 'count' | 'window'> {
  return { generated_at: data.generated_at, count: data.count, window: data.window };
}

export function getAllOpportunities(): Opportunity[] {
  return oppData.opportunities;
}

export function getOpportunityById(id: string): Opportunity | undefined {
  return getAllOpportunities().find((o) => o.id === id);
}

export function getOpportunityMeta(): {
  generated_at: string;
  last_success_at: string;
  last_attempt_at?: string;
  count: number;
  note?: string;
} {
  return {
    generated_at: oppData.generated_at,
    // Older files predate last_success_at; their generated_at is the best we have.
    last_success_at: oppData.last_success_at ?? oppData.generated_at,
    last_attempt_at: oppData.last_attempt_at,
    count: oppData.count,
    note: oppData.note,
  };
}

// SAM's `active` flag is frozen at scrape time, so a notice whose deadline has
// passed would keep saying "Active" while the feed is paused. Decide at build
// time instead: the response deadline wins, archive date only if there is none.
export function isOpportunityOpen(o: Opportunity, now = new Date()): boolean {
  if (o.response_deadline) return new Date(o.response_deadline).getTime() >= now.getTime();
  if (o.archive_date) return o.archive_date.slice(0, 10) >= now.toISOString().slice(0, 10);
  return o.active;
}

// Opportunities older than this at build time get a "feed paused" notice.
export const OPP_STALE_DAYS = 7;

export function isOpportunityFeedPaused(now = new Date()): boolean {
  const last = new Date(getOpportunityMeta().last_success_at).getTime();
  return now.getTime() - last > OPP_STALE_DAYS * 24 * 60 * 60 * 1000;
}

// USAspending can list an award whose start date is still in the future
// (1305M326P0406 starts 2027-01-01). "Recent" and "trending" lists only show
// awards that had started by build time.
export function hasStarted(c: Contract, now = new Date()): boolean {
  return !!c.start_date && c.start_date.slice(0, 10) <= now.toISOString().slice(0, 10);
}

export function getById(id: string): Contract | undefined {
  return getAll().find((c) => c.id === id);
}

export interface AgencyAgg {
  slug: string;
  name: string;
  count: number;
  total_amount: number;
}

export function getAgencies(): AgencyAgg[] {
  const map = new Map<string, AgencyAgg>();
  for (const c of getAll()) {
    const key = c.agency_slug;
    const cur = map.get(key) ?? { slug: key, name: c.agency, count: 0, total_amount: 0 };
    cur.count += 1;
    cur.total_amount += c.amount;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
}

export function getContractsByAgency(slug: string): Contract[] {
  return getAll().filter((c) => c.agency_slug === slug);
}

export interface VendorAgg {
  slug: string;
  name: string;
  count: number;
  total_amount: number;
  agencies: string[];
}

export function getVendors(): VendorAgg[] {
  const map = new Map<string, VendorAgg>();
  for (const c of getAll()) {
    const key = c.recipient_slug;
    const cur =
      map.get(key) ?? { slug: key, name: c.recipient, count: 0, total_amount: 0, agencies: [] };
    cur.count += 1;
    cur.total_amount += c.amount;
    if (!cur.agencies.includes(c.agency)) cur.agencies.push(c.agency);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
}

export function getContractsByVendor(slug: string): Contract[] {
  return getAll().filter((c) => c.recipient_slug === slug);
}

// NAICS aggregations
const NAICS_LABELS: Record<string, string> = {
  '541511': 'Custom Computer Programming Services',
  '541512': 'Computer Systems Design Services',
  '541513': 'Computer Facilities Management Services',
  '541519': 'Other Computer Related Services',
  '541715': 'R&D in Physical, Engineering & Life Sciences',
  '518210': 'Computing Infrastructure & Data Processing',
};

export interface NaicsAgg {
  code: string;
  label: string;
  count: number;
  total_amount: number;
}

export function getNaicsList(): NaicsAgg[] {
  const map = new Map<string, NaicsAgg>();
  for (const c of getAll()) {
    if (!c.naics_code) continue;
    const cur =
      map.get(c.naics_code) ??
      {
        code: c.naics_code,
        label: NAICS_LABELS[c.naics_code] ?? c.naics_desc ?? c.naics_code,
        count: 0,
        total_amount: 0,
      };
    cur.count += 1;
    cur.total_amount += c.amount;
    map.set(c.naics_code, cur);
  }
  return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
}

export function getContractsByNaics(code: string): Contract[] {
  return getAll().filter((c) => c.naics_code === code);
}

// State aggregations
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico',
};

export interface StateAgg {
  code: string;
  name: string;
  count: number;
  total_amount: number;
}

export function getStateList(): StateAgg[] {
  const map = new Map<string, StateAgg>();
  for (const c of getAll()) {
    const code = c.pop_state;
    if (!code) continue;
    const cur =
      map.get(code) ??
      { code, name: STATE_NAMES[code] ?? code, count: 0, total_amount: 0 };
    cur.count += 1;
    cur.total_amount += c.amount;
    map.set(code, cur);
  }
  return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
}

export function getContractsByState(code: string): Contract[] {
  return getAll().filter((c) => c.pop_state === code);
}
