import fs from 'node:fs';
import path from 'node:path';
const required=['docs/README.md','docs/product/overview.md','docs/architecture/system-context.md','docs/architecture/engineering-principles.md','docs/workflows/feature-change.md','docs/workflows/bug-fix.md','docs/workflows/release-and-manual-install.md','docs/quality/testing-strategy.md','docs/security/security-and-data.md','docs/operations/incident-response.md','docs/records/DECISION-LOG.md'];
const issues=[];
for(const f of required){if(!fs.existsSync(f))issues.push(`Missing ${f}`);else if(!fs.readFileSync(f,'utf8').trim())issues.push(`Empty ${f}`);}
function walk(d){if(!fs.existsSync(d))return[];return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
for(const f of walk('docs').filter(x=>x.endsWith('.md'))){const s=fs.readFileSync(f,'utf8');if(!s.endsWith('\n'))issues.push(`Missing final newline: ${f}`);if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(s))issues.push(`Possible private key: ${f}`);}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`PASS: ${required.length} required docs exist and are non-empty.`);console.log('PASS: Markdown newline and private-key pattern checks.');console.log('NOTE: Does not verify app behavior, live services, factual accuracy, or links.');
