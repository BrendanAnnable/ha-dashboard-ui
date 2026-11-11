import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

/** One self-contained file, named after the repo, which is what HACS installs. */
export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(process.env.LAB ? `${version}-lab` : version),
    __LEGACY_ALIAS__: JSON.stringify(!process.env.LAB),
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'ha-dashboard-ui.js',
    },
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
