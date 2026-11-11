// Link previews (iMessage, Slack, search results) should read like a normal
// contact page; the chaos is a surprise for people who actually open it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTACT } from '../site/js/config.js';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const metaContent = (attribute, key) => html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1];

const PREVIEW = Object.freeze({
  title: html.match(/<title>([^<]*)<\/title>/)?.[1],
  description: metaContent('name', 'description'),
  ogTitle: metaContent('property', 'og:title'),
  ogDescription: metaContent('property', 'og:description'),
});
const GIVEAWAYS = /obnoxious|absurd|hack|sunglasses|tap in|⚡|official business card/i;
const NAME = `${CONTACT.firstName} ${CONTACT.lastName}`;

test('every link-preview field is filled in and gives nothing away', () => {
  Object.entries(PREVIEW).forEach(([field, text]) => {
    assert.ok(text, `${field} is missing`);
    assert.doesNotMatch(text, GIVEAWAYS, `${field}: ${text}`);
    assert.ok(text.includes(NAME), `${field} should name ${NAME}`);
  });
});

test('the titles name the company and the descriptions give the role', () => {
  [PREVIEW.title, PREVIEW.ogTitle].forEach((text) => assert.ok(text.includes(CONTACT.company), text));
  [PREVIEW.description, PREVIEW.ogDescription].forEach((text) => {
    assert.ok(text.includes(CONTACT.title), text);
    assert.ok(text.includes(CONTACT.company), text);
  });
});
