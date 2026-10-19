import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Preserve notices for installed production dependencies, including the plotting
// library. This list is conservative: some installed modules are tree-shaken out.
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const sections = ['DeepSeek UI Engine — production dependency notices\nSome listed packages may not be included in the final bundle.'];
for (const [directory, entry] of Object.entries(lock.packages)) {
  if (!directory.startsWith('node_modules/') || entry.dev) continue;
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const notices = (await readdir(directory)).filter((name) => /^(licen[cs]e|notice)(\.[\w-]+)?$/i.test(name));
  const contents = await Promise.all(notices.map(async (name) => `${name}\n${await readFile(join(directory, name), 'utf8')}`));
  sections.push(`${pkg.name}@${pkg.version}\nLicense: ${pkg.license ?? 'See package source'}\n${contents.join('\n\n')}`);
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n');
