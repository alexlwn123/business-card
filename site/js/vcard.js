/**
 * Builds a vCard 3.0 string that iOS/macOS Contacts understands,
 * including Apple's labelled-URL extension for the Signal link.
 * Signal, phone and personal email are optional: only the VIP card has them.
 */
import { normalizePhone } from './phone.js';

const CRLF = '\r\n';
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

export function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[,;]/g, (ch) => `\\${ch}`);
}

function assertUri(value) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`vCard URI values cannot contain a line break: ${JSON.stringify(value)}`);
  }
  return value;
}

function assertHandle(handle) {
  if (!HANDLE_PATTERN.test(handle)) {
    throw new Error(`Invalid X/Twitter handle: ${JSON.stringify(handle)}`);
  }
  return handle;
}

export function buildVCard(contact) {
  const { firstName, lastName, company, title, location, email, personalEmail, phone, website, signalUrl } = contact;
  const handle = assertHandle(contact.twitterHandle);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeText(lastName)};${escapeText(firstName)};;;`,
    `FN:${escapeText(`${firstName} ${lastName}`)}`,
    ...(company ? [`ORG:${escapeText(company)}`] : []),
    ...(title ? [`TITLE:${escapeText(title)}`] : []),
    `EMAIL;TYPE=INTERNET;TYPE=WORK:${escapeText(email)}`,
    ...(personalEmail ? [`EMAIL;TYPE=INTERNET;TYPE=HOME:${escapeText(personalEmail)}`] : []),
    ...(phone ? [`TEL;TYPE=CELL;TYPE=VOICE:${normalizePhone(phone)}`] : []),
    `URL;TYPE=HOME:${assertUri(website)}`,
    `X-SOCIALPROFILE;TYPE=twitter;X-USER=${handle}:${assertUri(`https://x.com/${handle}`)}`,
    ...(signalUrl ? [`item1.URL:${assertUri(signalUrl)}`, 'item1.X-ABLabel:Signal'] : []),
    `ADR;TYPE=HOME:;;;${escapeText(location)};;;`,
    'END:VCARD',
  ];

  return lines.join(CRLF) + CRLF;
}
