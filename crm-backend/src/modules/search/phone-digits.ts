/**
 * Digits to look for in a phone column. Numbers are stored as 10 digits, so a
 * country code or trunk 0 typed in front (+91 98765 43210, 098765 43210) is dropped.
 */
export function phoneDigits(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}
