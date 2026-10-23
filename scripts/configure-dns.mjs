#!/usr/bin/env node
/**
 * Point contestedrealms.com at GitHub Pages through the Porkbun API.
 *
 *   node scripts/configure-dns.mjs            # dry run, prints the plan
 *   node scripts/configure-dns.mjs --apply    # writes the records
 *
 * Credentials come from ~/.config/contested-realms/porkbun.env
 * (PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY) or the environment. They are never
 * written into this repository.
 *
 * Only apex and www address records are managed. MX, TXT, SRV and NS records
 * are never touched, so Porkbun email forwarding keeps working.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DOMAIN = 'contestedrealms.com';
const API = 'https://api.porkbun.com/api/json/v3';

// Documented GitHub Pages addresses.
const APEX_A = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const APEX_AAAA = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
];
const WWW_TARGET = 'harrycarter1998.github.io';

/** Names this script is allowed to rewrite. Everything else is left alone. */
const MANAGED_NAMES = new Set(['', 'www']);
const ADDRESS_TYPES = new Set(['A', 'AAAA', 'CNAME', 'ALIAS']);

const apply = process.argv.includes('--apply');
const credentialsFile = join(homedir(), '.config', 'contested-realms', 'porkbun.env');

function loadCredentials() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(credentialsFile, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match && !env[match[1]]) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No file: fall back to the environment.
  }

  const required = ['PORKBUN_API_KEY', 'PORKBUN_SECRET_API_KEY'];
  const missing = required.filter((name) => !env[name] || env[name].startsWith('PASTE_'));
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(' and ')} not set in ${credentialsFile}.\n` +
        'Porkbun needs both values: the API Key and the Secret API Key.',
    );
  }

  return { apikey: env.PORKBUN_API_KEY, secretapikey: env.PORKBUN_SECRET_API_KEY };
}

const credentials = loadCredentials();

async function call(path, body = {}) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...credentials, ...body }),
  });
  const json = await response.json();
  if (json.status !== 'SUCCESS') {
    throw new Error(`${path} failed: ${json.message ?? JSON.stringify(json)}`);
  }
  return json;
}

const nameOf = (record) => record.name ?? '';
const key = (record) => `${record.type}|${nameOf(record)}|${record.content}`;

const wanted = [
  ...APEX_A.map((content) => ({ name: '', type: 'A', content })),
  ...APEX_AAAA.map((content) => ({ name: '', type: 'AAAA', content })),
  { name: 'www', type: 'CNAME', content: WWW_TARGET },
];
const wantedKeys = new Set(wanted.map(key));

await call('/ping');

const { records = [] } = await call(`/dns/retrieve/${DOMAIN}`);

const managed = records.filter(
  (record) => MANAGED_NAMES.has(nameOf(record)) && ADDRESS_TYPES.has(record.type),
);

// Anything on apex/www that is not exactly what we want gets removed, so stale
// parking records cannot linger next to the new ones.
const deletes = managed.filter((record) => !wantedKeys.has(key(record)));
const creates = wanted.filter((record) => !records.some((r) => key(r) === key(record)));

const mailRecords = records.filter((record) => record.type === 'MX');
const untouched = records.filter(
  (record) => !deletes.includes(record) && !creates.some((c) => key(c) === key(record)),
);

console.log(`Domain: ${DOMAIN}   mode: ${apply ? 'APPLY' : 'dry run'}\n`);

console.log(`Removing ${deletes.length} address record(s) on apex/www:`);
for (const record of deletes) {
  console.log(`  - ${record.type.padEnd(6)} ${(nameOf(record) || '@').padEnd(6)} ${record.content}`);
}

console.log(`\nEnsuring ${creates.length} GitHub Pages record(s):`);
for (const record of creates) {
  console.log(`  + ${record.type.padEnd(6)} ${(record.name || '@').padEnd(6)} ${record.content}`);
}

console.log(`\nLeaving ${untouched.length} other record(s) alone (MX, TXT, SRV, NS, subdomains).`);
if (mailRecords.length === 0) {
  console.log(
    '\nWARNING: no MX records found. Porkbun email forwarding looks unconfigured —' +
      ` mail to @${DOMAIN} will not be delivered.`,
  );
} else {
  console.log(`Mail is intact: ${mailRecords.map((r) => r.content).join(', ')}`);
}

console.log(`\nFinal apex/www address records after the run: ${wanted.length}.`);

if (!apply) {
  console.log('\nNothing changed. Re-run with --apply to write these records.');
  process.exit(0);
}

for (const record of deletes) {
  await call(`/dns/delete/${DOMAIN}/${record.id}`);
  console.log(`deleted ${record.type} ${nameOf(record) || '@'} ${record.content}`);
}

for (const record of creates) {
  await call(`/dns/create/${DOMAIN}`, { ...record, ttl: '600' });
  console.log(`created ${record.type} ${record.name || '@'} ${record.content}`);
}

console.log('\nDone. DNS propagates within the 600s TTL.');
