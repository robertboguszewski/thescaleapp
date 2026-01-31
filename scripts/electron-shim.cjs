/**
 * Electron Module Shim
 *
 * This shim fixes the module resolution issue where require('electron') resolves
 * to the npm electron package (which returns a path string) instead of Electron's
 * internal module.
 *
 * This should be injected at the top of bundled main process code.
 */

const Module = require('module');
const path = require('path');

// Store the original require
const originalRequire = Module.prototype.require;

// Override require to intercept 'electron' module requests
Module.prototype.require = function(id) {
  // Only intercept 'electron' and 'electron/*' requires
  if (id === 'electron' || id.startsWith('electron/')) {
    // Check if we're running inside Electron by checking for electron in process.versions
    if (process.versions && process.versions.electron) {
      // We're inside Electron, but the builtin isn't being resolved properly
      // This happens when Node.js resolves to node_modules/electron first

      // Check if the result would be the npm package (returns a string path)
      const result = originalRequire.call(this, id);
      if (typeof result === 'string') {
        // It's the npm package returning the path - this is wrong!
        // Try to find the real electron module

        // Method 1: Check if there's a cached proper electron module
        const cacheKey = Object.keys(require.cache).find(k =>
          k.includes('electron') && !k.includes('node_modules')
        );
        if (cacheKey && typeof require.cache[cacheKey].exports === 'object') {
          return require.cache[cacheKey].exports;
        }

        // Method 2: The electron binary should expose the module through a special mechanism
        // Unfortunately, if we get here, it means Electron's internal module isn't available

        // Throw a clear error instead of returning the path string
        throw new Error(
          `Electron module resolution failed. Got path "${result}" instead of Electron API. ` +
          `This usually means the app is not being run as a proper Electron application. ` +
          `Make sure to run with: electron . (not node main.cjs)`
        );
      }

      return result;
    }
  }

  return originalRequire.call(this, id);
};

// Export a marker so we know the shim is active
module.exports = { ELECTRON_SHIM_ACTIVE: true };
