/**
 * Builds pass.json for the store-card pass. Pure: no file or network access.
 */
import { escapeHtml } from './html.js';

const PASS_TYPE_ID = /^pass\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;

const link = (href, text) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
const hostOf = (url) => new URL(url).host;

function assertIdentity(passTypeIdentifier, teamIdentifier) {
  if (!PASS_TYPE_ID.test(passTypeIdentifier ?? '')) {
    throw new Error(`Invalid pass type identifier: ${JSON.stringify(passTypeIdentifier)}`);
  }
  if (!TEAM_ID.test(teamIdentifier ?? '')) {
    throw new Error(`Invalid team identifier: ${JSON.stringify(teamIdentifier)}`);
  }
}

function assertScanUrl(scanUrl) {
  if (!String(scanUrl ?? '').startsWith('https://')) {
    throw new Error(`The QR needs an https scan URL, got ${JSON.stringify(scanUrl)}`);
  }
  return scanUrl;
}

function signalField(contact) {
  if (!contact.signalUrl) return [];
  return [
    {
      key: 'signal',
      label: 'SIGNAL',
      value: 'Message on Signal',
      attributedValue: link(contact.signalUrl, 'Message on Signal'),
    },
  ];
}

// The back shows the public card link only: the VIP unlock URL lives in the QR alone.
function buildBackFields(contact, copy, note, cardUrl) {
  const xUrl = `https://x.com/${contact.twitterHandle}`;
  return [
    { key: 'name', label: 'NAME', value: copy.name },
    { key: 'title', label: 'TITLE', value: `${copy.title}, ${copy.firm}` },
    {
      key: 'email',
      label: 'EMAIL',
      value: contact.email,
      attributedValue: link(`mailto:${contact.email}`, contact.email),
    },
    ...signalField(contact),
    {
      key: 'x',
      label: 'X',
      value: `@${contact.twitterHandle}`,
      attributedValue: link(xUrl, `@${contact.twitterHandle}`),
    },
    {
      key: 'web',
      label: 'WEB',
      value: hostOf(contact.website),
      attributedValue: link(contact.website, hostOf(contact.website)),
    },
    { key: 'card', label: 'CARD', value: hostOf(cardUrl), attributedValue: link(cardUrl, hostOf(cardUrl)) },
    { key: 'note', label: 'NOTE', value: note },
  ];
}

export function buildPassJson({
  contact,
  copy,
  colors,
  meta,
  note,
  cardUrl,
  scanUrl,
  passTypeIdentifier,
  teamIdentifier,
}) {
  assertIdentity(passTypeIdentifier, teamIdentifier);
  return {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    serialNumber: meta.serialNumber,
    organizationName: meta.organizationName,
    description: meta.description,
    backgroundColor: colors.bone,
    foregroundColor: colors.ink,
    labelColor: colors.label,
    sharingProhibited: true, // the QR is the VIP key; don't make it one tap to forward
    barcodes: [{ format: 'PKBarcodeFormatQR', message: assertScanUrl(scanUrl), messageEncoding: 'iso-8859-1' }],
    // No front fields: the strip art is the whole card.
    storeCard: {
      backFields: buildBackFields(contact, copy, note, cardUrl),
    },
  };
}
