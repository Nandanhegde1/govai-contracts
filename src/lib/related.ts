import type { Contract } from './types';
import { getAll } from './data';

/** Find related contracts: prioritize same vendor, then same agency, then same NAICS. */
export function getRelatedContracts(c: Contract, max = 6): Contract[] {
  const all = getAll();
  const seen = new Set<string>([c.id]);
  const out: Contract[] = [];

  const push = (cands: Contract[]): void => {
    for (const x of cands) {
      if (out.length >= max) return;
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
  };

  // Same vendor (excluding self), sorted by amount desc
  push(
    all
      .filter((x) => x.recipient_slug === c.recipient_slug && x.id !== c.id)
      .sort((a, b) => b.amount - a.amount)
  );
  if (out.length >= max) return out.slice(0, max);

  // Same sub_agency / agency
  push(
    all
      .filter((x) => x.agency_slug === c.agency_slug && x.id !== c.id)
      .sort((a, b) => b.amount - a.amount)
  );
  if (out.length >= max) return out.slice(0, max);

  // Same NAICS
  if (c.naics_code) {
    push(
      all
        .filter((x) => x.naics_code === c.naics_code && x.id !== c.id)
        .sort((a, b) => b.amount - a.amount)
    );
  }

  return out.slice(0, max);
}

/** Trending = contracts with start_date in the last 30 days, sorted by amount. */
export function getTrending(max = 8): Contract[] {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return getAll()
    .filter((c) => {
      const t = new Date(c.start_date).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, max);
}

/** Largest awards of all time. */
export function getBiggest(max = 8): Contract[] {
  return [...getAll()].sort((a, b) => b.amount - a.amount).slice(0, max);
}
