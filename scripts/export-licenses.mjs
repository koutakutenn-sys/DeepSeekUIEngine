import { copyFile, writeFile } from 'node:fs/promises';
import { collectLicenseAudit } from './license-audit.mjs';

// Preserve notices for installed production dependencies, including the plotting
// library. This list is conservative: some installed modules are tree-shaken out.
const audit = await collectLicenseAudit();
await writeFile('dist/THIRD_PARTY_NOTICES.txt', audit.notices);
await writeFile('dist/THIRD_PARTY_COVERAGE.json', JSON.stringify({ packages: audit.coverage, unresolved: audit.unresolved }, null, 2) + '\n');
await copyFile('THIRD_PARTY_LICENSE_AUDIT.md', 'dist/THIRD_PARTY_LICENSE_AUDIT.md');
