// This shim ensures we get the built-in electron module
try {
  // In Electron context, process.type is available after initialization
  // But we need electron before that, so we access it via process.electronBinding
  module.exports = process.electronBinding ? require('electron') : {};
} catch (e) {
  module.exports = {};
}
