#!/usr/bin/env node
/**
 * Point contestedrealms.com at GitHub Pages through the Porkbun API.
 *
 * Dry run (default): prints what would change.
 * Apply:              node scripts/configure-dns.mjs --apply
 *
 * Credentials are read from ~/.config/contested-realms/porkbun.env
 * (PORKBUN_API_KEY, PORKBUN_SECRET_API_KEY) or from the environment.
 * They are never written to this repository.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DOMAIN = 'contestedrealms.com';
const API = 'https://api.porkbun.com/api/json/v3';

// Documented GitHub Pages addresses.
const APEX_A = [
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153',
];
const APEX_AAAA = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
];
const WWW_TARGET = 'harrycarter1998.github.io';

const apply = process.argv.includes('--apply');

function loadCredentials() {
  const file = join(homedir(), '.config', 'contested-realms', 'porkbun.env');
  const env = { ...process.env };
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (match && !env[match[1]]) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No file: fall back to the environment.
  }
  if (!env.PORKBUN_API_KEY || !env.PORKBUN_SECRET_API_KEY) {
    throw new Error(
      `Missing credentials. Expected ${file} with PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY.`,
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

const isParking = (record) =>
  (record.type === 'A' && record.content.startsWith('207.207.210.')) ||
  (record.type === 'CNAME' &&
    (record.content.includes('porkbun.com') || record.content.includes('porkbun.net')));

const wanted = [
  ...APEX_A.map((content) => ({ name: '', type: 'A', content })),
  ...APEX_AAAA.map((content) => ({ name: '', type: 'AAAA', content })),
  { name: 'www', type: 'CNAME', content: WWW_TARGET },
];

const key = (r) => `${r.type}|${r.name}|${r.content}`;

const { records = [] } = await call(`/dns/retrieve/${DOMAIN}`);

// Never touch mail, verification or nameserver records.
const protectedRecords = records.filter(
  (r) => r.type === 'MX' || r.type === 'TXT' || r.type === 'NS' || r.type === 'SRV',
);

const deletes = records.filter(
  (r) =>
    (r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME' || r.type === 'ALIAS') &&
    isParking(r),
);

const existing = new Set(records.filter((r) => !isParking(r)).map(key));
const creates = wanted.filter((w) => !existing.has(key(w)));

console.log(`Domain: ${DOMAIN}   mode: ${apply ? 'APPLY' : 'dry run'}\n`);

console.log(`Keeping ${protectedRecords.length} mail/verification record(s):`);
for (const r of protectedRecords) {
  console.log(`  ${r.type.padEnd(5)} ${(r.name || '@').padEnd(12)} ${r.content}`);
}

console.log(`\nRemoving ${deletes.length} parking record(s):`);
for (const r of deletes) {
  console.log(`  ${r.type.padEnd(5)} ${(r.name || '@').padEnd(12)} ${r.content}`);
}

console.log(`\nApplying ${creates.length} GitHub Pages record(s):`);
for (const r of creates) {
  console.log(`  ${r.type.padEnd(5)} ${(r.name || '@').padEnd(12)} ${r.content}`);
}

if (!apply) {
  console.log('\nNothing changed. Re-run with --apply to write these records.');
  process.exit(0);
}

for (const record of deletes) {
  await call(`/dns/delete/${DOMAIN}/${record.id}`);
  console.log(`deleted ${record.type} ${record.name || '@'} ${record.content}`);
}

for (const record of creates) {
  await call(`/dns/create/${DOMAIN}`, { ...record, ttl: '600' });
  console.log(`created ${record.type} ${record.name || '@'} ${record.content}`);
}

console.log('\nDone. DNS propagates within the record TTL (600s).');
