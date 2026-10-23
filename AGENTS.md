# Agent notes — contested-realms-site

Static Astro site for the Contested Realms Hytale server. Deployed by GitHub
Actions to GitHub Pages on push to `main`.

## Contract

- **Deploy = push to `main`.** There is no separate deploy step and no server to
  restart. A push is live in roughly a minute.
- **Never invent facts.** Server address, Discord invite, release links and the
  contact address come from `src/config/site.ts`. If a value is unknown, leave
  it `''` so the UI hides it. Do not put a plausible-looking placeholder on a
  public page.
- **Palette is shared with the game.** `src/styles/global.css` mirrors
  `src/main/java/ui/UiTheme.java` and `Common/UI/Custom/ContestedRealms/Theme.ui`.
  Changing a colour here means the game UI no longer matches — change all three
  or none.
- **`public/CNAME` must contain `contestedrealms.com`.** Deleting it unhooks the
  custom domain.
- **This repository is public.** Never commit `.env`, `*.env`, or anything from
  `~/.config/contested-realms/`. The Porkbun key is account-wide.

## Checks before pushing

```sh
npm run build          # must exit 0
npx astro check        # types and content schema
```

Then load `dist/` with `npm run preview` and confirm the changed page renders.
For visual verification, render a screenshot from the preview server rather than
describing the diff.

## Assets

Game imagery comes from the game repo's render tooling
(`scripts/render-build.py`, `scripts/render-model.py`), not from stock photos or
invented mockups. Put output under `public/img/` with descriptive filenames.

## Copy rules

Plain English, present tense, no hype adjectives. The audience is Hytale players
who already know survival games; explain what is different about *this* server —
finite realms, player-drawn borders, sieges that actually take ground.
