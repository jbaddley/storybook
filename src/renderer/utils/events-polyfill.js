// Polyfill for 'events' module used by webpack-dev-server
// This needs to match Node.js events module API exactly

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}

EventEmitter.prototype.on = function(type, listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('listener must be a function');
  }
  
  if (this._events[type]) {
    this._events[type].push(listener);
  } else {
    this._events[type] = [listener];
  }
  
  return this;
};

EventEmitter.prototype.emit = function(type) {
  if (this._events[type]) {
    const args = Array.prototype.slice.call(arguments, 1);
    this._events[type].forEach(function(listener) {
      listener.apply(this, args);
    }, this);
  }
  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if (this._events[type]) {
    this._events[type] = this._events[type].filter(function(l) {
      return l !== listener;
    });
    if (this._events[type].length === 0) {
      delete this._events[type];
    }
  }
  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  if (type) {
    delete this._events[type];
  } else {
    this._events = {};
  }
  return this;
};

// Export EventEmitter as the default export (Node.js style)
module.exports = EventEmitter;
// Also export as named export for compatibility
module.exports.EventEmitter = EventEmitter;

