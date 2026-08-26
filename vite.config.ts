import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  const isMobile = mode === 'mobile' || process.env.BUILD_TARGET === 'mobile';
  const outDir = isMobile ? 'dist-mobile' : 'dist';

  return {
    plugins: [react(), tailwindcss()],
    base: isMobile ? './' : '/',
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: isMobile ? {
        input: {
          main: path.resolve(__dirname, 'index-mobile.html'),
        },
      } : undefined,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
