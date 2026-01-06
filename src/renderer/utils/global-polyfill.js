// Global polyfill for browser environment
const globalPolyfill = typeof globalThis !== 'undefined' ? globalThis : 
                       typeof window !== 'undefined' ? window : 
                       typeof global !== 'undefined' ? global : 
                       typeof self !== 'undefined' ? self : {};

// Export for webpack ProvidePlugin
module.exports = globalPolyfill;

