/**
 * Phone numbers are written however you like ("+1 (404) 555-0123") but must
 * include the country code, and are normalised to E.164 for tel: links and vCards.
 */

const PHONE_CHARS = /^\+[0-9 ().-]+$/;
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

export function normalizePhone(phone) {
  if (!PHONE_CHARS.test(phone)) {
    throw new Error(`Phone numbers need a leading + and country code: ${JSON.stringify(phone)}`);
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    throw new Error(`Phone number has ${digits.length} digits, expected ${MIN_DIGITS}-${MAX_DIGITS}`);
  }
  return `+${digits}`;
}
