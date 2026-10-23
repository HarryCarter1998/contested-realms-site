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
  github: 'https://github.com/HarryCarter1998/contested-realms',
  /** Latest release page for the plugin build. */
  releases: 'https://github.com/HarryCarter1998/contested-realms/releases',
} as const;
