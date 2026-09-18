/**
 * Indonesian Phone Number Normalization and Matching Utilities
 * 
 * Standardizes Indonesian phone numbers across marketplaces (Shopee, Tokopedia)
 * and web store formats (+62, 62, 08, formatted with spaces or dashes).
 */

/**
 * Normalizes an Indonesian phone number into a canonical digits-only format starting with 62.
 * Examples:
 * - '0812-3456-7890'  -> '6281234567890'
 * - '+62 812 3456789' -> '628123456789'
 * - '8123456789'      -> '628123456789'
 * - '6281234567890'   -> '6281234567890'
 */
export function normalizeIndonesianPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('08')) {
    return '62' + digits.slice(1);
  }
  if (digits.startsWith('8') && digits.length >= 9) {
    return '62' + digits;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return digits;
}

/**
 * Formats a phone number for clean UI display.
 * Example: '6281234567890' -> '0812-3456-7890'
 */
export function formatDisplayPhone(phone?: string | null, mode: 'local' | 'international' = 'local'): string {
  if (!phone) return '-';
  const norm = normalizeIndonesianPhone(phone);
  if (!norm.startsWith('628') || norm.length < 10) {
    return phone;
  }

  const national = '0' + norm.slice(2);
  const part1 = national.slice(0, 4);
  const part2 = national.slice(4, 8);
  const part3 = national.slice(8);

  if (mode === 'international') {
    return `+62 ${norm.slice(2, 5)}-${norm.slice(5, 9)}-${norm.slice(9)}`;
  }
  return part3 ? `${part1}-${part2}-${part3}` : `${part1}-${part2}`;
}

/**
 * Checks if two phone numbers refer to the same phone, regardless of formatting or prefix.
 * Checks both full normalized match and trailing 8-digit suffix match.
 */
export function isPhoneMatch(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;

  const normA = normalizeIndonesianPhone(phoneA);
  const normB = normalizeIndonesianPhone(phoneB);

  if (normA && normB && normA === normB) {
    return true;
  }

  const digitsA = String(phoneA).replace(/\D/g, '');
  const digitsB = String(phoneB).replace(/\D/g, '');

  if (digitsA.length >= 8 && digitsB.length >= 8) {
    return digitsA.slice(-8) === digitsB.slice(-8);
  }

  return false;
}

/**
 * Checks if a search query matches a phone number.
 * Allows searching by:
 * - Local prefix: '0812' against stored '62812...'
 * - International prefix: '62812' against stored '0812...'
 * - Trailing subscriber digits: '345678'
 */
export function matchesPhoneQuery(phone?: string | null, query?: string | null): boolean {
  if (!phone || !query) return false;

  const rawPhone = String(phone).toLowerCase();
  const rawQuery = String(query).toLowerCase().trim();

  // Simple substring match first
  if (rawPhone.includes(rawQuery)) {
    return true;
  }

  const queryDigits = rawQuery.replace(/\D/g, '');
  if (queryDigits.length < 3) {
    return false;
  }

  const normPhone = normalizeIndonesianPhone(phone);
  const normQuery = normalizeIndonesianPhone(query);

  // Compare normalized
  if (normPhone.includes(normQuery) || normPhone.includes(queryDigits)) {
    return true;
  }

  // Check 0-based representation
  const localPhone = normPhone.startsWith('62') ? '0' + normPhone.slice(2) : normPhone;
  const localQuery = normQuery.startsWith('62') ? '0' + normQuery.slice(2) : queryDigits;

  if (localPhone.includes(localQuery) || localPhone.includes(queryDigits)) {
    return true;
  }

  return false;
}
