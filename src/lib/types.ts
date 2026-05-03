export interface Opportunity {
  id: string;
  title: string;
  solicitation_number?: string;
  agency_path: string;
  agency_top: string;
  agency_top_slug: string;
  type: string;
  posted_date: string;
  response_deadline?: string;
  archive_date?: string;
  naics_code?: string;
  psc_code?: string;
  active: boolean;
  description: string;
  description_url?: string;
  ui_link?: string;
  pop_state?: string;
  contact_email?: string;
  matched_keywords: string[];
}

export interface Contract {
  id: string;
  award_id: string;
  recipient: string;
  recipient_slug: string;
  amount: number;
  agency: string;
  agency_slug: string;
  sub_agency: string;
  description: string;
  start_date: string;
  end_date: string;
  naics_code?: string;
  naics_desc?: string;
  psc_code?: string;
  psc_desc?: string;
  pop_state?: string;
  matched_keywords: string[];
}

export const formatMoney = (n: number): string => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

export const formatDate = (s: string): string => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return s;
  }
};
