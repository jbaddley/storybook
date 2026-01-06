// Minimal EventEmitter polyfill for browser environment
function EventEmitter() {
  this._events = {};
}

EventEmitter.prototype.on = function(event, listener) {
  if (!this._events[event]) {
    this._events[event] = [];
  }
  this._events[event].push(listener);
  return this;
};

EventEmitter.prototype.once = function(event, listener) {
  var self = this;
  var onceWrapper = function() {
    listener.apply(self, arguments);
    self.off(event, onceWrapper);
  };
  return this.on(event, onceWrapper);
};

EventEmitter.prototype.off = function(event, listener) {
  if (!this._events[event]) return this;
  this._events[event] = this._events[event].filter(function(l) { return l !== listener; });
  return this;
};

EventEmitter.prototype.emit = function(event) {
  if (!this._events[event]) return false;
  var args = Array.prototype.slice.call(arguments, 1);
  var self = this;
  this._events[event].forEach(function(listener) {
    try {
      listener.apply(self, args);
    } catch (err) {
      console.error('Error in event listener:', err);
    }
  });
  return true;
};

EventEmitter.prototype.removeListener = function(event, listener) {
  return this.off(event, listener);
};

EventEmitter.prototype.removeAllListeners = function(event) {
  if (event) {
    delete this._events[event];
  } else {
    this._events = {};
  }
  return this;
};

EventEmitter.prototype.listeners = function(event) {
  return this._events[event] || [];
};

EventEmitter.prototype.listenerCount = function(event) {
  return this.listeners(event).length;
};

EventEmitter.prototype.addListener = function(event, listener) {
  return this.on(event, listener);
};

EventEmitter.prototype.prependListener = function(event, listener) {
  if (!this._events[event]) {
    this._events[event] = [];
  }
  this._events[event].unshift(listener);
  return this;
};

EventEmitter.prototype.setMaxListeners = function() {
  return this;
};

EventEmitter.prototype.getMaxListeners = function() {
  return Infinity;
};

// Export for both CommonJS and ES modules
module.exports = EventEmitter;
module.exports.default = EventEmitter;
module.exports.EventEmitter = EventEmitter;

