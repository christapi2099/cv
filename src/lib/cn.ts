import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve conflicting Tailwind utilities.
 * The single styling entry point for `components/ui/*` (plan Phase 1).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
