// Weight conversion utilities for kg/g products

/**
 * Formats weight display based on unit and value
 * Examples:
 * - 1.5 kg => "1kg 500g"
 * - 0.750 kg => "750g"
 * - 2.0 kg => "2kg"
 * - 500 g => "500g"
 */
export function formatWeight(value: number | string, unit: string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (unit === 'kg') {
    const kg = Math.floor(numValue);
    const grams = Math.round((numValue - kg) * 1000);
    
    if (kg === 0 && grams > 0) {
      return `${grams}g`;
    } else if (kg > 0 && grams === 0) {
      return `${kg}kg`;
    } else if (kg > 0 && grams > 0) {
      return `${kg}kg ${grams}g`;
    }
    return '0g';
  }
  
  if (unit === 'g') {
    return `${Math.round(numValue)}g`;
  }
  
  // For other units, just return the value with unit
  return `${numValue} ${unit}`;
}

/**
 * Calculates proportional price for kg/g products
 * If product is priced per kg but sold in grams, calculate the proportional price
 * 
 * Examples:
 * - Product: 100 MT/kg, selling 500g => 50 MT
 * - Product: 50 MT/kg, selling 1.5kg => 75 MT
 */
export function calculateProportionalPrice(
  basePrice: number | string,
  quantity: number,
  unit: 'kg' | 'g' | 'un' | 'pack' | 'box'
): number {
  const price = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
  
  if (unit === 'kg') {
    // Price is per kg, quantity is in kg
    return price * quantity;
  }
  
  if (unit === 'g') {
    // Price is per gram, quantity is in grams
    return price * quantity;
  }
  
  // For other units (un, pack, box), simple multiplication
  return price * quantity;
}

/**
 * Converts grams to kg for storage consistency
 * If user enters 1500g, convert to 1.5kg for storage
 */
export function normalizeWeight(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === 'g' && toUnit === 'kg') {
    return value / 1000;
  }
  if (fromUnit === 'kg' && toUnit === 'g') {
    return value * 1000;
  }
  return value;
}

/**
 * Validates if stock deduction is valid for kg/g products
 * Returns remaining stock after deduction
 */
export function deductStock(currentStock: number, quantity: number, unit: string): number {
  const remaining = currentStock - quantity;
  
  if (remaining < 0) {
    throw new Error('Estoque insuficiente');
  }
  
  return remaining;
}
