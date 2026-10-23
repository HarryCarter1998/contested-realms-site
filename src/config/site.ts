/**
 * Single source of truth for anything shown as a fact on the site.
 * Leave a value empty ("") to hide the element that depends on it rather than
 * publishing a placeholder that might be wrong.
 */
export const site = {
  name: 'Contested Realms',
  domain: 'contestedrealms.com',
  url: 'https://contestedrealms.com',
  tagline: 'Territory war for Hytale',
  description:
    'Contested Realms is a territory war for Hytale. Raise a clan, plant your stronghold, work the land, and defend it when the banners come over the ridge.',

  /** Join address shown on the site. Set to '' until the server is public. */
  serverAddress: '',

  /** Discord invite URL. Leave '' to hide every Discord button. */
  discordInvite: '',

  contactEmail: 'hello@contestedrealms.com',

  /**
   * Public build of the plugin. Leave '' until there is a genuinely public
   * download location (CurseForge, a public release repo, ...). While empty the
   * site hides every download call-to-action rather than linking to a private
   * repository, which is a 404 for every visitor.
   */
  downloadUrl: '',

  /**
   * Public source. Leave '' while the game repository is private.
   */
  sourceUrl: '',
} as const;
