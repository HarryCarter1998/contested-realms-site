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
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

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

/** Porkbun returns record names as FQDNs; compare in relative form. */
function relativeName(record) {
  const name = record.name ?? '';
  if (name === DOMAIN) return '';
  if (name.endsWith(`.${DOMAIN}`)) return name.slice(0, -(DOMAIN.length + 1));
  return name;
}

const isParkingHost = (record) => /porkbun\.(com|net)$/i.test(record.content);

const CONFIG_FILE = join(homedir(), '.config', 'contested-realms', 'porkbun.env');
const LOCAL_FILE = join(process.cwd(), '.env.local');

/**
 * Where keys are read from, in order:
 *   1. $PORKBUN_ENV
 *   2. ./.env.local in the site checkout (the familiar place)
 *   3. ~/.config/contested-realms/porkbun.env
 */
function credentialsFile() {
  if (process.env.PORKBUN_ENV) return process.env.PORKBUN_ENV;
  if (existsSync(LOCAL_FILE)) return LOCAL_FILE;
  return CONFIG_FILE;
}

/** A keys file that git tracks in a public repo is a leak waiting to happen. */
function assertNotTracked(file) {
  try {
    const tracked = execFileSync('git', ['ls-files', '--', file], {
      cwd: dirname(file),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (tracked) {
      throw new Error(
        `${file} is tracked by git. It must be ignored before it can hold keys.\n` +
          'Add it to .gitignore and run: git rm --cached ' + file,
      );
    }
  } catch (error) {
    if (error.message.includes('tracked by git')) throw error;
    // git is unavailable or this is not a repository; nothing to check.
  }
}

/** Read one line from the terminal without echoing it. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(
        new Error(
          'No interactive terminal. Run this command directly in a terminal window.',
        ),
      );
      return;
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const finish = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      resolve(result);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          process.exit(1);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function setupCredentials() {
  const target = process.argv.includes('--global') ? CONFIG_FILE : LOCAL_FILE;
  assertNotTracked(target);

  console.log(
    'Paste each key from https://porkbun.com/account/api (nothing is echoed or saved in shell history).\n',
  );

  const apikey = (await promptHidden('API Key: ')).trim().replace(/\s+/g, '');
  const secretapikey = (await promptHidden('Secret API Key: ')).trim().replace(/\s+/g, '');

  if (!apikey || !secretapikey) {
    throw new Error('Both values are required. Nothing was saved.');
  }

  const response = await fetch(`${API}/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey, secretapikey }),
  });
  const json = await response.json();
  if (json.status !== 'SUCCESS') {
    throw new Error(
      `Porkbun rejected those credentials: ${json.message ?? JSON.stringify(json)}. Nothing was saved.`,
    );
  }

  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(
    target,
    [
      '# Porkbun API credentials for scripts/configure-dns.mjs',
      '# Never commit this file. This repository is public.',
      '# Keys are account-wide; revoke them at https://porkbun.com/account/api',
      `PORKBUN_API_KEY=${apikey}`,
      `PORKBUN_SECRET_API_KEY=${secretapikey}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );

  console.log(`Saved to ${target} (mode 600). Credentials accepted by Porkbun.\n`);
}

function loadCredentials() {
  const file = credentialsFile();
  assertNotTracked(file);

  const env = { ...process.env };
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
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
      `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set in ${file}.\n` +
        'Run `node scripts/configure-dns.mjs --credentials` to enter them without editing a file.',
    );
  }

  return { apikey: env.PORKBUN_API_KEY, secretapikey: env.PORKBUN_SECRET_API_KEY };
}

const nameOf = relativeName;
const key = (record) => `${record.type}|${relativeName(record)}|${record.content}`;

const wanted = [
  ...APEX_A.map((content) => ({ name: '', type: 'A', content })),
  ...APEX_AAAA.map((content) => ({ name: '', type: 'AAAA', content })),
  { name: 'www', type: 'CNAME', content: WWW_TARGET },
];
const wantedKeys = new Set(wanted.map(key));

async function main() {
  const apply = process.argv.includes('--apply');

  if (process.argv.includes('--credentials')) {
    await setupCredentials();
  }

  const credentials = loadCredentials();

  const call = async (path, body = {}) => {
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
  };

  await call('/ping');

  const { records = [] } = await call(`/dns/retrieve/${DOMAIN}`);

  const managed = records.filter(
    (record) =>
      ADDRESS_TYPES.has(record.type) &&
      (MANAGED_NAMES.has(relativeName(record)) ||
        // Porkbun parks every unknown subdomain behind a wildcard; drop that too.
        (relativeName(record) === '*' && isParkingHost(record))),
  );

  // Anything on apex/www that is not exactly what we want gets removed, so
  // stale parking records cannot linger next to the new ones.
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
      `\nWARNING: no MX records found. Mail to @${DOMAIN} will not be delivered.`,
    );
  } else {
    console.log(`Mail is intact: ${mailRecords.map((r) => r.content).join(', ')}`);
  }

  if (!apply) {
    console.log('\nNothing changed. Re-run with --apply to write these records.');
    return;
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
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
