/**
 * Vite Configuration
 *
 * Configuration for Vite build tool and development server
 * for the React renderer process of TheScale App.
 *
 * @module vite.config
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Root directory for the renderer process
  root: 'src/presentation',

  // Base public path
  base: './',

  // Build configuration
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['recharts'],
          'state-vendor': ['zustand'],
        },
      },
    },
    // Target Electron's Chromium version
    target: 'chrome114',
  },

  // Development server configuration
  server: {
    port: 11001, // High port to avoid conflicts with other projects
    strictPort: true,
    // Allow Electron to connect
    cors: true,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self' ws://localhost:*",
      ].join('; '),
    },
  },

  // Preview server configuration
  preview: {
    port: 4173,
    strictPort: true,
  },

  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js',
  },

  // Dependency optimization
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'recharts', 'dayjs', 'zod'],
    exclude: ['electron'],
  },

  // Environment variable configuration
  envPrefix: 'VITE_',

  // esbuild configuration
  esbuild: {
    // Keep console logs in development
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __DEV__: process.env.NODE_ENV !== 'production',
  },
});
