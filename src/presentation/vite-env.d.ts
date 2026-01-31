/// <reference types="vite/client" />

/**
 * Vite Environment Types
 *
 * Type definitions for Vite-specific features and environment variables.
 *
 * @module presentation/vite-env
 */

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    readonly data: Record<string, unknown>;
    accept(): void;
    accept(cb: (mod: unknown) => void): void;
    accept(deps: readonly string[], cb: (mods: readonly unknown[]) => void): void;
    dispose(cb: (data: Record<string, unknown>) => void): void;
    decline(): void;
    invalidate(): void;
    on<T extends string>(
      event: T,
      cb: (payload: unknown) => void
    ): void;
  };
}

// Global constants defined in vite.config.ts
declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
