/**
 * Turns the contact config into tappable link descriptors.
 * Pure (no DOM) so it can be unit tested in Node.
 */
const SAFE_PROTOCOLS = Object.freeze(['https:', 'mailto:']);

const mailto = (address, subject) => `mailto:${address}?subject=${encodeURIComponent(subject)}`;

const HREF_BUILDERS = Object.freeze({
  signal: (contact) => contact.signalUrl,
  x: (contact) => `https://x.com/${encodeURIComponent(contact.twitterHandle)}`,
  email: (contact, subject) => mailto(contact.email, subject),
  site: (contact) => contact.website,
  personal: (contact, subject) => mailto(contact.personalEmail, subject),
});

// The contact field each link needs; VIP links only show when their detail was unlocked.
const LINK_FIELDS = Object.freeze({
  signal: 'signalUrl',
  x: 'twitterHandle',
  email: 'email',
  site: 'website',
  personal: 'personalEmail',
});

export function availableLinks(contact, links) {
  return links.filter((link) => Boolean(contact[LINK_FIELDS[link.id]]));
}

export function assertSafeHref(href) {
  let url;
  try {
    url = new URL(href);
  } catch (error) {
    throw new Error(`Invalid link: ${JSON.stringify(href)}`, { cause: error });
  }
  if (!SAFE_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Refusing unsafe link protocol "${url.protocol}" in ${href}`);
  }
  return href;
}

export function buildLinks(contact, links, emailSubject) {
  return links.map((link) => {
    const build = HREF_BUILDERS[link.id];
    if (!build) {
      throw new Error(`Unknown link id: ${link.id}`);
    }
    return { ...link, href: assertSafeHref(build(contact, emailSubject)) };
  });
}
