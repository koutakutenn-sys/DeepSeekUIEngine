import { relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Record Rollup's retained modules, without source code or machine-specific paths. */
export function licenseModules(target: 'content' | 'popup'): Plugin {
  return {
    name: 'license-module-inventory',
    generateBundle(_options, bundle) {
      const modules = new Set<string>();
      const generated = new Set<string>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const [id, info] of Object.entries(chunk.modules)) {
          if (info.renderedLength === 0) continue;
          const clean = id.replace(/^\0/, '').split('?')[0];
          const path = relative(resolve('.'), clean).replaceAll('\\', '/');
          if (path.startsWith('node_modules/')) modules.add(path);
          else if (id.includes('commonjsHelpers.js')) generated.add('rollup-commonjs-helpers');
          else if (id.includes('vite/modulepreload-polyfill.js')) generated.add('vite-modulepreload-polyfill');
        }
      }
      this.emitFile({ type: 'asset', fileName: `THIRD_PARTY_MODULES.${target}.json`,
        source: JSON.stringify({ target, modules: [...modules].sort(), generated: [...generated].sort() }, null, 2) + '\n' });
    },
  };
}
