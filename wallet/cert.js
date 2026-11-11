/**
 * Reads the pass type id + team id out of a Pass Type ID certificate subject
 * (openssl x509 -noout -subject -nameopt RFC2253), so you never type them.
 */

export function parseSubject(line) {
  const body = line.replace(/^subject\s*=\s*/, '');
  return Object.fromEntries(
    body.split(/(?<!\\),/).map((part) => {
      const eq = part.indexOf('=');
      const value = part.slice(eq + 1).trim().replace(/\\(.)/g, '$1');
      return [part.slice(0, eq).trim(), value];
    }),
  );
}

export function passIdentityFromSubject(line) {
  const subject = parseSubject(line);
  const passTypeIdentifier = subject.UID;
  const teamIdentifier = subject.OU;
  if (!passTypeIdentifier?.startsWith('pass.') || !teamIdentifier) {
    throw new Error(
      `This is not a Pass Type ID certificate (subject: ${line.trim()}). ` +
        'Create one under Certificates, IDs & Profiles → Pass Type IDs.',
    );
  }
  return { passTypeIdentifier, teamIdentifier };
}
