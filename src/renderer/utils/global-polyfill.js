// Polyfill for 'global' in browser context
if (typeof global === 'undefined') {
  var global = window;
}
module.exports = global;

