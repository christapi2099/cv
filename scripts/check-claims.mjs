#!/usr/bin/env node
/**
 * Claim + attribution ledger checks (plan.md Phase 4.4, D-C).
 *
 * Every case study under src/content/work/**\/*.{md,mdx} must carry:
 *
 *   claim_source:
 *     - claim: "roughly $4,000 every month"
 *       source: "https://… or a repo document"
 *       checked: "2026-11-14"
 *
 *   stack:
 *     - name: "Next.js"
 *       artifact: "RollTrackApp web client"
 *     - name: "NestJS"
 *       artifact: "legacy internal service"
 *       hidden: true
 *
 * Rules: ≥1 numeric claim with a source + checked date; ≥3 attributed stack
 * chips; D-C names (NestJS / Payload CMS / MySQL) may appear in the ledger only
 * with `hidden: true` and must not render in the body; "HIPAA certified" and
 * "HIPAA compliant" are banned (use "HIPAA-appropriate"); "production scale"
 * requires a verified numeric claim.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const WORK_DIR = path.join(process.cwd(), 'src/content/work');
const HIDDEN_NAMES = [/^nestjs$/i, /^payload(?:\s+cms)?$/i, /^mysql$/i];
const STACK_LEDGER_KEYS = ['stack', 'stack_attribution', 'tech_attribution'];

async function main() {
  const files = await listCaseStudies(WORK_DIR);

  if (files.length === 0) {
    console.log(
      'check-claims: no case studies found under src/content/work yet. ' +
        'The G4 ledger assertions activate with the first case study.',
    );
    return;
  }

  const failures = [];
  for (const file of files) {
    failures.push(...await checkFile(file));
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure}`);
    console.error(`\ncheck-claims: ${failures.length} failure(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`check-claims: ${files.length} case study ledger(s) valid.`);
}

async function listCaseStudies(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listCaseStudies(target));
    } else if (/\.mdx?$/i.test(entry.name)) {
      files.push(target);
    }
  }
  return files.sort();
}

async function checkFile(file) {
  const relative = path.relative(process.cwd(), file);
  const source = await readFile(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(source);
  const failures = [];

  const claims = parseListBlock(frontmatter, 'claim_source');
  const verifiedClaims = claims.filter(
    (claim) =>
      /\d/.test(claim.claim ?? '') &&
      Boolean(claim.source ?? claim.url) &&
      Boolean(claim.checked),
  );

  if (verifiedClaims.length === 0) {
    failures.push(
      `${relative}: needs at least one numeric claim with claim_source.source and claim_source.checked.`,
    );
  }

  const stack = STACK_LEDGER_KEYS.flatMap((key) => parseListBlock(frontmatter, key));
  const attributed = stack.filter(
    (entry) => entry.name && (entry.artifact || entry.evidence || entry.where),
  );

  if (attributed.length < 3) {
    failures.push(
      `${relative}: needs at least 3 attributed stack chips (name + artifact) in the ledger.`,
    );
  }

  for (const entry of stack) {
    const name = entry.name?.trim();
    if (!name) continue;

    const isHiddenName = HIDDEN_NAMES.some((pattern) => pattern.test(name));
    if (isHiddenName && entry.hidden !== 'true') {
      failures.push(
        `${relative}: "${name}" is D-C UI-hidden; mark it hidden: true in the ledger.`,
      );
    }
    if (isHiddenName && bodyMentions(body, name)) {
      failures.push(`${relative}: "${name}" is UI-hidden (D-C) but appears in the rendered body.`);
    }
  }

  if (/\bHIPAA[\s-]+certified\b/i.test(body)) {
    failures.push(`${relative}: remove "HIPAA certified" — certification is not ours to claim.`);
  }
  if (/\bHIPAA[\s-]+compliant\b/i.test(body)) {
    failures.push(
      `${relative}: "HIPAA compliant" is banned; describe the deployment as "HIPAA-appropriate".`,
    );
  }
  if (/\bproduction[\s-]+scale\b/i.test(body) && verifiedClaims.length === 0) {
    failures.push(
      `${relative}: "production scale" needs a verified numeric claim in the same file.`,
    );
  }

  return failures;
}

function bodyMentions(body, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(body);
}

function splitFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { frontmatter: '', body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

/**
 * Minimal YAML subset: `key:` followed by indented `- key: value` items and
 * indented continuation keys. Enough for a reviewable ledger without a
 * transitive YAML dependency.
 */
function parseListBlock(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}\\s*:\\s*$`).test(line));
  if (start === -1) return [];

  const items = [];
  let current = null;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line)) break;
    if (!line.trim()) continue;

    const itemStart = /^\s*-\s+(.*)$/.exec(line);
    if (itemStart) {
      current = {};
      items.push(current);
      readKeyValue(current, itemStart[1]);
      continue;
    }

    if (current) readKeyValue(current, line.trim());
  }

  return items;
}

function readKeyValue(target, fragment) {
  const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(fragment);
  if (!match) return;
  target[match[1]] = unquote(match[2].trim());
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

await main();
