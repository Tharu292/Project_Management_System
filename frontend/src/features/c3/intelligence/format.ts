// Fixed colour per arXiv category, the same as in the Phase B report figures
// (reference categorical palette, slots 1-5): a category keeps its colour everywhere.
export const CATEGORY_COLORS: Record<string, string> = {
  'cs.CV': '#2a78d6',
  'cs.CL': '#eb6834',
  'cs.CR': '#1baf7a',
  'cs.RO': '#eda100',
  'cs.DB': '#e87ba4',
}

export function compactNumber(value: number): string {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : String(Math.round(value))
}

export function wholeNumber(value: number): string {
  return value.toLocaleString('en-GB')
}

/** A measured share of papers (not a probability), e.g. 0.0533 -> "5.3%". */
export function share(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

export function score(value: number | null): string {
  return value === null ? '—' : value.toFixed(4)
}
