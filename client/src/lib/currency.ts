// Currency formatting for Mozambican Metical (MZN)
export function formatCurrency(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `MT ${numValue.toFixed(2)}`;
}

export function formatCurrencyCompact(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (numValue >= 1000000) {
    return `MT ${(numValue / 1000000).toFixed(1)}M`;
  }
  if (numValue >= 1000) {
    return `MT ${(numValue / 1000).toFixed(1)}K`;
  }
  return `MT ${numValue.toFixed(2)}`;
}

export const CURRENCY_SYMBOL = 'MT';
export const CURRENCY_CODE = 'MZN';
export const CURRENCY_NAME = 'Metical';
