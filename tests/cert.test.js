import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSubject, passIdentityFromSubject } from '../wallet/cert.js';

const REAL_LOOKING =
  'subject=UID=pass.lol.lwn.card,CN=Pass Type ID: pass.lol.lwn.card,OU=ABCDE12345,O=Alex Lewin,C=US';

test('parseSubject splits an RFC2253 subject into attributes', () => {
  assert.deepEqual(parseSubject(REAL_LOOKING), {
    UID: 'pass.lol.lwn.card',
    CN: 'Pass Type ID: pass.lol.lwn.card',
    OU: 'ABCDE12345',
    O: 'Alex Lewin',
    C: 'US',
  });
});

test('parseSubject keeps escaped commas inside a value', () => {
  assert.equal(parseSubject('subject=O=Lewin\\, Lewin & Co,C=US').O, 'Lewin, Lewin & Co');
});

test('passIdentityFromSubject reads pass type id (UID) and team id (OU)', () => {
  assert.deepEqual(passIdentityFromSubject(REAL_LOOKING), {
    passTypeIdentifier: 'pass.lol.lwn.card',
    teamIdentifier: 'ABCDE12345',
  });
});

test('passIdentityFromSubject rejects certificates that are not Pass Type IDs', () => {
  assert.throws(
    () => passIdentityFromSubject('subject=CN=Apple Development: Alex,OU=ABCDE12345,C=US'),
    /Pass Type ID certificate/,
  );
});
