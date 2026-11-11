/**
 * The Wallet pass: a Patrick Bateman business card on the outside,
 * qr.lwn.lol (the monstrosity) behind the QR code.
 * Copy is written in natural case; the strip art uppercases it.
 */
import { CONTACT } from '../site/js/config.js';

export const CARD_URL = 'https://qr.lwn.lol';

export const PASS_COPY = Object.freeze({
  firm: CONTACT.company,
  name: `${CONTACT.firstName} ${CONTACT.lastName}`,
  title: CONTACT.title,
  topLeft: CONTACT.email,
  bottomLeft: 'Atlanta, Georgia',
  bottomRight: new URL(CONTACT.website).host,
  monogram: 'F',
});

// "Bone." Wallet requires rgb(r, g, b) syntax; CSS accepts it too.
export const PASS_COLORS = Object.freeze({
  bone: 'rgb(236, 231, 218)',
  ink: 'rgb(40, 37, 33)',
  label: 'rgb(140, 131, 114)',
});

export const PASS_META = Object.freeze({
  serialNumber: 'alex-lewin-business-card-001',
  organizationName: PASS_COPY.firm,
  description: `${PASS_COPY.name}, ${PASS_COPY.title}, ${PASS_COPY.firm}`,
});

export const PASS_NOTE =
  'Look at that subtle off-white coloring. The tasteful thickness of it. Oh my God, it even has a watermark.';
