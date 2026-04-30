import contractsData from '../data/contracts.json';
import type { Contract } from './types';

interface DataFile {
  generated_at: string;
  count: number;
  window: { start: string; end: string };
  contracts: Contract[];
}

const data = contractsData as unknown as DataFile;

export function getAll(): Contract[] {
  return data.contracts;
}

export function getMeta(): Pick<DataFile, 'generated_at' | 'count' | 'window'> {
  return { generated_at: data.generated_at, count: data.count, window: data.window };
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
