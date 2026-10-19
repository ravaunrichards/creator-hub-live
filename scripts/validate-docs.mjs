#!/usr/bin/env node
/**
 * CHL documentation gate. Node built-ins only; safe to run offline.
 * It validates the handbook added by this package and all local Markdown links
 * from that handbook. It does not mutate files or contact external services.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = [
  'docs/README.md',
  'docs/engineering/README.md',
  'docs/engineering/WORKFLOW.md',
  'docs/engineering/PLATFORM-PATTERNS.md',
  'docs/engineering/ARCHITECTURE-AND-DOMAIN-MAP.md',
  'docs/engineering/QUALITY-GATES.md',
  'docs/engineering/DATA-CHANGE-CONTROL.md',
  'docs/engineering/RELEASE-AND-ROLLBACK.md',
  'docs/engineering/INCIDENT-RESPONSE.md',
  'docs/engineering/SECURITY-PRIVACY-OBSERVABILITY.md',
  'docs/engineering/DOCS-STANDARDS.md',
  'docs/engineering/decisions/README.md',
  'docs/engineering/decisions/ADR-0001-domain-authority.md',
  'docs/engineering/templates/FEATURE-REQUEST.md',
  'docs/engineering/templates/TECHNICAL-DESIGN.md',
  'docs/engineering/templates/ADR.md',
  'docs/engineering/templates/BUG-REPORT.md',
  'docs/engineering/templates/INCIDENT-POSTMORTEM.md',
  'docs/engineering/templates/RELEASE-READINESS.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/workflows/docs-quality.yml',
  'DOCS-AND-WORKFLOWS-MANUAL-INSTALL.md',
];
const problems = [];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) problems.push(`Missing required file: ${rel}`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

const docsToCheck = new Set([
  path.join(root, 'docs/README.md'),
  path.join(root, 'DOCS-AND-WORKFLOWS-MANUAL-INSTALL.md'),
  path.join(root, '.github/PULL_REQUEST_TEMPLATE.md'),
  ...walk(path.join(root, 'docs/engineering')),
]);
let linkCount = 0;
for (const file of docsToCheck) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(root, file).split(path.sep).join('/');
  const content = fs.readFileSync(file, 'utf8');
  if (!content.trim()) problems.push(`Empty Markdown file: ${rel}`);
  if (!/^#\s+\S/m.test(content)) problems.push(`No top-level Markdown heading: ${rel}`);

  // Strip fenced code to avoid treating examples as live links.
  const body = content.replace(/```[\s\S]*?```/g, '');
  const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of body.matchAll(linkRe)) {
    const raw = match[1].trim().split(/\s+['"]/)[0];
    if (!raw || /^(?:https?:|mailto:|tel:|#|data:)/i.test(raw)) continue;
    const targetPath = decodeURIComponent(raw.split('#')[0]);
    if (!targetPath) continue;
    linkCount++;
    const resolved = path.resolve(path.dirname(file), targetPath);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      problems.push(`Link escapes repository root in ${rel}: ${raw}`);
      continue;
    }
    if (!fs.existsSync(resolved)) problems.push(`Broken local link in ${rel}: ${raw} -> ${path.relative(root, resolved)}`);
  }
}

// Documentation wording should not accidentally report completion without an evidence state.
const manual = path.join(root, 'DOCS-AND-WORKFLOWS-MANUAL-INSTALL.md');
if (fs.existsSync(manual)) {
  const t = fs.readFileSync(manual, 'utf8');
  if (!t.includes('Remote changes made:') || !t.includes('This package does not edit GitHub, Supabase, Render, secrets, or the live CHL site.')) problems.push('Manual-install note must explicitly state remote changes made and list unchanged services.')
  if (!t.includes('PASS') || !t.includes('BLOCKED') || !t.includes('NOT RUN')) problems.push('Manual-install note must define evidence status terms.');
}

if (problems.length) {
  console.error(`CHL docs validation FAILED (${problems.length} issue(s)):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`CHL docs validation PASS: ${required.length} required files present; ${docsToCheck.size} Markdown files inspected; ${linkCount} local Markdown links resolved.`);
}
