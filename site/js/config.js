/**
 * Everything public on the card lives here.
 * Shared by the browser (main.js) and the Node build scripts (vCard + tests).
 * Private details (Signal, phone, personal email) live in private/contact.json,
 * outside site/, and are only reachable through the Wallet pass (see vip.js).
 */

export const CONTACT = Object.freeze({
  firstName: 'Alex',
  lastName: 'Lewin',
  company: 'Finite Computer',
  title: 'Minister of Development',
  location: 'Atlanta, GA',
  email: 'alex@finite.computer',
  twitterHandle: 'ALewin',
  website: 'https://alex.lwn.lol',
});

export const EMAIL_SUBJECT = 'I scanned your absurd business card';

export const LINKS = Object.freeze([
  Object.freeze({ id: 'x', emoji: '🐦', label: '@ALEWIN', sub: "it's still twitter" }),
  Object.freeze({ id: 'email', emoji: '💌', label: 'EMAIL ME', sub: 'i reply eventually™' }),
  Object.freeze({ id: 'site', emoji: '🌐', label: 'ALEX.LWN.LOL', sub: 'the mothership' }),
]);

// Only shown after the Wallet pass QR unlocks VIP mode. The phone number goes in the VIP contact card only.
export const VIP_LINKS = Object.freeze([
  Object.freeze({ id: 'signal', emoji: '🔐', label: 'SIGNAL ME', sub: 'encrypted vibes only', vip: true }),
  Object.freeze({ id: 'personal', emoji: '🏠', label: 'PERSONAL EMAIL', sub: 'the inner-circle inbox', vip: true }),
]);

export const VIP_BOOT_LINES = Object.freeze([
  '> wallet pass detected ......... OK',
  '> verifying VIP clearance ...... OK',
]);

export const VIP_EMOJIS = Object.freeze(['🔓', '💎', '👑', '🥂']);

export const TAGLINES = Object.freeze([
  'hackity hacking',
  'professional button pusher',
  'certified computer wizard',
  'will debug for snacks',
  'runs on cold brew + vibes',
  "atl's #1 alex (probably)",
]);

export const BOOT_LINES = Object.freeze([
  '> loading obnoxiousness.dll ..... OK',
  '> bypassing the mainframe ....... OK',
  '> reticulating splines .......... OK',
  '> downloading swag [#########] 100%',
  'ACCESS GRANTED',
]);

export const MARQUEE_TEXT =
  '★ ALEX LEWIN ★ HACKITY HACKING ★ ATLANTA, GA ★ YOU SCANNED THE CODE ★ NOW TAP A BUTTON ';

export const VISITOR_NUMBER = 1337;

export const VCARD_FILENAME = 'alex-lewin.vcf';
