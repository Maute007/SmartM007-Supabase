import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  // Format as Mozambican Metical (MZN)
  // Using simple format since pt-MZ locale may not be widely supported
  return `MT ${value.toFixed(2)}`;
}
