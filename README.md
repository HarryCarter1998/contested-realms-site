# Contested Realms — website

The public site for the Contested Realms Hytale server. Astro, static output,
deployed to GitHub Pages on every push to `main`.

## Commands

```sh
npm install        # once
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/
```

## Where things live

- `src/config/site.ts` — join address, Discord invite, contact email, download
  and source links. **Every fact on the site comes from here.** An empty string
  hides the element, which is why the download button disappears until a public
  build URL exists (never link to the private game repo — it 404s for visitors).
- `src/styles/global.css` — palette and layout. Colours mirror
  `src/main/java/ui/UiTheme.java` in the game repo; keep them in sync.
- `src/pages/index.astro` — landing page copy.
- `src/content/news/*.md` — news posts. Filename becomes the URL slug.
- `public/CNAME` — the custom domain GitHub Pages serves. Do not delete it.

## Writing a news post

Create `src/content/news/YYYY-MM-DD-slug.md`:

```md
---
title: Realm one has opened
date: 2026-11-02
summary: One line that appears on the landing page.
tag: Realm
---

Body in Markdown.
```

`draft: true` keeps a post out of the build.

## Deploying

Push to `main`. The Action builds and publishes in about a minute. To take a
change back, revert the commit and push again — Pages redeploys the old output.

## Custom domain

`contestedrealms.com` is registered at Porkbun and served by GitHub Pages.

- Apex: `A` records to GitHub Pages' four IPs
- `www`: `CNAME` to `harrycarter1998.github.io`
- Enforce HTTPS in the repository's Pages settings after the certificate issues

### DNS credentials

`scripts/configure-dns.mjs` manages the apex and `www` address records through
the Porkbun API. It never touches MX, TXT, SRV or NS records, so Porkbun email
forwarding keeps working.

Enter the keys once, without editing a file by hand:

```sh
node scripts/configure-dns.mjs --credentials
```

They are validated against Porkbun before anything is saved, then written to
`.env.local` in this checkout (mode 600, gitignored). Add `--global` to store
them in `~/.config/contested-realms/porkbun.env` instead. Read order is
`$PORKBUN_ENV`, `./.env.local`, then the global file.

The script refuses to run if the file it would use is tracked by git — this
repository is public, and the key is account-wide.

Then:

```sh
node scripts/configure-dns.mjs            # dry run, prints the plan
node scripts/configure-dns.mjs --apply    # writes the records
```
