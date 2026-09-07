import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  const isAdmin = mode === 'admin' || process.env.BUILD_TARGET === 'admin';
  const isUser = mode === 'user' || process.env.BUILD_TARGET === 'user';
  const isMobile = mode === 'mobile' || process.env.BUILD_TARGET === 'mobile';
  const outDir = isAdmin ? 'dist-admin' : isUser ? 'dist-user' : isMobile ? 'dist-mobile' : 'dist';
  const isStandalone = isAdmin || isUser || isMobile;

  return {
    plugins: [react(), tailwindcss()],
    base: isStandalone ? './' : '/',
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: isAdmin ? {
        input: {
          main: path.resolve(__dirname, 'index-admin.html'),
        },
      } : isUser ? {
        input: {
          main: path.resolve(__dirname, 'index-user.html'),
        },
      } : isMobile ? {
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
