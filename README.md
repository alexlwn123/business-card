# business-card

The most obnoxious business card ever made, live at [qr.lwn.lol](https://qr.lwn.lol), plus an
American Psycho-style Apple Wallet pass whose QR code opens it.

- `site/`: the static site, deployed to Vercel. Public contact details live in `site/js/config.js`.
- `wallet/`: the pass design and `pass.json`. The copy is in `wallet/config.js`.
- `scripts/`: build, render, sign and deploy.
- `tests/`: unit, integration and Playwright end-to-end tests.

## Setup

You need Node 22+, OpenSSL, and Chrome, Brave or Edge (used to render the pass art and run the e2e tests).

```sh
npm install
npm test            # unit + integration
npm run test:e2e    # drives the real page in a browser
```

## VIP mode

The public page only shows public links. The Wallet pass QR code adds a secret key (`#vip=<key>`) that also
unlocks Signal, a phone number and a personal email. Those details live in `private/contact.json`, which is
git-ignored. Every field is optional:

```json
{
  "signalUrl": "https://signal.me/#eu/…",
  "phone": "+1 404 555 0123",
  "personalEmail": "you@example.com"
}
```

On its first run, `npm run build` creates the key in `private/vip.key` and writes the private details to
`site/vip/<key>.json` and `.vcf`. It also saves the unlock link to `private/vip-url.txt`.
`npm run vip:rotate` swaps in a new key, after which you need to re-sign and re-add the pass.

- **Back up `private/`.** It holds the only copy of the key. If you build without it, VIP mode is switched off.
- **Deploy with the CLI (`npm run deploy`), not Vercel's Git integration.** Those builds can't see `private/`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Writes the public vCard (`site/alex-lewin.vcf`) and the VIP files |
| `npm run deploy` | Builds, then runs `vercel deploy site --prod` |
| `npm run pass:art` | Renders the pass artwork into `wallet/pass/` and a mock-up into `out/pass-preview.png` |
| `npm run pass:sign -- <cert.p12>` | Signs `out/alex-lewin.pkpass` (set `P12_PASSWORD`) |
| `npm run qr -- <url>` | Writes a QR code for any URL to `out/card-qr.png` and `.svg` |

## Signing the Wallet pass

Signing needs a Pass Type ID certificate from your Apple Developer account, exported as a `.p12` file:

```sh
npm run build   # the pass picks up the VIP link from here
P12_PASSWORD='…' npm run pass:sign -- ~/Downloads/PassTypeID.p12
```

The pass type and team IDs are read from the certificate. Apple's WWDR certificate is downloaded on the
first run. AirDrop `out/alex-lewin.pkpass` to your phone. Re-adding it replaces the old card.
