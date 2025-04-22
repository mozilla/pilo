"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/.pnpm/secure-json-parse@2.7.0/node_modules/secure-json-parse/index.js
  var require_secure_json_parse = __commonJS({
    "node_modules/.pnpm/secure-json-parse@2.7.0/node_modules/secure-json-parse/index.js"(exports, module) {
      "use strict";
      var hasBuffer = typeof Buffer !== "undefined";
      var suspectProtoRx = /"(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])"\s*:/;
      var suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
      function _parse(text2, reviver, options) {
        if (options == null) {
          if (reviver !== null && typeof reviver === "object") {
            options = reviver;
            reviver = void 0;
          }
        }
        if (hasBuffer && Buffer.isBuffer(text2)) {
          text2 = text2.toString();
        }
        if (text2 && text2.charCodeAt(0) === 65279) {
          text2 = text2.slice(1);
        }
        const obj = JSON.parse(text2, reviver);
        if (obj === null || typeof obj !== "object") {
          return obj;
        }
        const protoAction = options && options.protoAction || "error";
        const constructorAction = options && options.constructorAction || "error";
        if (protoAction === "ignore" && constructorAction === "ignore") {
          return obj;
        }
        if (protoAction !== "ignore" && constructorAction !== "ignore") {
          if (suspectProtoRx.test(text2) === false && suspectConstructorRx.test(text2) === false) {
            return obj;
          }
        } else if (protoAction !== "ignore" && constructorAction === "ignore") {
          if (suspectProtoRx.test(text2) === false) {
            return obj;
          }
        } else {
          if (suspectConstructorRx.test(text2) === false) {
            return obj;
          }
        }
        return filter(obj, { protoAction, constructorAction, safe: options && options.safe });
      }
      function filter(obj, { protoAction = "error", constructorAction = "error", safe } = {}) {
        let next = [obj];
        while (next.length) {
          const nodes = next;
          next = [];
          for (const node of nodes) {
            if (protoAction !== "ignore" && Object.prototype.hasOwnProperty.call(node, "__proto__")) {
              if (safe === true) {
                return null;
              } else if (protoAction === "error") {
                throw new SyntaxError("Object contains forbidden prototype property");
              }
              delete node.__proto__;
            }
            if (constructorAction !== "ignore" && Object.prototype.hasOwnProperty.call(node, "constructor") && Object.prototype.hasOwnProperty.call(node.constructor, "prototype")) {
              if (safe === true) {
                return null;
              } else if (constructorAction === "error") {
                throw new SyntaxError("Object contains forbidden prototype property");
              }
              delete node.constructor;
            }
            for (const key in node) {
              const value = node[key];
              if (value && typeof value === "object") {
                next.push(value);
              }
            }
          }
        }
        return obj;
      }
      function parse(text2, reviver, options) {
        const stackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 0;
        try {
          return _parse(text2, reviver, options);
        } finally {
          Error.stackTraceLimit = stackTraceLimit;
        }
      }
      function safeParse(text2, reviver) {
        const stackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 0;
        try {
          return _parse(text2, reviver, { safe: true });
        } catch (_e) {
          return null;
        } finally {
          Error.stackTraceLimit = stackTraceLimit;
        }
      }
      module.exports = parse;
      module.exports.default = parse;
      module.exports.parse = parse;
      module.exports.safeParse = safeParse;
      module.exports.scan = filter;
    }
  });

  // node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js
  var require_eventemitter3 = __commonJS({
    "node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js"(exports, module) {
      "use strict";
      var has = Object.prototype.hasOwnProperty;
      var prefix = "~";
      function Events() {
      }
      if (Object.create) {
        Events.prototype = /* @__PURE__ */ Object.create(null);
        if (!new Events().__proto__) prefix = false;
      }
      function EE(fn, context, once) {
        this.fn = fn;
        this.context = context;
        this.once = once || false;
      }
      function addListener(emitter, event, fn, context, once) {
        if (typeof fn !== "function") {
          throw new TypeError("The listener must be a function");
        }
        var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
        if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
        else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
        else emitter._events[evt] = [emitter._events[evt], listener];
        return emitter;
      }
      function clearEvent(emitter, evt) {
        if (--emitter._eventsCount === 0) emitter._events = new Events();
        else delete emitter._events[evt];
      }
      function EventEmitter2() {
        this._events = new Events();
        this._eventsCount = 0;
      }
      EventEmitter2.prototype.eventNames = function eventNames() {
        var names = [], events, name17;
        if (this._eventsCount === 0) return names;
        for (name17 in events = this._events) {
          if (has.call(events, name17)) names.push(prefix ? name17.slice(1) : name17);
        }
        if (Object.getOwnPropertySymbols) {
          return names.concat(Object.getOwnPropertySymbols(events));
        }
        return names;
      };
      EventEmitter2.prototype.listeners = function listeners(event) {
        var evt = prefix ? prefix + event : event, handlers = this._events[evt];
        if (!handlers) return [];
        if (handlers.fn) return [handlers.fn];
        for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
          ee[i] = handlers[i].fn;
        }
        return ee;
      };
      EventEmitter2.prototype.listenerCount = function listenerCount(event) {
        var evt = prefix ? prefix + event : event, listeners = this._events[evt];
        if (!listeners) return 0;
        if (listeners.fn) return 1;
        return listeners.length;
      };
      EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return false;
        var listeners = this._events[evt], len = arguments.length, args, i;
        if (listeners.fn) {
          if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
          switch (len) {
            case 1:
              return listeners.fn.call(listeners.context), true;
            case 2:
              return listeners.fn.call(listeners.context, a1), true;
            case 3:
              return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
              return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
          }
          for (i = 1, args = new Array(len - 1); i < len; i++) {
            args[i - 1] = arguments[i];
          }
          listeners.fn.apply(listeners.context, args);
        } else {
          var length = listeners.length, j;
          for (i = 0; i < length; i++) {
            if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
            switch (len) {
              case 1:
                listeners[i].fn.call(listeners[i].context);
                break;
              case 2:
                listeners[i].fn.call(listeners[i].context, a1);
                break;
              case 3:
                listeners[i].fn.call(listeners[i].context, a1, a2);
                break;
              case 4:
                listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                break;
              default:
                if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
                listeners[i].fn.apply(listeners[i].context, args);
            }
          }
        }
        return true;
      };
      EventEmitter2.prototype.on = function on(event, fn, context) {
        return addListener(this, event, fn, context, false);
      };
      EventEmitter2.prototype.once = function once(event, fn, context) {
        return addListener(this, event, fn, context, true);
      };
      EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return this;
        if (!fn) {
          clearEvent(this, evt);
          return this;
        }
        var listeners = this._events[evt];
        if (listeners.fn) {
          if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
            clearEvent(this, evt);
          }
        } else {
          for (var i = 0, events = [], length = listeners.length; i < length; i++) {
            if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
              events.push(listeners[i]);
            }
          }
          if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
          else clearEvent(this, evt);
        }
        return this;
      };
      EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
        var evt;
        if (event) {
          evt = prefix ? prefix + event : event;
          if (this._events[evt]) clearEvent(this, evt);
        } else {
          this._events = new Events();
          this._eventsCount = 0;
        }
        return this;
      };
      EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
      EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
      EventEmitter2.prefixed = prefix;
      EventEmitter2.EventEmitter = EventEmitter2;
      if ("undefined" !== typeof module) {
        module.exports = EventEmitter2;
      }
    }
  });

  // node_modules/.pnpm/@ai-sdk+provider@1.1.0/node_modules/@ai-sdk/provider/dist/index.mjs
  var marker = "vercel.ai.error";
  var symbol = Symbol.for(marker);
  var _a;
  var _AISDKError = class _AISDKError2 extends Error {
    /**
     * Creates an AI SDK Error.
     *
     * @param {Object} params - The parameters for creating the error.
     * @param {string} params.name - The name of the error.
     * @param {string} params.message - The error message.
     * @param {unknown} [params.cause] - The underlying cause of the error.
     */
    constructor({
      name: name143,
      message,
      cause
    }) {
      super(message);
      this[_a] = true;
      this.name = name143;
      this.cause = cause;
    }
    /**
     * Checks if the given error is an AI SDK Error.
     * @param {unknown} error - The error to check.
     * @returns {boolean} True if the error is an AI SDK Error, false otherwise.
     */
    static isInstance(error) {
      return _AISDKError2.hasMarker(error, marker);
    }
    static hasMarker(error, marker153) {
      const markerSymbol = Symbol.for(marker153);
      return error != null && typeof error === "object" && markerSymbol in error && typeof error[markerSymbol] === "boolean" && error[markerSymbol] === true;
    }
  };
  _a = symbol;
  var AISDKError = _AISDKError;
  var name = "AI_APICallError";
  var marker2 = `vercel.ai.error.${name}`;
  var symbol2 = Symbol.for(marker2);
  var _a2;
  var APICallError = class extends AISDKError {
    constructor({
      message,
      url,
      requestBodyValues,
      statusCode,
      responseHeaders,
      responseBody,
      cause,
      isRetryable = statusCode != null && (statusCode === 408 || // request timeout
      statusCode === 409 || // conflict
      statusCode === 429 || // too many requests
      statusCode >= 500),
      // server error
      data
    }) {
      super({ name, message, cause });
      this[_a2] = true;
      this.url = url;
      this.requestBodyValues = requestBodyValues;
      this.statusCode = statusCode;
      this.responseHeaders = responseHeaders;
      this.responseBody = responseBody;
      this.isRetryable = isRetryable;
      this.data = data;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker2);
    }
  };
  _a2 = symbol2;
  var name2 = "AI_EmptyResponseBodyError";
  var marker3 = `vercel.ai.error.${name2}`;
  var symbol3 = Symbol.for(marker3);
  var _a3;
  var EmptyResponseBodyError = class extends AISDKError {
    // used in isInstance
    constructor({ message = "Empty response body" } = {}) {
      super({ name: name2, message });
      this[_a3] = true;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker3);
    }
  };
  _a3 = symbol3;
  function getErrorMessage(error) {
    if (error == null) {
      return "unknown error";
    }
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return JSON.stringify(error);
  }
  var name3 = "AI_InvalidArgumentError";
  var marker4 = `vercel.ai.error.${name3}`;
  var symbol4 = Symbol.for(marker4);
  var _a4;
  var InvalidArgumentError = class extends AISDKError {
    constructor({
      message,
      cause,
      argument
    }) {
      super({ name: name3, message, cause });
      this[_a4] = true;
      this.argument = argument;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker4);
    }
  };
  _a4 = symbol4;
  var name4 = "AI_InvalidPromptError";
  var marker5 = `vercel.ai.error.${name4}`;
  var symbol5 = Symbol.for(marker5);
  var _a5;
  var InvalidPromptError = class extends AISDKError {
    constructor({
      prompt,
      message,
      cause
    }) {
      super({ name: name4, message: `Invalid prompt: ${message}`, cause });
      this[_a5] = true;
      this.prompt = prompt;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker5);
    }
  };
  _a5 = symbol5;
  var name5 = "AI_InvalidResponseDataError";
  var marker6 = `vercel.ai.error.${name5}`;
  var symbol6 = Symbol.for(marker6);
  var _a6;
  var InvalidResponseDataError = class extends AISDKError {
    constructor({
      data,
      message = `Invalid response data: ${JSON.stringify(data)}.`
    }) {
      super({ name: name5, message });
      this[_a6] = true;
      this.data = data;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker6);
    }
  };
  _a6 = symbol6;
  var name6 = "AI_JSONParseError";
  var marker7 = `vercel.ai.error.${name6}`;
  var symbol7 = Symbol.for(marker7);
  var _a7;
  var JSONParseError = class extends AISDKError {
    constructor({ text: text2, cause }) {
      super({
        name: name6,
        message: `JSON parsing failed: Text: ${text2}.
Error message: ${getErrorMessage(cause)}`,
        cause
      });
      this[_a7] = true;
      this.text = text2;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker7);
    }
  };
  _a7 = symbol7;
  var name7 = "AI_LoadAPIKeyError";
  var marker8 = `vercel.ai.error.${name7}`;
  var symbol8 = Symbol.for(marker8);
  var _a8;
  var LoadAPIKeyError = class extends AISDKError {
    // used in isInstance
    constructor({ message }) {
      super({ name: name7, message });
      this[_a8] = true;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker8);
    }
  };
  _a8 = symbol8;
  var name8 = "AI_LoadSettingError";
  var marker9 = `vercel.ai.error.${name8}`;
  var symbol9 = Symbol.for(marker9);
  var _a9;
  _a9 = symbol9;
  var name9 = "AI_NoContentGeneratedError";
  var marker10 = `vercel.ai.error.${name9}`;
  var symbol10 = Symbol.for(marker10);
  var _a10;
  _a10 = symbol10;
  var name10 = "AI_NoSuchModelError";
  var marker11 = `vercel.ai.error.${name10}`;
  var symbol11 = Symbol.for(marker11);
  var _a11;
  _a11 = symbol11;
  var name11 = "AI_TooManyEmbeddingValuesForCallError";
  var marker12 = `vercel.ai.error.${name11}`;
  var symbol12 = Symbol.for(marker12);
  var _a12;
  var TooManyEmbeddingValuesForCallError = class extends AISDKError {
    constructor(options) {
      super({
        name: name11,
        message: `Too many values for a single embedding call. The ${options.provider} model "${options.modelId}" can only embed up to ${options.maxEmbeddingsPerCall} values per call, but ${options.values.length} values were provided.`
      });
      this[_a12] = true;
      this.provider = options.provider;
      this.modelId = options.modelId;
      this.maxEmbeddingsPerCall = options.maxEmbeddingsPerCall;
      this.values = options.values;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker12);
    }
  };
  _a12 = symbol12;
  var name12 = "AI_TypeValidationError";
  var marker13 = `vercel.ai.error.${name12}`;
  var symbol13 = Symbol.for(marker13);
  var _a13;
  var _TypeValidationError = class _TypeValidationError2 extends AISDKError {
    constructor({ value, cause }) {
      super({
        name: name12,
        message: `Type validation failed: Value: ${JSON.stringify(value)}.
Error message: ${getErrorMessage(cause)}`,
        cause
      });
      this[_a13] = true;
      this.value = value;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker13);
    }
    /**
     * Wraps an error into a TypeValidationError.
     * If the cause is already a TypeValidationError with the same value, it returns the cause.
     * Otherwise, it creates a new TypeValidationError.
     *
     * @param {Object} params - The parameters for wrapping the error.
     * @param {unknown} params.value - The value that failed validation.
     * @param {unknown} params.cause - The original error or cause of the validation failure.
     * @returns {TypeValidationError} A TypeValidationError instance.
     */
    static wrap({
      value,
      cause
    }) {
      return _TypeValidationError2.isInstance(cause) && cause.value === value ? cause : new _TypeValidationError2({ value, cause });
    }
  };
  _a13 = symbol13;
  var TypeValidationError = _TypeValidationError;
  var name13 = "AI_UnsupportedFunctionalityError";
  var marker14 = `vercel.ai.error.${name13}`;
  var symbol14 = Symbol.for(marker14);
  var _a14;
  var UnsupportedFunctionalityError = class extends AISDKError {
    constructor({
      functionality,
      message = `'${functionality}' functionality not supported.`
    }) {
      super({ name: name13, message });
      this[_a14] = true;
      this.functionality = functionality;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker14);
    }
  };
  _a14 = symbol14;
  function isJSONValue(value) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every(isJSONValue);
    }
    if (typeof value === "object") {
      return Object.entries(value).every(
        ([key, val]) => typeof key === "string" && isJSONValue(val)
      );
    }
    return false;
  }
  function isJSONArray(value) {
    return Array.isArray(value) && value.every(isJSONValue);
  }
  function isJSONObject(value) {
    return value != null && typeof value === "object" && Object.entries(value).every(
      ([key, val]) => typeof key === "string" && isJSONValue(val)
    );
  }

  // node_modules/.pnpm/nanoid@3.3.11/node_modules/nanoid/non-secure/index.js
  var customAlphabet = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
      let id = "";
      let i = size | 0;
      while (i--) {
        id += alphabet[Math.random() * alphabet.length | 0];
      }
      return id;
    };
  };

  // node_modules/.pnpm/@ai-sdk+provider-utils@2.2.0_zod@3.24.2/node_modules/@ai-sdk/provider-utils/dist/index.mjs
  var import_secure_json_parse = __toESM(require_secure_json_parse(), 1);

  // node_modules/.pnpm/eventsource-parser@3.0.0/node_modules/eventsource-parser/dist/index.js
  var __defProp2 = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key != "symbol" ? key + "" : key, value);
  var ParseError = class extends Error {
    constructor(message, options) {
      super(message), __publicField(this, "type"), __publicField(this, "field"), __publicField(this, "value"), __publicField(this, "line"), this.name = "ParseError", this.type = options.type, this.field = options.field, this.value = options.value, this.line = options.line;
    }
  };
  function noop(_arg) {
  }
  function createParser(callbacks) {
    const { onEvent = noop, onError = noop, onRetry = noop, onComment } = callbacks;
    let incompleteLine = "", isFirstChunk = true, id, data = "", eventType = "";
    function feed(newChunk) {
      const chunk = isFirstChunk ? newChunk.replace(/^\xEF\xBB\xBF/, "") : newChunk, [complete, incomplete] = splitLines(`${incompleteLine}${chunk}`);
      for (const line of complete)
        parseLine(line);
      incompleteLine = incomplete, isFirstChunk = false;
    }
    function parseLine(line) {
      if (line === "") {
        dispatchEvent();
        return;
      }
      if (line.startsWith(":")) {
        onComment && onComment(line.slice(line.startsWith(": ") ? 2 : 1));
        return;
      }
      const fieldSeparatorIndex = line.indexOf(":");
      if (fieldSeparatorIndex !== -1) {
        const field = line.slice(0, fieldSeparatorIndex), offset = line[fieldSeparatorIndex + 1] === " " ? 2 : 1, value = line.slice(fieldSeparatorIndex + offset);
        processField(field, value, line);
        return;
      }
      processField(line, "", line);
    }
    function processField(field, value, line) {
      switch (field) {
        case "event":
          eventType = value;
          break;
        case "data":
          data = `${data}${value}
`;
          break;
        case "id":
          id = value.includes("\0") ? void 0 : value;
          break;
        case "retry":
          /^\d+$/.test(value) ? onRetry(parseInt(value, 10)) : onError(
            new ParseError(`Invalid \`retry\` value: "${value}"`, {
              type: "invalid-retry",
              value,
              line
            })
          );
          break;
        default:
          onError(
            new ParseError(
              `Unknown field "${field.length > 20 ? `${field.slice(0, 20)}\u2026` : field}"`,
              { type: "unknown-field", field, value, line }
            )
          );
          break;
      }
    }
    function dispatchEvent() {
      data.length > 0 && onEvent({
        id,
        event: eventType || void 0,
        // If the data buffer's last character is a U+000A LINE FEED (LF) character,
        // then remove the last character from the data buffer.
        data: data.endsWith(`
`) ? data.slice(0, -1) : data
      }), id = void 0, data = "", eventType = "";
    }
    function reset(options = {}) {
      incompleteLine && options.consume && parseLine(incompleteLine), id = void 0, data = "", eventType = "", incompleteLine = "";
    }
    return { feed, reset };
  }
  function splitLines(chunk) {
    const lines = [];
    let incompleteLine = "";
    const totalLength = chunk.length;
    for (let i = 0; i < totalLength; i++) {
      const char = chunk[i];
      char === "\r" && chunk[i + 1] === `
` ? (lines.push(incompleteLine), incompleteLine = "", i++) : char === "\r" || char === `
` ? (lines.push(incompleteLine), incompleteLine = "") : incompleteLine += char;
    }
    return [lines, incompleteLine];
  }

  // node_modules/.pnpm/eventsource-parser@3.0.0/node_modules/eventsource-parser/dist/stream.js
  var EventSourceParserStream = class extends TransformStream {
    constructor({ onError, onRetry, onComment } = {}) {
      let parser;
      super({
        start(controller) {
          parser = createParser({
            onEvent: (event) => {
              controller.enqueue(event);
            },
            onError(error) {
              onError === "terminate" ? controller.error(error) : typeof onError == "function" && onError(error);
            },
            onRetry,
            onComment
          });
        },
        transform(chunk) {
          parser.feed(chunk);
        }
      });
    }
  };

  // node_modules/.pnpm/@ai-sdk+provider-utils@2.2.0_zod@3.24.2/node_modules/@ai-sdk/provider-utils/dist/index.mjs
  function combineHeaders(...headers) {
    return headers.reduce(
      (combinedHeaders, currentHeaders) => ({
        ...combinedHeaders,
        ...currentHeaders != null ? currentHeaders : {}
      }),
      {}
    );
  }
  function convertAsyncIteratorToReadableStream(iterator) {
    return new ReadableStream({
      /**
       * Called when the consumer wants to pull more data from the stream.
       *
       * @param {ReadableStreamDefaultController<T>} controller - The controller to enqueue data into the stream.
       * @returns {Promise<void>}
       */
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      },
      /**
       * Called when the consumer cancels the stream.
       */
      cancel() {
      }
    });
  }
  async function delay(delayInMs) {
    return delayInMs == null ? Promise.resolve() : new Promise((resolve2) => setTimeout(resolve2, delayInMs));
  }
  function extractResponseHeaders(response) {
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  var createIdGenerator = ({
    prefix,
    size: defaultSize = 16,
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    separator = "-"
  } = {}) => {
    const generator = customAlphabet(alphabet, defaultSize);
    if (prefix == null) {
      return generator;
    }
    if (alphabet.includes(separator)) {
      throw new InvalidArgumentError({
        argument: "separator",
        message: `The separator "${separator}" must not be part of the alphabet "${alphabet}".`
      });
    }
    return (size) => `${prefix}${separator}${generator(size)}`;
  };
  var generateId = createIdGenerator();
  function getErrorMessage2(error) {
    if (error == null) {
      return "unknown error";
    }
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return JSON.stringify(error);
  }
  function removeUndefinedEntries(record) {
    return Object.fromEntries(
      Object.entries(record).filter(([_key, value]) => value != null)
    );
  }
  function isAbortError(error) {
    return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
  }
  function loadApiKey({
    apiKey,
    environmentVariableName,
    apiKeyParameterName = "apiKey",
    description
  }) {
    if (typeof apiKey === "string") {
      return apiKey;
    }
    if (apiKey != null) {
      throw new LoadAPIKeyError({
        message: `${description} API key must be a string.`
      });
    }
    if (typeof process === "undefined") {
      throw new LoadAPIKeyError({
        message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter. Environment variables is not supported in this environment.`
      });
    }
    apiKey = process.env[environmentVariableName];
    if (apiKey == null) {
      throw new LoadAPIKeyError({
        message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter or the ${environmentVariableName} environment variable.`
      });
    }
    if (typeof apiKey !== "string") {
      throw new LoadAPIKeyError({
        message: `${description} API key must be a string. The value of the ${environmentVariableName} environment variable is not a string.`
      });
    }
    return apiKey;
  }
  var validatorSymbol = Symbol.for("vercel.ai.validator");
  function validator(validate) {
    return { [validatorSymbol]: true, validate };
  }
  function isValidator(value) {
    return typeof value === "object" && value !== null && validatorSymbol in value && value[validatorSymbol] === true && "validate" in value;
  }
  function asValidator(value) {
    return isValidator(value) ? value : zodValidator(value);
  }
  function zodValidator(zodSchema2) {
    return validator((value) => {
      const result = zodSchema2.safeParse(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    });
  }
  function validateTypes({
    value,
    schema: inputSchema
  }) {
    const result = safeValidateTypes({ value, schema: inputSchema });
    if (!result.success) {
      throw TypeValidationError.wrap({ value, cause: result.error });
    }
    return result.value;
  }
  function safeValidateTypes({
    value,
    schema
  }) {
    const validator2 = asValidator(schema);
    try {
      if (validator2.validate == null) {
        return { success: true, value };
      }
      const result = validator2.validate(value);
      if (result.success) {
        return result;
      }
      return {
        success: false,
        error: TypeValidationError.wrap({ value, cause: result.error })
      };
    } catch (error) {
      return {
        success: false,
        error: TypeValidationError.wrap({ value, cause: error })
      };
    }
  }
  function parseJSON({
    text: text2,
    schema
  }) {
    try {
      const value = import_secure_json_parse.default.parse(text2);
      if (schema == null) {
        return value;
      }
      return validateTypes({ value, schema });
    } catch (error) {
      if (JSONParseError.isInstance(error) || TypeValidationError.isInstance(error)) {
        throw error;
      }
      throw new JSONParseError({ text: text2, cause: error });
    }
  }
  function safeParseJSON({
    text: text2,
    schema
  }) {
    try {
      const value = import_secure_json_parse.default.parse(text2);
      if (schema == null) {
        return { success: true, value, rawValue: value };
      }
      const validationResult = safeValidateTypes({ value, schema });
      return validationResult.success ? { ...validationResult, rawValue: value } : validationResult;
    } catch (error) {
      return {
        success: false,
        error: JSONParseError.isInstance(error) ? error : new JSONParseError({ text: text2, cause: error })
      };
    }
  }
  function isParsableJson(input) {
    try {
      import_secure_json_parse.default.parse(input);
      return true;
    } catch (e) {
      return false;
    }
  }
  var getOriginalFetch2 = () => globalThis.fetch;
  var postJsonToApi = async ({
    url,
    headers,
    body,
    failedResponseHandler,
    successfulResponseHandler,
    abortSignal,
    fetch: fetch2
  }) => postToApi({
    url,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: {
      content: JSON.stringify(body),
      values: body
    },
    failedResponseHandler,
    successfulResponseHandler,
    abortSignal,
    fetch: fetch2
  });
  var postToApi = async ({
    url,
    headers = {},
    body,
    successfulResponseHandler,
    failedResponseHandler,
    abortSignal,
    fetch: fetch2 = getOriginalFetch2()
  }) => {
    try {
      const response = await fetch2(url, {
        method: "POST",
        headers: removeUndefinedEntries(headers),
        body: body.content,
        signal: abortSignal
      });
      const responseHeaders = extractResponseHeaders(response);
      if (!response.ok) {
        let errorInformation;
        try {
          errorInformation = await failedResponseHandler({
            response,
            url,
            requestBodyValues: body.values
          });
        } catch (error) {
          if (isAbortError(error) || APICallError.isInstance(error)) {
            throw error;
          }
          throw new APICallError({
            message: "Failed to process error response",
            cause: error,
            statusCode: response.status,
            url,
            responseHeaders,
            requestBodyValues: body.values
          });
        }
        throw errorInformation.value;
      }
      try {
        return await successfulResponseHandler({
          response,
          url,
          requestBodyValues: body.values
        });
      } catch (error) {
        if (error instanceof Error) {
          if (isAbortError(error) || APICallError.isInstance(error)) {
            throw error;
          }
        }
        throw new APICallError({
          message: "Failed to process successful response",
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: body.values
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (error instanceof TypeError && error.message === "fetch failed") {
        const cause = error.cause;
        if (cause != null) {
          throw new APICallError({
            message: `Cannot connect to API: ${cause.message}`,
            cause,
            url,
            requestBodyValues: body.values,
            isRetryable: true
            // retry when network error
          });
        }
      }
      throw error;
    }
  };
  var createJsonErrorResponseHandler = ({
    errorSchema,
    errorToMessage,
    isRetryable
  }) => async ({ response, url, requestBodyValues }) => {
    const responseBody = await response.text();
    const responseHeaders = extractResponseHeaders(response);
    if (responseBody.trim() === "") {
      return {
        responseHeaders,
        value: new APICallError({
          message: response.statusText,
          url,
          requestBodyValues,
          statusCode: response.status,
          responseHeaders,
          responseBody,
          isRetryable: isRetryable == null ? void 0 : isRetryable(response)
        })
      };
    }
    try {
      const parsedError = parseJSON({
        text: responseBody,
        schema: errorSchema
      });
      return {
        responseHeaders,
        value: new APICallError({
          message: errorToMessage(parsedError),
          url,
          requestBodyValues,
          statusCode: response.status,
          responseHeaders,
          responseBody,
          data: parsedError,
          isRetryable: isRetryable == null ? void 0 : isRetryable(response, parsedError)
        })
      };
    } catch (parseError) {
      return {
        responseHeaders,
        value: new APICallError({
          message: response.statusText,
          url,
          requestBodyValues,
          statusCode: response.status,
          responseHeaders,
          responseBody,
          isRetryable: isRetryable == null ? void 0 : isRetryable(response)
        })
      };
    }
  };
  var createEventSourceResponseHandler = (chunkSchema) => async ({ response }) => {
    const responseHeaders = extractResponseHeaders(response);
    if (response.body == null) {
      throw new EmptyResponseBodyError({});
    }
    return {
      responseHeaders,
      value: response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream()).pipeThrough(
        new TransformStream({
          transform({ data }, controller) {
            if (data === "[DONE]") {
              return;
            }
            controller.enqueue(
              safeParseJSON({
                text: data,
                schema: chunkSchema
              })
            );
          }
        })
      )
    };
  };
  var createJsonResponseHandler = (responseSchema) => async ({ response, url, requestBodyValues }) => {
    const responseBody = await response.text();
    const parsedResult = safeParseJSON({
      text: responseBody,
      schema: responseSchema
    });
    const responseHeaders = extractResponseHeaders(response);
    if (!parsedResult.success) {
      throw new APICallError({
        message: "Invalid JSON response",
        cause: parsedResult.error,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        url,
        requestBodyValues
      });
    }
    return {
      responseHeaders,
      value: parsedResult.value,
      rawValue: parsedResult.rawValue
    };
  };
  var { btoa, atob: atob2 } = globalThis;
  function convertBase64ToUint8Array(base64String) {
    const base64Url = base64String.replace(/-/g, "+").replace(/_/g, "/");
    const latin1string = atob2(base64Url);
    return Uint8Array.from(latin1string, (byte) => byte.codePointAt(0));
  }
  function convertUint8ArrayToBase64(array) {
    let latin1string = "";
    for (let i = 0; i < array.length; i++) {
      latin1string += String.fromCodePoint(array[i]);
    }
    return btoa(latin1string);
  }
  function withoutTrailingSlash(url) {
    return url == null ? void 0 : url.replace(/\/$/, "");
  }

  // node_modules/.pnpm/zod@3.24.2/node_modules/zod/lib/index.mjs
  var util;
  (function(util2) {
    util2.assertEqual = (val) => val;
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object2) => {
      const keys = [];
      for (const key in object2) {
        if (Object.prototype.hasOwnProperty.call(object2, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
        // second overwrites first
      };
    };
  })(objectUtil || (objectUtil = {}));
  var ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };
  var ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
  };
  var ZodError = class _ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof _ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
          fieldErrors[sub.path[0]].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };
  var errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  var overrideErrorMap = errorMap;
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }
  var makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    if (issueData.message !== void 0) {
      return {
        ...issueData,
        path: fullPath,
        message: issueData.message
      };
    }
    let errorMessage = "";
    const maps = errorMaps.filter((m) => !!m).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: errorMessage
    };
  };
  var EMPTY_PATH = [];
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === errorMap ? void 0 : errorMap
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  var ParseStatus = class _ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s of results) {
        if (s.status === "aborted")
          return INVALID;
        if (s.status === "dirty")
          status.dirty();
        arrayValue.push(s.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        const key = await pair.key;
        const value = await pair.value;
        syncPairs.push({
          key,
          value
        });
      }
      return _ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  };
  var INVALID = Object.freeze({
    status: "aborted"
  });
  var DIRTY = (value) => ({ status: "dirty", value });
  var OK = (value) => ({ status: "valid", value });
  var isAborted = (x) => x.status === "aborted";
  var isDirty = (x) => x.status === "dirty";
  var isValid = (x) => x.status === "valid";
  var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
  })(errorUtil || (errorUtil = {}));
  var _ZodEnum_cache;
  var _ZodNativeEnum_cache;
  var ParseInputLazyPath = class {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (this._key instanceof Array) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  };
  var handleResult = (ctx, result) => {
    if (isValid(result)) {
      return { success: true, data: result.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      var _a17, _b;
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: (_a17 = message !== null && message !== void 0 ? message : required_error) !== null && _a17 !== void 0 ? _a17 : ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  var ZodType = class {
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result = this._parse(input);
      if (isAsync(result)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result;
    }
    _parseAsync(input) {
      const result = this._parse(input);
      return Promise.resolve(result);
    }
    parse(data, params) {
      const result = this.safeParse(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    safeParse(data, params) {
      var _a17;
      const ctx = {
        common: {
          issues: [],
          async: (_a17 = params === null || params === void 0 ? void 0 : params.async) !== null && _a17 !== void 0 ? _a17 : false,
          contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
        },
        path: (params === null || params === void 0 ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result);
    }
    "~validate"(data) {
      var _a17, _b;
      const ctx = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      if (!this["~standard"].async) {
        try {
          const result = this._parseSync({ data, path: [], parent: ctx });
          return isValid(result) ? {
            value: result.value
          } : {
            issues: ctx.common.issues
          };
        } catch (err) {
          if ((_b = (_a17 = err === null || err === void 0 ? void 0 : err.message) === null || _a17 === void 0 ? void 0 : _a17.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes("encountered")) {
            this["~standard"].async = true;
          }
          ctx.common = {
            issues: [],
            async: true
          };
        }
      }
      return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
        value: result.value
      } : {
        issues: ctx.common.issues
      });
    }
    async parseAsync(data, params) {
      const result = await this.safeParseAsync(data, params);
      if (result.success)
        return result.data;
      throw result.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
          async: true
        },
        path: (params === null || params === void 0 ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
      const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result instanceof Promise) {
          return result.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
      this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: (data) => this["~validate"](data)
      };
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects({
        ...processCreateParams(this._def),
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        ...processCreateParams(this._def),
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    brand() {
      return new ZodBranded({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this,
        ...processCreateParams(this._def)
      });
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch({
        ...processCreateParams(this._def),
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  var cuidRegex = /^c[^\s-]{8,}$/i;
  var cuid2Regex = /^[0-9a-z]+$/;
  var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  var nanoidRegex = /^[a-z0-9_-]{21}$/i;
  var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  var emojiRegex;
  var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
  var dateRegex = new RegExp(`^${dateRegexSource}$`);
  function timeRegexSource(args) {
    let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
    if (args.precision) {
      regex = `${regex}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      regex = `${regex}(\\.\\d+)?`;
    }
    return regex;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if (!decoded.typ || !decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch (_a17) {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  var ZodString = class _ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch (_a17) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      var _a17, _b;
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
        offset: (_a17 = options === null || options === void 0 ? void 0 : options.offset) !== null && _a17 !== void 0 ? _a17 : false,
        local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
        ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
        ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options === null || options === void 0 ? void 0 : options.position,
        ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new _ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodString.create = (params) => {
    var _a17;
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: (_a17 = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a17 !== void 0 ? _a17 : false,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / Math.pow(10, decCount);
  }
  var ZodNumber = class _ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null, min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  };
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  var ZodBigInt = class _ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch (_a17) {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new _ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new _ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  };
  ZodBigInt.create = (params) => {
    var _a17;
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: (_a17 = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a17 !== void 0 ? _a17 : false,
      ...processCreateParams(params)
    });
  };
  var ZodBoolean = class extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  var ZodDate = class _ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new _ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  };
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  var ZodSymbol = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  var ZodUndefined = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  var ZodNull = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  var ZodAny = class extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  var ZodUnknown = class extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  };
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  var ZodNever = class extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  };
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  var ZodVoid = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  };
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  var ZodArray = class _ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result2) => {
          return ParseStatus.mergeArray(status, result2);
        });
      }
      const result = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new _ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new _ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new _ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  var ZodObject = class _ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      return this._cached = { shape, keys };
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") ;
        else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            var _a17, _b, _c, _d;
            const defaultError = (_c = (_b = (_a17 = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a17, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new _ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new _ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new _ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new _ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      util.objectKeys(mask).forEach((key) => {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      });
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      util.objectKeys(this.shape).forEach((key) => {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      });
      return new _ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      util.objectKeys(this.shape).forEach((key) => {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      });
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      util.objectKeys(this.shape).forEach((key) => {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      });
      return new _ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  };
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  var ZodUnion = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result of results) {
          if (result.result.status === "valid") {
            return result.result;
          }
        }
        for (const result of results) {
          if (result.result.status === "dirty") {
            ctx.common.issues.push(...result.ctx.common.issues);
            return result.result;
          }
        }
        const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result.status === "valid") {
            return result;
          } else if (result.status === "dirty" && !dirty) {
            dirty = { result, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  ZodUnion.create = (types, params) => {
    return new ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  var getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return util.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else if (type instanceof ZodOptional) {
      return [void 0, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodNullable) {
      return [null, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodBranded) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
      return getDiscriminator(type._def.innerType);
    } else {
      return [];
    }
  };
  var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new _ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  };
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  var ZodIntersection = class extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  };
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  var ZodTuple = class _ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new _ZodTuple({
        ...this._def,
        rest
      });
    }
  };
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  var ZodRecord = class _ZodRecord extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const pairs = [];
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      for (const key in ctx.data) {
        pairs.push({
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
          value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (ctx.common.async) {
        return ParseStatus.mergeObjectAsync(status, pairs);
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get element() {
      return this._def.valueType;
    }
    static create(first, second, third) {
      if (second instanceof ZodType) {
        return new _ZodRecord({
          keyType: first,
          valueType: second,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(third)
        });
      }
      return new _ZodRecord({
        keyType: ZodString.create(),
        valueType: first,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(second)
      });
    }
  };
  var ZodMap = class extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  };
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  var ZodSet = class _ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new _ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new _ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  };
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  var ZodFunction = class _ZodFunction extends ZodType {
    constructor() {
      super(...arguments);
      this.validate = this.implement;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.function) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.function,
          received: ctx.parsedType
        });
        return INVALID;
      }
      function makeArgsIssue(args, error) {
        return makeIssue({
          data: args,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            getErrorMap(),
            errorMap
          ].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_arguments,
            argumentsError: error
          }
        });
      }
      function makeReturnsIssue(returns, error) {
        return makeIssue({
          data: returns,
          path: ctx.path,
          errorMaps: [
            ctx.common.contextualErrorMap,
            ctx.schemaErrorMap,
            getErrorMap(),
            errorMap
          ].filter((x) => !!x),
          issueData: {
            code: ZodIssueCode.invalid_return_type,
            returnTypeError: error
          }
        });
      }
      const params = { errorMap: ctx.common.contextualErrorMap };
      const fn = ctx.data;
      if (this._def.returns instanceof ZodPromise) {
        const me = this;
        return OK(async function(...args) {
          const error = new ZodError([]);
          const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
            error.addIssue(makeArgsIssue(args, e));
            throw error;
          });
          const result = await Reflect.apply(fn, this, parsedArgs);
          const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
          return parsedReturns;
        });
      } else {
        const me = this;
        return OK(function(...args) {
          const parsedArgs = me._def.args.safeParse(args, params);
          if (!parsedArgs.success) {
            throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
          }
          const result = Reflect.apply(fn, this, parsedArgs.data);
          const parsedReturns = me._def.returns.safeParse(result, params);
          if (!parsedReturns.success) {
            throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
          }
          return parsedReturns.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...items) {
      return new _ZodFunction({
        ...this._def,
        args: ZodTuple.create(items).rest(ZodUnknown.create())
      });
    }
    returns(returnType) {
      return new _ZodFunction({
        ...this._def,
        returns: returnType
      });
    }
    implement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    strictImplement(func) {
      const validatedFunc = this.parse(func);
      return validatedFunc;
    }
    static create(args, returns, params) {
      return new _ZodFunction({
        args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
        returns: returns || ZodUnknown.create(),
        typeName: ZodFirstPartyTypeKind.ZodFunction,
        ...processCreateParams(params)
      });
    }
  };
  var ZodLazy = class extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  };
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  var ZodLiteral = class extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  };
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  var ZodEnum = class _ZodEnum extends ZodType {
    constructor() {
      super(...arguments);
      _ZodEnum_cache.set(this, void 0);
    }
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
        __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
      }
      if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return _ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  };
  _ZodEnum_cache = /* @__PURE__ */ new WeakMap();
  ZodEnum.create = createZodEnum;
  var ZodNativeEnum = class extends ZodType {
    constructor() {
      super(...arguments);
      _ZodNativeEnum_cache.set(this, void 0);
    }
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
        __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
      }
      if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  _ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  var ZodPromise = class extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  };
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  var ZodEffects = class extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result);
          }
          if (result instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return base;
          const result = effect.transform(base.value, checkCtx);
          if (result instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return base;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
          });
        }
      }
      util.assertNever(effect);
    }
  };
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  var ZodOptional = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  var ZodNullable = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  var ZodDefault = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  var ZodCatch = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result)) {
        return result.then((result2) => {
          return {
            status: "valid",
            value: result2.status === "valid" ? result2.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result.status === "valid" ? result.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  var ZodNaN = class extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  };
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  var BRAND = Symbol("zod_brand");
  var ZodBranded = class extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  var ZodPipeline = class _ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new _ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  };
  var ZodReadonly = class extends ZodType {
    _parse(input) {
      const result = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
  }
  function custom(check, _params = {}, fatal) {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        var _a17, _b;
        const r = check(data);
        if (r instanceof Promise) {
          return r.then((r2) => {
            var _a18, _b2;
            if (!r2) {
              const params = cleanParams(_params, data);
              const _fatal = (_b2 = (_a18 = params.fatal) !== null && _a18 !== void 0 ? _a18 : fatal) !== null && _b2 !== void 0 ? _b2 : true;
              ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
          });
        }
        if (!r) {
          const params = cleanParams(_params, data);
          const _fatal = (_b = (_a17 = params.fatal) !== null && _a17 !== void 0 ? _a17 : fatal) !== null && _b !== void 0 ? _b : true;
          ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
        }
        return;
      });
    return ZodAny.create();
  }
  var late = {
    object: ZodObject.lazycreate
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  var instanceOfType = (cls, params = {
    message: `Input not instance of ${cls.name}`
  }) => custom((data) => data instanceof cls, params);
  var stringType = ZodString.create;
  var numberType = ZodNumber.create;
  var nanType = ZodNaN.create;
  var bigIntType = ZodBigInt.create;
  var booleanType = ZodBoolean.create;
  var dateType = ZodDate.create;
  var symbolType = ZodSymbol.create;
  var undefinedType = ZodUndefined.create;
  var nullType = ZodNull.create;
  var anyType = ZodAny.create;
  var unknownType = ZodUnknown.create;
  var neverType = ZodNever.create;
  var voidType = ZodVoid.create;
  var arrayType = ZodArray.create;
  var objectType = ZodObject.create;
  var strictObjectType = ZodObject.strictCreate;
  var unionType = ZodUnion.create;
  var discriminatedUnionType = ZodDiscriminatedUnion.create;
  var intersectionType = ZodIntersection.create;
  var tupleType = ZodTuple.create;
  var recordType = ZodRecord.create;
  var mapType = ZodMap.create;
  var setType = ZodSet.create;
  var functionType = ZodFunction.create;
  var lazyType = ZodLazy.create;
  var literalType = ZodLiteral.create;
  var enumType = ZodEnum.create;
  var nativeEnumType = ZodNativeEnum.create;
  var promiseType = ZodPromise.create;
  var effectsType = ZodEffects.create;
  var optionalType = ZodOptional.create;
  var nullableType = ZodNullable.create;
  var preprocessType = ZodEffects.createWithPreprocess;
  var pipelineType = ZodPipeline.create;
  var ostring = () => stringType().optional();
  var onumber = () => numberType().optional();
  var oboolean = () => booleanType().optional();
  var coerce = {
    string: (arg) => ZodString.create({ ...arg, coerce: true }),
    number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
    boolean: (arg) => ZodBoolean.create({
      ...arg,
      coerce: true
    }),
    bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
    date: (arg) => ZodDate.create({ ...arg, coerce: true })
  };
  var NEVER = INVALID;
  var z = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    defaultErrorMap: errorMap,
    setErrorMap,
    getErrorMap,
    makeIssue,
    EMPTY_PATH,
    addIssueToContext,
    ParseStatus,
    INVALID,
    DIRTY,
    OK,
    isAborted,
    isDirty,
    isValid,
    isAsync,
    get util() {
      return util;
    },
    get objectUtil() {
      return objectUtil;
    },
    ZodParsedType,
    getParsedType,
    ZodType,
    datetimeRegex,
    ZodString,
    ZodNumber,
    ZodBigInt,
    ZodBoolean,
    ZodDate,
    ZodSymbol,
    ZodUndefined,
    ZodNull,
    ZodAny,
    ZodUnknown,
    ZodNever,
    ZodVoid,
    ZodArray,
    ZodObject,
    ZodUnion,
    ZodDiscriminatedUnion,
    ZodIntersection,
    ZodTuple,
    ZodRecord,
    ZodMap,
    ZodSet,
    ZodFunction,
    ZodLazy,
    ZodLiteral,
    ZodEnum,
    ZodNativeEnum,
    ZodPromise,
    ZodEffects,
    ZodTransformer: ZodEffects,
    ZodOptional,
    ZodNullable,
    ZodDefault,
    ZodCatch,
    ZodNaN,
    BRAND,
    ZodBranded,
    ZodPipeline,
    ZodReadonly,
    custom,
    Schema: ZodType,
    ZodSchema: ZodType,
    late,
    get ZodFirstPartyTypeKind() {
      return ZodFirstPartyTypeKind;
    },
    coerce,
    any: anyType,
    array: arrayType,
    bigint: bigIntType,
    boolean: booleanType,
    date: dateType,
    discriminatedUnion: discriminatedUnionType,
    effect: effectsType,
    "enum": enumType,
    "function": functionType,
    "instanceof": instanceOfType,
    intersection: intersectionType,
    lazy: lazyType,
    literal: literalType,
    map: mapType,
    nan: nanType,
    nativeEnum: nativeEnumType,
    never: neverType,
    "null": nullType,
    nullable: nullableType,
    number: numberType,
    object: objectType,
    oboolean,
    onumber,
    optional: optionalType,
    ostring,
    pipeline: pipelineType,
    preprocess: preprocessType,
    promise: promiseType,
    record: recordType,
    set: setType,
    strictObject: strictObjectType,
    string: stringType,
    symbol: symbolType,
    transformer: effectsType,
    tuple: tupleType,
    "undefined": undefinedType,
    union: unionType,
    unknown: unknownType,
    "void": voidType,
    NEVER,
    ZodIssueCode,
    quotelessJson,
    ZodError
  });

  // node_modules/.pnpm/@ai-sdk+openai@1.3.0_zod@3.24.2/node_modules/@ai-sdk/openai/dist/index.mjs
  function convertToOpenAIChatMessages({
    prompt,
    useLegacyFunctionCalling = false,
    systemMessageMode = "system"
  }) {
    const messages = [];
    const warnings = [];
    for (const { role, content } of prompt) {
      switch (role) {
        case "system": {
          switch (systemMessageMode) {
            case "system": {
              messages.push({ role: "system", content });
              break;
            }
            case "developer": {
              messages.push({ role: "developer", content });
              break;
            }
            case "remove": {
              warnings.push({
                type: "other",
                message: "system messages are removed for this model"
              });
              break;
            }
            default: {
              const _exhaustiveCheck = systemMessageMode;
              throw new Error(
                `Unsupported system message mode: ${_exhaustiveCheck}`
              );
            }
          }
          break;
        }
        case "user": {
          if (content.length === 1 && content[0].type === "text") {
            messages.push({ role: "user", content: content[0].text });
            break;
          }
          messages.push({
            role: "user",
            content: content.map((part, index) => {
              var _a17, _b, _c, _d;
              switch (part.type) {
                case "text": {
                  return { type: "text", text: part.text };
                }
                case "image": {
                  return {
                    type: "image_url",
                    image_url: {
                      url: part.image instanceof URL ? part.image.toString() : `data:${(_a17 = part.mimeType) != null ? _a17 : "image/jpeg"};base64,${convertUint8ArrayToBase64(part.image)}`,
                      // OpenAI specific extension: image detail
                      detail: (_c = (_b = part.providerMetadata) == null ? void 0 : _b.openai) == null ? void 0 : _c.imageDetail
                    }
                  };
                }
                case "file": {
                  if (part.data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: "'File content parts with URL data' functionality not supported."
                    });
                  }
                  switch (part.mimeType) {
                    case "audio/wav": {
                      return {
                        type: "input_audio",
                        input_audio: { data: part.data, format: "wav" }
                      };
                    }
                    case "audio/mp3":
                    case "audio/mpeg": {
                      return {
                        type: "input_audio",
                        input_audio: { data: part.data, format: "mp3" }
                      };
                    }
                    case "application/pdf": {
                      return {
                        type: "file",
                        file: {
                          filename: (_d = part.filename) != null ? _d : `part-${index}.pdf`,
                          file_data: `data:application/pdf;base64,${part.data}`
                        }
                      };
                    }
                    default: {
                      throw new UnsupportedFunctionalityError({
                        functionality: `File content part type ${part.mimeType} in user messages`
                      });
                    }
                  }
                }
              }
            })
          });
          break;
        }
        case "assistant": {
          let text2 = "";
          const toolCalls = [];
          for (const part of content) {
            switch (part.type) {
              case "text": {
                text2 += part.text;
                break;
              }
              case "tool-call": {
                toolCalls.push({
                  id: part.toolCallId,
                  type: "function",
                  function: {
                    name: part.toolName,
                    arguments: JSON.stringify(part.args)
                  }
                });
                break;
              }
            }
          }
          if (useLegacyFunctionCalling) {
            if (toolCalls.length > 1) {
              throw new UnsupportedFunctionalityError({
                functionality: "useLegacyFunctionCalling with multiple tool calls in one message"
              });
            }
            messages.push({
              role: "assistant",
              content: text2,
              function_call: toolCalls.length > 0 ? toolCalls[0].function : void 0
            });
          } else {
            messages.push({
              role: "assistant",
              content: text2,
              tool_calls: toolCalls.length > 0 ? toolCalls : void 0
            });
          }
          break;
        }
        case "tool": {
          for (const toolResponse of content) {
            if (useLegacyFunctionCalling) {
              messages.push({
                role: "function",
                name: toolResponse.toolName,
                content: JSON.stringify(toolResponse.result)
              });
            } else {
              messages.push({
                role: "tool",
                tool_call_id: toolResponse.toolCallId,
                content: JSON.stringify(toolResponse.result)
              });
            }
          }
          break;
        }
        default: {
          const _exhaustiveCheck = role;
          throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
        }
      }
    }
    return { messages, warnings };
  }
  function mapOpenAIChatLogProbsOutput(logprobs) {
    var _a17, _b;
    return (_b = (_a17 = logprobs == null ? void 0 : logprobs.content) == null ? void 0 : _a17.map(({ token, logprob, top_logprobs }) => ({
      token,
      logprob,
      topLogprobs: top_logprobs ? top_logprobs.map(({ token: token2, logprob: logprob2 }) => ({
        token: token2,
        logprob: logprob2
      })) : []
    }))) != null ? _b : void 0;
  }
  function mapOpenAIFinishReason(finishReason) {
    switch (finishReason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content-filter";
      case "function_call":
      case "tool_calls":
        return "tool-calls";
      default:
        return "unknown";
    }
  }
  var openaiErrorDataSchema = z.object({
    error: z.object({
      message: z.string(),
      // The additional information below is handled loosely to support
      // OpenAI-compatible providers that have slightly different error
      // responses:
      type: z.string().nullish(),
      param: z.any().nullish(),
      code: z.union([z.string(), z.number()]).nullish()
    })
  });
  var openaiFailedResponseHandler = createJsonErrorResponseHandler({
    errorSchema: openaiErrorDataSchema,
    errorToMessage: (data) => data.error.message
  });
  function getResponseMetadata({
    id,
    model,
    created
  }) {
    return {
      id: id != null ? id : void 0,
      modelId: model != null ? model : void 0,
      timestamp: created != null ? new Date(created * 1e3) : void 0
    };
  }
  function prepareTools({
    mode,
    useLegacyFunctionCalling = false,
    structuredOutputs
  }) {
    var _a17;
    const tools = ((_a17 = mode.tools) == null ? void 0 : _a17.length) ? mode.tools : void 0;
    const toolWarnings = [];
    if (tools == null) {
      return { tools: void 0, tool_choice: void 0, toolWarnings };
    }
    const toolChoice = mode.toolChoice;
    if (useLegacyFunctionCalling) {
      const openaiFunctions = [];
      for (const tool of tools) {
        if (tool.type === "provider-defined") {
          toolWarnings.push({ type: "unsupported-tool", tool });
        } else {
          openaiFunctions.push({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          });
        }
      }
      if (toolChoice == null) {
        return {
          functions: openaiFunctions,
          function_call: void 0,
          toolWarnings
        };
      }
      const type2 = toolChoice.type;
      switch (type2) {
        case "auto":
        case "none":
        case void 0:
          return {
            functions: openaiFunctions,
            function_call: void 0,
            toolWarnings
          };
        case "required":
          throw new UnsupportedFunctionalityError({
            functionality: "useLegacyFunctionCalling and toolChoice: required"
          });
        default:
          return {
            functions: openaiFunctions,
            function_call: { name: toolChoice.toolName },
            toolWarnings
          };
      }
    }
    const openaiTools2 = [];
    for (const tool of tools) {
      if (tool.type === "provider-defined") {
        toolWarnings.push({ type: "unsupported-tool", tool });
      } else {
        openaiTools2.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: structuredOutputs ? true : void 0
          }
        });
      }
    }
    if (toolChoice == null) {
      return { tools: openaiTools2, tool_choice: void 0, toolWarnings };
    }
    const type = toolChoice.type;
    switch (type) {
      case "auto":
      case "none":
      case "required":
        return { tools: openaiTools2, tool_choice: type, toolWarnings };
      case "tool":
        return {
          tools: openaiTools2,
          tool_choice: {
            type: "function",
            function: {
              name: toolChoice.toolName
            }
          },
          toolWarnings
        };
      default: {
        const _exhaustiveCheck = type;
        throw new UnsupportedFunctionalityError({
          functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
        });
      }
    }
  }
  var OpenAIChatLanguageModel = class {
    constructor(modelId, settings, config) {
      this.specificationVersion = "v1";
      this.modelId = modelId;
      this.settings = settings;
      this.config = config;
    }
    get supportsStructuredOutputs() {
      var _a17;
      return (_a17 = this.settings.structuredOutputs) != null ? _a17 : isReasoningModel(this.modelId);
    }
    get defaultObjectGenerationMode() {
      if (isAudioModel(this.modelId)) {
        return "tool";
      }
      return this.supportsStructuredOutputs ? "json" : "tool";
    }
    get provider() {
      return this.config.provider;
    }
    get supportsImageUrls() {
      return !this.settings.downloadImages;
    }
    getArgs({
      mode,
      prompt,
      maxTokens,
      temperature,
      topP,
      topK,
      frequencyPenalty,
      presencePenalty,
      stopSequences,
      responseFormat,
      seed,
      providerMetadata
    }) {
      var _a17, _b, _c, _d, _e, _f, _g, _h;
      const type = mode.type;
      const warnings = [];
      if (topK != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "topK"
        });
      }
      if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !this.supportsStructuredOutputs) {
        warnings.push({
          type: "unsupported-setting",
          setting: "responseFormat",
          details: "JSON response format schema is only supported with structuredOutputs"
        });
      }
      const useLegacyFunctionCalling = this.settings.useLegacyFunctionCalling;
      if (useLegacyFunctionCalling && this.settings.parallelToolCalls === true) {
        throw new UnsupportedFunctionalityError({
          functionality: "useLegacyFunctionCalling with parallelToolCalls"
        });
      }
      if (useLegacyFunctionCalling && this.supportsStructuredOutputs) {
        throw new UnsupportedFunctionalityError({
          functionality: "structuredOutputs with useLegacyFunctionCalling"
        });
      }
      const { messages, warnings: messageWarnings } = convertToOpenAIChatMessages(
        {
          prompt,
          useLegacyFunctionCalling,
          systemMessageMode: getSystemMessageMode(this.modelId)
        }
      );
      warnings.push(...messageWarnings);
      const baseArgs = {
        // model id:
        model: this.modelId,
        // model specific settings:
        logit_bias: this.settings.logitBias,
        logprobs: this.settings.logprobs === true || typeof this.settings.logprobs === "number" ? true : void 0,
        top_logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
        user: this.settings.user,
        parallel_tool_calls: this.settings.parallelToolCalls,
        // standardized settings:
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs && responseFormat.schema != null ? {
          type: "json_schema",
          json_schema: {
            schema: responseFormat.schema,
            strict: true,
            name: (_a17 = responseFormat.name) != null ? _a17 : "response",
            description: responseFormat.description
          }
        } : { type: "json_object" } : void 0,
        stop: stopSequences,
        seed,
        // openai specific settings:
        // TODO remove in next major version; we auto-map maxTokens now
        max_completion_tokens: (_b = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _b.maxCompletionTokens,
        store: (_c = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _c.store,
        metadata: (_d = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _d.metadata,
        prediction: (_e = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _e.prediction,
        reasoning_effort: (_g = (_f = providerMetadata == null ? void 0 : providerMetadata.openai) == null ? void 0 : _f.reasoningEffort) != null ? _g : this.settings.reasoningEffort,
        // messages:
        messages
      };
      if (isReasoningModel(this.modelId)) {
        if (baseArgs.temperature != null) {
          baseArgs.temperature = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "temperature",
            details: "temperature is not supported for reasoning models"
          });
        }
        if (baseArgs.top_p != null) {
          baseArgs.top_p = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "topP",
            details: "topP is not supported for reasoning models"
          });
        }
        if (baseArgs.frequency_penalty != null) {
          baseArgs.frequency_penalty = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "frequencyPenalty",
            details: "frequencyPenalty is not supported for reasoning models"
          });
        }
        if (baseArgs.presence_penalty != null) {
          baseArgs.presence_penalty = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "presencePenalty",
            details: "presencePenalty is not supported for reasoning models"
          });
        }
        if (baseArgs.logit_bias != null) {
          baseArgs.logit_bias = void 0;
          warnings.push({
            type: "other",
            message: "logitBias is not supported for reasoning models"
          });
        }
        if (baseArgs.logprobs != null) {
          baseArgs.logprobs = void 0;
          warnings.push({
            type: "other",
            message: "logprobs is not supported for reasoning models"
          });
        }
        if (baseArgs.top_logprobs != null) {
          baseArgs.top_logprobs = void 0;
          warnings.push({
            type: "other",
            message: "topLogprobs is not supported for reasoning models"
          });
        }
        if (baseArgs.max_tokens != null) {
          if (baseArgs.max_completion_tokens == null) {
            baseArgs.max_completion_tokens = baseArgs.max_tokens;
          }
          baseArgs.max_tokens = void 0;
        }
      }
      switch (type) {
        case "regular": {
          const { tools, tool_choice, functions, function_call, toolWarnings } = prepareTools({
            mode,
            useLegacyFunctionCalling,
            structuredOutputs: this.supportsStructuredOutputs
          });
          return {
            args: {
              ...baseArgs,
              tools,
              tool_choice,
              functions,
              function_call
            },
            warnings: [...warnings, ...toolWarnings]
          };
        }
        case "object-json": {
          return {
            args: {
              ...baseArgs,
              response_format: this.supportsStructuredOutputs && mode.schema != null ? {
                type: "json_schema",
                json_schema: {
                  schema: mode.schema,
                  strict: true,
                  name: (_h = mode.name) != null ? _h : "response",
                  description: mode.description
                }
              } : { type: "json_object" }
            },
            warnings
          };
        }
        case "object-tool": {
          return {
            args: useLegacyFunctionCalling ? {
              ...baseArgs,
              function_call: {
                name: mode.tool.name
              },
              functions: [
                {
                  name: mode.tool.name,
                  description: mode.tool.description,
                  parameters: mode.tool.parameters
                }
              ]
            } : {
              ...baseArgs,
              tool_choice: {
                type: "function",
                function: { name: mode.tool.name }
              },
              tools: [
                {
                  type: "function",
                  function: {
                    name: mode.tool.name,
                    description: mode.tool.description,
                    parameters: mode.tool.parameters,
                    strict: this.supportsStructuredOutputs ? true : void 0
                  }
                }
              ]
            },
            warnings
          };
        }
        default: {
          const _exhaustiveCheck = type;
          throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
        }
      }
    }
    async doGenerate(options) {
      var _a17, _b, _c, _d, _e, _f, _g, _h;
      const { args: body, warnings } = this.getArgs(options);
      const {
        responseHeaders,
        value: response,
        rawValue: rawResponse
      } = await postJsonToApi({
        url: this.config.url({
          path: "/chat/completions",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          openaiChatResponseSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const { messages: rawPrompt, ...rawSettings } = body;
      const choice = response.choices[0];
      const completionTokenDetails = (_a17 = response.usage) == null ? void 0 : _a17.completion_tokens_details;
      const promptTokenDetails = (_b = response.usage) == null ? void 0 : _b.prompt_tokens_details;
      const providerMetadata = { openai: {} };
      if ((completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens) != null) {
        providerMetadata.openai.reasoningTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.reasoning_tokens;
      }
      if ((completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens) != null) {
        providerMetadata.openai.acceptedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.accepted_prediction_tokens;
      }
      if ((completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens) != null) {
        providerMetadata.openai.rejectedPredictionTokens = completionTokenDetails == null ? void 0 : completionTokenDetails.rejected_prediction_tokens;
      }
      if ((promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens) != null) {
        providerMetadata.openai.cachedPromptTokens = promptTokenDetails == null ? void 0 : promptTokenDetails.cached_tokens;
      }
      return {
        text: (_c = choice.message.content) != null ? _c : void 0,
        toolCalls: this.settings.useLegacyFunctionCalling && choice.message.function_call ? [
          {
            toolCallType: "function",
            toolCallId: generateId(),
            toolName: choice.message.function_call.name,
            args: choice.message.function_call.arguments
          }
        ] : (_d = choice.message.tool_calls) == null ? void 0 : _d.map((toolCall) => {
          var _a23;
          return {
            toolCallType: "function",
            toolCallId: (_a23 = toolCall.id) != null ? _a23 : generateId(),
            toolName: toolCall.function.name,
            args: toolCall.function.arguments
          };
        }),
        finishReason: mapOpenAIFinishReason(choice.finish_reason),
        usage: {
          promptTokens: (_f = (_e = response.usage) == null ? void 0 : _e.prompt_tokens) != null ? _f : NaN,
          completionTokens: (_h = (_g = response.usage) == null ? void 0 : _g.completion_tokens) != null ? _h : NaN
        },
        rawCall: { rawPrompt, rawSettings },
        rawResponse: { headers: responseHeaders, body: rawResponse },
        request: { body: JSON.stringify(body) },
        response: getResponseMetadata(response),
        warnings,
        logprobs: mapOpenAIChatLogProbsOutput(choice.logprobs),
        providerMetadata
      };
    }
    async doStream(options) {
      if (this.settings.simulateStreaming) {
        const result = await this.doGenerate(options);
        const simulatedStream = new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "response-metadata", ...result.response });
            if (result.text) {
              controller.enqueue({
                type: "text-delta",
                textDelta: result.text
              });
            }
            if (result.toolCalls) {
              for (const toolCall of result.toolCalls) {
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  argsTextDelta: toolCall.args
                });
                controller.enqueue({
                  type: "tool-call",
                  ...toolCall
                });
              }
            }
            controller.enqueue({
              type: "finish",
              finishReason: result.finishReason,
              usage: result.usage,
              logprobs: result.logprobs,
              providerMetadata: result.providerMetadata
            });
            controller.close();
          }
        });
        return {
          stream: simulatedStream,
          rawCall: result.rawCall,
          rawResponse: result.rawResponse,
          warnings: result.warnings
        };
      }
      const { args, warnings } = this.getArgs(options);
      const body = {
        ...args,
        stream: true,
        // only include stream_options when in strict compatibility mode:
        stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
      };
      const { responseHeaders, value: response } = await postJsonToApi({
        url: this.config.url({
          path: "/chat/completions",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createEventSourceResponseHandler(
          openaiChatChunkSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const { messages: rawPrompt, ...rawSettings } = args;
      const toolCalls = [];
      let finishReason = "unknown";
      let usage = {
        promptTokens: void 0,
        completionTokens: void 0
      };
      let logprobs;
      let isFirstChunk = true;
      const { useLegacyFunctionCalling } = this.settings;
      const providerMetadata = { openai: {} };
      return {
        stream: response.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              var _a17, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
              if (!chunk.success) {
                finishReason = "error";
                controller.enqueue({ type: "error", error: chunk.error });
                return;
              }
              const value = chunk.value;
              if ("error" in value) {
                finishReason = "error";
                controller.enqueue({ type: "error", error: value.error });
                return;
              }
              if (isFirstChunk) {
                isFirstChunk = false;
                controller.enqueue({
                  type: "response-metadata",
                  ...getResponseMetadata(value)
                });
              }
              if (value.usage != null) {
                const {
                  prompt_tokens,
                  completion_tokens,
                  prompt_tokens_details,
                  completion_tokens_details
                } = value.usage;
                usage = {
                  promptTokens: prompt_tokens != null ? prompt_tokens : void 0,
                  completionTokens: completion_tokens != null ? completion_tokens : void 0
                };
                if ((completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens) != null) {
                  providerMetadata.openai.reasoningTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.reasoning_tokens;
                }
                if ((completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens) != null) {
                  providerMetadata.openai.acceptedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.accepted_prediction_tokens;
                }
                if ((completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens) != null) {
                  providerMetadata.openai.rejectedPredictionTokens = completion_tokens_details == null ? void 0 : completion_tokens_details.rejected_prediction_tokens;
                }
                if ((prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens) != null) {
                  providerMetadata.openai.cachedPromptTokens = prompt_tokens_details == null ? void 0 : prompt_tokens_details.cached_tokens;
                }
              }
              const choice = value.choices[0];
              if ((choice == null ? void 0 : choice.finish_reason) != null) {
                finishReason = mapOpenAIFinishReason(choice.finish_reason);
              }
              if ((choice == null ? void 0 : choice.delta) == null) {
                return;
              }
              const delta = choice.delta;
              if (delta.content != null) {
                controller.enqueue({
                  type: "text-delta",
                  textDelta: delta.content
                });
              }
              const mappedLogprobs = mapOpenAIChatLogProbsOutput(
                choice == null ? void 0 : choice.logprobs
              );
              if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
                if (logprobs === void 0) logprobs = [];
                logprobs.push(...mappedLogprobs);
              }
              const mappedToolCalls = useLegacyFunctionCalling && delta.function_call != null ? [
                {
                  type: "function",
                  id: generateId(),
                  function: delta.function_call,
                  index: 0
                }
              ] : delta.tool_calls;
              if (mappedToolCalls != null) {
                for (const toolCallDelta of mappedToolCalls) {
                  const index = toolCallDelta.index;
                  if (toolCalls[index] == null) {
                    if (toolCallDelta.type !== "function") {
                      throw new InvalidResponseDataError({
                        data: toolCallDelta,
                        message: `Expected 'function' type.`
                      });
                    }
                    if (toolCallDelta.id == null) {
                      throw new InvalidResponseDataError({
                        data: toolCallDelta,
                        message: `Expected 'id' to be a string.`
                      });
                    }
                    if (((_a17 = toolCallDelta.function) == null ? void 0 : _a17.name) == null) {
                      throw new InvalidResponseDataError({
                        data: toolCallDelta,
                        message: `Expected 'function.name' to be a string.`
                      });
                    }
                    toolCalls[index] = {
                      id: toolCallDelta.id,
                      type: "function",
                      function: {
                        name: toolCallDelta.function.name,
                        arguments: (_b = toolCallDelta.function.arguments) != null ? _b : ""
                      },
                      hasFinished: false
                    };
                    const toolCall2 = toolCalls[index];
                    if (((_c = toolCall2.function) == null ? void 0 : _c.name) != null && ((_d = toolCall2.function) == null ? void 0 : _d.arguments) != null) {
                      if (toolCall2.function.arguments.length > 0) {
                        controller.enqueue({
                          type: "tool-call-delta",
                          toolCallType: "function",
                          toolCallId: toolCall2.id,
                          toolName: toolCall2.function.name,
                          argsTextDelta: toolCall2.function.arguments
                        });
                      }
                      if (isParsableJson(toolCall2.function.arguments)) {
                        controller.enqueue({
                          type: "tool-call",
                          toolCallType: "function",
                          toolCallId: (_e = toolCall2.id) != null ? _e : generateId(),
                          toolName: toolCall2.function.name,
                          args: toolCall2.function.arguments
                        });
                        toolCall2.hasFinished = true;
                      }
                    }
                    continue;
                  }
                  const toolCall = toolCalls[index];
                  if (toolCall.hasFinished) {
                    continue;
                  }
                  if (((_f = toolCallDelta.function) == null ? void 0 : _f.arguments) != null) {
                    toolCall.function.arguments += (_h = (_g = toolCallDelta.function) == null ? void 0 : _g.arguments) != null ? _h : "";
                  }
                  controller.enqueue({
                    type: "tool-call-delta",
                    toolCallType: "function",
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    argsTextDelta: (_i = toolCallDelta.function.arguments) != null ? _i : ""
                  });
                  if (((_j = toolCall.function) == null ? void 0 : _j.name) != null && ((_k = toolCall.function) == null ? void 0 : _k.arguments) != null && isParsableJson(toolCall.function.arguments)) {
                    controller.enqueue({
                      type: "tool-call",
                      toolCallType: "function",
                      toolCallId: (_l = toolCall.id) != null ? _l : generateId(),
                      toolName: toolCall.function.name,
                      args: toolCall.function.arguments
                    });
                    toolCall.hasFinished = true;
                  }
                }
              }
            },
            flush(controller) {
              var _a17, _b;
              controller.enqueue({
                type: "finish",
                finishReason,
                logprobs,
                usage: {
                  promptTokens: (_a17 = usage.promptTokens) != null ? _a17 : NaN,
                  completionTokens: (_b = usage.completionTokens) != null ? _b : NaN
                },
                ...providerMetadata != null ? { providerMetadata } : {}
              });
            }
          })
        ),
        rawCall: { rawPrompt, rawSettings },
        rawResponse: { headers: responseHeaders },
        request: { body: JSON.stringify(body) },
        warnings
      };
    }
  };
  var openaiTokenUsageSchema = z.object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    prompt_tokens_details: z.object({
      cached_tokens: z.number().nullish()
    }).nullish(),
    completion_tokens_details: z.object({
      reasoning_tokens: z.number().nullish(),
      accepted_prediction_tokens: z.number().nullish(),
      rejected_prediction_tokens: z.number().nullish()
    }).nullish()
  }).nullish();
  var openaiChatResponseSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        message: z.object({
          role: z.literal("assistant").nullish(),
          content: z.string().nullish(),
          function_call: z.object({
            arguments: z.string(),
            name: z.string()
          }).nullish(),
          tool_calls: z.array(
            z.object({
              id: z.string().nullish(),
              type: z.literal("function"),
              function: z.object({
                name: z.string(),
                arguments: z.string()
              })
            })
          ).nullish()
        }),
        index: z.number(),
        logprobs: z.object({
          content: z.array(
            z.object({
              token: z.string(),
              logprob: z.number(),
              top_logprobs: z.array(
                z.object({
                  token: z.string(),
                  logprob: z.number()
                })
              )
            })
          ).nullable()
        }).nullish(),
        finish_reason: z.string().nullish()
      })
    ),
    usage: openaiTokenUsageSchema
  });
  var openaiChatChunkSchema = z.union([
    z.object({
      id: z.string().nullish(),
      created: z.number().nullish(),
      model: z.string().nullish(),
      choices: z.array(
        z.object({
          delta: z.object({
            role: z.enum(["assistant"]).nullish(),
            content: z.string().nullish(),
            function_call: z.object({
              name: z.string().optional(),
              arguments: z.string().optional()
            }).nullish(),
            tool_calls: z.array(
              z.object({
                index: z.number(),
                id: z.string().nullish(),
                type: z.literal("function").optional(),
                function: z.object({
                  name: z.string().nullish(),
                  arguments: z.string().nullish()
                })
              })
            ).nullish()
          }).nullish(),
          logprobs: z.object({
            content: z.array(
              z.object({
                token: z.string(),
                logprob: z.number(),
                top_logprobs: z.array(
                  z.object({
                    token: z.string(),
                    logprob: z.number()
                  })
                )
              })
            ).nullable()
          }).nullish(),
          finish_reason: z.string().nullable().optional(),
          index: z.number()
        })
      ),
      usage: openaiTokenUsageSchema
    }),
    openaiErrorDataSchema
  ]);
  function isReasoningModel(modelId) {
    return modelId === "o1" || modelId.startsWith("o1-") || modelId === "o3" || modelId.startsWith("o3-");
  }
  function isAudioModel(modelId) {
    return modelId.startsWith("gpt-4o-audio-preview");
  }
  function getSystemMessageMode(modelId) {
    var _a17, _b;
    if (!isReasoningModel(modelId)) {
      return "system";
    }
    return (_b = (_a17 = reasoningModels[modelId]) == null ? void 0 : _a17.systemMessageMode) != null ? _b : "developer";
  }
  var reasoningModels = {
    "o1-mini": {
      systemMessageMode: "remove"
    },
    "o1-mini-2024-09-12": {
      systemMessageMode: "remove"
    },
    "o1-preview": {
      systemMessageMode: "remove"
    },
    "o1-preview-2024-09-12": {
      systemMessageMode: "remove"
    },
    "o3-mini": {
      systemMessageMode: "developer"
    },
    "o3-mini-2025-01-31": {
      systemMessageMode: "developer"
    }
  };
  function convertToOpenAICompletionPrompt({
    prompt,
    inputFormat,
    user = "user",
    assistant = "assistant"
  }) {
    if (inputFormat === "prompt" && prompt.length === 1 && prompt[0].role === "user" && prompt[0].content.length === 1 && prompt[0].content[0].type === "text") {
      return { prompt: prompt[0].content[0].text };
    }
    let text2 = "";
    if (prompt[0].role === "system") {
      text2 += `${prompt[0].content}

`;
      prompt = prompt.slice(1);
    }
    for (const { role, content } of prompt) {
      switch (role) {
        case "system": {
          throw new InvalidPromptError({
            message: "Unexpected system message in prompt: ${content}",
            prompt
          });
        }
        case "user": {
          const userMessage = content.map((part) => {
            switch (part.type) {
              case "text": {
                return part.text;
              }
              case "image": {
                throw new UnsupportedFunctionalityError({
                  functionality: "images"
                });
              }
            }
          }).join("");
          text2 += `${user}:
${userMessage}

`;
          break;
        }
        case "assistant": {
          const assistantMessage = content.map((part) => {
            switch (part.type) {
              case "text": {
                return part.text;
              }
              case "tool-call": {
                throw new UnsupportedFunctionalityError({
                  functionality: "tool-call messages"
                });
              }
            }
          }).join("");
          text2 += `${assistant}:
${assistantMessage}

`;
          break;
        }
        case "tool": {
          throw new UnsupportedFunctionalityError({
            functionality: "tool messages"
          });
        }
        default: {
          const _exhaustiveCheck = role;
          throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
        }
      }
    }
    text2 += `${assistant}:
`;
    return {
      prompt: text2,
      stopSequences: [`
${user}:`]
    };
  }
  function mapOpenAICompletionLogProbs(logprobs) {
    return logprobs == null ? void 0 : logprobs.tokens.map((token, index) => ({
      token,
      logprob: logprobs.token_logprobs[index],
      topLogprobs: logprobs.top_logprobs ? Object.entries(logprobs.top_logprobs[index]).map(
        ([token2, logprob]) => ({
          token: token2,
          logprob
        })
      ) : []
    }));
  }
  var OpenAICompletionLanguageModel = class {
    constructor(modelId, settings, config) {
      this.specificationVersion = "v1";
      this.defaultObjectGenerationMode = void 0;
      this.modelId = modelId;
      this.settings = settings;
      this.config = config;
    }
    get provider() {
      return this.config.provider;
    }
    getArgs({
      mode,
      inputFormat,
      prompt,
      maxTokens,
      temperature,
      topP,
      topK,
      frequencyPenalty,
      presencePenalty,
      stopSequences: userStopSequences,
      responseFormat,
      seed
    }) {
      var _a17;
      const type = mode.type;
      const warnings = [];
      if (topK != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "topK"
        });
      }
      if (responseFormat != null && responseFormat.type !== "text") {
        warnings.push({
          type: "unsupported-setting",
          setting: "responseFormat",
          details: "JSON response format is not supported."
        });
      }
      const { prompt: completionPrompt, stopSequences } = convertToOpenAICompletionPrompt({ prompt, inputFormat });
      const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
      const baseArgs = {
        // model id:
        model: this.modelId,
        // model specific settings:
        echo: this.settings.echo,
        logit_bias: this.settings.logitBias,
        logprobs: typeof this.settings.logprobs === "number" ? this.settings.logprobs : typeof this.settings.logprobs === "boolean" ? this.settings.logprobs ? 0 : void 0 : void 0,
        suffix: this.settings.suffix,
        user: this.settings.user,
        // standardized settings:
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,
        // prompt:
        prompt: completionPrompt,
        // stop sequences:
        stop: stop.length > 0 ? stop : void 0
      };
      switch (type) {
        case "regular": {
          if ((_a17 = mode.tools) == null ? void 0 : _a17.length) {
            throw new UnsupportedFunctionalityError({
              functionality: "tools"
            });
          }
          if (mode.toolChoice) {
            throw new UnsupportedFunctionalityError({
              functionality: "toolChoice"
            });
          }
          return { args: baseArgs, warnings };
        }
        case "object-json": {
          throw new UnsupportedFunctionalityError({
            functionality: "object-json mode"
          });
        }
        case "object-tool": {
          throw new UnsupportedFunctionalityError({
            functionality: "object-tool mode"
          });
        }
        default: {
          const _exhaustiveCheck = type;
          throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
        }
      }
    }
    async doGenerate(options) {
      const { args, warnings } = this.getArgs(options);
      const {
        responseHeaders,
        value: response,
        rawValue: rawResponse
      } = await postJsonToApi({
        url: this.config.url({
          path: "/completions",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body: args,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          openaiCompletionResponseSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const { prompt: rawPrompt, ...rawSettings } = args;
      const choice = response.choices[0];
      return {
        text: choice.text,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens
        },
        finishReason: mapOpenAIFinishReason(choice.finish_reason),
        logprobs: mapOpenAICompletionLogProbs(choice.logprobs),
        rawCall: { rawPrompt, rawSettings },
        rawResponse: { headers: responseHeaders, body: rawResponse },
        response: getResponseMetadata(response),
        warnings,
        request: { body: JSON.stringify(args) }
      };
    }
    async doStream(options) {
      const { args, warnings } = this.getArgs(options);
      const body = {
        ...args,
        stream: true,
        // only include stream_options when in strict compatibility mode:
        stream_options: this.config.compatibility === "strict" ? { include_usage: true } : void 0
      };
      const { responseHeaders, value: response } = await postJsonToApi({
        url: this.config.url({
          path: "/completions",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createEventSourceResponseHandler(
          openaiCompletionChunkSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const { prompt: rawPrompt, ...rawSettings } = args;
      let finishReason = "unknown";
      let usage = {
        promptTokens: Number.NaN,
        completionTokens: Number.NaN
      };
      let logprobs;
      let isFirstChunk = true;
      return {
        stream: response.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              if (!chunk.success) {
                finishReason = "error";
                controller.enqueue({ type: "error", error: chunk.error });
                return;
              }
              const value = chunk.value;
              if ("error" in value) {
                finishReason = "error";
                controller.enqueue({ type: "error", error: value.error });
                return;
              }
              if (isFirstChunk) {
                isFirstChunk = false;
                controller.enqueue({
                  type: "response-metadata",
                  ...getResponseMetadata(value)
                });
              }
              if (value.usage != null) {
                usage = {
                  promptTokens: value.usage.prompt_tokens,
                  completionTokens: value.usage.completion_tokens
                };
              }
              const choice = value.choices[0];
              if ((choice == null ? void 0 : choice.finish_reason) != null) {
                finishReason = mapOpenAIFinishReason(choice.finish_reason);
              }
              if ((choice == null ? void 0 : choice.text) != null) {
                controller.enqueue({
                  type: "text-delta",
                  textDelta: choice.text
                });
              }
              const mappedLogprobs = mapOpenAICompletionLogProbs(
                choice == null ? void 0 : choice.logprobs
              );
              if (mappedLogprobs == null ? void 0 : mappedLogprobs.length) {
                if (logprobs === void 0) logprobs = [];
                logprobs.push(...mappedLogprobs);
              }
            },
            flush(controller) {
              controller.enqueue({
                type: "finish",
                finishReason,
                logprobs,
                usage
              });
            }
          })
        ),
        rawCall: { rawPrompt, rawSettings },
        rawResponse: { headers: responseHeaders },
        warnings,
        request: { body: JSON.stringify(body) }
      };
    }
  };
  var openaiCompletionResponseSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
      z.object({
        text: z.string(),
        finish_reason: z.string(),
        logprobs: z.object({
          tokens: z.array(z.string()),
          token_logprobs: z.array(z.number()),
          top_logprobs: z.array(z.record(z.string(), z.number())).nullable()
        }).nullish()
      })
    ),
    usage: z.object({
      prompt_tokens: z.number(),
      completion_tokens: z.number()
    })
  });
  var openaiCompletionChunkSchema = z.union([
    z.object({
      id: z.string().nullish(),
      created: z.number().nullish(),
      model: z.string().nullish(),
      choices: z.array(
        z.object({
          text: z.string(),
          finish_reason: z.string().nullish(),
          index: z.number(),
          logprobs: z.object({
            tokens: z.array(z.string()),
            token_logprobs: z.array(z.number()),
            top_logprobs: z.array(z.record(z.string(), z.number())).nullable()
          }).nullish()
        })
      ),
      usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number()
      }).nullish()
    }),
    openaiErrorDataSchema
  ]);
  var OpenAIEmbeddingModel = class {
    constructor(modelId, settings, config) {
      this.specificationVersion = "v1";
      this.modelId = modelId;
      this.settings = settings;
      this.config = config;
    }
    get provider() {
      return this.config.provider;
    }
    get maxEmbeddingsPerCall() {
      var _a17;
      return (_a17 = this.settings.maxEmbeddingsPerCall) != null ? _a17 : 2048;
    }
    get supportsParallelCalls() {
      var _a17;
      return (_a17 = this.settings.supportsParallelCalls) != null ? _a17 : true;
    }
    async doEmbed({
      values,
      headers,
      abortSignal
    }) {
      if (values.length > this.maxEmbeddingsPerCall) {
        throw new TooManyEmbeddingValuesForCallError({
          provider: this.provider,
          modelId: this.modelId,
          maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
          values
        });
      }
      const { responseHeaders, value: response } = await postJsonToApi({
        url: this.config.url({
          path: "/embeddings",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), headers),
        body: {
          model: this.modelId,
          input: values,
          encoding_format: "float",
          dimensions: this.settings.dimensions,
          user: this.settings.user
        },
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          openaiTextEmbeddingResponseSchema
        ),
        abortSignal,
        fetch: this.config.fetch
      });
      return {
        embeddings: response.data.map((item) => item.embedding),
        usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
        rawResponse: { headers: responseHeaders }
      };
    }
  };
  var openaiTextEmbeddingResponseSchema = z.object({
    data: z.array(z.object({ embedding: z.array(z.number()) })),
    usage: z.object({ prompt_tokens: z.number() }).nullish()
  });
  var modelMaxImagesPerCall = {
    "dall-e-3": 1,
    "dall-e-2": 10
  };
  var OpenAIImageModel = class {
    constructor(modelId, settings, config) {
      this.modelId = modelId;
      this.settings = settings;
      this.config = config;
      this.specificationVersion = "v1";
    }
    get maxImagesPerCall() {
      var _a17, _b;
      return (_b = (_a17 = this.settings.maxImagesPerCall) != null ? _a17 : modelMaxImagesPerCall[this.modelId]) != null ? _b : 1;
    }
    get provider() {
      return this.config.provider;
    }
    async doGenerate({
      prompt,
      n,
      size,
      aspectRatio,
      seed,
      providerOptions,
      headers,
      abortSignal
    }) {
      var _a17, _b, _c, _d;
      const warnings = [];
      if (aspectRatio != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "aspectRatio",
          details: "This model does not support aspect ratio. Use `size` instead."
        });
      }
      if (seed != null) {
        warnings.push({ type: "unsupported-setting", setting: "seed" });
      }
      const currentDate = (_c = (_b = (_a17 = this.config._internal) == null ? void 0 : _a17.currentDate) == null ? void 0 : _b.call(_a17)) != null ? _c : /* @__PURE__ */ new Date();
      const { value: response, responseHeaders } = await postJsonToApi({
        url: this.config.url({
          path: "/images/generations",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), headers),
        body: {
          model: this.modelId,
          prompt,
          n,
          size,
          ...(_d = providerOptions.openai) != null ? _d : {},
          response_format: "b64_json"
        },
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          openaiImageResponseSchema
        ),
        abortSignal,
        fetch: this.config.fetch
      });
      return {
        images: response.data.map((item) => item.b64_json),
        warnings,
        response: {
          timestamp: currentDate,
          modelId: this.modelId,
          headers: responseHeaders
        }
      };
    }
  };
  var openaiImageResponseSchema = z.object({
    data: z.array(z.object({ b64_json: z.string() }))
  });
  function convertToOpenAIResponsesMessages({
    prompt,
    systemMessageMode
  }) {
    const messages = [];
    const warnings = [];
    for (const { role, content } of prompt) {
      switch (role) {
        case "system": {
          switch (systemMessageMode) {
            case "system": {
              messages.push({ role: "system", content });
              break;
            }
            case "developer": {
              messages.push({ role: "developer", content });
              break;
            }
            case "remove": {
              warnings.push({
                type: "other",
                message: "system messages are removed for this model"
              });
              break;
            }
            default: {
              const _exhaustiveCheck = systemMessageMode;
              throw new Error(
                `Unsupported system message mode: ${_exhaustiveCheck}`
              );
            }
          }
          break;
        }
        case "user": {
          messages.push({
            role: "user",
            content: content.map((part, index) => {
              var _a17, _b, _c, _d;
              switch (part.type) {
                case "text": {
                  return { type: "input_text", text: part.text };
                }
                case "image": {
                  return {
                    type: "input_image",
                    image_url: part.image instanceof URL ? part.image.toString() : `data:${(_a17 = part.mimeType) != null ? _a17 : "image/jpeg"};base64,${convertUint8ArrayToBase64(part.image)}`,
                    // OpenAI specific extension: image detail
                    detail: (_c = (_b = part.providerMetadata) == null ? void 0 : _b.openai) == null ? void 0 : _c.imageDetail
                  };
                }
                case "file": {
                  if (part.data instanceof URL) {
                    throw new UnsupportedFunctionalityError({
                      functionality: "File URLs in user messages"
                    });
                  }
                  switch (part.mimeType) {
                    case "application/pdf": {
                      return {
                        type: "input_file",
                        filename: (_d = part.filename) != null ? _d : `part-${index}.pdf`,
                        file_data: `data:application/pdf;base64,${part.data}`
                      };
                    }
                    default: {
                      throw new UnsupportedFunctionalityError({
                        functionality: "Only PDF files are supported in user messages"
                      });
                    }
                  }
                }
              }
            })
          });
          break;
        }
        case "assistant": {
          for (const part of content) {
            switch (part.type) {
              case "text": {
                messages.push({
                  role: "assistant",
                  content: [{ type: "output_text", text: part.text }]
                });
                break;
              }
              case "tool-call": {
                messages.push({
                  type: "function_call",
                  call_id: part.toolCallId,
                  name: part.toolName,
                  arguments: JSON.stringify(part.args)
                });
                break;
              }
            }
          }
          break;
        }
        case "tool": {
          for (const part of content) {
            messages.push({
              type: "function_call_output",
              call_id: part.toolCallId,
              output: JSON.stringify(part.result)
            });
          }
          break;
        }
        default: {
          const _exhaustiveCheck = role;
          throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
        }
      }
    }
    return { messages, warnings };
  }
  function mapOpenAIResponseFinishReason({
    finishReason,
    hasToolCalls
  }) {
    switch (finishReason) {
      case void 0:
      case null:
        return hasToolCalls ? "tool-calls" : "stop";
      case "max_output_tokens":
        return "length";
      case "content_filter":
        return "content-filter";
      default:
        return hasToolCalls ? "tool-calls" : "unknown";
    }
  }
  function prepareResponsesTools({
    mode,
    strict
  }) {
    var _a17;
    const tools = ((_a17 = mode.tools) == null ? void 0 : _a17.length) ? mode.tools : void 0;
    const toolWarnings = [];
    if (tools == null) {
      return { tools: void 0, tool_choice: void 0, toolWarnings };
    }
    const toolChoice = mode.toolChoice;
    const openaiTools2 = [];
    for (const tool of tools) {
      switch (tool.type) {
        case "function":
          openaiTools2.push({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: strict ? true : void 0
          });
          break;
        case "provider-defined":
          switch (tool.id) {
            case "openai.web_search_preview":
              openaiTools2.push({
                type: "web_search_preview",
                search_context_size: tool.args.searchContextSize,
                user_location: tool.args.userLocation
              });
              break;
            default:
              toolWarnings.push({ type: "unsupported-tool", tool });
              break;
          }
          break;
        default:
          toolWarnings.push({ type: "unsupported-tool", tool });
          break;
      }
    }
    if (toolChoice == null) {
      return { tools: openaiTools2, tool_choice: void 0, toolWarnings };
    }
    const type = toolChoice.type;
    switch (type) {
      case "auto":
      case "none":
      case "required":
        return { tools: openaiTools2, tool_choice: type, toolWarnings };
      case "tool":
        return {
          tools: openaiTools2,
          tool_choice: {
            type: "function",
            name: toolChoice.toolName
          },
          toolWarnings
        };
      default: {
        const _exhaustiveCheck = type;
        throw new UnsupportedFunctionalityError({
          functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
        });
      }
    }
  }
  var OpenAIResponsesLanguageModel = class {
    constructor(modelId, config) {
      this.specificationVersion = "v1";
      this.defaultObjectGenerationMode = "json";
      this.modelId = modelId;
      this.config = config;
    }
    get provider() {
      return this.config.provider;
    }
    getArgs({
      mode,
      maxTokens,
      temperature,
      stopSequences,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      seed,
      prompt,
      providerMetadata,
      responseFormat
    }) {
      var _a17, _b, _c, _d;
      const warnings = [];
      const modelConfig = getResponsesModelConfig(this.modelId);
      const type = mode.type;
      if (topK != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "topK"
        });
      }
      if (seed != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "seed"
        });
      }
      if (presencePenalty != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "presencePenalty"
        });
      }
      if (frequencyPenalty != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "frequencyPenalty"
        });
      }
      if (stopSequences != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "stopSequences"
        });
      }
      const { messages, warnings: messageWarnings } = convertToOpenAIResponsesMessages({
        prompt,
        systemMessageMode: modelConfig.systemMessageMode
      });
      warnings.push(...messageWarnings);
      const parsedProviderOptions = providerMetadata != null ? safeValidateTypes({
        value: providerMetadata,
        schema: providerOptionsSchema
      }) : { success: true, value: void 0 };
      if (!parsedProviderOptions.success) {
        throw new InvalidArgumentError({
          argument: "providerOptions",
          message: "invalid provider options",
          cause: parsedProviderOptions.error
        });
      }
      const openaiOptions = (_a17 = parsedProviderOptions.value) == null ? void 0 : _a17.openai;
      const isStrict = (_b = openaiOptions == null ? void 0 : openaiOptions.strictSchemas) != null ? _b : true;
      const baseArgs = {
        model: this.modelId,
        input: messages,
        temperature,
        top_p: topP,
        max_output_tokens: maxTokens,
        ...(responseFormat == null ? void 0 : responseFormat.type) === "json" && {
          text: {
            format: responseFormat.schema != null ? {
              type: "json_schema",
              strict: isStrict,
              name: (_c = responseFormat.name) != null ? _c : "response",
              description: responseFormat.description,
              schema: responseFormat.schema
            } : { type: "json_object" }
          }
        },
        // provider options:
        metadata: openaiOptions == null ? void 0 : openaiOptions.metadata,
        parallel_tool_calls: openaiOptions == null ? void 0 : openaiOptions.parallelToolCalls,
        previous_response_id: openaiOptions == null ? void 0 : openaiOptions.previousResponseId,
        store: openaiOptions == null ? void 0 : openaiOptions.store,
        user: openaiOptions == null ? void 0 : openaiOptions.user,
        // model-specific settings:
        ...modelConfig.isReasoningModel && (openaiOptions == null ? void 0 : openaiOptions.reasoningEffort) != null && {
          reasoning: { effort: openaiOptions == null ? void 0 : openaiOptions.reasoningEffort }
        },
        ...modelConfig.requiredAutoTruncation && {
          truncation: "auto"
        }
      };
      if (modelConfig.isReasoningModel) {
        if (baseArgs.temperature != null) {
          baseArgs.temperature = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "temperature",
            details: "temperature is not supported for reasoning models"
          });
        }
        if (baseArgs.top_p != null) {
          baseArgs.top_p = void 0;
          warnings.push({
            type: "unsupported-setting",
            setting: "topP",
            details: "topP is not supported for reasoning models"
          });
        }
      }
      switch (type) {
        case "regular": {
          const { tools, tool_choice, toolWarnings } = prepareResponsesTools({
            mode,
            strict: isStrict
            // TODO support provider options on tools
          });
          return {
            args: {
              ...baseArgs,
              tools,
              tool_choice
            },
            warnings: [...warnings, ...toolWarnings]
          };
        }
        case "object-json": {
          return {
            args: {
              ...baseArgs,
              text: {
                format: mode.schema != null ? {
                  type: "json_schema",
                  strict: isStrict,
                  name: (_d = mode.name) != null ? _d : "response",
                  description: mode.description,
                  schema: mode.schema
                } : { type: "json_object" }
              }
            },
            warnings
          };
        }
        case "object-tool": {
          return {
            args: {
              ...baseArgs,
              tool_choice: { type: "function", name: mode.tool.name },
              tools: [
                {
                  type: "function",
                  name: mode.tool.name,
                  description: mode.tool.description,
                  parameters: mode.tool.parameters,
                  strict: isStrict
                }
              ]
            },
            warnings
          };
        }
        default: {
          const _exhaustiveCheck = type;
          throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
        }
      }
    }
    async doGenerate(options) {
      var _a17, _b, _c, _d, _e;
      const { args: body, warnings } = this.getArgs(options);
      const {
        responseHeaders,
        value: response,
        rawValue: rawResponse
      } = await postJsonToApi({
        url: this.config.url({
          path: "/responses",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body,
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          z.object({
            id: z.string(),
            created_at: z.number(),
            model: z.string(),
            output: z.array(
              z.discriminatedUnion("type", [
                z.object({
                  type: z.literal("message"),
                  role: z.literal("assistant"),
                  content: z.array(
                    z.object({
                      type: z.literal("output_text"),
                      text: z.string(),
                      annotations: z.array(
                        z.object({
                          type: z.literal("url_citation"),
                          start_index: z.number(),
                          end_index: z.number(),
                          url: z.string(),
                          title: z.string()
                        })
                      )
                    })
                  )
                }),
                z.object({
                  type: z.literal("function_call"),
                  call_id: z.string(),
                  name: z.string(),
                  arguments: z.string()
                }),
                z.object({
                  type: z.literal("web_search_call")
                }),
                z.object({
                  type: z.literal("computer_call")
                }),
                z.object({
                  type: z.literal("reasoning")
                })
              ])
            ),
            incomplete_details: z.object({ reason: z.string() }).nullable(),
            usage: usageSchema
          })
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const outputTextElements = response.output.filter((output) => output.type === "message").flatMap((output) => output.content).filter((content) => content.type === "output_text");
      const toolCalls = response.output.filter((output) => output.type === "function_call").map((output) => ({
        toolCallType: "function",
        toolCallId: output.call_id,
        toolName: output.name,
        args: output.arguments
      }));
      return {
        text: outputTextElements.map((content) => content.text).join("\n"),
        sources: outputTextElements.flatMap(
          (content) => content.annotations.map((annotation) => {
            var _a23, _b2, _c2;
            return {
              sourceType: "url",
              id: (_c2 = (_b2 = (_a23 = this.config).generateId) == null ? void 0 : _b2.call(_a23)) != null ? _c2 : generateId(),
              url: annotation.url,
              title: annotation.title
            };
          })
        ),
        finishReason: mapOpenAIResponseFinishReason({
          finishReason: (_a17 = response.incomplete_details) == null ? void 0 : _a17.reason,
          hasToolCalls: toolCalls.length > 0
        }),
        toolCalls: toolCalls.length > 0 ? toolCalls : void 0,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens
        },
        rawCall: {
          rawPrompt: void 0,
          rawSettings: {}
        },
        rawResponse: {
          headers: responseHeaders,
          body: rawResponse
        },
        request: {
          body: JSON.stringify(body)
        },
        response: {
          id: response.id,
          timestamp: new Date(response.created_at * 1e3),
          modelId: response.model
        },
        providerMetadata: {
          openai: {
            responseId: response.id,
            cachedPromptTokens: (_c = (_b = response.usage.input_tokens_details) == null ? void 0 : _b.cached_tokens) != null ? _c : null,
            reasoningTokens: (_e = (_d = response.usage.output_tokens_details) == null ? void 0 : _d.reasoning_tokens) != null ? _e : null
          }
        },
        warnings
      };
    }
    async doStream(options) {
      const { args: body, warnings } = this.getArgs(options);
      const { responseHeaders, value: response } = await postJsonToApi({
        url: this.config.url({
          path: "/responses",
          modelId: this.modelId
        }),
        headers: combineHeaders(this.config.headers(), options.headers),
        body: {
          ...body,
          stream: true
        },
        failedResponseHandler: openaiFailedResponseHandler,
        successfulResponseHandler: createEventSourceResponseHandler(
          openaiResponsesChunkSchema
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch
      });
      const self2 = this;
      let finishReason = "unknown";
      let promptTokens = NaN;
      let completionTokens = NaN;
      let cachedPromptTokens = null;
      let reasoningTokens = null;
      let responseId = null;
      const ongoingToolCalls = {};
      let hasToolCalls = false;
      return {
        stream: response.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              var _a17, _b, _c, _d, _e, _f, _g, _h;
              if (!chunk.success) {
                finishReason = "error";
                controller.enqueue({ type: "error", error: chunk.error });
                return;
              }
              const value = chunk.value;
              if (isResponseOutputItemAddedChunk(value)) {
                if (value.item.type === "function_call") {
                  ongoingToolCalls[value.output_index] = {
                    toolName: value.item.name,
                    toolCallId: value.item.call_id
                  };
                  controller.enqueue({
                    type: "tool-call-delta",
                    toolCallType: "function",
                    toolCallId: value.item.call_id,
                    toolName: value.item.name,
                    argsTextDelta: value.item.arguments
                  });
                }
              } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
                const toolCall = ongoingToolCalls[value.output_index];
                if (toolCall != null) {
                  controller.enqueue({
                    type: "tool-call-delta",
                    toolCallType: "function",
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    argsTextDelta: value.delta
                  });
                }
              } else if (isResponseCreatedChunk(value)) {
                responseId = value.response.id;
                controller.enqueue({
                  type: "response-metadata",
                  id: value.response.id,
                  timestamp: new Date(value.response.created_at * 1e3),
                  modelId: value.response.model
                });
              } else if (isTextDeltaChunk(value)) {
                controller.enqueue({
                  type: "text-delta",
                  textDelta: value.delta
                });
              } else if (isResponseOutputItemDoneChunk(value) && value.item.type === "function_call") {
                ongoingToolCalls[value.output_index] = void 0;
                hasToolCalls = true;
                controller.enqueue({
                  type: "tool-call",
                  toolCallType: "function",
                  toolCallId: value.item.call_id,
                  toolName: value.item.name,
                  args: value.item.arguments
                });
              } else if (isResponseFinishedChunk(value)) {
                finishReason = mapOpenAIResponseFinishReason({
                  finishReason: (_a17 = value.response.incomplete_details) == null ? void 0 : _a17.reason,
                  hasToolCalls
                });
                promptTokens = value.response.usage.input_tokens;
                completionTokens = value.response.usage.output_tokens;
                cachedPromptTokens = (_c = (_b = value.response.usage.input_tokens_details) == null ? void 0 : _b.cached_tokens) != null ? _c : cachedPromptTokens;
                reasoningTokens = (_e = (_d = value.response.usage.output_tokens_details) == null ? void 0 : _d.reasoning_tokens) != null ? _e : reasoningTokens;
              } else if (isResponseAnnotationAddedChunk(value)) {
                controller.enqueue({
                  type: "source",
                  source: {
                    sourceType: "url",
                    id: (_h = (_g = (_f = self2.config).generateId) == null ? void 0 : _g.call(_f)) != null ? _h : generateId(),
                    url: value.annotation.url,
                    title: value.annotation.title
                  }
                });
              }
            },
            flush(controller) {
              controller.enqueue({
                type: "finish",
                finishReason,
                usage: { promptTokens, completionTokens },
                ...(cachedPromptTokens != null || reasoningTokens != null) && {
                  providerMetadata: {
                    openai: {
                      responseId,
                      cachedPromptTokens,
                      reasoningTokens
                    }
                  }
                }
              });
            }
          })
        ),
        rawCall: {
          rawPrompt: void 0,
          rawSettings: {}
        },
        rawResponse: { headers: responseHeaders },
        request: { body: JSON.stringify(body) },
        warnings
      };
    }
  };
  var usageSchema = z.object({
    input_tokens: z.number(),
    input_tokens_details: z.object({ cached_tokens: z.number().nullish() }).nullish(),
    output_tokens: z.number(),
    output_tokens_details: z.object({ reasoning_tokens: z.number().nullish() }).nullish()
  });
  var textDeltaChunkSchema = z.object({
    type: z.literal("response.output_text.delta"),
    delta: z.string()
  });
  var responseFinishedChunkSchema = z.object({
    type: z.enum(["response.completed", "response.incomplete"]),
    response: z.object({
      incomplete_details: z.object({ reason: z.string() }).nullish(),
      usage: usageSchema
    })
  });
  var responseCreatedChunkSchema = z.object({
    type: z.literal("response.created"),
    response: z.object({
      id: z.string(),
      created_at: z.number(),
      model: z.string()
    })
  });
  var responseOutputItemDoneSchema = z.object({
    type: z.literal("response.output_item.done"),
    output_index: z.number(),
    item: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("message")
      }),
      z.object({
        type: z.literal("function_call"),
        id: z.string(),
        call_id: z.string(),
        name: z.string(),
        arguments: z.string(),
        status: z.literal("completed")
      })
    ])
  });
  var responseFunctionCallArgumentsDeltaSchema = z.object({
    type: z.literal("response.function_call_arguments.delta"),
    item_id: z.string(),
    output_index: z.number(),
    delta: z.string()
  });
  var responseOutputItemAddedSchema = z.object({
    type: z.literal("response.output_item.added"),
    output_index: z.number(),
    item: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("message")
      }),
      z.object({
        type: z.literal("function_call"),
        id: z.string(),
        call_id: z.string(),
        name: z.string(),
        arguments: z.string()
      })
    ])
  });
  var responseAnnotationAddedSchema = z.object({
    type: z.literal("response.output_text.annotation.added"),
    annotation: z.object({
      type: z.literal("url_citation"),
      url: z.string(),
      title: z.string()
    })
  });
  var openaiResponsesChunkSchema = z.union([
    textDeltaChunkSchema,
    responseFinishedChunkSchema,
    responseCreatedChunkSchema,
    responseOutputItemDoneSchema,
    responseFunctionCallArgumentsDeltaSchema,
    responseOutputItemAddedSchema,
    responseAnnotationAddedSchema,
    z.object({ type: z.string() }).passthrough()
    // fallback for unknown chunks
  ]);
  function isTextDeltaChunk(chunk) {
    return chunk.type === "response.output_text.delta";
  }
  function isResponseOutputItemDoneChunk(chunk) {
    return chunk.type === "response.output_item.done";
  }
  function isResponseFinishedChunk(chunk) {
    return chunk.type === "response.completed" || chunk.type === "response.incomplete";
  }
  function isResponseCreatedChunk(chunk) {
    return chunk.type === "response.created";
  }
  function isResponseFunctionCallArgumentsDeltaChunk(chunk) {
    return chunk.type === "response.function_call_arguments.delta";
  }
  function isResponseOutputItemAddedChunk(chunk) {
    return chunk.type === "response.output_item.added";
  }
  function isResponseAnnotationAddedChunk(chunk) {
    return chunk.type === "response.output_text.annotation.added";
  }
  var providerOptionsSchema = z.object({
    openai: z.object({
      metadata: z.any().nullish(),
      parallelToolCalls: z.boolean().nullish(),
      previousResponseId: z.string().nullish(),
      store: z.boolean().nullish(),
      user: z.string().nullish(),
      reasoningEffort: z.string().nullish(),
      strictSchemas: z.boolean().nullish()
    }).nullish()
  });
  function getResponsesModelConfig(modelId) {
    if (modelId.startsWith("o")) {
      if (modelId.startsWith("o1-mini") || modelId.startsWith("o1-preview")) {
        return {
          isReasoningModel: true,
          systemMessageMode: "remove",
          requiredAutoTruncation: false
        };
      }
      return {
        isReasoningModel: true,
        systemMessageMode: "developer",
        requiredAutoTruncation: false
      };
    }
    return {
      isReasoningModel: false,
      systemMessageMode: "system",
      requiredAutoTruncation: false
    };
  }
  var WebSearchPreviewParameters = z.object({});
  function webSearchPreviewTool({
    searchContextSize,
    userLocation
  } = {}) {
    return {
      type: "provider-defined",
      id: "openai.web_search_preview",
      args: {
        searchContextSize,
        userLocation
      },
      parameters: WebSearchPreviewParameters
    };
  }
  var openaiTools = {
    webSearchPreview: webSearchPreviewTool
  };
  function createOpenAI(options = {}) {
    var _a17, _b, _c;
    const baseURL = (_a17 = withoutTrailingSlash(options.baseURL)) != null ? _a17 : "https://api.openai.com/v1";
    const compatibility = (_b = options.compatibility) != null ? _b : "compatible";
    const providerName = (_c = options.name) != null ? _c : "openai";
    const getHeaders = () => ({
      Authorization: `Bearer ${loadApiKey({
        apiKey: options.apiKey,
        environmentVariableName: "OPENAI_API_KEY",
        description: "OpenAI"
      })}`,
      "OpenAI-Organization": options.organization,
      "OpenAI-Project": options.project,
      ...options.headers
    });
    const createChatModel = (modelId, settings = {}) => new OpenAIChatLanguageModel(modelId, settings, {
      provider: `${providerName}.chat`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch
    });
    const createCompletionModel = (modelId, settings = {}) => new OpenAICompletionLanguageModel(modelId, settings, {
      provider: `${providerName}.completion`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch
    });
    const createEmbeddingModel = (modelId, settings = {}) => new OpenAIEmbeddingModel(modelId, settings, {
      provider: `${providerName}.embedding`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch
    });
    const createImageModel = (modelId, settings = {}) => new OpenAIImageModel(modelId, settings, {
      provider: `${providerName}.image`,
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch
    });
    const createLanguageModel = (modelId, settings) => {
      if (new.target) {
        throw new Error(
          "The OpenAI model function cannot be called with the new keyword."
        );
      }
      if (modelId === "gpt-3.5-turbo-instruct") {
        return createCompletionModel(
          modelId,
          settings
        );
      }
      return createChatModel(modelId, settings);
    };
    const createResponsesModel = (modelId) => {
      return new OpenAIResponsesLanguageModel(modelId, {
        provider: `${providerName}.responses`,
        url: ({ path }) => `${baseURL}${path}`,
        headers: getHeaders,
        fetch: options.fetch
      });
    };
    const provider = function(modelId, settings) {
      return createLanguageModel(modelId, settings);
    };
    provider.languageModel = createLanguageModel;
    provider.chat = createChatModel;
    provider.completion = createCompletionModel;
    provider.responses = createResponsesModel;
    provider.embedding = createEmbeddingModel;
    provider.textEmbedding = createEmbeddingModel;
    provider.textEmbeddingModel = createEmbeddingModel;
    provider.image = createImageModel;
    provider.imageModel = createImageModel;
    provider.tools = openaiTools;
    return provider;
  }
  var openai = createOpenAI({
    compatibility: "strict"
    // strict for OpenAI API
  });

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/Options.js
  var ignoreOverride = Symbol("Let zodToJsonSchema decide on which parser to use");
  var defaultOptions = {
    name: void 0,
    $refStrategy: "root",
    basePath: ["#"],
    effectStrategy: "input",
    pipeStrategy: "all",
    dateStrategy: "format:date-time",
    mapStrategy: "entries",
    removeAdditionalStrategy: "passthrough",
    allowedAdditionalProperties: true,
    rejectedAdditionalProperties: false,
    definitionPath: "definitions",
    target: "jsonSchema7",
    strictUnions: false,
    definitions: {},
    errorMessages: false,
    markdownDescription: false,
    patternStrategy: "escape",
    applyRegexFlags: false,
    emailStrategy: "format:email",
    base64Strategy: "contentEncoding:base64",
    nameStrategy: "ref"
  };
  var getDefaultOptions = (options) => typeof options === "string" ? {
    ...defaultOptions,
    name: options
  } : {
    ...defaultOptions,
    ...options
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/Refs.js
  var getRefs = (options) => {
    const _options = getDefaultOptions(options);
    const currentPath = _options.name !== void 0 ? [..._options.basePath, _options.definitionPath, _options.name] : _options.basePath;
    return {
      ..._options,
      currentPath,
      propertyPath: void 0,
      seen: new Map(Object.entries(_options.definitions).map(([name17, def]) => [
        def._def,
        {
          def: def._def,
          path: [..._options.basePath, _options.definitionPath, name17],
          // Resolution of references will be forced even though seen, so it's ok that the schema is undefined here for now.
          jsonSchema: void 0
        }
      ]))
    };
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/errorMessages.js
  function addErrorMessage(res, key, errorMessage, refs) {
    if (!refs?.errorMessages)
      return;
    if (errorMessage) {
      res.errorMessage = {
        ...res.errorMessage,
        [key]: errorMessage
      };
    }
  }
  function setResponseValueAndErrors(res, key, value, errorMessage, refs) {
    res[key] = value;
    addErrorMessage(res, key, errorMessage, refs);
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/any.js
  function parseAnyDef() {
    return {};
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/array.js
  function parseArrayDef(def, refs) {
    const res = {
      type: "array"
    };
    if (def.type?._def && def.type?._def?.typeName !== ZodFirstPartyTypeKind.ZodAny) {
      res.items = parseDef(def.type._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items"]
      });
    }
    if (def.minLength) {
      setResponseValueAndErrors(res, "minItems", def.minLength.value, def.minLength.message, refs);
    }
    if (def.maxLength) {
      setResponseValueAndErrors(res, "maxItems", def.maxLength.value, def.maxLength.message, refs);
    }
    if (def.exactLength) {
      setResponseValueAndErrors(res, "minItems", def.exactLength.value, def.exactLength.message, refs);
      setResponseValueAndErrors(res, "maxItems", def.exactLength.value, def.exactLength.message, refs);
    }
    return res;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/bigint.js
  function parseBigintDef(def, refs) {
    const res = {
      type: "integer",
      format: "int64"
    };
    if (!def.checks)
      return res;
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          if (refs.target === "jsonSchema7") {
            if (check.inclusive) {
              setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
            } else {
              setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
            }
          } else {
            if (!check.inclusive) {
              res.exclusiveMinimum = true;
            }
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          }
          break;
        case "max":
          if (refs.target === "jsonSchema7") {
            if (check.inclusive) {
              setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
            } else {
              setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
            }
          } else {
            if (!check.inclusive) {
              res.exclusiveMaximum = true;
            }
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          }
          break;
        case "multipleOf":
          setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
          break;
      }
    }
    return res;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/boolean.js
  function parseBooleanDef() {
    return {
      type: "boolean"
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/branded.js
  function parseBrandedDef(_def, refs) {
    return parseDef(_def.type._def, refs);
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/catch.js
  var parseCatchDef = (def, refs) => {
    return parseDef(def.innerType._def, refs);
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/date.js
  function parseDateDef(def, refs, overrideDateStrategy) {
    const strategy = overrideDateStrategy ?? refs.dateStrategy;
    if (Array.isArray(strategy)) {
      return {
        anyOf: strategy.map((item, i) => parseDateDef(def, refs, item))
      };
    }
    switch (strategy) {
      case "string":
      case "format:date-time":
        return {
          type: "string",
          format: "date-time"
        };
      case "format:date":
        return {
          type: "string",
          format: "date"
        };
      case "integer":
        return integerDateParser(def, refs);
    }
  }
  var integerDateParser = (def, refs) => {
    const res = {
      type: "integer",
      format: "unix-time"
    };
    if (refs.target === "openApi3") {
      return res;
    }
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          setResponseValueAndErrors(
            res,
            "minimum",
            check.value,
            // This is in milliseconds
            check.message,
            refs
          );
          break;
        case "max":
          setResponseValueAndErrors(
            res,
            "maximum",
            check.value,
            // This is in milliseconds
            check.message,
            refs
          );
          break;
      }
    }
    return res;
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/default.js
  function parseDefaultDef(_def, refs) {
    return {
      ...parseDef(_def.innerType._def, refs),
      default: _def.defaultValue()
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/effects.js
  function parseEffectsDef(_def, refs) {
    return refs.effectStrategy === "input" ? parseDef(_def.schema._def, refs) : {};
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/enum.js
  function parseEnumDef(def) {
    return {
      type: "string",
      enum: Array.from(def.values)
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/intersection.js
  var isJsonSchema7AllOfType = (type) => {
    if ("type" in type && type.type === "string")
      return false;
    return "allOf" in type;
  };
  function parseIntersectionDef(def, refs) {
    const allOf = [
      parseDef(def.left._def, {
        ...refs,
        currentPath: [...refs.currentPath, "allOf", "0"]
      }),
      parseDef(def.right._def, {
        ...refs,
        currentPath: [...refs.currentPath, "allOf", "1"]
      })
    ].filter((x) => !!x);
    let unevaluatedProperties = refs.target === "jsonSchema2019-09" ? { unevaluatedProperties: false } : void 0;
    const mergedAllOf = [];
    allOf.forEach((schema) => {
      if (isJsonSchema7AllOfType(schema)) {
        mergedAllOf.push(...schema.allOf);
        if (schema.unevaluatedProperties === void 0) {
          unevaluatedProperties = void 0;
        }
      } else {
        let nestedSchema = schema;
        if ("additionalProperties" in schema && schema.additionalProperties === false) {
          const { additionalProperties, ...rest } = schema;
          nestedSchema = rest;
        } else {
          unevaluatedProperties = void 0;
        }
        mergedAllOf.push(nestedSchema);
      }
    });
    return mergedAllOf.length ? {
      allOf: mergedAllOf,
      ...unevaluatedProperties
    } : void 0;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/literal.js
  function parseLiteralDef(def, refs) {
    const parsedType = typeof def.value;
    if (parsedType !== "bigint" && parsedType !== "number" && parsedType !== "boolean" && parsedType !== "string") {
      return {
        type: Array.isArray(def.value) ? "array" : "object"
      };
    }
    if (refs.target === "openApi3") {
      return {
        type: parsedType === "bigint" ? "integer" : parsedType,
        enum: [def.value]
      };
    }
    return {
      type: parsedType === "bigint" ? "integer" : parsedType,
      const: def.value
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/string.js
  var emojiRegex2 = void 0;
  var zodPatterns = {
    /**
     * `c` was changed to `[cC]` to replicate /i flag
     */
    cuid: /^[cC][^\s-]{8,}$/,
    cuid2: /^[0-9a-z]+$/,
    ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
    /**
     * `a-z` was added to replicate /i flag
     */
    email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
    /**
     * Constructed a valid Unicode RegExp
     *
     * Lazily instantiate since this type of regex isn't supported
     * in all envs (e.g. React Native).
     *
     * See:
     * https://github.com/colinhacks/zod/issues/2433
     * Fix in Zod:
     * https://github.com/colinhacks/zod/commit/9340fd51e48576a75adc919bff65dbc4a5d4c99b
     */
    emoji: () => {
      if (emojiRegex2 === void 0) {
        emojiRegex2 = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
      }
      return emojiRegex2;
    },
    /**
     * Unused
     */
    uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
    /**
     * Unused
     */
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
    ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
    /**
     * Unused
     */
    ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
    ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
    base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
    base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
    nanoid: /^[a-zA-Z0-9_-]{21}$/,
    jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
  };
  function parseStringDef(def, refs) {
    const res = {
      type: "string"
    };
    if (def.checks) {
      for (const check of def.checks) {
        switch (check.kind) {
          case "min":
            setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
            break;
          case "max":
            setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
            break;
          case "email":
            switch (refs.emailStrategy) {
              case "format:email":
                addFormat(res, "email", check.message, refs);
                break;
              case "format:idn-email":
                addFormat(res, "idn-email", check.message, refs);
                break;
              case "pattern:zod":
                addPattern(res, zodPatterns.email, check.message, refs);
                break;
            }
            break;
          case "url":
            addFormat(res, "uri", check.message, refs);
            break;
          case "uuid":
            addFormat(res, "uuid", check.message, refs);
            break;
          case "regex":
            addPattern(res, check.regex, check.message, refs);
            break;
          case "cuid":
            addPattern(res, zodPatterns.cuid, check.message, refs);
            break;
          case "cuid2":
            addPattern(res, zodPatterns.cuid2, check.message, refs);
            break;
          case "startsWith":
            addPattern(res, RegExp(`^${escapeLiteralCheckValue(check.value, refs)}`), check.message, refs);
            break;
          case "endsWith":
            addPattern(res, RegExp(`${escapeLiteralCheckValue(check.value, refs)}$`), check.message, refs);
            break;
          case "datetime":
            addFormat(res, "date-time", check.message, refs);
            break;
          case "date":
            addFormat(res, "date", check.message, refs);
            break;
          case "time":
            addFormat(res, "time", check.message, refs);
            break;
          case "duration":
            addFormat(res, "duration", check.message, refs);
            break;
          case "length":
            setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
            setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
            break;
          case "includes": {
            addPattern(res, RegExp(escapeLiteralCheckValue(check.value, refs)), check.message, refs);
            break;
          }
          case "ip": {
            if (check.version !== "v6") {
              addFormat(res, "ipv4", check.message, refs);
            }
            if (check.version !== "v4") {
              addFormat(res, "ipv6", check.message, refs);
            }
            break;
          }
          case "base64url":
            addPattern(res, zodPatterns.base64url, check.message, refs);
            break;
          case "jwt":
            addPattern(res, zodPatterns.jwt, check.message, refs);
            break;
          case "cidr": {
            if (check.version !== "v6") {
              addPattern(res, zodPatterns.ipv4Cidr, check.message, refs);
            }
            if (check.version !== "v4") {
              addPattern(res, zodPatterns.ipv6Cidr, check.message, refs);
            }
            break;
          }
          case "emoji":
            addPattern(res, zodPatterns.emoji(), check.message, refs);
            break;
          case "ulid": {
            addPattern(res, zodPatterns.ulid, check.message, refs);
            break;
          }
          case "base64": {
            switch (refs.base64Strategy) {
              case "format:binary": {
                addFormat(res, "binary", check.message, refs);
                break;
              }
              case "contentEncoding:base64": {
                setResponseValueAndErrors(res, "contentEncoding", "base64", check.message, refs);
                break;
              }
              case "pattern:zod": {
                addPattern(res, zodPatterns.base64, check.message, refs);
                break;
              }
            }
            break;
          }
          case "nanoid": {
            addPattern(res, zodPatterns.nanoid, check.message, refs);
          }
          case "toLowerCase":
          case "toUpperCase":
          case "trim":
            break;
          default:
            /* @__PURE__ */ ((_) => {
            })(check);
        }
      }
    }
    return res;
  }
  function escapeLiteralCheckValue(literal, refs) {
    return refs.patternStrategy === "escape" ? escapeNonAlphaNumeric(literal) : literal;
  }
  var ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
  function escapeNonAlphaNumeric(source) {
    let result = "";
    for (let i = 0; i < source.length; i++) {
      if (!ALPHA_NUMERIC.has(source[i])) {
        result += "\\";
      }
      result += source[i];
    }
    return result;
  }
  function addFormat(schema, value, message, refs) {
    if (schema.format || schema.anyOf?.some((x) => x.format)) {
      if (!schema.anyOf) {
        schema.anyOf = [];
      }
      if (schema.format) {
        schema.anyOf.push({
          format: schema.format,
          ...schema.errorMessage && refs.errorMessages && {
            errorMessage: { format: schema.errorMessage.format }
          }
        });
        delete schema.format;
        if (schema.errorMessage) {
          delete schema.errorMessage.format;
          if (Object.keys(schema.errorMessage).length === 0) {
            delete schema.errorMessage;
          }
        }
      }
      schema.anyOf.push({
        format: value,
        ...message && refs.errorMessages && { errorMessage: { format: message } }
      });
    } else {
      setResponseValueAndErrors(schema, "format", value, message, refs);
    }
  }
  function addPattern(schema, regex, message, refs) {
    if (schema.pattern || schema.allOf?.some((x) => x.pattern)) {
      if (!schema.allOf) {
        schema.allOf = [];
      }
      if (schema.pattern) {
        schema.allOf.push({
          pattern: schema.pattern,
          ...schema.errorMessage && refs.errorMessages && {
            errorMessage: { pattern: schema.errorMessage.pattern }
          }
        });
        delete schema.pattern;
        if (schema.errorMessage) {
          delete schema.errorMessage.pattern;
          if (Object.keys(schema.errorMessage).length === 0) {
            delete schema.errorMessage;
          }
        }
      }
      schema.allOf.push({
        pattern: stringifyRegExpWithFlags(regex, refs),
        ...message && refs.errorMessages && { errorMessage: { pattern: message } }
      });
    } else {
      setResponseValueAndErrors(schema, "pattern", stringifyRegExpWithFlags(regex, refs), message, refs);
    }
  }
  function stringifyRegExpWithFlags(regex, refs) {
    if (!refs.applyRegexFlags || !regex.flags) {
      return regex.source;
    }
    const flags = {
      i: regex.flags.includes("i"),
      m: regex.flags.includes("m"),
      s: regex.flags.includes("s")
      // `.` matches newlines
    };
    const source = flags.i ? regex.source.toLowerCase() : regex.source;
    let pattern = "";
    let isEscaped = false;
    let inCharGroup = false;
    let inCharRange = false;
    for (let i = 0; i < source.length; i++) {
      if (isEscaped) {
        pattern += source[i];
        isEscaped = false;
        continue;
      }
      if (flags.i) {
        if (inCharGroup) {
          if (source[i].match(/[a-z]/)) {
            if (inCharRange) {
              pattern += source[i];
              pattern += `${source[i - 2]}-${source[i]}`.toUpperCase();
              inCharRange = false;
            } else if (source[i + 1] === "-" && source[i + 2]?.match(/[a-z]/)) {
              pattern += source[i];
              inCharRange = true;
            } else {
              pattern += `${source[i]}${source[i].toUpperCase()}`;
            }
            continue;
          }
        } else if (source[i].match(/[a-z]/)) {
          pattern += `[${source[i]}${source[i].toUpperCase()}]`;
          continue;
        }
      }
      if (flags.m) {
        if (source[i] === "^") {
          pattern += `(^|(?<=[\r
]))`;
          continue;
        } else if (source[i] === "$") {
          pattern += `($|(?=[\r
]))`;
          continue;
        }
      }
      if (flags.s && source[i] === ".") {
        pattern += inCharGroup ? `${source[i]}\r
` : `[${source[i]}\r
]`;
        continue;
      }
      pattern += source[i];
      if (source[i] === "\\") {
        isEscaped = true;
      } else if (inCharGroup && source[i] === "]") {
        inCharGroup = false;
      } else if (!inCharGroup && source[i] === "[") {
        inCharGroup = true;
      }
    }
    try {
      new RegExp(pattern);
    } catch {
      console.warn(`Could not convert regex pattern at ${refs.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`);
      return regex.source;
    }
    return pattern;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/record.js
  function parseRecordDef(def, refs) {
    if (refs.target === "openAi") {
      console.warn("Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.");
    }
    if (refs.target === "openApi3" && def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
      return {
        type: "object",
        required: def.keyType._def.values,
        properties: def.keyType._def.values.reduce((acc, key) => ({
          ...acc,
          [key]: parseDef(def.valueType._def, {
            ...refs,
            currentPath: [...refs.currentPath, "properties", key]
          }) ?? {}
        }), {}),
        additionalProperties: refs.rejectedAdditionalProperties
      };
    }
    const schema = {
      type: "object",
      additionalProperties: parseDef(def.valueType._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalProperties"]
      }) ?? refs.allowedAdditionalProperties
    };
    if (refs.target === "openApi3") {
      return schema;
    }
    if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.checks?.length) {
      const { type, ...keyType } = parseStringDef(def.keyType._def, refs);
      return {
        ...schema,
        propertyNames: keyType
      };
    } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
      return {
        ...schema,
        propertyNames: {
          enum: def.keyType._def.values
        }
      };
    } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodBranded && def.keyType._def.type._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.type._def.checks?.length) {
      const { type, ...keyType } = parseBrandedDef(def.keyType._def, refs);
      return {
        ...schema,
        propertyNames: keyType
      };
    }
    return schema;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/map.js
  function parseMapDef(def, refs) {
    if (refs.mapStrategy === "record") {
      return parseRecordDef(def, refs);
    }
    const keys = parseDef(def.keyType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items", "items", "0"]
    }) || {};
    const values = parseDef(def.valueType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items", "items", "1"]
    }) || {};
    return {
      type: "array",
      maxItems: 125,
      items: {
        type: "array",
        items: [keys, values],
        minItems: 2,
        maxItems: 2
      }
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/nativeEnum.js
  function parseNativeEnumDef(def) {
    const object2 = def.values;
    const actualKeys = Object.keys(def.values).filter((key) => {
      return typeof object2[object2[key]] !== "number";
    });
    const actualValues = actualKeys.map((key) => object2[key]);
    const parsedTypes = Array.from(new Set(actualValues.map((values) => typeof values)));
    return {
      type: parsedTypes.length === 1 ? parsedTypes[0] === "string" ? "string" : "number" : ["string", "number"],
      enum: actualValues
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/never.js
  function parseNeverDef() {
    return {
      not: {}
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/null.js
  function parseNullDef(refs) {
    return refs.target === "openApi3" ? {
      enum: ["null"],
      nullable: true
    } : {
      type: "null"
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/union.js
  var primitiveMappings = {
    ZodString: "string",
    ZodNumber: "number",
    ZodBigInt: "integer",
    ZodBoolean: "boolean",
    ZodNull: "null"
  };
  function parseUnionDef(def, refs) {
    if (refs.target === "openApi3")
      return asAnyOf(def, refs);
    const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
    if (options.every((x) => x._def.typeName in primitiveMappings && (!x._def.checks || !x._def.checks.length))) {
      const types = options.reduce((types2, x) => {
        const type = primitiveMappings[x._def.typeName];
        return type && !types2.includes(type) ? [...types2, type] : types2;
      }, []);
      return {
        type: types.length > 1 ? types : types[0]
      };
    } else if (options.every((x) => x._def.typeName === "ZodLiteral" && !x.description)) {
      const types = options.reduce((acc, x) => {
        const type = typeof x._def.value;
        switch (type) {
          case "string":
          case "number":
          case "boolean":
            return [...acc, type];
          case "bigint":
            return [...acc, "integer"];
          case "object":
            if (x._def.value === null)
              return [...acc, "null"];
          case "symbol":
          case "undefined":
          case "function":
          default:
            return acc;
        }
      }, []);
      if (types.length === options.length) {
        const uniqueTypes = types.filter((x, i, a) => a.indexOf(x) === i);
        return {
          type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
          enum: options.reduce((acc, x) => {
            return acc.includes(x._def.value) ? acc : [...acc, x._def.value];
          }, [])
        };
      }
    } else if (options.every((x) => x._def.typeName === "ZodEnum")) {
      return {
        type: "string",
        enum: options.reduce((acc, x) => [
          ...acc,
          ...x._def.values.filter((x2) => !acc.includes(x2))
        ], [])
      };
    }
    return asAnyOf(def, refs);
  }
  var asAnyOf = (def, refs) => {
    const anyOf = (def.options instanceof Map ? Array.from(def.options.values()) : def.options).map((x, i) => parseDef(x._def, {
      ...refs,
      currentPath: [...refs.currentPath, "anyOf", `${i}`]
    })).filter((x) => !!x && (!refs.strictUnions || typeof x === "object" && Object.keys(x).length > 0));
    return anyOf.length ? { anyOf } : void 0;
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/nullable.js
  function parseNullableDef(def, refs) {
    if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(def.innerType._def.typeName) && (!def.innerType._def.checks || !def.innerType._def.checks.length)) {
      if (refs.target === "openApi3") {
        return {
          type: primitiveMappings[def.innerType._def.typeName],
          nullable: true
        };
      }
      return {
        type: [
          primitiveMappings[def.innerType._def.typeName],
          "null"
        ]
      };
    }
    if (refs.target === "openApi3") {
      const base2 = parseDef(def.innerType._def, {
        ...refs,
        currentPath: [...refs.currentPath]
      });
      if (base2 && "$ref" in base2)
        return { allOf: [base2], nullable: true };
      return base2 && { ...base2, nullable: true };
    }
    const base = parseDef(def.innerType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "anyOf", "0"]
    });
    return base && { anyOf: [base, { type: "null" }] };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/number.js
  function parseNumberDef(def, refs) {
    const res = {
      type: "number"
    };
    if (!def.checks)
      return res;
    for (const check of def.checks) {
      switch (check.kind) {
        case "int":
          res.type = "integer";
          addErrorMessage(res, "type", check.message, refs);
          break;
        case "min":
          if (refs.target === "jsonSchema7") {
            if (check.inclusive) {
              setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
            } else {
              setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
            }
          } else {
            if (!check.inclusive) {
              res.exclusiveMinimum = true;
            }
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          }
          break;
        case "max":
          if (refs.target === "jsonSchema7") {
            if (check.inclusive) {
              setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
            } else {
              setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
            }
          } else {
            if (!check.inclusive) {
              res.exclusiveMaximum = true;
            }
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          }
          break;
        case "multipleOf":
          setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
          break;
      }
    }
    return res;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/object.js
  function parseObjectDef(def, refs) {
    const forceOptionalIntoNullable = refs.target === "openAi";
    const result = {
      type: "object",
      properties: {}
    };
    const required = [];
    const shape = def.shape();
    for (const propName in shape) {
      let propDef = shape[propName];
      if (propDef === void 0 || propDef._def === void 0) {
        continue;
      }
      let propOptional = safeIsOptional(propDef);
      if (propOptional && forceOptionalIntoNullable) {
        if (propDef instanceof ZodOptional) {
          propDef = propDef._def.innerType;
        }
        if (!propDef.isNullable()) {
          propDef = propDef.nullable();
        }
        propOptional = false;
      }
      const parsedDef = parseDef(propDef._def, {
        ...refs,
        currentPath: [...refs.currentPath, "properties", propName],
        propertyPath: [...refs.currentPath, "properties", propName]
      });
      if (parsedDef === void 0) {
        continue;
      }
      result.properties[propName] = parsedDef;
      if (!propOptional) {
        required.push(propName);
      }
    }
    if (required.length) {
      result.required = required;
    }
    const additionalProperties = decideAdditionalProperties(def, refs);
    if (additionalProperties !== void 0) {
      result.additionalProperties = additionalProperties;
    }
    return result;
  }
  function decideAdditionalProperties(def, refs) {
    if (def.catchall._def.typeName !== "ZodNever") {
      return parseDef(def.catchall._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalProperties"]
      });
    }
    switch (def.unknownKeys) {
      case "passthrough":
        return refs.allowedAdditionalProperties;
      case "strict":
        return refs.rejectedAdditionalProperties;
      case "strip":
        return refs.removeAdditionalStrategy === "strict" ? refs.allowedAdditionalProperties : refs.rejectedAdditionalProperties;
    }
  }
  function safeIsOptional(schema) {
    try {
      return schema.isOptional();
    } catch {
      return true;
    }
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/optional.js
  var parseOptionalDef = (def, refs) => {
    if (refs.currentPath.toString() === refs.propertyPath?.toString()) {
      return parseDef(def.innerType._def, refs);
    }
    const innerSchema = parseDef(def.innerType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "anyOf", "1"]
    });
    return innerSchema ? {
      anyOf: [
        {
          not: {}
        },
        innerSchema
      ]
    } : {};
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/pipeline.js
  var parsePipelineDef = (def, refs) => {
    if (refs.pipeStrategy === "input") {
      return parseDef(def.in._def, refs);
    } else if (refs.pipeStrategy === "output") {
      return parseDef(def.out._def, refs);
    }
    const a = parseDef(def.in._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "0"]
    });
    const b = parseDef(def.out._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", a ? "1" : "0"]
    });
    return {
      allOf: [a, b].filter((x) => x !== void 0)
    };
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/promise.js
  function parsePromiseDef(def, refs) {
    return parseDef(def.type._def, refs);
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/set.js
  function parseSetDef(def, refs) {
    const items = parseDef(def.valueType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items"]
    });
    const schema = {
      type: "array",
      uniqueItems: true,
      items
    };
    if (def.minSize) {
      setResponseValueAndErrors(schema, "minItems", def.minSize.value, def.minSize.message, refs);
    }
    if (def.maxSize) {
      setResponseValueAndErrors(schema, "maxItems", def.maxSize.value, def.maxSize.message, refs);
    }
    return schema;
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/tuple.js
  function parseTupleDef(def, refs) {
    if (def.rest) {
      return {
        type: "array",
        minItems: def.items.length,
        items: def.items.map((x, i) => parseDef(x._def, {
          ...refs,
          currentPath: [...refs.currentPath, "items", `${i}`]
        })).reduce((acc, x) => x === void 0 ? acc : [...acc, x], []),
        additionalItems: parseDef(def.rest._def, {
          ...refs,
          currentPath: [...refs.currentPath, "additionalItems"]
        })
      };
    } else {
      return {
        type: "array",
        minItems: def.items.length,
        maxItems: def.items.length,
        items: def.items.map((x, i) => parseDef(x._def, {
          ...refs,
          currentPath: [...refs.currentPath, "items", `${i}`]
        })).reduce((acc, x) => x === void 0 ? acc : [...acc, x], [])
      };
    }
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/undefined.js
  function parseUndefinedDef() {
    return {
      not: {}
    };
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/unknown.js
  function parseUnknownDef() {
    return {};
  }

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parsers/readonly.js
  var parseReadonlyDef = (def, refs) => {
    return parseDef(def.innerType._def, refs);
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/selectParser.js
  var selectParser = (def, typeName, refs) => {
    switch (typeName) {
      case ZodFirstPartyTypeKind.ZodString:
        return parseStringDef(def, refs);
      case ZodFirstPartyTypeKind.ZodNumber:
        return parseNumberDef(def, refs);
      case ZodFirstPartyTypeKind.ZodObject:
        return parseObjectDef(def, refs);
      case ZodFirstPartyTypeKind.ZodBigInt:
        return parseBigintDef(def, refs);
      case ZodFirstPartyTypeKind.ZodBoolean:
        return parseBooleanDef();
      case ZodFirstPartyTypeKind.ZodDate:
        return parseDateDef(def, refs);
      case ZodFirstPartyTypeKind.ZodUndefined:
        return parseUndefinedDef();
      case ZodFirstPartyTypeKind.ZodNull:
        return parseNullDef(refs);
      case ZodFirstPartyTypeKind.ZodArray:
        return parseArrayDef(def, refs);
      case ZodFirstPartyTypeKind.ZodUnion:
      case ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
        return parseUnionDef(def, refs);
      case ZodFirstPartyTypeKind.ZodIntersection:
        return parseIntersectionDef(def, refs);
      case ZodFirstPartyTypeKind.ZodTuple:
        return parseTupleDef(def, refs);
      case ZodFirstPartyTypeKind.ZodRecord:
        return parseRecordDef(def, refs);
      case ZodFirstPartyTypeKind.ZodLiteral:
        return parseLiteralDef(def, refs);
      case ZodFirstPartyTypeKind.ZodEnum:
        return parseEnumDef(def);
      case ZodFirstPartyTypeKind.ZodNativeEnum:
        return parseNativeEnumDef(def);
      case ZodFirstPartyTypeKind.ZodNullable:
        return parseNullableDef(def, refs);
      case ZodFirstPartyTypeKind.ZodOptional:
        return parseOptionalDef(def, refs);
      case ZodFirstPartyTypeKind.ZodMap:
        return parseMapDef(def, refs);
      case ZodFirstPartyTypeKind.ZodSet:
        return parseSetDef(def, refs);
      case ZodFirstPartyTypeKind.ZodLazy:
        return () => def.getter()._def;
      case ZodFirstPartyTypeKind.ZodPromise:
        return parsePromiseDef(def, refs);
      case ZodFirstPartyTypeKind.ZodNaN:
      case ZodFirstPartyTypeKind.ZodNever:
        return parseNeverDef();
      case ZodFirstPartyTypeKind.ZodEffects:
        return parseEffectsDef(def, refs);
      case ZodFirstPartyTypeKind.ZodAny:
        return parseAnyDef();
      case ZodFirstPartyTypeKind.ZodUnknown:
        return parseUnknownDef();
      case ZodFirstPartyTypeKind.ZodDefault:
        return parseDefaultDef(def, refs);
      case ZodFirstPartyTypeKind.ZodBranded:
        return parseBrandedDef(def, refs);
      case ZodFirstPartyTypeKind.ZodReadonly:
        return parseReadonlyDef(def, refs);
      case ZodFirstPartyTypeKind.ZodCatch:
        return parseCatchDef(def, refs);
      case ZodFirstPartyTypeKind.ZodPipeline:
        return parsePipelineDef(def, refs);
      case ZodFirstPartyTypeKind.ZodFunction:
      case ZodFirstPartyTypeKind.ZodVoid:
      case ZodFirstPartyTypeKind.ZodSymbol:
        return void 0;
      default:
        return /* @__PURE__ */ ((_) => void 0)(typeName);
    }
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/parseDef.js
  function parseDef(def, refs, forceResolution = false) {
    const seenItem = refs.seen.get(def);
    if (refs.override) {
      const overrideResult = refs.override?.(def, refs, seenItem, forceResolution);
      if (overrideResult !== ignoreOverride) {
        return overrideResult;
      }
    }
    if (seenItem && !forceResolution) {
      const seenSchema = get$ref(seenItem, refs);
      if (seenSchema !== void 0) {
        return seenSchema;
      }
    }
    const newItem = { def, path: refs.currentPath, jsonSchema: void 0 };
    refs.seen.set(def, newItem);
    const jsonSchemaOrGetter = selectParser(def, def.typeName, refs);
    const jsonSchema2 = typeof jsonSchemaOrGetter === "function" ? parseDef(jsonSchemaOrGetter(), refs) : jsonSchemaOrGetter;
    if (jsonSchema2) {
      addMeta(def, refs, jsonSchema2);
    }
    if (refs.postProcess) {
      const postProcessResult = refs.postProcess(jsonSchema2, def, refs);
      newItem.jsonSchema = jsonSchema2;
      return postProcessResult;
    }
    newItem.jsonSchema = jsonSchema2;
    return jsonSchema2;
  }
  var get$ref = (item, refs) => {
    switch (refs.$refStrategy) {
      case "root":
        return { $ref: item.path.join("/") };
      case "relative":
        return { $ref: getRelativePath(refs.currentPath, item.path) };
      case "none":
      case "seen": {
        if (item.path.length < refs.currentPath.length && item.path.every((value, index) => refs.currentPath[index] === value)) {
          console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);
          return {};
        }
        return refs.$refStrategy === "seen" ? {} : void 0;
      }
    }
  };
  var getRelativePath = (pathA, pathB) => {
    let i = 0;
    for (; i < pathA.length && i < pathB.length; i++) {
      if (pathA[i] !== pathB[i])
        break;
    }
    return [(pathA.length - i).toString(), ...pathB.slice(i)].join("/");
  };
  var addMeta = (def, refs, jsonSchema2) => {
    if (def.description) {
      jsonSchema2.description = def.description;
      if (refs.markdownDescription) {
        jsonSchema2.markdownDescription = def.description;
      }
    }
    return jsonSchema2;
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/zodToJsonSchema.js
  var zodToJsonSchema = (schema, options) => {
    const refs = getRefs(options);
    const definitions = typeof options === "object" && options.definitions ? Object.entries(options.definitions).reduce((acc, [name18, schema2]) => ({
      ...acc,
      [name18]: parseDef(schema2._def, {
        ...refs,
        currentPath: [...refs.basePath, refs.definitionPath, name18]
      }, true) ?? {}
    }), {}) : void 0;
    const name17 = typeof options === "string" ? options : options?.nameStrategy === "title" ? void 0 : options?.name;
    const main = parseDef(schema._def, name17 === void 0 ? refs : {
      ...refs,
      currentPath: [...refs.basePath, refs.definitionPath, name17]
    }, false) ?? {};
    const title = typeof options === "object" && options.name !== void 0 && options.nameStrategy === "title" ? options.name : void 0;
    if (title !== void 0) {
      main.title = title;
    }
    const combined = name17 === void 0 ? definitions ? {
      ...main,
      [refs.definitionPath]: definitions
    } : main : {
      $ref: [
        ...refs.$refStrategy === "relative" ? [] : refs.basePath,
        refs.definitionPath,
        name17
      ].join("/"),
      [refs.definitionPath]: {
        ...definitions,
        [name17]: main
      }
    };
    if (refs.target === "jsonSchema7") {
      combined.$schema = "http://json-schema.org/draft-07/schema#";
    } else if (refs.target === "jsonSchema2019-09" || refs.target === "openAi") {
      combined.$schema = "https://json-schema.org/draft/2019-09/schema#";
    }
    if (refs.target === "openAi" && ("anyOf" in combined || "oneOf" in combined || "allOf" in combined || "type" in combined && Array.isArray(combined.type))) {
      console.warn("Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.");
    }
    return combined;
  };

  // node_modules/.pnpm/zod-to-json-schema@3.24.5_zod@3.24.2/node_modules/zod-to-json-schema/dist/esm/index.js
  var esm_default = zodToJsonSchema;

  // node_modules/.pnpm/@ai-sdk+ui-utils@1.2.0_zod@3.24.2/node_modules/@ai-sdk/ui-utils/dist/index.mjs
  var textStreamPart = {
    code: "0",
    name: "text",
    parse: (value) => {
      if (typeof value !== "string") {
        throw new Error('"text" parts expect a string value.');
      }
      return { type: "text", value };
    }
  };
  var errorStreamPart = {
    code: "3",
    name: "error",
    parse: (value) => {
      if (typeof value !== "string") {
        throw new Error('"error" parts expect a string value.');
      }
      return { type: "error", value };
    }
  };
  var assistantMessageStreamPart = {
    code: "4",
    name: "assistant_message",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("id" in value) || !("role" in value) || !("content" in value) || typeof value.id !== "string" || typeof value.role !== "string" || value.role !== "assistant" || !Array.isArray(value.content) || !value.content.every(
        (item) => item != null && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && item.text != null && typeof item.text === "object" && "value" in item.text && typeof item.text.value === "string"
      )) {
        throw new Error(
          '"assistant_message" parts expect an object with an "id", "role", and "content" property.'
        );
      }
      return {
        type: "assistant_message",
        value
      };
    }
  };
  var assistantControlDataStreamPart = {
    code: "5",
    name: "assistant_control_data",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("threadId" in value) || !("messageId" in value) || typeof value.threadId !== "string" || typeof value.messageId !== "string") {
        throw new Error(
          '"assistant_control_data" parts expect an object with a "threadId" and "messageId" property.'
        );
      }
      return {
        type: "assistant_control_data",
        value: {
          threadId: value.threadId,
          messageId: value.messageId
        }
      };
    }
  };
  var dataMessageStreamPart = {
    code: "6",
    name: "data_message",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("role" in value) || !("data" in value) || typeof value.role !== "string" || value.role !== "data") {
        throw new Error(
          '"data_message" parts expect an object with a "role" and "data" property.'
        );
      }
      return {
        type: "data_message",
        value
      };
    }
  };
  var assistantStreamParts = [
    textStreamPart,
    errorStreamPart,
    assistantMessageStreamPart,
    assistantControlDataStreamPart,
    dataMessageStreamPart
  ];
  var assistantStreamPartsByCode = {
    [textStreamPart.code]: textStreamPart,
    [errorStreamPart.code]: errorStreamPart,
    [assistantMessageStreamPart.code]: assistantMessageStreamPart,
    [assistantControlDataStreamPart.code]: assistantControlDataStreamPart,
    [dataMessageStreamPart.code]: dataMessageStreamPart
  };
  var StreamStringPrefixes = {
    [textStreamPart.name]: textStreamPart.code,
    [errorStreamPart.name]: errorStreamPart.code,
    [assistantMessageStreamPart.name]: assistantMessageStreamPart.code,
    [assistantControlDataStreamPart.name]: assistantControlDataStreamPart.code,
    [dataMessageStreamPart.name]: dataMessageStreamPart.code
  };
  var validCodes = assistantStreamParts.map((part) => part.code);
  function fixJson(input) {
    const stack = ["ROOT"];
    let lastValidIndex = -1;
    let literalStart = null;
    function processValueStart(char, i, swapState) {
      {
        switch (char) {
          case '"': {
            lastValidIndex = i;
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_STRING");
            break;
          }
          case "f":
          case "t":
          case "n": {
            lastValidIndex = i;
            literalStart = i;
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_LITERAL");
            break;
          }
          case "-": {
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_NUMBER");
            break;
          }
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            lastValidIndex = i;
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_NUMBER");
            break;
          }
          case "{": {
            lastValidIndex = i;
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_OBJECT_START");
            break;
          }
          case "[": {
            lastValidIndex = i;
            stack.pop();
            stack.push(swapState);
            stack.push("INSIDE_ARRAY_START");
            break;
          }
        }
      }
    }
    function processAfterObjectValue(char, i) {
      switch (char) {
        case ",": {
          stack.pop();
          stack.push("INSIDE_OBJECT_AFTER_COMMA");
          break;
        }
        case "}": {
          lastValidIndex = i;
          stack.pop();
          break;
        }
      }
    }
    function processAfterArrayValue(char, i) {
      switch (char) {
        case ",": {
          stack.pop();
          stack.push("INSIDE_ARRAY_AFTER_COMMA");
          break;
        }
        case "]": {
          lastValidIndex = i;
          stack.pop();
          break;
        }
      }
    }
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const currentState = stack[stack.length - 1];
      switch (currentState) {
        case "ROOT":
          processValueStart(char, i, "FINISH");
          break;
        case "INSIDE_OBJECT_START": {
          switch (char) {
            case '"': {
              stack.pop();
              stack.push("INSIDE_OBJECT_KEY");
              break;
            }
            case "}": {
              lastValidIndex = i;
              stack.pop();
              break;
            }
          }
          break;
        }
        case "INSIDE_OBJECT_AFTER_COMMA": {
          switch (char) {
            case '"': {
              stack.pop();
              stack.push("INSIDE_OBJECT_KEY");
              break;
            }
          }
          break;
        }
        case "INSIDE_OBJECT_KEY": {
          switch (char) {
            case '"': {
              stack.pop();
              stack.push("INSIDE_OBJECT_AFTER_KEY");
              break;
            }
          }
          break;
        }
        case "INSIDE_OBJECT_AFTER_KEY": {
          switch (char) {
            case ":": {
              stack.pop();
              stack.push("INSIDE_OBJECT_BEFORE_VALUE");
              break;
            }
          }
          break;
        }
        case "INSIDE_OBJECT_BEFORE_VALUE": {
          processValueStart(char, i, "INSIDE_OBJECT_AFTER_VALUE");
          break;
        }
        case "INSIDE_OBJECT_AFTER_VALUE": {
          processAfterObjectValue(char, i);
          break;
        }
        case "INSIDE_STRING": {
          switch (char) {
            case '"': {
              stack.pop();
              lastValidIndex = i;
              break;
            }
            case "\\": {
              stack.push("INSIDE_STRING_ESCAPE");
              break;
            }
            default: {
              lastValidIndex = i;
            }
          }
          break;
        }
        case "INSIDE_ARRAY_START": {
          switch (char) {
            case "]": {
              lastValidIndex = i;
              stack.pop();
              break;
            }
            default: {
              lastValidIndex = i;
              processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
              break;
            }
          }
          break;
        }
        case "INSIDE_ARRAY_AFTER_VALUE": {
          switch (char) {
            case ",": {
              stack.pop();
              stack.push("INSIDE_ARRAY_AFTER_COMMA");
              break;
            }
            case "]": {
              lastValidIndex = i;
              stack.pop();
              break;
            }
            default: {
              lastValidIndex = i;
              break;
            }
          }
          break;
        }
        case "INSIDE_ARRAY_AFTER_COMMA": {
          processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
          break;
        }
        case "INSIDE_STRING_ESCAPE": {
          stack.pop();
          lastValidIndex = i;
          break;
        }
        case "INSIDE_NUMBER": {
          switch (char) {
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9": {
              lastValidIndex = i;
              break;
            }
            case "e":
            case "E":
            case "-":
            case ".": {
              break;
            }
            case ",": {
              stack.pop();
              if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
                processAfterArrayValue(char, i);
              }
              if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
                processAfterObjectValue(char, i);
              }
              break;
            }
            case "}": {
              stack.pop();
              if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
                processAfterObjectValue(char, i);
              }
              break;
            }
            case "]": {
              stack.pop();
              if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
                processAfterArrayValue(char, i);
              }
              break;
            }
            default: {
              stack.pop();
              break;
            }
          }
          break;
        }
        case "INSIDE_LITERAL": {
          const partialLiteral = input.substring(literalStart, i + 1);
          if (!"false".startsWith(partialLiteral) && !"true".startsWith(partialLiteral) && !"null".startsWith(partialLiteral)) {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            } else if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
          } else {
            lastValidIndex = i;
          }
          break;
        }
      }
    }
    let result = input.slice(0, lastValidIndex + 1);
    for (let i = stack.length - 1; i >= 0; i--) {
      const state = stack[i];
      switch (state) {
        case "INSIDE_STRING": {
          result += '"';
          break;
        }
        case "INSIDE_OBJECT_KEY":
        case "INSIDE_OBJECT_AFTER_KEY":
        case "INSIDE_OBJECT_AFTER_COMMA":
        case "INSIDE_OBJECT_START":
        case "INSIDE_OBJECT_BEFORE_VALUE":
        case "INSIDE_OBJECT_AFTER_VALUE": {
          result += "}";
          break;
        }
        case "INSIDE_ARRAY_START":
        case "INSIDE_ARRAY_AFTER_COMMA":
        case "INSIDE_ARRAY_AFTER_VALUE": {
          result += "]";
          break;
        }
        case "INSIDE_LITERAL": {
          const partialLiteral = input.substring(literalStart, input.length);
          if ("true".startsWith(partialLiteral)) {
            result += "true".slice(partialLiteral.length);
          } else if ("false".startsWith(partialLiteral)) {
            result += "false".slice(partialLiteral.length);
          } else if ("null".startsWith(partialLiteral)) {
            result += "null".slice(partialLiteral.length);
          }
        }
      }
    }
    return result;
  }
  function parsePartialJson(jsonText) {
    if (jsonText === void 0) {
      return { value: void 0, state: "undefined-input" };
    }
    let result = safeParseJSON({ text: jsonText });
    if (result.success) {
      return { value: result.value, state: "successful-parse" };
    }
    result = safeParseJSON({ text: fixJson(jsonText) });
    if (result.success) {
      return { value: result.value, state: "repaired-parse" };
    }
    return { value: void 0, state: "failed-parse" };
  }
  var textStreamPart2 = {
    code: "0",
    name: "text",
    parse: (value) => {
      if (typeof value !== "string") {
        throw new Error('"text" parts expect a string value.');
      }
      return { type: "text", value };
    }
  };
  var dataStreamPart = {
    code: "2",
    name: "data",
    parse: (value) => {
      if (!Array.isArray(value)) {
        throw new Error('"data" parts expect an array value.');
      }
      return { type: "data", value };
    }
  };
  var errorStreamPart2 = {
    code: "3",
    name: "error",
    parse: (value) => {
      if (typeof value !== "string") {
        throw new Error('"error" parts expect a string value.');
      }
      return { type: "error", value };
    }
  };
  var messageAnnotationsStreamPart = {
    code: "8",
    name: "message_annotations",
    parse: (value) => {
      if (!Array.isArray(value)) {
        throw new Error('"message_annotations" parts expect an array value.');
      }
      return { type: "message_annotations", value };
    }
  };
  var toolCallStreamPart = {
    code: "9",
    name: "tool_call",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("toolName" in value) || typeof value.toolName !== "string" || !("args" in value) || typeof value.args !== "object") {
        throw new Error(
          '"tool_call" parts expect an object with a "toolCallId", "toolName", and "args" property.'
        );
      }
      return {
        type: "tool_call",
        value
      };
    }
  };
  var toolResultStreamPart = {
    code: "a",
    name: "tool_result",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("result" in value)) {
        throw new Error(
          '"tool_result" parts expect an object with a "toolCallId" and a "result" property.'
        );
      }
      return {
        type: "tool_result",
        value
      };
    }
  };
  var toolCallStreamingStartStreamPart = {
    code: "b",
    name: "tool_call_streaming_start",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("toolName" in value) || typeof value.toolName !== "string") {
        throw new Error(
          '"tool_call_streaming_start" parts expect an object with a "toolCallId" and "toolName" property.'
        );
      }
      return {
        type: "tool_call_streaming_start",
        value
      };
    }
  };
  var toolCallDeltaStreamPart = {
    code: "c",
    name: "tool_call_delta",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("argsTextDelta" in value) || typeof value.argsTextDelta !== "string") {
        throw new Error(
          '"tool_call_delta" parts expect an object with a "toolCallId" and "argsTextDelta" property.'
        );
      }
      return {
        type: "tool_call_delta",
        value
      };
    }
  };
  var finishMessageStreamPart = {
    code: "d",
    name: "finish_message",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("finishReason" in value) || typeof value.finishReason !== "string") {
        throw new Error(
          '"finish_message" parts expect an object with a "finishReason" property.'
        );
      }
      const result = {
        finishReason: value.finishReason
      };
      if ("usage" in value && value.usage != null && typeof value.usage === "object" && "promptTokens" in value.usage && "completionTokens" in value.usage) {
        result.usage = {
          promptTokens: typeof value.usage.promptTokens === "number" ? value.usage.promptTokens : Number.NaN,
          completionTokens: typeof value.usage.completionTokens === "number" ? value.usage.completionTokens : Number.NaN
        };
      }
      return {
        type: "finish_message",
        value: result
      };
    }
  };
  var finishStepStreamPart = {
    code: "e",
    name: "finish_step",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("finishReason" in value) || typeof value.finishReason !== "string") {
        throw new Error(
          '"finish_step" parts expect an object with a "finishReason" property.'
        );
      }
      const result = {
        finishReason: value.finishReason,
        isContinued: false
      };
      if ("usage" in value && value.usage != null && typeof value.usage === "object" && "promptTokens" in value.usage && "completionTokens" in value.usage) {
        result.usage = {
          promptTokens: typeof value.usage.promptTokens === "number" ? value.usage.promptTokens : Number.NaN,
          completionTokens: typeof value.usage.completionTokens === "number" ? value.usage.completionTokens : Number.NaN
        };
      }
      if ("isContinued" in value && typeof value.isContinued === "boolean") {
        result.isContinued = value.isContinued;
      }
      return {
        type: "finish_step",
        value: result
      };
    }
  };
  var startStepStreamPart = {
    code: "f",
    name: "start_step",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("messageId" in value) || typeof value.messageId !== "string") {
        throw new Error(
          '"start_step" parts expect an object with an "id" property.'
        );
      }
      return {
        type: "start_step",
        value: {
          messageId: value.messageId
        }
      };
    }
  };
  var reasoningStreamPart = {
    code: "g",
    name: "reasoning",
    parse: (value) => {
      if (typeof value !== "string") {
        throw new Error('"reasoning" parts expect a string value.');
      }
      return { type: "reasoning", value };
    }
  };
  var sourcePart = {
    code: "h",
    name: "source",
    parse: (value) => {
      if (value == null || typeof value !== "object") {
        throw new Error('"source" parts expect a Source object.');
      }
      return {
        type: "source",
        value
      };
    }
  };
  var redactedReasoningStreamPart = {
    code: "i",
    name: "redacted_reasoning",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("data" in value) || typeof value.data !== "string") {
        throw new Error(
          '"redacted_reasoning" parts expect an object with a "data" property.'
        );
      }
      return { type: "redacted_reasoning", value: { data: value.data } };
    }
  };
  var reasoningSignatureStreamPart = {
    code: "j",
    name: "reasoning_signature",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("signature" in value) || typeof value.signature !== "string") {
        throw new Error(
          '"reasoning_signature" parts expect an object with a "signature" property.'
        );
      }
      return {
        type: "reasoning_signature",
        value: { signature: value.signature }
      };
    }
  };
  var fileStreamPart = {
    code: "k",
    name: "file",
    parse: (value) => {
      if (value == null || typeof value !== "object" || !("data" in value) || typeof value.data !== "string" || !("mimeType" in value) || typeof value.mimeType !== "string") {
        throw new Error(
          '"file" parts expect an object with a "data" and "mimeType" property.'
        );
      }
      return { type: "file", value };
    }
  };
  var dataStreamParts = [
    textStreamPart2,
    dataStreamPart,
    errorStreamPart2,
    messageAnnotationsStreamPart,
    toolCallStreamPart,
    toolResultStreamPart,
    toolCallStreamingStartStreamPart,
    toolCallDeltaStreamPart,
    finishMessageStreamPart,
    finishStepStreamPart,
    startStepStreamPart,
    reasoningStreamPart,
    sourcePart,
    redactedReasoningStreamPart,
    reasoningSignatureStreamPart,
    fileStreamPart
  ];
  var dataStreamPartsByCode = Object.fromEntries(
    dataStreamParts.map((part) => [part.code, part])
  );
  var DataStreamStringPrefixes = Object.fromEntries(
    dataStreamParts.map((part) => [part.name, part.code])
  );
  var validCodes2 = dataStreamParts.map((part) => part.code);
  function formatDataStreamPart(type, value) {
    const streamPart = dataStreamParts.find((part) => part.name === type);
    if (!streamPart) {
      throw new Error(`Invalid stream part type: ${type}`);
    }
    return `${streamPart.code}:${JSON.stringify(value)}
`;
  }
  var NEWLINE = "\n".charCodeAt(0);
  var NEWLINE2 = "\n".charCodeAt(0);
  function zodSchema(zodSchema2, options) {
    var _a17;
    const useReferences = (_a17 = options == null ? void 0 : options.useReferences) != null ? _a17 : false;
    return jsonSchema(
      esm_default(zodSchema2, {
        $refStrategy: useReferences ? "root" : "none",
        target: "jsonSchema7"
        // note: openai mode breaks various gemini conversions
      }),
      {
        validate: (value) => {
          const result = zodSchema2.safeParse(value);
          return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
        }
      }
    );
  }
  var schemaSymbol = Symbol.for("vercel.ai.schema");
  function jsonSchema(jsonSchema2, {
    validate
  } = {}) {
    return {
      [schemaSymbol]: true,
      _type: void 0,
      // should never be used directly
      [validatorSymbol]: true,
      jsonSchema: jsonSchema2,
      validate
    };
  }
  function isSchema(value) {
    return typeof value === "object" && value !== null && schemaSymbol in value && value[schemaSymbol] === true && "jsonSchema" in value && "validate" in value;
  }
  function asSchema(schema) {
    return isSchema(schema) ? schema : zodSchema(schema);
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/platform/browser/globalThis.js
  var _globalThis = typeof globalThis === "object" ? globalThis : typeof self === "object" ? self : typeof window === "object" ? window : typeof global === "object" ? global : {};

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/version.js
  var VERSION = "1.9.0";

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/internal/semver.js
  var re = /^(\d+)\.(\d+)\.(\d+)(-(.+))?$/;
  function _makeCompatibilityCheck(ownVersion) {
    var acceptedVersions = /* @__PURE__ */ new Set([ownVersion]);
    var rejectedVersions = /* @__PURE__ */ new Set();
    var myVersionMatch = ownVersion.match(re);
    if (!myVersionMatch) {
      return function() {
        return false;
      };
    }
    var ownVersionParsed = {
      major: +myVersionMatch[1],
      minor: +myVersionMatch[2],
      patch: +myVersionMatch[3],
      prerelease: myVersionMatch[4]
    };
    if (ownVersionParsed.prerelease != null) {
      return function isExactmatch(globalVersion) {
        return globalVersion === ownVersion;
      };
    }
    function _reject(v) {
      rejectedVersions.add(v);
      return false;
    }
    function _accept(v) {
      acceptedVersions.add(v);
      return true;
    }
    return function isCompatible2(globalVersion) {
      if (acceptedVersions.has(globalVersion)) {
        return true;
      }
      if (rejectedVersions.has(globalVersion)) {
        return false;
      }
      var globalVersionMatch = globalVersion.match(re);
      if (!globalVersionMatch) {
        return _reject(globalVersion);
      }
      var globalVersionParsed = {
        major: +globalVersionMatch[1],
        minor: +globalVersionMatch[2],
        patch: +globalVersionMatch[3],
        prerelease: globalVersionMatch[4]
      };
      if (globalVersionParsed.prerelease != null) {
        return _reject(globalVersion);
      }
      if (ownVersionParsed.major !== globalVersionParsed.major) {
        return _reject(globalVersion);
      }
      if (ownVersionParsed.major === 0) {
        if (ownVersionParsed.minor === globalVersionParsed.minor && ownVersionParsed.patch <= globalVersionParsed.patch) {
          return _accept(globalVersion);
        }
        return _reject(globalVersion);
      }
      if (ownVersionParsed.minor <= globalVersionParsed.minor) {
        return _accept(globalVersion);
      }
      return _reject(globalVersion);
    };
  }
  var isCompatible = _makeCompatibilityCheck(VERSION);

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/internal/global-utils.js
  var major = VERSION.split(".")[0];
  var GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for("opentelemetry.js.api." + major);
  var _global = _globalThis;
  function registerGlobal(type, instance, diag, allowOverride) {
    var _a17;
    if (allowOverride === void 0) {
      allowOverride = false;
    }
    var api = _global[GLOBAL_OPENTELEMETRY_API_KEY] = (_a17 = _global[GLOBAL_OPENTELEMETRY_API_KEY]) !== null && _a17 !== void 0 ? _a17 : {
      version: VERSION
    };
    if (!allowOverride && api[type]) {
      var err = new Error("@opentelemetry/api: Attempted duplicate registration of API: " + type);
      diag.error(err.stack || err.message);
      return false;
    }
    if (api.version !== VERSION) {
      var err = new Error("@opentelemetry/api: Registration of version v" + api.version + " for " + type + " does not match previously registered API v" + VERSION);
      diag.error(err.stack || err.message);
      return false;
    }
    api[type] = instance;
    diag.debug("@opentelemetry/api: Registered a global for " + type + " v" + VERSION + ".");
    return true;
  }
  function getGlobal(type) {
    var _a17, _b;
    var globalVersion = (_a17 = _global[GLOBAL_OPENTELEMETRY_API_KEY]) === null || _a17 === void 0 ? void 0 : _a17.version;
    if (!globalVersion || !isCompatible(globalVersion)) {
      return;
    }
    return (_b = _global[GLOBAL_OPENTELEMETRY_API_KEY]) === null || _b === void 0 ? void 0 : _b[type];
  }
  function unregisterGlobal(type, diag) {
    diag.debug("@opentelemetry/api: Unregistering a global for " + type + " v" + VERSION + ".");
    var api = _global[GLOBAL_OPENTELEMETRY_API_KEY];
    if (api) {
      delete api[type];
    }
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/diag/ComponentLogger.js
  var __read = function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  };
  var __spreadArray = function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  var DiagComponentLogger = (
    /** @class */
    function() {
      function DiagComponentLogger2(props) {
        this._namespace = props.namespace || "DiagComponentLogger";
      }
      DiagComponentLogger2.prototype.debug = function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        return logProxy("debug", this._namespace, args);
      };
      DiagComponentLogger2.prototype.error = function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        return logProxy("error", this._namespace, args);
      };
      DiagComponentLogger2.prototype.info = function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        return logProxy("info", this._namespace, args);
      };
      DiagComponentLogger2.prototype.warn = function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        return logProxy("warn", this._namespace, args);
      };
      DiagComponentLogger2.prototype.verbose = function() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
        }
        return logProxy("verbose", this._namespace, args);
      };
      return DiagComponentLogger2;
    }()
  );
  function logProxy(funcName, namespace, args) {
    var logger = getGlobal("diag");
    if (!logger) {
      return;
    }
    args.unshift(namespace);
    return logger[funcName].apply(logger, __spreadArray([], __read(args), false));
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/diag/types.js
  var DiagLogLevel;
  (function(DiagLogLevel2) {
    DiagLogLevel2[DiagLogLevel2["NONE"] = 0] = "NONE";
    DiagLogLevel2[DiagLogLevel2["ERROR"] = 30] = "ERROR";
    DiagLogLevel2[DiagLogLevel2["WARN"] = 50] = "WARN";
    DiagLogLevel2[DiagLogLevel2["INFO"] = 60] = "INFO";
    DiagLogLevel2[DiagLogLevel2["DEBUG"] = 70] = "DEBUG";
    DiagLogLevel2[DiagLogLevel2["VERBOSE"] = 80] = "VERBOSE";
    DiagLogLevel2[DiagLogLevel2["ALL"] = 9999] = "ALL";
  })(DiagLogLevel || (DiagLogLevel = {}));

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/diag/internal/logLevelLogger.js
  function createLogLevelDiagLogger(maxLevel, logger) {
    if (maxLevel < DiagLogLevel.NONE) {
      maxLevel = DiagLogLevel.NONE;
    } else if (maxLevel > DiagLogLevel.ALL) {
      maxLevel = DiagLogLevel.ALL;
    }
    logger = logger || {};
    function _filterFunc(funcName, theLevel) {
      var theFunc = logger[funcName];
      if (typeof theFunc === "function" && maxLevel >= theLevel) {
        return theFunc.bind(logger);
      }
      return function() {
      };
    }
    return {
      error: _filterFunc("error", DiagLogLevel.ERROR),
      warn: _filterFunc("warn", DiagLogLevel.WARN),
      info: _filterFunc("info", DiagLogLevel.INFO),
      debug: _filterFunc("debug", DiagLogLevel.DEBUG),
      verbose: _filterFunc("verbose", DiagLogLevel.VERBOSE)
    };
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/api/diag.js
  var __read2 = function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  };
  var __spreadArray2 = function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  var API_NAME = "diag";
  var DiagAPI = (
    /** @class */
    function() {
      function DiagAPI2() {
        function _logProxy(funcName) {
          return function() {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
            }
            var logger = getGlobal("diag");
            if (!logger)
              return;
            return logger[funcName].apply(logger, __spreadArray2([], __read2(args), false));
          };
        }
        var self2 = this;
        var setLogger = function(logger, optionsOrLogLevel) {
          var _a17, _b, _c;
          if (optionsOrLogLevel === void 0) {
            optionsOrLogLevel = { logLevel: DiagLogLevel.INFO };
          }
          if (logger === self2) {
            var err = new Error("Cannot use diag as the logger for itself. Please use a DiagLogger implementation like ConsoleDiagLogger or a custom implementation");
            self2.error((_a17 = err.stack) !== null && _a17 !== void 0 ? _a17 : err.message);
            return false;
          }
          if (typeof optionsOrLogLevel === "number") {
            optionsOrLogLevel = {
              logLevel: optionsOrLogLevel
            };
          }
          var oldLogger = getGlobal("diag");
          var newLogger = createLogLevelDiagLogger((_b = optionsOrLogLevel.logLevel) !== null && _b !== void 0 ? _b : DiagLogLevel.INFO, logger);
          if (oldLogger && !optionsOrLogLevel.suppressOverrideMessage) {
            var stack = (_c = new Error().stack) !== null && _c !== void 0 ? _c : "<failed to generate stacktrace>";
            oldLogger.warn("Current logger will be overwritten from " + stack);
            newLogger.warn("Current logger will overwrite one already registered from " + stack);
          }
          return registerGlobal("diag", newLogger, self2, true);
        };
        self2.setLogger = setLogger;
        self2.disable = function() {
          unregisterGlobal(API_NAME, self2);
        };
        self2.createComponentLogger = function(options) {
          return new DiagComponentLogger(options);
        };
        self2.verbose = _logProxy("verbose");
        self2.debug = _logProxy("debug");
        self2.info = _logProxy("info");
        self2.warn = _logProxy("warn");
        self2.error = _logProxy("error");
      }
      DiagAPI2.instance = function() {
        if (!this._instance) {
          this._instance = new DiagAPI2();
        }
        return this._instance;
      };
      return DiagAPI2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/context/context.js
  function createContextKey(description) {
    return Symbol.for(description);
  }
  var BaseContext = (
    /** @class */
    /* @__PURE__ */ function() {
      function BaseContext2(parentContext) {
        var self2 = this;
        self2._currentContext = parentContext ? new Map(parentContext) : /* @__PURE__ */ new Map();
        self2.getValue = function(key) {
          return self2._currentContext.get(key);
        };
        self2.setValue = function(key, value) {
          var context = new BaseContext2(self2._currentContext);
          context._currentContext.set(key, value);
          return context;
        };
        self2.deleteValue = function(key) {
          var context = new BaseContext2(self2._currentContext);
          context._currentContext.delete(key);
          return context;
        };
      }
      return BaseContext2;
    }()
  );
  var ROOT_CONTEXT = new BaseContext();

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/context/NoopContextManager.js
  var __read3 = function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  };
  var __spreadArray3 = function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  var NoopContextManager = (
    /** @class */
    function() {
      function NoopContextManager2() {
      }
      NoopContextManager2.prototype.active = function() {
        return ROOT_CONTEXT;
      };
      NoopContextManager2.prototype.with = function(_context, fn, thisArg) {
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
          args[_i - 3] = arguments[_i];
        }
        return fn.call.apply(fn, __spreadArray3([thisArg], __read3(args), false));
      };
      NoopContextManager2.prototype.bind = function(_context, target) {
        return target;
      };
      NoopContextManager2.prototype.enable = function() {
        return this;
      };
      NoopContextManager2.prototype.disable = function() {
        return this;
      };
      return NoopContextManager2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/api/context.js
  var __read4 = function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
      e = { error };
    } finally {
      try {
        if (r && !r.done && (m = i["return"])) m.call(i);
      } finally {
        if (e) throw e.error;
      }
    }
    return ar;
  };
  var __spreadArray4 = function(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
        if (!ar) ar = Array.prototype.slice.call(from, 0, i);
        ar[i] = from[i];
      }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
  var API_NAME2 = "context";
  var NOOP_CONTEXT_MANAGER = new NoopContextManager();
  var ContextAPI = (
    /** @class */
    function() {
      function ContextAPI2() {
      }
      ContextAPI2.getInstance = function() {
        if (!this._instance) {
          this._instance = new ContextAPI2();
        }
        return this._instance;
      };
      ContextAPI2.prototype.setGlobalContextManager = function(contextManager) {
        return registerGlobal(API_NAME2, contextManager, DiagAPI.instance());
      };
      ContextAPI2.prototype.active = function() {
        return this._getContextManager().active();
      };
      ContextAPI2.prototype.with = function(context, fn, thisArg) {
        var _a17;
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
          args[_i - 3] = arguments[_i];
        }
        return (_a17 = this._getContextManager()).with.apply(_a17, __spreadArray4([context, fn, thisArg], __read4(args), false));
      };
      ContextAPI2.prototype.bind = function(context, target) {
        return this._getContextManager().bind(context, target);
      };
      ContextAPI2.prototype._getContextManager = function() {
        return getGlobal(API_NAME2) || NOOP_CONTEXT_MANAGER;
      };
      ContextAPI2.prototype.disable = function() {
        this._getContextManager().disable();
        unregisterGlobal(API_NAME2, DiagAPI.instance());
      };
      return ContextAPI2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/trace_flags.js
  var TraceFlags;
  (function(TraceFlags2) {
    TraceFlags2[TraceFlags2["NONE"] = 0] = "NONE";
    TraceFlags2[TraceFlags2["SAMPLED"] = 1] = "SAMPLED";
  })(TraceFlags || (TraceFlags = {}));

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/invalid-span-constants.js
  var INVALID_SPANID = "0000000000000000";
  var INVALID_TRACEID = "00000000000000000000000000000000";
  var INVALID_SPAN_CONTEXT = {
    traceId: INVALID_TRACEID,
    spanId: INVALID_SPANID,
    traceFlags: TraceFlags.NONE
  };

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/NonRecordingSpan.js
  var NonRecordingSpan = (
    /** @class */
    function() {
      function NonRecordingSpan2(_spanContext) {
        if (_spanContext === void 0) {
          _spanContext = INVALID_SPAN_CONTEXT;
        }
        this._spanContext = _spanContext;
      }
      NonRecordingSpan2.prototype.spanContext = function() {
        return this._spanContext;
      };
      NonRecordingSpan2.prototype.setAttribute = function(_key, _value) {
        return this;
      };
      NonRecordingSpan2.prototype.setAttributes = function(_attributes) {
        return this;
      };
      NonRecordingSpan2.prototype.addEvent = function(_name, _attributes) {
        return this;
      };
      NonRecordingSpan2.prototype.addLink = function(_link) {
        return this;
      };
      NonRecordingSpan2.prototype.addLinks = function(_links) {
        return this;
      };
      NonRecordingSpan2.prototype.setStatus = function(_status) {
        return this;
      };
      NonRecordingSpan2.prototype.updateName = function(_name) {
        return this;
      };
      NonRecordingSpan2.prototype.end = function(_endTime) {
      };
      NonRecordingSpan2.prototype.isRecording = function() {
        return false;
      };
      NonRecordingSpan2.prototype.recordException = function(_exception, _time) {
      };
      return NonRecordingSpan2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/context-utils.js
  var SPAN_KEY = createContextKey("OpenTelemetry Context Key SPAN");
  function getSpan(context) {
    return context.getValue(SPAN_KEY) || void 0;
  }
  function getActiveSpan() {
    return getSpan(ContextAPI.getInstance().active());
  }
  function setSpan(context, span) {
    return context.setValue(SPAN_KEY, span);
  }
  function deleteSpan(context) {
    return context.deleteValue(SPAN_KEY);
  }
  function setSpanContext(context, spanContext) {
    return setSpan(context, new NonRecordingSpan(spanContext));
  }
  function getSpanContext(context) {
    var _a17;
    return (_a17 = getSpan(context)) === null || _a17 === void 0 ? void 0 : _a17.spanContext();
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/spancontext-utils.js
  var VALID_TRACEID_REGEX = /^([0-9a-f]{32})$/i;
  var VALID_SPANID_REGEX = /^[0-9a-f]{16}$/i;
  function isValidTraceId(traceId) {
    return VALID_TRACEID_REGEX.test(traceId) && traceId !== INVALID_TRACEID;
  }
  function isValidSpanId(spanId) {
    return VALID_SPANID_REGEX.test(spanId) && spanId !== INVALID_SPANID;
  }
  function isSpanContextValid(spanContext) {
    return isValidTraceId(spanContext.traceId) && isValidSpanId(spanContext.spanId);
  }
  function wrapSpanContext(spanContext) {
    return new NonRecordingSpan(spanContext);
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/NoopTracer.js
  var contextApi = ContextAPI.getInstance();
  var NoopTracer = (
    /** @class */
    function() {
      function NoopTracer2() {
      }
      NoopTracer2.prototype.startSpan = function(name17, options, context) {
        if (context === void 0) {
          context = contextApi.active();
        }
        var root = Boolean(options === null || options === void 0 ? void 0 : options.root);
        if (root) {
          return new NonRecordingSpan();
        }
        var parentFromContext = context && getSpanContext(context);
        if (isSpanContext(parentFromContext) && isSpanContextValid(parentFromContext)) {
          return new NonRecordingSpan(parentFromContext);
        } else {
          return new NonRecordingSpan();
        }
      };
      NoopTracer2.prototype.startActiveSpan = function(name17, arg2, arg3, arg4) {
        var opts;
        var ctx;
        var fn;
        if (arguments.length < 2) {
          return;
        } else if (arguments.length === 2) {
          fn = arg2;
        } else if (arguments.length === 3) {
          opts = arg2;
          fn = arg3;
        } else {
          opts = arg2;
          ctx = arg3;
          fn = arg4;
        }
        var parentContext = ctx !== null && ctx !== void 0 ? ctx : contextApi.active();
        var span = this.startSpan(name17, opts, parentContext);
        var contextWithSpanSet = setSpan(parentContext, span);
        return contextApi.with(contextWithSpanSet, fn, void 0, span);
      };
      return NoopTracer2;
    }()
  );
  function isSpanContext(spanContext) {
    return typeof spanContext === "object" && typeof spanContext["spanId"] === "string" && typeof spanContext["traceId"] === "string" && typeof spanContext["traceFlags"] === "number";
  }

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/ProxyTracer.js
  var NOOP_TRACER = new NoopTracer();
  var ProxyTracer = (
    /** @class */
    function() {
      function ProxyTracer2(_provider, name17, version, options) {
        this._provider = _provider;
        this.name = name17;
        this.version = version;
        this.options = options;
      }
      ProxyTracer2.prototype.startSpan = function(name17, options, context) {
        return this._getTracer().startSpan(name17, options, context);
      };
      ProxyTracer2.prototype.startActiveSpan = function(_name, _options, _context, _fn) {
        var tracer = this._getTracer();
        return Reflect.apply(tracer.startActiveSpan, tracer, arguments);
      };
      ProxyTracer2.prototype._getTracer = function() {
        if (this._delegate) {
          return this._delegate;
        }
        var tracer = this._provider.getDelegateTracer(this.name, this.version, this.options);
        if (!tracer) {
          return NOOP_TRACER;
        }
        this._delegate = tracer;
        return this._delegate;
      };
      return ProxyTracer2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/NoopTracerProvider.js
  var NoopTracerProvider = (
    /** @class */
    function() {
      function NoopTracerProvider2() {
      }
      NoopTracerProvider2.prototype.getTracer = function(_name, _version, _options) {
        return new NoopTracer();
      };
      return NoopTracerProvider2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/ProxyTracerProvider.js
  var NOOP_TRACER_PROVIDER = new NoopTracerProvider();
  var ProxyTracerProvider = (
    /** @class */
    function() {
      function ProxyTracerProvider2() {
      }
      ProxyTracerProvider2.prototype.getTracer = function(name17, version, options) {
        var _a17;
        return (_a17 = this.getDelegateTracer(name17, version, options)) !== null && _a17 !== void 0 ? _a17 : new ProxyTracer(this, name17, version, options);
      };
      ProxyTracerProvider2.prototype.getDelegate = function() {
        var _a17;
        return (_a17 = this._delegate) !== null && _a17 !== void 0 ? _a17 : NOOP_TRACER_PROVIDER;
      };
      ProxyTracerProvider2.prototype.setDelegate = function(delegate) {
        this._delegate = delegate;
      };
      ProxyTracerProvider2.prototype.getDelegateTracer = function(name17, version, options) {
        var _a17;
        return (_a17 = this._delegate) === null || _a17 === void 0 ? void 0 : _a17.getTracer(name17, version, options);
      };
      return ProxyTracerProvider2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace/status.js
  var SpanStatusCode;
  (function(SpanStatusCode2) {
    SpanStatusCode2[SpanStatusCode2["UNSET"] = 0] = "UNSET";
    SpanStatusCode2[SpanStatusCode2["OK"] = 1] = "OK";
    SpanStatusCode2[SpanStatusCode2["ERROR"] = 2] = "ERROR";
  })(SpanStatusCode || (SpanStatusCode = {}));

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/api/trace.js
  var API_NAME3 = "trace";
  var TraceAPI = (
    /** @class */
    function() {
      function TraceAPI2() {
        this._proxyTracerProvider = new ProxyTracerProvider();
        this.wrapSpanContext = wrapSpanContext;
        this.isSpanContextValid = isSpanContextValid;
        this.deleteSpan = deleteSpan;
        this.getSpan = getSpan;
        this.getActiveSpan = getActiveSpan;
        this.getSpanContext = getSpanContext;
        this.setSpan = setSpan;
        this.setSpanContext = setSpanContext;
      }
      TraceAPI2.getInstance = function() {
        if (!this._instance) {
          this._instance = new TraceAPI2();
        }
        return this._instance;
      };
      TraceAPI2.prototype.setGlobalTracerProvider = function(provider) {
        var success = registerGlobal(API_NAME3, this._proxyTracerProvider, DiagAPI.instance());
        if (success) {
          this._proxyTracerProvider.setDelegate(provider);
        }
        return success;
      };
      TraceAPI2.prototype.getTracerProvider = function() {
        return getGlobal(API_NAME3) || this._proxyTracerProvider;
      };
      TraceAPI2.prototype.getTracer = function(name17, version) {
        return this.getTracerProvider().getTracer(name17, version);
      };
      TraceAPI2.prototype.disable = function() {
        unregisterGlobal(API_NAME3, DiagAPI.instance());
        this._proxyTracerProvider = new ProxyTracerProvider();
      };
      return TraceAPI2;
    }()
  );

  // node_modules/.pnpm/@opentelemetry+api@1.9.0/node_modules/@opentelemetry/api/build/esm/trace-api.js
  var trace = TraceAPI.getInstance();

  // node_modules/.pnpm/ai@4.2.0_react@19.0.0_zod@3.24.2/node_modules/ai/dist/index.mjs
  var __defProp3 = Object.defineProperty;
  var __export = (target, all) => {
    for (var name17 in all)
      __defProp3(target, name17, { get: all[name17], enumerable: true });
  };
  function prepareResponseHeaders(headers, {
    contentType,
    dataStreamVersion
  }) {
    const responseHeaders = new Headers(headers != null ? headers : {});
    if (!responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", contentType);
    }
    if (dataStreamVersion !== void 0) {
      responseHeaders.set("X-Vercel-AI-Data-Stream", dataStreamVersion);
    }
    return responseHeaders;
  }
  var name14 = "AI_InvalidArgumentError";
  var marker15 = `vercel.ai.error.${name14}`;
  var symbol15 = Symbol.for(marker15);
  var _a15;
  var InvalidArgumentError2 = class extends AISDKError {
    constructor({
      parameter,
      value,
      message
    }) {
      super({
        name: name14,
        message: `Invalid argument for parameter ${parameter}: ${message}`
      });
      this[_a15] = true;
      this.parameter = parameter;
      this.value = value;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker15);
    }
  };
  _a15 = symbol15;
  var name22 = "AI_RetryError";
  var marker22 = `vercel.ai.error.${name22}`;
  var symbol22 = Symbol.for(marker22);
  var _a22;
  var RetryError = class extends AISDKError {
    constructor({
      message,
      reason,
      errors
    }) {
      super({ name: name22, message });
      this[_a22] = true;
      this.reason = reason;
      this.errors = errors;
      this.lastError = errors[errors.length - 1];
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker22);
    }
  };
  _a22 = symbol22;
  var retryWithExponentialBackoff = ({
    maxRetries = 2,
    initialDelayInMs = 2e3,
    backoffFactor = 2
  } = {}) => async (f) => _retryWithExponentialBackoff(f, {
    maxRetries,
    delayInMs: initialDelayInMs,
    backoffFactor
  });
  async function _retryWithExponentialBackoff(f, {
    maxRetries,
    delayInMs,
    backoffFactor
  }, errors = []) {
    try {
      return await f();
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (maxRetries === 0) {
        throw error;
      }
      const errorMessage = getErrorMessage2(error);
      const newErrors = [...errors, error];
      const tryNumber = newErrors.length;
      if (tryNumber > maxRetries) {
        throw new RetryError({
          message: `Failed after ${tryNumber} attempts. Last error: ${errorMessage}`,
          reason: "maxRetriesExceeded",
          errors: newErrors
        });
      }
      if (error instanceof Error && APICallError.isInstance(error) && error.isRetryable === true && tryNumber <= maxRetries) {
        await delay(delayInMs);
        return _retryWithExponentialBackoff(
          f,
          { maxRetries, delayInMs: backoffFactor * delayInMs, backoffFactor },
          newErrors
        );
      }
      if (tryNumber === 1) {
        throw error;
      }
      throw new RetryError({
        message: `Failed after ${tryNumber} attempts with non-retryable error: '${errorMessage}'`,
        reason: "errorNotRetryable",
        errors: newErrors
      });
    }
  }
  function prepareRetries({
    maxRetries
  }) {
    if (maxRetries != null) {
      if (!Number.isInteger(maxRetries)) {
        throw new InvalidArgumentError2({
          parameter: "maxRetries",
          value: maxRetries,
          message: "maxRetries must be an integer"
        });
      }
      if (maxRetries < 0) {
        throw new InvalidArgumentError2({
          parameter: "maxRetries",
          value: maxRetries,
          message: "maxRetries must be >= 0"
        });
      }
    }
    const maxRetriesResult = maxRetries != null ? maxRetries : 2;
    return {
      maxRetries: maxRetriesResult,
      retry: retryWithExponentialBackoff({ maxRetries: maxRetriesResult })
    };
  }
  function assembleOperationName({
    operationId,
    telemetry
  }) {
    return {
      // standardized operation and resource name:
      "operation.name": `${operationId}${(telemetry == null ? void 0 : telemetry.functionId) != null ? ` ${telemetry.functionId}` : ""}`,
      "resource.name": telemetry == null ? void 0 : telemetry.functionId,
      // detailed, AI SDK specific data:
      "ai.operationId": operationId,
      "ai.telemetry.functionId": telemetry == null ? void 0 : telemetry.functionId
    };
  }
  function getBaseTelemetryAttributes({
    model,
    settings,
    telemetry,
    headers
  }) {
    var _a17;
    return {
      "ai.model.provider": model.provider,
      "ai.model.id": model.modelId,
      // settings:
      ...Object.entries(settings).reduce((attributes, [key, value]) => {
        attributes[`ai.settings.${key}`] = value;
        return attributes;
      }, {}),
      // add metadata as attributes:
      ...Object.entries((_a17 = telemetry == null ? void 0 : telemetry.metadata) != null ? _a17 : {}).reduce(
        (attributes, [key, value]) => {
          attributes[`ai.telemetry.metadata.${key}`] = value;
          return attributes;
        },
        {}
      ),
      // request headers
      ...Object.entries(headers != null ? headers : {}).reduce((attributes, [key, value]) => {
        if (value !== void 0) {
          attributes[`ai.request.headers.${key}`] = value;
        }
        return attributes;
      }, {})
    };
  }
  var noopTracer = {
    startSpan() {
      return noopSpan;
    },
    startActiveSpan(name17, arg1, arg2, arg3) {
      if (typeof arg1 === "function") {
        return arg1(noopSpan);
      }
      if (typeof arg2 === "function") {
        return arg2(noopSpan);
      }
      if (typeof arg3 === "function") {
        return arg3(noopSpan);
      }
    }
  };
  var noopSpan = {
    spanContext() {
      return noopSpanContext;
    },
    setAttribute() {
      return this;
    },
    setAttributes() {
      return this;
    },
    addEvent() {
      return this;
    },
    addLink() {
      return this;
    },
    addLinks() {
      return this;
    },
    setStatus() {
      return this;
    },
    updateName() {
      return this;
    },
    end() {
      return this;
    },
    isRecording() {
      return false;
    },
    recordException() {
      return this;
    }
  };
  var noopSpanContext = {
    traceId: "",
    spanId: "",
    traceFlags: 0
  };
  function getTracer({
    isEnabled = false,
    tracer
  } = {}) {
    if (!isEnabled) {
      return noopTracer;
    }
    if (tracer) {
      return tracer;
    }
    return trace.getTracer("ai");
  }
  function recordSpan({
    name: name17,
    tracer,
    attributes,
    fn,
    endWhenDone = true
  }) {
    return tracer.startActiveSpan(name17, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        if (endWhenDone) {
          span.end();
        }
        return result;
      } catch (error) {
        try {
          if (error instanceof Error) {
            span.recordException({
              name: error.name,
              message: error.message,
              stack: error.stack
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message
            });
          } else {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
        } finally {
          span.end();
        }
        throw error;
      }
    });
  }
  function selectTelemetryAttributes({
    telemetry,
    attributes
  }) {
    if ((telemetry == null ? void 0 : telemetry.isEnabled) !== true) {
      return {};
    }
    return Object.entries(attributes).reduce((attributes2, [key, value]) => {
      if (value === void 0) {
        return attributes2;
      }
      if (typeof value === "object" && "input" in value && typeof value.input === "function") {
        if ((telemetry == null ? void 0 : telemetry.recordInputs) === false) {
          return attributes2;
        }
        const result = value.input();
        return result === void 0 ? attributes2 : { ...attributes2, [key]: result };
      }
      if (typeof value === "object" && "output" in value && typeof value.output === "function") {
        if ((telemetry == null ? void 0 : telemetry.recordOutputs) === false) {
          return attributes2;
        }
        const result = value.output();
        return result === void 0 ? attributes2 : { ...attributes2, [key]: result };
      }
      return { ...attributes2, [key]: value };
    }, {});
  }
  var name32 = "AI_NoImageGeneratedError";
  var marker32 = `vercel.ai.error.${name32}`;
  var symbol32 = Symbol.for(marker32);
  var _a32;
  _a32 = symbol32;
  var mimeTypeSignatures = [
    {
      mimeType: "image/gif",
      bytesPrefix: [71, 73, 70],
      base64Prefix: "R0lG"
    },
    {
      mimeType: "image/png",
      bytesPrefix: [137, 80, 78, 71],
      base64Prefix: "iVBORw"
    },
    {
      mimeType: "image/jpeg",
      bytesPrefix: [255, 216],
      base64Prefix: "/9j/"
    },
    {
      mimeType: "image/webp",
      bytesPrefix: [82, 73, 70, 70],
      base64Prefix: "UklGRg"
    },
    {
      mimeType: "image/bmp",
      bytesPrefix: [66, 77],
      base64Prefix: "Qk"
    },
    {
      mimeType: "image/tiff",
      bytesPrefix: [73, 73, 42, 0],
      base64Prefix: "SUkqAA"
    },
    {
      mimeType: "image/tiff",
      bytesPrefix: [77, 77, 0, 42],
      base64Prefix: "TU0AKg"
    },
    {
      mimeType: "image/avif",
      bytesPrefix: [
        0,
        0,
        0,
        32,
        102,
        116,
        121,
        112,
        97,
        118,
        105,
        102
      ],
      base64Prefix: "AAAAIGZ0eXBhdmlm"
    },
    {
      mimeType: "image/heic",
      bytesPrefix: [
        0,
        0,
        0,
        32,
        102,
        116,
        121,
        112,
        104,
        101,
        105,
        99
      ],
      base64Prefix: "AAAAIGZ0eXBoZWlj"
    }
  ];
  function detectImageMimeType(image) {
    for (const signature of mimeTypeSignatures) {
      if (typeof image === "string" ? image.startsWith(signature.base64Prefix) : image.length >= signature.bytesPrefix.length && signature.bytesPrefix.every((byte, index) => image[index] === byte)) {
        return signature.mimeType;
      }
    }
    return void 0;
  }
  var name42 = "AI_NoObjectGeneratedError";
  var marker42 = `vercel.ai.error.${name42}`;
  var symbol42 = Symbol.for(marker42);
  var _a42;
  var NoObjectGeneratedError = class extends AISDKError {
    constructor({
      message = "No object generated.",
      cause,
      text: text2,
      response,
      usage
    }) {
      super({ name: name42, message, cause });
      this[_a42] = true;
      this.text = text2;
      this.response = response;
      this.usage = usage;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker42);
    }
  };
  _a42 = symbol42;
  var name52 = "AI_DownloadError";
  var marker52 = `vercel.ai.error.${name52}`;
  var symbol52 = Symbol.for(marker52);
  var _a52;
  var DownloadError = class extends AISDKError {
    constructor({
      url,
      statusCode,
      statusText,
      cause,
      message = cause == null ? `Failed to download ${url}: ${statusCode} ${statusText}` : `Failed to download ${url}: ${cause}`
    }) {
      super({ name: name52, message, cause });
      this[_a52] = true;
      this.url = url;
      this.statusCode = statusCode;
      this.statusText = statusText;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker52);
    }
  };
  _a52 = symbol52;
  async function download({
    url,
    fetchImplementation = fetch
  }) {
    var _a17;
    const urlText = url.toString();
    try {
      const response = await fetchImplementation(urlText);
      if (!response.ok) {
        throw new DownloadError({
          url: urlText,
          statusCode: response.status,
          statusText: response.statusText
        });
      }
      return {
        data: new Uint8Array(await response.arrayBuffer()),
        mimeType: (_a17 = response.headers.get("content-type")) != null ? _a17 : void 0
      };
    } catch (error) {
      if (DownloadError.isInstance(error)) {
        throw error;
      }
      throw new DownloadError({ url: urlText, cause: error });
    }
  }
  var name62 = "AI_InvalidDataContentError";
  var marker62 = `vercel.ai.error.${name62}`;
  var symbol62 = Symbol.for(marker62);
  var _a62;
  var InvalidDataContentError = class extends AISDKError {
    constructor({
      content,
      cause,
      message = `Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got ${typeof content}.`
    }) {
      super({ name: name62, message, cause });
      this[_a62] = true;
      this.content = content;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker62);
    }
  };
  _a62 = symbol62;
  var dataContentSchema = z.union([
    z.string(),
    z.instanceof(Uint8Array),
    z.instanceof(ArrayBuffer),
    z.custom(
      // Buffer might not be available in some environments such as CloudFlare:
      (value) => {
        var _a17, _b;
        return (_b = (_a17 = globalThis.Buffer) == null ? void 0 : _a17.isBuffer(value)) != null ? _b : false;
      },
      { message: "Must be a Buffer" }
    )
  ]);
  function convertDataContentToBase64String(content) {
    if (typeof content === "string") {
      return content;
    }
    if (content instanceof ArrayBuffer) {
      return convertUint8ArrayToBase64(new Uint8Array(content));
    }
    return convertUint8ArrayToBase64(content);
  }
  function convertDataContentToUint8Array(content) {
    if (content instanceof Uint8Array) {
      return content;
    }
    if (typeof content === "string") {
      try {
        return convertBase64ToUint8Array(content);
      } catch (error) {
        throw new InvalidDataContentError({
          message: "Invalid data content. Content string is not a base64-encoded media.",
          content,
          cause: error
        });
      }
    }
    if (content instanceof ArrayBuffer) {
      return new Uint8Array(content);
    }
    throw new InvalidDataContentError({ content });
  }
  function convertUint8ArrayToText(uint8Array) {
    try {
      return new TextDecoder().decode(uint8Array);
    } catch (error) {
      throw new Error("Error decoding Uint8Array to text");
    }
  }
  var name72 = "AI_InvalidMessageRoleError";
  var marker72 = `vercel.ai.error.${name72}`;
  var symbol72 = Symbol.for(marker72);
  var _a72;
  var InvalidMessageRoleError = class extends AISDKError {
    constructor({
      role,
      message = `Invalid message role: '${role}'. Must be one of: "system", "user", "assistant", "tool".`
    }) {
      super({ name: name72, message });
      this[_a72] = true;
      this.role = role;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker72);
    }
  };
  _a72 = symbol72;
  function splitDataUrl(dataUrl) {
    try {
      const [header, base64Content] = dataUrl.split(",");
      return {
        mimeType: header.split(";")[0].split(":")[1],
        base64Content
      };
    } catch (error) {
      return {
        mimeType: void 0,
        base64Content: void 0
      };
    }
  }
  async function convertToLanguageModelPrompt({
    prompt,
    modelSupportsImageUrls = true,
    modelSupportsUrl = () => false,
    downloadImplementation = download
  }) {
    const downloadedAssets = await downloadAssets(
      prompt.messages,
      downloadImplementation,
      modelSupportsImageUrls,
      modelSupportsUrl
    );
    return [
      ...prompt.system != null ? [{ role: "system", content: prompt.system }] : [],
      ...prompt.messages.map(
        (message) => convertToLanguageModelMessage(message, downloadedAssets)
      )
    ];
  }
  function convertToLanguageModelMessage(message, downloadedAssets) {
    var _a17, _b, _c, _d, _e, _f;
    const role = message.role;
    switch (role) {
      case "system": {
        return {
          role: "system",
          content: message.content,
          providerMetadata: (_a17 = message.providerOptions) != null ? _a17 : message.experimental_providerMetadata
        };
      }
      case "user": {
        if (typeof message.content === "string") {
          return {
            role: "user",
            content: [{ type: "text", text: message.content }],
            providerMetadata: (_b = message.providerOptions) != null ? _b : message.experimental_providerMetadata
          };
        }
        return {
          role: "user",
          content: message.content.map((part) => convertPartToLanguageModelPart(part, downloadedAssets)).filter((part) => part.type !== "text" || part.text !== ""),
          providerMetadata: (_c = message.providerOptions) != null ? _c : message.experimental_providerMetadata
        };
      }
      case "assistant": {
        if (typeof message.content === "string") {
          return {
            role: "assistant",
            content: [{ type: "text", text: message.content }],
            providerMetadata: (_d = message.providerOptions) != null ? _d : message.experimental_providerMetadata
          };
        }
        return {
          role: "assistant",
          content: message.content.filter(
            // remove empty text parts:
            (part) => part.type !== "text" || part.text !== ""
          ).map((part) => {
            var _a18;
            const providerOptions = (_a18 = part.providerOptions) != null ? _a18 : part.experimental_providerMetadata;
            switch (part.type) {
              case "file": {
                return {
                  type: "file",
                  data: part.data instanceof URL ? part.data : convertDataContentToBase64String(part.data),
                  filename: part.filename,
                  mimeType: part.mimeType,
                  providerMetadata: providerOptions
                };
              }
              case "reasoning": {
                return {
                  type: "reasoning",
                  text: part.text,
                  signature: part.signature,
                  providerMetadata: providerOptions
                };
              }
              case "redacted-reasoning": {
                return {
                  type: "redacted-reasoning",
                  data: part.data,
                  providerMetadata: providerOptions
                };
              }
              case "text": {
                return {
                  type: "text",
                  text: part.text,
                  providerMetadata: providerOptions
                };
              }
              case "tool-call": {
                return {
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  args: part.args,
                  providerMetadata: providerOptions
                };
              }
            }
          }),
          providerMetadata: (_e = message.providerOptions) != null ? _e : message.experimental_providerMetadata
        };
      }
      case "tool": {
        return {
          role: "tool",
          content: message.content.map((part) => {
            var _a18;
            return {
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              result: part.result,
              content: part.experimental_content,
              isError: part.isError,
              providerMetadata: (_a18 = part.providerOptions) != null ? _a18 : part.experimental_providerMetadata
            };
          }),
          providerMetadata: (_f = message.providerOptions) != null ? _f : message.experimental_providerMetadata
        };
      }
      default: {
        const _exhaustiveCheck = role;
        throw new InvalidMessageRoleError({ role: _exhaustiveCheck });
      }
    }
  }
  async function downloadAssets(messages, downloadImplementation, modelSupportsImageUrls, modelSupportsUrl) {
    const urls = messages.filter((message) => message.role === "user").map((message) => message.content).filter(
      (content) => Array.isArray(content)
    ).flat().filter(
      (part) => part.type === "image" || part.type === "file"
    ).filter(
      (part) => !(part.type === "image" && modelSupportsImageUrls === true)
    ).map((part) => part.type === "image" ? part.image : part.data).map(
      (part) => (
        // support string urls:
        typeof part === "string" && (part.startsWith("http:") || part.startsWith("https:")) ? new URL(part) : part
      )
    ).filter((image) => image instanceof URL).filter((url) => !modelSupportsUrl(url));
    const downloadedImages = await Promise.all(
      urls.map(async (url) => ({
        url,
        data: await downloadImplementation({ url })
      }))
    );
    return Object.fromEntries(
      downloadedImages.map(({ url, data }) => [url.toString(), data])
    );
  }
  function convertPartToLanguageModelPart(part, downloadedAssets) {
    var _a17, _b, _c, _d;
    if (part.type === "text") {
      return {
        type: "text",
        text: part.text,
        providerMetadata: (_a17 = part.providerOptions) != null ? _a17 : part.experimental_providerMetadata
      };
    }
    let mimeType = part.mimeType;
    let data;
    let content;
    let normalizedData;
    const type = part.type;
    switch (type) {
      case "image":
        data = part.image;
        break;
      case "file":
        data = part.data;
        break;
      default:
        throw new Error(`Unsupported part type: ${type}`);
    }
    try {
      content = typeof data === "string" ? new URL(data) : data;
    } catch (error) {
      content = data;
    }
    if (content instanceof URL) {
      if (content.protocol === "data:") {
        const { mimeType: dataUrlMimeType, base64Content } = splitDataUrl(
          content.toString()
        );
        if (dataUrlMimeType == null || base64Content == null) {
          throw new Error(`Invalid data URL format in part ${type}`);
        }
        mimeType = dataUrlMimeType;
        normalizedData = convertDataContentToUint8Array(base64Content);
      } else {
        const downloadedFile = downloadedAssets[content.toString()];
        if (downloadedFile) {
          normalizedData = downloadedFile.data;
          mimeType != null ? mimeType : mimeType = downloadedFile.mimeType;
        } else {
          normalizedData = content;
        }
      }
    } else {
      normalizedData = convertDataContentToUint8Array(content);
    }
    switch (type) {
      case "image": {
        if (normalizedData instanceof Uint8Array) {
          mimeType = (_b = detectImageMimeType(normalizedData)) != null ? _b : mimeType;
        }
        return {
          type: "image",
          image: normalizedData,
          mimeType,
          providerMetadata: (_c = part.providerOptions) != null ? _c : part.experimental_providerMetadata
        };
      }
      case "file": {
        if (mimeType == null) {
          throw new Error(`Mime type is missing for file part`);
        }
        return {
          type: "file",
          data: normalizedData instanceof Uint8Array ? convertDataContentToBase64String(normalizedData) : normalizedData,
          filename: part.filename,
          mimeType,
          providerMetadata: (_d = part.providerOptions) != null ? _d : part.experimental_providerMetadata
        };
      }
    }
  }
  function prepareCallSettings({
    maxTokens,
    temperature,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    seed
  }) {
    if (maxTokens != null) {
      if (!Number.isInteger(maxTokens)) {
        throw new InvalidArgumentError2({
          parameter: "maxTokens",
          value: maxTokens,
          message: "maxTokens must be an integer"
        });
      }
      if (maxTokens < 1) {
        throw new InvalidArgumentError2({
          parameter: "maxTokens",
          value: maxTokens,
          message: "maxTokens must be >= 1"
        });
      }
    }
    if (temperature != null) {
      if (typeof temperature !== "number") {
        throw new InvalidArgumentError2({
          parameter: "temperature",
          value: temperature,
          message: "temperature must be a number"
        });
      }
    }
    if (topP != null) {
      if (typeof topP !== "number") {
        throw new InvalidArgumentError2({
          parameter: "topP",
          value: topP,
          message: "topP must be a number"
        });
      }
    }
    if (topK != null) {
      if (typeof topK !== "number") {
        throw new InvalidArgumentError2({
          parameter: "topK",
          value: topK,
          message: "topK must be a number"
        });
      }
    }
    if (presencePenalty != null) {
      if (typeof presencePenalty !== "number") {
        throw new InvalidArgumentError2({
          parameter: "presencePenalty",
          value: presencePenalty,
          message: "presencePenalty must be a number"
        });
      }
    }
    if (frequencyPenalty != null) {
      if (typeof frequencyPenalty !== "number") {
        throw new InvalidArgumentError2({
          parameter: "frequencyPenalty",
          value: frequencyPenalty,
          message: "frequencyPenalty must be a number"
        });
      }
    }
    if (seed != null) {
      if (!Number.isInteger(seed)) {
        throw new InvalidArgumentError2({
          parameter: "seed",
          value: seed,
          message: "seed must be an integer"
        });
      }
    }
    return {
      maxTokens,
      // TODO v5 remove default 0 for temperature
      temperature: temperature != null ? temperature : 0,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      stopSequences: stopSequences != null && stopSequences.length > 0 ? stopSequences : void 0,
      seed
    };
  }
  function attachmentsToParts(attachments) {
    var _a17, _b, _c;
    const parts = [];
    for (const attachment of attachments) {
      let url;
      try {
        url = new URL(attachment.url);
      } catch (error) {
        throw new Error(`Invalid URL: ${attachment.url}`);
      }
      switch (url.protocol) {
        case "http:":
        case "https:": {
          if ((_a17 = attachment.contentType) == null ? void 0 : _a17.startsWith("image/")) {
            parts.push({ type: "image", image: url });
          } else {
            if (!attachment.contentType) {
              throw new Error(
                "If the attachment is not an image, it must specify a content type"
              );
            }
            parts.push({
              type: "file",
              data: url,
              mimeType: attachment.contentType
            });
          }
          break;
        }
        case "data:": {
          let header;
          let base64Content;
          let mimeType;
          try {
            [header, base64Content] = attachment.url.split(",");
            mimeType = header.split(";")[0].split(":")[1];
          } catch (error) {
            throw new Error(`Error processing data URL: ${attachment.url}`);
          }
          if (mimeType == null || base64Content == null) {
            throw new Error(`Invalid data URL format: ${attachment.url}`);
          }
          if ((_b = attachment.contentType) == null ? void 0 : _b.startsWith("image/")) {
            parts.push({
              type: "image",
              image: convertDataContentToUint8Array(base64Content)
            });
          } else if ((_c = attachment.contentType) == null ? void 0 : _c.startsWith("text/")) {
            parts.push({
              type: "text",
              text: convertUint8ArrayToText(
                convertDataContentToUint8Array(base64Content)
              )
            });
          } else {
            if (!attachment.contentType) {
              throw new Error(
                "If the attachment is not an image or text, it must specify a content type"
              );
            }
            parts.push({
              type: "file",
              data: base64Content,
              mimeType: attachment.contentType
            });
          }
          break;
        }
        default: {
          throw new Error(`Unsupported URL protocol: ${url.protocol}`);
        }
      }
    }
    return parts;
  }
  var name82 = "AI_MessageConversionError";
  var marker82 = `vercel.ai.error.${name82}`;
  var symbol82 = Symbol.for(marker82);
  var _a82;
  var MessageConversionError = class extends AISDKError {
    constructor({
      originalMessage,
      message
    }) {
      super({ name: name82, message });
      this[_a82] = true;
      this.originalMessage = originalMessage;
    }
    static isInstance(error) {
      return AISDKError.hasMarker(error, marker82);
    }
  };
  _a82 = symbol82;
  function convertToCoreMessages(messages, options) {
    var _a17, _b;
    const tools = (_a17 = options == null ? void 0 : options.tools) != null ? _a17 : {};
    const coreMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const isLastMessage = i === messages.length - 1;
      const { role, content, experimental_attachments } = message;
      switch (role) {
        case "system": {
          coreMessages.push({
            role: "system",
            content
          });
          break;
        }
        case "user": {
          coreMessages.push({
            role: "user",
            content: experimental_attachments ? [
              { type: "text", text: content },
              ...attachmentsToParts(experimental_attachments)
            ] : content
          });
          break;
        }
        case "assistant": {
          if (message.parts != null) {
            let processBlock2 = function() {
              const content2 = [];
              for (const part of block) {
                switch (part.type) {
                  case "file":
                  case "text": {
                    content2.push(part);
                    break;
                  }
                  case "reasoning": {
                    for (const detail of part.details) {
                      switch (detail.type) {
                        case "text":
                          content2.push({
                            type: "reasoning",
                            text: detail.text,
                            signature: detail.signature
                          });
                          break;
                        case "redacted":
                          content2.push({
                            type: "redacted-reasoning",
                            data: detail.data
                          });
                          break;
                      }
                    }
                    break;
                  }
                  case "tool-invocation":
                    content2.push({
                      type: "tool-call",
                      toolCallId: part.toolInvocation.toolCallId,
                      toolName: part.toolInvocation.toolName,
                      args: part.toolInvocation.args
                    });
                    break;
                  default: {
                    const _exhaustiveCheck = part;
                    throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
                  }
                }
              }
              coreMessages.push({
                role: "assistant",
                content: content2
              });
              const stepInvocations = block.filter(
                (part) => part.type === "tool-invocation"
              ).map((part) => part.toolInvocation);
              if (stepInvocations.length > 0) {
                coreMessages.push({
                  role: "tool",
                  content: stepInvocations.map(
                    (toolInvocation) => {
                      if (!("result" in toolInvocation)) {
                        throw new MessageConversionError({
                          originalMessage: message,
                          message: "ToolInvocation must have a result: " + JSON.stringify(toolInvocation)
                        });
                      }
                      const { toolCallId, toolName, result } = toolInvocation;
                      const tool2 = tools[toolName];
                      return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                        type: "tool-result",
                        toolCallId,
                        toolName,
                        result: tool2.experimental_toToolResultContent(result),
                        experimental_content: tool2.experimental_toToolResultContent(result)
                      } : {
                        type: "tool-result",
                        toolCallId,
                        toolName,
                        result
                      };
                    }
                  )
                });
              }
              block = [];
              blockHasToolInvocations = false;
              currentStep++;
            };
            var processBlock = processBlock2;
            let currentStep = 0;
            let blockHasToolInvocations = false;
            let block = [];
            for (const part of message.parts) {
              switch (part.type) {
                case "text": {
                  if (blockHasToolInvocations) {
                    processBlock2();
                  }
                  block.push(part);
                  break;
                }
                case "file":
                case "reasoning": {
                  block.push(part);
                  break;
                }
                case "tool-invocation": {
                  if (((_b = part.toolInvocation.step) != null ? _b : 0) !== currentStep) {
                    processBlock2();
                  }
                  block.push(part);
                  blockHasToolInvocations = true;
                  break;
                }
              }
            }
            processBlock2();
            break;
          }
          const toolInvocations = message.toolInvocations;
          if (toolInvocations == null || toolInvocations.length === 0) {
            coreMessages.push({ role: "assistant", content });
            break;
          }
          const maxStep = toolInvocations.reduce((max, toolInvocation) => {
            var _a18;
            return Math.max(max, (_a18 = toolInvocation.step) != null ? _a18 : 0);
          }, 0);
          for (let i2 = 0; i2 <= maxStep; i2++) {
            const stepInvocations = toolInvocations.filter(
              (toolInvocation) => {
                var _a18;
                return ((_a18 = toolInvocation.step) != null ? _a18 : 0) === i2;
              }
            );
            if (stepInvocations.length === 0) {
              continue;
            }
            coreMessages.push({
              role: "assistant",
              content: [
                ...isLastMessage && content && i2 === 0 ? [{ type: "text", text: content }] : [],
                ...stepInvocations.map(
                  ({ toolCallId, toolName, args }) => ({
                    type: "tool-call",
                    toolCallId,
                    toolName,
                    args
                  })
                )
              ]
            });
            coreMessages.push({
              role: "tool",
              content: stepInvocations.map((toolInvocation) => {
                if (!("result" in toolInvocation)) {
                  throw new MessageConversionError({
                    originalMessage: message,
                    message: "ToolInvocation must have a result: " + JSON.stringify(toolInvocation)
                  });
                }
                const { toolCallId, toolName, result } = toolInvocation;
                const tool2 = tools[toolName];
                return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                  type: "tool-result",
                  toolCallId,
                  toolName,
                  result: tool2.experimental_toToolResultContent(result),
                  experimental_content: tool2.experimental_toToolResultContent(result)
                } : {
                  type: "tool-result",
                  toolCallId,
                  toolName,
                  result
                };
              })
            });
          }
          if (content && !isLastMessage) {
            coreMessages.push({ role: "assistant", content });
          }
          break;
        }
        case "data": {
          break;
        }
        default: {
          const _exhaustiveCheck = role;
          throw new MessageConversionError({
            originalMessage: message,
            message: `Unsupported role: ${_exhaustiveCheck}`
          });
        }
      }
    }
    return coreMessages;
  }
  function detectPromptType(prompt) {
    if (!Array.isArray(prompt)) {
      return "other";
    }
    if (prompt.length === 0) {
      return "messages";
    }
    const characteristics = prompt.map(detectSingleMessageCharacteristics);
    if (characteristics.some((c) => c === "has-ui-specific-parts")) {
      return "ui-messages";
    } else if (characteristics.every(
      (c) => c === "has-core-specific-parts" || c === "message"
    )) {
      return "messages";
    } else {
      return "other";
    }
  }
  function detectSingleMessageCharacteristics(message) {
    if (typeof message === "object" && message !== null && (message.role === "function" || // UI-only role
    message.role === "data" || // UI-only role
    "toolInvocations" in message || // UI-specific field
    "parts" in message || // UI-specific field
    "experimental_attachments" in message)) {
      return "has-ui-specific-parts";
    } else if (typeof message === "object" && message !== null && "content" in message && (Array.isArray(message.content) || // Core messages can have array content
    "experimental_providerMetadata" in message || "providerOptions" in message)) {
      return "has-core-specific-parts";
    } else if (typeof message === "object" && message !== null && "role" in message && "content" in message && typeof message.content === "string" && ["system", "user", "assistant", "tool"].includes(message.role)) {
      return "message";
    } else {
      return "other";
    }
  }
  var jsonValueSchema = z.lazy(
    () => z.union([
      z.null(),
      z.string(),
      z.number(),
      z.boolean(),
      z.record(z.string(), jsonValueSchema),
      z.array(jsonValueSchema)
    ])
  );
  var providerMetadataSchema = z.record(
    z.string(),
    z.record(z.string(), jsonValueSchema)
  );
  var toolResultContentSchema = z.array(
    z.union([
      z.object({ type: z.literal("text"), text: z.string() }),
      z.object({
        type: z.literal("image"),
        data: z.string(),
        mimeType: z.string().optional()
      })
    ])
  );
  var textPartSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var imagePartSchema = z.object({
    type: z.literal("image"),
    image: z.union([dataContentSchema, z.instanceof(URL)]),
    mimeType: z.string().optional(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var filePartSchema = z.object({
    type: z.literal("file"),
    data: z.union([dataContentSchema, z.instanceof(URL)]),
    filename: z.string().optional(),
    mimeType: z.string(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var reasoningPartSchema = z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var redactedReasoningPartSchema = z.object({
    type: z.literal("redacted-reasoning"),
    data: z.string(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var toolCallPartSchema = z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.unknown(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var toolResultPartSchema = z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
    content: toolResultContentSchema.optional(),
    isError: z.boolean().optional(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var coreSystemMessageSchema = z.object({
    role: z.literal("system"),
    content: z.string(),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var coreUserMessageSchema = z.object({
    role: z.literal("user"),
    content: z.union([
      z.string(),
      z.array(z.union([textPartSchema, imagePartSchema, filePartSchema]))
    ]),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var coreAssistantMessageSchema = z.object({
    role: z.literal("assistant"),
    content: z.union([
      z.string(),
      z.array(
        z.union([
          textPartSchema,
          filePartSchema,
          reasoningPartSchema,
          redactedReasoningPartSchema,
          toolCallPartSchema
        ])
      )
    ]),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var coreToolMessageSchema = z.object({
    role: z.literal("tool"),
    content: z.array(toolResultPartSchema),
    providerOptions: providerMetadataSchema.optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
  });
  var coreMessageSchema = z.union([
    coreSystemMessageSchema,
    coreUserMessageSchema,
    coreAssistantMessageSchema,
    coreToolMessageSchema
  ]);
  function standardizePrompt({
    prompt,
    tools
  }) {
    if (prompt.prompt == null && prompt.messages == null) {
      throw new InvalidPromptError({
        prompt,
        message: "prompt or messages must be defined"
      });
    }
    if (prompt.prompt != null && prompt.messages != null) {
      throw new InvalidPromptError({
        prompt,
        message: "prompt and messages cannot be defined at the same time"
      });
    }
    if (prompt.system != null && typeof prompt.system !== "string") {
      throw new InvalidPromptError({
        prompt,
        message: "system must be a string"
      });
    }
    if (prompt.prompt != null) {
      if (typeof prompt.prompt !== "string") {
        throw new InvalidPromptError({
          prompt,
          message: "prompt must be a string"
        });
      }
      return {
        type: "prompt",
        system: prompt.system,
        messages: [
          {
            role: "user",
            content: prompt.prompt
          }
        ]
      };
    }
    if (prompt.messages != null) {
      const promptType = detectPromptType(prompt.messages);
      if (promptType === "other") {
        throw new InvalidPromptError({
          prompt,
          message: "messages must be an array of CoreMessage or UIMessage"
        });
      }
      const messages = promptType === "ui-messages" ? convertToCoreMessages(prompt.messages, {
        tools
      }) : prompt.messages;
      const validationResult = safeValidateTypes({
        value: messages,
        schema: z.array(coreMessageSchema)
      });
      if (!validationResult.success) {
        throw new InvalidPromptError({
          prompt,
          message: "messages must be an array of CoreMessage or UIMessage",
          cause: validationResult.error
        });
      }
      return {
        type: "messages",
        messages,
        system: prompt.system
      };
    }
    throw new Error("unreachable");
  }
  function calculateLanguageModelUsage({
    promptTokens,
    completionTokens
  }) {
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }
  var DEFAULT_SCHEMA_PREFIX = "JSON schema:";
  var DEFAULT_SCHEMA_SUFFIX = "You MUST answer with a JSON object that matches the JSON schema above.";
  var DEFAULT_GENERIC_SUFFIX = "You MUST answer with JSON.";
  function injectJsonInstruction({
    prompt,
    schema,
    schemaPrefix = schema != null ? DEFAULT_SCHEMA_PREFIX : void 0,
    schemaSuffix = schema != null ? DEFAULT_SCHEMA_SUFFIX : DEFAULT_GENERIC_SUFFIX
  }) {
    return [
      prompt != null && prompt.length > 0 ? prompt : void 0,
      prompt != null && prompt.length > 0 ? "" : void 0,
      // add a newline if prompt is not null
      schemaPrefix,
      schema != null ? JSON.stringify(schema) : void 0,
      schemaSuffix
    ].filter((line) => line != null).join("\n");
  }
  function createAsyncIterableStream(source) {
    const stream = source.pipeThrough(new TransformStream());
    stream[Symbol.asyncIterator] = () => {
      const reader = stream.getReader();
      return {
        async next() {
          const { done, value } = await reader.read();
          return done ? { done: true, value: void 0 } : { done: false, value };
        }
      };
    };
    return stream;
  }
  var noSchemaOutputStrategy = {
    type: "no-schema",
    jsonSchema: void 0,
    validatePartialResult({ value, textDelta }) {
      return { success: true, value: { partial: value, textDelta } };
    },
    validateFinalResult(value, context) {
      return value === void 0 ? {
        success: false,
        error: new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          text: context.text,
          response: context.response,
          usage: context.usage
        })
      } : { success: true, value };
    },
    createElementStream() {
      throw new UnsupportedFunctionalityError({
        functionality: "element streams in no-schema mode"
      });
    }
  };
  var objectOutputStrategy = (schema) => ({
    type: "object",
    jsonSchema: schema.jsonSchema,
    validatePartialResult({ value, textDelta }) {
      return {
        success: true,
        value: {
          // Note: currently no validation of partial results:
          partial: value,
          textDelta
        }
      };
    },
    validateFinalResult(value) {
      return safeValidateTypes({ value, schema });
    },
    createElementStream() {
      throw new UnsupportedFunctionalityError({
        functionality: "element streams in object mode"
      });
    }
  });
  var arrayOutputStrategy = (schema) => {
    const { $schema, ...itemSchema } = schema.jsonSchema;
    return {
      type: "enum",
      // wrap in object that contains array of elements, since most LLMs will not
      // be able to generate an array directly:
      // possible future optimization: use arrays directly when model supports grammar-guided generation
      jsonSchema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          elements: { type: "array", items: itemSchema }
        },
        required: ["elements"],
        additionalProperties: false
      },
      validatePartialResult({ value, latestObject, isFirstDelta, isFinalDelta }) {
        var _a17;
        if (!isJSONObject(value) || !isJSONArray(value.elements)) {
          return {
            success: false,
            error: new TypeValidationError({
              value,
              cause: "value must be an object that contains an array of elements"
            })
          };
        }
        const inputArray = value.elements;
        const resultArray = [];
        for (let i = 0; i < inputArray.length; i++) {
          const element = inputArray[i];
          const result = safeValidateTypes({ value: element, schema });
          if (i === inputArray.length - 1 && !isFinalDelta) {
            continue;
          }
          if (!result.success) {
            return result;
          }
          resultArray.push(result.value);
        }
        const publishedElementCount = (_a17 = latestObject == null ? void 0 : latestObject.length) != null ? _a17 : 0;
        let textDelta = "";
        if (isFirstDelta) {
          textDelta += "[";
        }
        if (publishedElementCount > 0) {
          textDelta += ",";
        }
        textDelta += resultArray.slice(publishedElementCount).map((element) => JSON.stringify(element)).join(",");
        if (isFinalDelta) {
          textDelta += "]";
        }
        return {
          success: true,
          value: {
            partial: resultArray,
            textDelta
          }
        };
      },
      validateFinalResult(value) {
        if (!isJSONObject(value) || !isJSONArray(value.elements)) {
          return {
            success: false,
            error: new TypeValidationError({
              value,
              cause: "value must be an object that contains an array of elements"
            })
          };
        }
        const inputArray = value.elements;
        for (const element of inputArray) {
          const result = safeValidateTypes({ value: element, schema });
          if (!result.success) {
            return result;
          }
        }
        return { success: true, value: inputArray };
      },
      createElementStream(originalStream) {
        let publishedElements = 0;
        return createAsyncIterableStream(
          originalStream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                switch (chunk.type) {
                  case "object": {
                    const array = chunk.object;
                    for (; publishedElements < array.length; publishedElements++) {
                      controller.enqueue(array[publishedElements]);
                    }
                    break;
                  }
                  case "text-delta":
                  case "finish":
                  case "error":
                    break;
                  default: {
                    const _exhaustiveCheck = chunk;
                    throw new Error(
                      `Unsupported chunk type: ${_exhaustiveCheck}`
                    );
                  }
                }
              }
            })
          )
        );
      }
    };
  };
  var enumOutputStrategy = (enumValues) => {
    return {
      type: "enum",
      // wrap in object that contains result, since most LLMs will not
      // be able to generate an enum value directly:
      // possible future optimization: use enums directly when model supports top-level enums
      jsonSchema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          result: { type: "string", enum: enumValues }
        },
        required: ["result"],
        additionalProperties: false
      },
      validateFinalResult(value) {
        if (!isJSONObject(value) || typeof value.result !== "string") {
          return {
            success: false,
            error: new TypeValidationError({
              value,
              cause: 'value must be an object that contains a string in the "result" property.'
            })
          };
        }
        const result = value.result;
        return enumValues.includes(result) ? { success: true, value: result } : {
          success: false,
          error: new TypeValidationError({
            value,
            cause: "value must be a string in the enum"
          })
        };
      },
      validatePartialResult() {
        throw new UnsupportedFunctionalityError({
          functionality: "partial results in enum mode"
        });
      },
      createElementStream() {
        throw new UnsupportedFunctionalityError({
          functionality: "element streams in enum mode"
        });
      }
    };
  };
  function getOutputStrategy({
    output,
    schema,
    enumValues
  }) {
    switch (output) {
      case "object":
        return objectOutputStrategy(asSchema(schema));
      case "array":
        return arrayOutputStrategy(asSchema(schema));
      case "enum":
        return enumOutputStrategy(enumValues);
      case "no-schema":
        return noSchemaOutputStrategy;
      default: {
        const _exhaustiveCheck = output;
        throw new Error(`Unsupported output: ${_exhaustiveCheck}`);
      }
    }
  }
  function validateObjectGenerationInput({
    output,
    mode,
    schema,
    schemaName,
    schemaDescription,
    enumValues
  }) {
    if (output != null && output !== "object" && output !== "array" && output !== "enum" && output !== "no-schema") {
      throw new InvalidArgumentError2({
        parameter: "output",
        value: output,
        message: "Invalid output type."
      });
    }
    if (output === "no-schema") {
      if (mode === "auto" || mode === "tool") {
        throw new InvalidArgumentError2({
          parameter: "mode",
          value: mode,
          message: 'Mode must be "json" for no-schema output.'
        });
      }
      if (schema != null) {
        throw new InvalidArgumentError2({
          parameter: "schema",
          value: schema,
          message: "Schema is not supported for no-schema output."
        });
      }
      if (schemaDescription != null) {
        throw new InvalidArgumentError2({
          parameter: "schemaDescription",
          value: schemaDescription,
          message: "Schema description is not supported for no-schema output."
        });
      }
      if (schemaName != null) {
        throw new InvalidArgumentError2({
          parameter: "schemaName",
          value: schemaName,
          message: "Schema name is not supported for no-schema output."
        });
      }
      if (enumValues != null) {
        throw new InvalidArgumentError2({
          parameter: "enumValues",
          value: enumValues,
          message: "Enum values are not supported for no-schema output."
        });
      }
    }
    if (output === "object") {
      if (schema == null) {
        throw new InvalidArgumentError2({
          parameter: "schema",
          value: schema,
          message: "Schema is required for object output."
        });
      }
      if (enumValues != null) {
        throw new InvalidArgumentError2({
          parameter: "enumValues",
          value: enumValues,
          message: "Enum values are not supported for object output."
        });
      }
    }
    if (output === "array") {
      if (schema == null) {
        throw new InvalidArgumentError2({
          parameter: "schema",
          value: schema,
          message: "Element schema is required for array output."
        });
      }
      if (enumValues != null) {
        throw new InvalidArgumentError2({
          parameter: "enumValues",
          value: enumValues,
          message: "Enum values are not supported for array output."
        });
      }
    }
    if (output === "enum") {
      if (schema != null) {
        throw new InvalidArgumentError2({
          parameter: "schema",
          value: schema,
          message: "Schema is not supported for enum output."
        });
      }
      if (schemaDescription != null) {
        throw new InvalidArgumentError2({
          parameter: "schemaDescription",
          value: schemaDescription,
          message: "Schema description is not supported for enum output."
        });
      }
      if (schemaName != null) {
        throw new InvalidArgumentError2({
          parameter: "schemaName",
          value: schemaName,
          message: "Schema name is not supported for enum output."
        });
      }
      if (enumValues == null) {
        throw new InvalidArgumentError2({
          parameter: "enumValues",
          value: enumValues,
          message: "Enum values are required for enum output."
        });
      }
      for (const value of enumValues) {
        if (typeof value !== "string") {
          throw new InvalidArgumentError2({
            parameter: "enumValues",
            value,
            message: "Enum values must be strings."
          });
        }
      }
    }
  }
  var originalGenerateId = createIdGenerator({ prefix: "aiobj", size: 24 });
  async function generateObject({
    model,
    enum: enumValues,
    // rename bc enum is reserved by typescript
    schema: inputSchema,
    schemaName,
    schemaDescription,
    mode,
    output = "object",
    system,
    prompt,
    messages,
    maxRetries: maxRetriesArg,
    abortSignal,
    headers,
    experimental_repairText: repairText,
    experimental_telemetry: telemetry,
    experimental_providerMetadata,
    providerOptions = experimental_providerMetadata,
    _internal: {
      generateId: generateId3 = originalGenerateId,
      currentDate = () => /* @__PURE__ */ new Date()
    } = {},
    ...settings
  }) {
    validateObjectGenerationInput({
      output,
      mode,
      schema: inputSchema,
      schemaName,
      schemaDescription,
      enumValues
    });
    const { maxRetries, retry } = prepareRetries({ maxRetries: maxRetriesArg });
    const outputStrategy = getOutputStrategy({
      output,
      schema: inputSchema,
      enumValues
    });
    if (outputStrategy.type === "no-schema" && mode === void 0) {
      mode = "json";
    }
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model,
      telemetry,
      headers,
      settings: { ...settings, maxRetries }
    });
    const tracer = getTracer(telemetry);
    return recordSpan({
      name: "ai.generateObject",
      attributes: selectTelemetryAttributes({
        telemetry,
        attributes: {
          ...assembleOperationName({
            operationId: "ai.generateObject",
            telemetry
          }),
          ...baseTelemetryAttributes,
          // specific settings that only make sense on the outer level:
          "ai.prompt": {
            input: () => JSON.stringify({ system, prompt, messages })
          },
          "ai.schema": outputStrategy.jsonSchema != null ? { input: () => JSON.stringify(outputStrategy.jsonSchema) } : void 0,
          "ai.schema.name": schemaName,
          "ai.schema.description": schemaDescription,
          "ai.settings.output": outputStrategy.type,
          "ai.settings.mode": mode
        }
      }),
      tracer,
      fn: async (span) => {
        var _a17, _b, _c, _d;
        if (mode === "auto" || mode == null) {
          mode = model.defaultObjectGenerationMode;
        }
        let result;
        let finishReason;
        let usage;
        let warnings;
        let rawResponse;
        let response;
        let request;
        let logprobs;
        let resultProviderMetadata;
        switch (mode) {
          case "json": {
            const standardizedPrompt = standardizePrompt({
              prompt: {
                system: outputStrategy.jsonSchema == null ? injectJsonInstruction({ prompt: system }) : model.supportsStructuredOutputs ? system : injectJsonInstruction({
                  prompt: system,
                  schema: outputStrategy.jsonSchema
                }),
                prompt,
                messages
              },
              tools: void 0
            });
            const promptMessages = await convertToLanguageModelPrompt({
              prompt: standardizedPrompt,
              modelSupportsImageUrls: model.supportsImageUrls,
              modelSupportsUrl: (_a17 = model.supportsUrl) == null ? void 0 : _a17.bind(model)
              // support 'this' context
            });
            const generateResult = await retry(
              () => recordSpan({
                name: "ai.generateObject.doGenerate",
                attributes: selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    ...assembleOperationName({
                      operationId: "ai.generateObject.doGenerate",
                      telemetry
                    }),
                    ...baseTelemetryAttributes,
                    "ai.prompt.format": {
                      input: () => standardizedPrompt.type
                    },
                    "ai.prompt.messages": {
                      input: () => JSON.stringify(promptMessages)
                    },
                    "ai.settings.mode": mode,
                    // standardized gen-ai llm span attributes:
                    "gen_ai.system": model.provider,
                    "gen_ai.request.model": model.modelId,
                    "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                    "gen_ai.request.max_tokens": settings.maxTokens,
                    "gen_ai.request.presence_penalty": settings.presencePenalty,
                    "gen_ai.request.temperature": settings.temperature,
                    "gen_ai.request.top_k": settings.topK,
                    "gen_ai.request.top_p": settings.topP
                  }
                }),
                tracer,
                fn: async (span2) => {
                  var _a18, _b2, _c2, _d2, _e, _f;
                  const result2 = await model.doGenerate({
                    mode: {
                      type: "object-json",
                      schema: outputStrategy.jsonSchema,
                      name: schemaName,
                      description: schemaDescription
                    },
                    ...prepareCallSettings(settings),
                    inputFormat: standardizedPrompt.type,
                    prompt: promptMessages,
                    providerMetadata: providerOptions,
                    abortSignal,
                    headers
                  });
                  const responseData = {
                    id: (_b2 = (_a18 = result2.response) == null ? void 0 : _a18.id) != null ? _b2 : generateId3(),
                    timestamp: (_d2 = (_c2 = result2.response) == null ? void 0 : _c2.timestamp) != null ? _d2 : currentDate(),
                    modelId: (_f = (_e = result2.response) == null ? void 0 : _e.modelId) != null ? _f : model.modelId
                  };
                  if (result2.text === void 0) {
                    throw new NoObjectGeneratedError({
                      message: "No object generated: the model did not return a response.",
                      response: responseData,
                      usage: calculateLanguageModelUsage(result2.usage)
                    });
                  }
                  span2.setAttributes(
                    selectTelemetryAttributes({
                      telemetry,
                      attributes: {
                        "ai.response.finishReason": result2.finishReason,
                        "ai.response.object": { output: () => result2.text },
                        "ai.response.id": responseData.id,
                        "ai.response.model": responseData.modelId,
                        "ai.response.timestamp": responseData.timestamp.toISOString(),
                        "ai.usage.promptTokens": result2.usage.promptTokens,
                        "ai.usage.completionTokens": result2.usage.completionTokens,
                        // standardized gen-ai llm span attributes:
                        "gen_ai.response.finish_reasons": [result2.finishReason],
                        "gen_ai.response.id": responseData.id,
                        "gen_ai.response.model": responseData.modelId,
                        "gen_ai.usage.prompt_tokens": result2.usage.promptTokens,
                        "gen_ai.usage.completion_tokens": result2.usage.completionTokens
                      }
                    })
                  );
                  return { ...result2, objectText: result2.text, responseData };
                }
              })
            );
            result = generateResult.objectText;
            finishReason = generateResult.finishReason;
            usage = generateResult.usage;
            warnings = generateResult.warnings;
            rawResponse = generateResult.rawResponse;
            logprobs = generateResult.logprobs;
            resultProviderMetadata = generateResult.providerMetadata;
            request = (_b = generateResult.request) != null ? _b : {};
            response = generateResult.responseData;
            break;
          }
          case "tool": {
            const standardizedPrompt = standardizePrompt({
              prompt: { system, prompt, messages },
              tools: void 0
            });
            const promptMessages = await convertToLanguageModelPrompt({
              prompt: standardizedPrompt,
              modelSupportsImageUrls: model.supportsImageUrls,
              modelSupportsUrl: (_c = model.supportsUrl) == null ? void 0 : _c.bind(model)
              // support 'this' context,
            });
            const inputFormat = standardizedPrompt.type;
            const generateResult = await retry(
              () => recordSpan({
                name: "ai.generateObject.doGenerate",
                attributes: selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    ...assembleOperationName({
                      operationId: "ai.generateObject.doGenerate",
                      telemetry
                    }),
                    ...baseTelemetryAttributes,
                    "ai.prompt.format": {
                      input: () => inputFormat
                    },
                    "ai.prompt.messages": {
                      input: () => JSON.stringify(promptMessages)
                    },
                    "ai.settings.mode": mode,
                    // standardized gen-ai llm span attributes:
                    "gen_ai.system": model.provider,
                    "gen_ai.request.model": model.modelId,
                    "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                    "gen_ai.request.max_tokens": settings.maxTokens,
                    "gen_ai.request.presence_penalty": settings.presencePenalty,
                    "gen_ai.request.temperature": settings.temperature,
                    "gen_ai.request.top_k": settings.topK,
                    "gen_ai.request.top_p": settings.topP
                  }
                }),
                tracer,
                fn: async (span2) => {
                  var _a18, _b2, _c2, _d2, _e, _f, _g, _h;
                  const result2 = await model.doGenerate({
                    mode: {
                      type: "object-tool",
                      tool: {
                        type: "function",
                        name: schemaName != null ? schemaName : "json",
                        description: schemaDescription != null ? schemaDescription : "Respond with a JSON object.",
                        parameters: outputStrategy.jsonSchema
                      }
                    },
                    ...prepareCallSettings(settings),
                    inputFormat,
                    prompt: promptMessages,
                    providerMetadata: providerOptions,
                    abortSignal,
                    headers
                  });
                  const objectText = (_b2 = (_a18 = result2.toolCalls) == null ? void 0 : _a18[0]) == null ? void 0 : _b2.args;
                  const responseData = {
                    id: (_d2 = (_c2 = result2.response) == null ? void 0 : _c2.id) != null ? _d2 : generateId3(),
                    timestamp: (_f = (_e = result2.response) == null ? void 0 : _e.timestamp) != null ? _f : currentDate(),
                    modelId: (_h = (_g = result2.response) == null ? void 0 : _g.modelId) != null ? _h : model.modelId
                  };
                  if (objectText === void 0) {
                    throw new NoObjectGeneratedError({
                      message: "No object generated: the tool was not called.",
                      response: responseData,
                      usage: calculateLanguageModelUsage(result2.usage)
                    });
                  }
                  span2.setAttributes(
                    selectTelemetryAttributes({
                      telemetry,
                      attributes: {
                        "ai.response.finishReason": result2.finishReason,
                        "ai.response.object": { output: () => objectText },
                        "ai.response.id": responseData.id,
                        "ai.response.model": responseData.modelId,
                        "ai.response.timestamp": responseData.timestamp.toISOString(),
                        "ai.usage.promptTokens": result2.usage.promptTokens,
                        "ai.usage.completionTokens": result2.usage.completionTokens,
                        // standardized gen-ai llm span attributes:
                        "gen_ai.response.finish_reasons": [result2.finishReason],
                        "gen_ai.response.id": responseData.id,
                        "gen_ai.response.model": responseData.modelId,
                        "gen_ai.usage.input_tokens": result2.usage.promptTokens,
                        "gen_ai.usage.output_tokens": result2.usage.completionTokens
                      }
                    })
                  );
                  return { ...result2, objectText, responseData };
                }
              })
            );
            result = generateResult.objectText;
            finishReason = generateResult.finishReason;
            usage = generateResult.usage;
            warnings = generateResult.warnings;
            rawResponse = generateResult.rawResponse;
            logprobs = generateResult.logprobs;
            resultProviderMetadata = generateResult.providerMetadata;
            request = (_d = generateResult.request) != null ? _d : {};
            response = generateResult.responseData;
            break;
          }
          case void 0: {
            throw new Error(
              "Model does not have a default object generation mode."
            );
          }
          default: {
            const _exhaustiveCheck = mode;
            throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
          }
        }
        function processResult(result2) {
          const parseResult = safeParseJSON({ text: result2 });
          if (!parseResult.success) {
            throw new NoObjectGeneratedError({
              message: "No object generated: could not parse the response.",
              cause: parseResult.error,
              text: result2,
              response,
              usage: calculateLanguageModelUsage(usage)
            });
          }
          const validationResult = outputStrategy.validateFinalResult(
            parseResult.value,
            {
              text: result2,
              response,
              usage: calculateLanguageModelUsage(usage)
            }
          );
          if (!validationResult.success) {
            throw new NoObjectGeneratedError({
              message: "No object generated: response did not match schema.",
              cause: validationResult.error,
              text: result2,
              response,
              usage: calculateLanguageModelUsage(usage)
            });
          }
          return validationResult.value;
        }
        let object2;
        try {
          object2 = processResult(result);
        } catch (error) {
          if (repairText != null && NoObjectGeneratedError.isInstance(error) && (JSONParseError.isInstance(error.cause) || TypeValidationError.isInstance(error.cause))) {
            const repairedText = await repairText({
              text: result,
              error: error.cause
            });
            if (repairedText === null) {
              throw error;
            }
            object2 = processResult(repairedText);
          } else {
            throw error;
          }
        }
        span.setAttributes(
          selectTelemetryAttributes({
            telemetry,
            attributes: {
              "ai.response.finishReason": finishReason,
              "ai.response.object": {
                output: () => JSON.stringify(object2)
              },
              "ai.usage.promptTokens": usage.promptTokens,
              "ai.usage.completionTokens": usage.completionTokens
            }
          })
        );
        return new DefaultGenerateObjectResult({
          object: object2,
          finishReason,
          usage: calculateLanguageModelUsage(usage),
          warnings,
          request,
          response: {
            ...response,
            headers: rawResponse == null ? void 0 : rawResponse.headers,
            body: rawResponse == null ? void 0 : rawResponse.body
          },
          logprobs,
          providerMetadata: resultProviderMetadata
        });
      }
    });
  }
  var DefaultGenerateObjectResult = class {
    constructor(options) {
      this.object = options.object;
      this.finishReason = options.finishReason;
      this.usage = options.usage;
      this.warnings = options.warnings;
      this.providerMetadata = options.providerMetadata;
      this.experimental_providerMetadata = options.providerMetadata;
      this.response = options.response;
      this.request = options.request;
      this.logprobs = options.logprobs;
    }
    toJsonResponse(init) {
      var _a17;
      return new Response(JSON.stringify(this.object), {
        status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
        headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
          contentType: "application/json; charset=utf-8"
        })
      });
    }
  };
  var originalGenerateId2 = createIdGenerator({ prefix: "aiobj", size: 24 });
  var name92 = "AI_NoOutputSpecifiedError";
  var marker92 = `vercel.ai.error.${name92}`;
  var symbol92 = Symbol.for(marker92);
  var _a92;
  _a92 = symbol92;
  var name102 = "AI_ToolExecutionError";
  var marker102 = `vercel.ai.error.${name102}`;
  var symbol102 = Symbol.for(marker102);
  var _a102;
  _a102 = symbol102;
  var name112 = "AI_InvalidToolArgumentsError";
  var marker112 = `vercel.ai.error.${name112}`;
  var symbol112 = Symbol.for(marker112);
  var _a112;
  _a112 = symbol112;
  var name122 = "AI_NoSuchToolError";
  var marker122 = `vercel.ai.error.${name122}`;
  var symbol122 = Symbol.for(marker122);
  var _a122;
  _a122 = symbol122;
  var name132 = "AI_ToolCallRepairError";
  var marker132 = `vercel.ai.error.${name132}`;
  var symbol132 = Symbol.for(marker132);
  var _a132;
  _a132 = symbol132;
  var originalGenerateId3 = createIdGenerator({
    prefix: "aitxt",
    size: 24
  });
  var originalGenerateMessageId = createIdGenerator({
    prefix: "msg",
    size: 24
  });
  var output_exports = {};
  __export(output_exports, {
    object: () => object,
    text: () => text
  });
  var name142 = "AI_InvalidStreamPartError";
  var marker142 = `vercel.ai.error.${name142}`;
  var symbol142 = Symbol.for(marker142);
  var _a142;
  _a142 = symbol142;
  var name15 = "AI_MCPClientError";
  var marker152 = `vercel.ai.error.${name15}`;
  var symbol152 = Symbol.for(marker152);
  var _a152;
  _a152 = symbol152;
  var text = () => ({
    type: "text",
    responseFormat: () => ({ type: "text" }),
    injectIntoSystemPrompt({ system }) {
      return system;
    },
    parsePartial({ text: text2 }) {
      return { partial: text2 };
    },
    parseOutput({ text: text2 }) {
      return text2;
    }
  });
  var object = ({
    schema: inputSchema
  }) => {
    const schema = asSchema(inputSchema);
    return {
      type: "object",
      responseFormat: ({ model }) => ({
        type: "json",
        schema: model.supportsStructuredOutputs ? schema.jsonSchema : void 0
      }),
      injectIntoSystemPrompt({ system, model }) {
        return model.supportsStructuredOutputs ? system : injectJsonInstruction({
          prompt: system,
          schema: schema.jsonSchema
        });
      },
      parsePartial({ text: text2 }) {
        const result = parsePartialJson(text2);
        switch (result.state) {
          case "failed-parse":
          case "undefined-input":
            return void 0;
          case "repaired-parse":
          case "successful-parse":
            return {
              // Note: currently no validation of partial results:
              partial: result.value
            };
          default: {
            const _exhaustiveCheck = result.state;
            throw new Error(`Unsupported parse state: ${_exhaustiveCheck}`);
          }
        }
      },
      parseOutput({ text: text2 }, context) {
        const parseResult = safeParseJSON({ text: text2 });
        if (!parseResult.success) {
          throw new NoObjectGeneratedError({
            message: "No object generated: could not parse the response.",
            cause: parseResult.error,
            text: text2,
            response: context.response,
            usage: context.usage
          });
        }
        const validationResult = safeValidateTypes({
          value: parseResult.value,
          schema
        });
        if (!validationResult.success) {
          throw new NoObjectGeneratedError({
            message: "No object generated: response did not match schema.",
            cause: validationResult.error,
            text: text2,
            response: context.response,
            usage: context.usage
          });
        }
        return validationResult.value;
      }
    };
  };
  function mergeStreams(stream1, stream2) {
    const reader1 = stream1.getReader();
    const reader2 = stream2.getReader();
    let lastRead1 = void 0;
    let lastRead2 = void 0;
    let stream1Done = false;
    let stream2Done = false;
    async function readStream1(controller) {
      try {
        if (lastRead1 == null) {
          lastRead1 = reader1.read();
        }
        const result = await lastRead1;
        lastRead1 = void 0;
        if (!result.done) {
          controller.enqueue(result.value);
        } else {
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    }
    async function readStream2(controller) {
      try {
        if (lastRead2 == null) {
          lastRead2 = reader2.read();
        }
        const result = await lastRead2;
        lastRead2 = void 0;
        if (!result.done) {
          controller.enqueue(result.value);
        } else {
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    }
    return new ReadableStream({
      async pull(controller) {
        try {
          if (stream1Done) {
            await readStream2(controller);
            return;
          }
          if (stream2Done) {
            await readStream1(controller);
            return;
          }
          if (lastRead1 == null) {
            lastRead1 = reader1.read();
          }
          if (lastRead2 == null) {
            lastRead2 = reader2.read();
          }
          const { result, reader } = await Promise.race([
            lastRead1.then((result2) => ({ result: result2, reader: reader1 })),
            lastRead2.then((result2) => ({ result: result2, reader: reader2 }))
          ]);
          if (!result.done) {
            controller.enqueue(result.value);
          }
          if (reader === reader1) {
            lastRead1 = void 0;
            if (result.done) {
              await readStream2(controller);
              stream1Done = true;
            }
          } else {
            lastRead2 = void 0;
            if (result.done) {
              stream2Done = true;
              await readStream1(controller);
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        reader1.cancel();
        reader2.cancel();
      }
    });
  }
  var originalGenerateId4 = createIdGenerator({
    prefix: "aitxt",
    size: 24
  });
  var originalGenerateMessageId2 = createIdGenerator({
    prefix: "msg",
    size: 24
  });
  var name16 = "AI_NoSuchProviderError";
  var marker16 = `vercel.ai.error.${name16}`;
  var symbol16 = Symbol.for(marker16);
  var _a16;
  _a16 = symbol16;
  var ClientOrServerImplementationSchema = z.object({
    name: z.string(),
    version: z.string()
  }).passthrough();
  var BaseParamsSchema = z.object({
    _meta: z.optional(z.object({}).passthrough())
  }).passthrough();
  var ResultSchema = BaseParamsSchema;
  var RequestSchema = z.object({
    method: z.string(),
    params: z.optional(BaseParamsSchema)
  });
  var ServerCapabilitiesSchema = z.object({
    experimental: z.optional(z.object({}).passthrough()),
    logging: z.optional(z.object({}).passthrough()),
    prompts: z.optional(
      z.object({
        listChanged: z.optional(z.boolean())
      }).passthrough()
    ),
    resources: z.optional(
      z.object({
        subscribe: z.optional(z.boolean()),
        listChanged: z.optional(z.boolean())
      }).passthrough()
    ),
    tools: z.optional(
      z.object({
        listChanged: z.optional(z.boolean())
      }).passthrough()
    )
  }).passthrough();
  var InitializeResultSchema = ResultSchema.extend({
    protocolVersion: z.string(),
    capabilities: ServerCapabilitiesSchema,
    serverInfo: ClientOrServerImplementationSchema,
    instructions: z.optional(z.string())
  });
  var PaginatedResultSchema = ResultSchema.extend({
    nextCursor: z.optional(z.string())
  });
  var ToolSchema = z.object({
    name: z.string(),
    description: z.optional(z.string()),
    inputSchema: z.object({
      type: z.literal("object"),
      properties: z.optional(z.object({}).passthrough())
    }).passthrough()
  }).passthrough();
  var ListToolsResultSchema = PaginatedResultSchema.extend({
    tools: z.array(ToolSchema)
  });
  var TextContentSchema = z.object({
    type: z.literal("text"),
    text: z.string()
  }).passthrough();
  var ImageContentSchema = z.object({
    type: z.literal("image"),
    data: z.string().base64(),
    mimeType: z.string()
  }).passthrough();
  var ResourceContentsSchema = z.object({
    /**
     * The URI of this resource.
     */
    uri: z.string(),
    /**
     * The MIME type of this resource, if known.
     */
    mimeType: z.optional(z.string())
  }).passthrough();
  var TextResourceContentsSchema = ResourceContentsSchema.extend({
    text: z.string()
  });
  var BlobResourceContentsSchema = ResourceContentsSchema.extend({
    blob: z.string().base64()
  });
  var EmbeddedResourceSchema = z.object({
    type: z.literal("resource"),
    resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema])
  }).passthrough();
  var CallToolResultSchema = ResultSchema.extend({
    content: z.array(
      z.union([TextContentSchema, ImageContentSchema, EmbeddedResourceSchema])
    ),
    isError: z.boolean().default(false).optional()
  }).or(
    ResultSchema.extend({
      toolResult: z.unknown()
    })
  );
  var JSONRPC_VERSION = "2.0";
  var JSONRPCRequestSchema = z.object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()])
  }).merge(RequestSchema).strict();
  var JSONRPCResponseSchema = z.object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    result: ResultSchema
  }).strict();
  var JSONRPCErrorSchema = z.object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
      data: z.optional(z.unknown())
    })
  }).strict();
  var JSONRPCNotificationSchema = z.object({
    jsonrpc: z.literal(JSONRPC_VERSION)
  }).merge(
    z.object({
      method: z.string(),
      params: z.optional(BaseParamsSchema)
    })
  ).strict();
  var JSONRPCMessageSchema = z.union([
    JSONRPCRequestSchema,
    JSONRPCNotificationSchema,
    JSONRPCResponseSchema,
    JSONRPCErrorSchema
  ]);
  var langchain_adapter_exports = {};
  __export(langchain_adapter_exports, {
    mergeIntoDataStream: () => mergeIntoDataStream,
    toDataStream: () => toDataStream,
    toDataStreamResponse: () => toDataStreamResponse
  });
  function createCallbacksTransformer(callbacks = {}) {
    const textEncoder = new TextEncoder();
    let aggregatedResponse = "";
    return new TransformStream({
      async start() {
        if (callbacks.onStart)
          await callbacks.onStart();
      },
      async transform(message, controller) {
        controller.enqueue(textEncoder.encode(message));
        aggregatedResponse += message;
        if (callbacks.onToken)
          await callbacks.onToken(message);
        if (callbacks.onText && typeof message === "string") {
          await callbacks.onText(message);
        }
      },
      async flush() {
        if (callbacks.onCompletion) {
          await callbacks.onCompletion(aggregatedResponse);
        }
        if (callbacks.onFinal) {
          await callbacks.onFinal(aggregatedResponse);
        }
      }
    });
  }
  function toDataStreamInternal(stream, callbacks) {
    return stream.pipeThrough(
      new TransformStream({
        transform: async (value, controller) => {
          var _a17;
          if (typeof value === "string") {
            controller.enqueue(value);
            return;
          }
          if ("event" in value) {
            if (value.event === "on_chat_model_stream") {
              forwardAIMessageChunk(
                (_a17 = value.data) == null ? void 0 : _a17.chunk,
                controller
              );
            }
            return;
          }
          forwardAIMessageChunk(value, controller);
        }
      })
    ).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        transform: async (chunk, controller) => {
          controller.enqueue(formatDataStreamPart("text", chunk));
        }
      })
    );
  }
  function toDataStream(stream, callbacks) {
    return toDataStreamInternal(stream, callbacks).pipeThrough(
      new TextEncoderStream()
    );
  }
  function toDataStreamResponse(stream, options) {
    var _a17;
    const dataStream = toDataStreamInternal(
      stream,
      options == null ? void 0 : options.callbacks
    ).pipeThrough(new TextEncoderStream());
    const data = options == null ? void 0 : options.data;
    const init = options == null ? void 0 : options.init;
    const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
    return new Response(responseStream, {
      status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
      statusText: init == null ? void 0 : init.statusText,
      headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8",
        dataStreamVersion: "v1"
      })
    });
  }
  function mergeIntoDataStream(stream, options) {
    options.dataStream.merge(toDataStreamInternal(stream, options.callbacks));
  }
  function forwardAIMessageChunk(chunk, controller) {
    if (typeof chunk.content === "string") {
      controller.enqueue(chunk.content);
    } else {
      const content = chunk.content;
      for (const item of content) {
        if (item.type === "text") {
          controller.enqueue(item.text);
        }
      }
    }
  }
  var llamaindex_adapter_exports = {};
  __export(llamaindex_adapter_exports, {
    mergeIntoDataStream: () => mergeIntoDataStream2,
    toDataStream: () => toDataStream2,
    toDataStreamResponse: () => toDataStreamResponse2
  });
  function toDataStreamInternal2(stream, callbacks) {
    const trimStart = trimStartOfStream();
    return convertAsyncIteratorToReadableStream(stream[Symbol.asyncIterator]()).pipeThrough(
      new TransformStream({
        async transform(message, controller) {
          controller.enqueue(trimStart(message.delta));
        }
      })
    ).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        transform: async (chunk, controller) => {
          controller.enqueue(formatDataStreamPart("text", chunk));
        }
      })
    );
  }
  function toDataStream2(stream, callbacks) {
    return toDataStreamInternal2(stream, callbacks).pipeThrough(
      new TextEncoderStream()
    );
  }
  function toDataStreamResponse2(stream, options = {}) {
    var _a17;
    const { init, data, callbacks } = options;
    const dataStream = toDataStreamInternal2(stream, callbacks).pipeThrough(
      new TextEncoderStream()
    );
    const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
    return new Response(responseStream, {
      status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
      statusText: init == null ? void 0 : init.statusText,
      headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8",
        dataStreamVersion: "v1"
      })
    });
  }
  function mergeIntoDataStream2(stream, options) {
    options.dataStream.merge(toDataStreamInternal2(stream, options.callbacks));
  }
  function trimStartOfStream() {
    let isStreamStart = true;
    return (text2) => {
      if (isStreamStart) {
        text2 = text2.trimStart();
        if (text2)
          isStreamStart = false;
      }
      return text2;
    };
  }
  var HANGING_STREAM_WARNING_TIME_MS = 15 * 1e3;

  // src/prompts.ts
  var youArePrompt = `
You are an expert at completing tasks using a web browser.
You have deep knowledge of the web and use only the highest quality sources.
You focus on the task at hand and complete one step at a time.
You adapt to situations and find creative ways to complete tasks without getting stuck.
`.trim();
  var buildPlanPrompt = (task) => `
${youArePrompt}
Create a plan for this web navigation task.
Provide a clear explanation, step-by-step plan, and starting URL.
Focus on general steps and goals rather than specific page features or UI elements.

Today's Date: ${getCurrentFormattedDate()}
Task: ${task}

Best Practices:
- When explaining the task, make sure to expand all dates to include the year.
- For booking tasks, all dates must be in the future.
- Avoid assumptions about specific UI layouts that may change.

Respond with a JSON object matching this structure:
\`\`\`json
{
  "explanation": "Restate the task concisely in your own words, focusing on the core objective.",
  "plan": "Create a high-level, numbered list plan for this web navigation task, with each step on its own line. Focus on general steps without assuming specific page features.",
  "url": "Must be a real top-level domain with no path OR a web search: https://duckduckgo.com/?q=search+query"
}
\`\`\`
`.trim();
  var actionLoopResponseFormat = `{
  "currentStep": "Status (Starting/Working on/Completing) Step #: [exact step text from plan]",
  "observation": "Brief assessment of previous step's outcome. Was it a success or failure? Note the type of data you should extract from the page to complete the task.",
  "extractedData": "Only extract important data from the page that is needed to complete the task. This shouldn't include any element refs. Use markdown to structure this data clearly.",
  "thought": "Reasoning for your next action. If the previous action failed, retry once then try an alternative approach.",
  "action": {
    "action": "The type of action to perform (e.g., 'click', 'fill', 'done').",
    "ref": "reference to the element on the page (e.g., 's#e##'). Not needed for done/wait/goto/back/forward.",
    "value": "Required for fill/select/goto, seconds for wait, result for done."
  }
}`;
  var actionLoopPrompt = `
${youArePrompt}
For each step, assess the current state and decide on the next action to take.
Consider the outcome of previous actions and explain your reasoning.

Actions:
- "select": Select option from dropdown (ref=element reference, value=option)
- "fill": Enter text into field (ref=element reference, value=text)
- "click": Click element (ref=element reference)
- "hover": Hover over element (ref=element reference)
- "check": Check checkbox (ref=element reference)
- "uncheck": Uncheck checkbox (ref=element reference)
- "wait": Wait for specified time (value=seconds)
- "goto": Navigate to a PREVIOUSLY SEEN URL (value=URL)
- "back": Go to previous page
- "forward": Go to next page
- "done": Task is complete (value=final result)

Rules:
1. Use refs from page snapshot (e.g., [ref=s1e33])
2. Perform only one action per step
3. After each action, you'll receive an updated page snapshot
4. For "done", include the final result in value
5. Use "wait" for page loads, animations, or dynamic content
6. The "goto" action can ONLY be used with a URL that has already appeared in the conversation history (either the starting URL or a URL visited during the task). Do NOT invent new URLs.

Best Practices:
- Use click instead of goto whenever possible, especially for navigation elements on the page.
- For forms, click the submit button after filling all fields
- If an element isn't found, try looking for alternative elements

Respond with a JSON object matching this structure:
\`\`\`json
${actionLoopResponseFormat}
\`\`\`
`.trim();
  var buildTaskAndPlanPrompt = (task, explanation, plan) => `
Task: ${task}
Explanation: ${explanation}
Plan: ${plan}
Today's Date: ${getCurrentFormattedDate()}
`.trim();
  var buildPageSnapshotPrompt = (title, url, snapshot) => `
This is a text snapshot of the current page in the browser.

Title: ${title}
URL: ${url}

\`\`\`
${snapshot}
\`\`\`

Assess the current state and choose your next action.
Focus on the most relevant elements that help complete your task.
If content appears dynamic or paginated, consider waiting or exploring navigation options.
If an action has failed twice, try something else or move on.
`.trim();
  var validationFeedbackPrompt = `
Your previous response did not match the required format. Here are the validation errors:

{validationErrors}

Please correct your response to match this exact format:
\`\`\`json
${actionLoopResponseFormat}
\`\`\`

Remember:
- For "select", "fill", "click", "hover", "check", "uncheck" actions, you MUST provide a "ref"
- For "fill", "select", "goto" actions, you MUST provide a "value"
- For "wait" action, you MUST provide a "value" with the number of seconds
- For "done" action, you MUST provide a "value" with the final result
- For "back" and "forward" actions, you must NOT provide a "ref" or "value"
`.trim();
  var buildTaskValidationPrompt = (task, finalAnswer) => `
Review the task completion and determine if it was successful.

Task: ${task}
Final Answer: ${finalAnswer}

Consider:
1. Does the answer directly address the task?
2. Is the answer complete and specific enough?
3. Does it provide the requested information or perform the requested action?

If the task was not completed successfully, provide a brief, direct instruction on what needs to be done to complete it.
`.trim();
  function getCurrentFormattedDate() {
    const date = /* @__PURE__ */ new Date();
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  // src/browser/ariaBrowser.ts
  var PageAction = /* @__PURE__ */ ((PageAction2) => {
    PageAction2["Click"] = "click";
    PageAction2["Hover"] = "hover";
    PageAction2["Fill"] = "fill";
    PageAction2["Focus"] = "focus";
    PageAction2["Check"] = "check";
    PageAction2["Uncheck"] = "uncheck";
    PageAction2["Select"] = "select";
    PageAction2["Wait"] = "wait";
    PageAction2["Goto"] = "goto";
    PageAction2["Back"] = "back";
    PageAction2["Forward"] = "forward";
    PageAction2["Done"] = "done";
    return PageAction2;
  })(PageAction || {});

  // src/schemas.ts
  var planSchema = z.object({
    explanation: z.string(),
    plan: z.string(),
    url: z.string()
  });
  var actionSchema = z.object({
    currentStep: z.string(),
    observation: z.string(),
    extractedData: z.string().optional(),
    thought: z.string(),
    action: z.object({
      action: z.nativeEnum(PageAction),
      ref: z.string().optional(),
      value: z.string().optional()
    })
  });
  var taskValidationSchema = z.object({
    isValid: z.boolean(),
    feedback: z.string().optional()
  });

  // node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.mjs
  var import_index2 = __toESM(require_eventemitter3(), 1);

  // src/events.ts
  var WebAgentEventEmitter = class extends import_index2.default {
    /**
     * Emit a WebAgent event
     */
    emitEvent(event) {
      return this.emit(event.type, event.data);
    }
    /**
     * Listen for a specific WebAgent event type
     */
    onEvent(eventType, listener) {
      return this.on(eventType, listener);
    }
    /**
     * Listen for a specific WebAgent event type once
     */
    onceEvent(eventType, listener) {
      return this.once(eventType, listener);
    }
    /**
     * Remove a listener for a specific WebAgent event type
     */
    offEvent(eventType, listener) {
      return this.off(eventType, listener);
    }
  };

  // node_modules/.pnpm/chalk@5.4.1/node_modules/chalk/source/vendor/ansi-styles/index.js
  var ANSI_BACKGROUND_OFFSET = 10;
  var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
  var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
  var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
  var styles = {
    modifier: {
      reset: [0, 0],
      // 21 isn't widely supported and 22 does the same thing
      bold: [1, 22],
      dim: [2, 22],
      italic: [3, 23],
      underline: [4, 24],
      overline: [53, 55],
      inverse: [7, 27],
      hidden: [8, 28],
      strikethrough: [9, 29]
    },
    color: {
      black: [30, 39],
      red: [31, 39],
      green: [32, 39],
      yellow: [33, 39],
      blue: [34, 39],
      magenta: [35, 39],
      cyan: [36, 39],
      white: [37, 39],
      // Bright color
      blackBright: [90, 39],
      gray: [90, 39],
      // Alias of `blackBright`
      grey: [90, 39],
      // Alias of `blackBright`
      redBright: [91, 39],
      greenBright: [92, 39],
      yellowBright: [93, 39],
      blueBright: [94, 39],
      magentaBright: [95, 39],
      cyanBright: [96, 39],
      whiteBright: [97, 39]
    },
    bgColor: {
      bgBlack: [40, 49],
      bgRed: [41, 49],
      bgGreen: [42, 49],
      bgYellow: [43, 49],
      bgBlue: [44, 49],
      bgMagenta: [45, 49],
      bgCyan: [46, 49],
      bgWhite: [47, 49],
      // Bright color
      bgBlackBright: [100, 49],
      bgGray: [100, 49],
      // Alias of `bgBlackBright`
      bgGrey: [100, 49],
      // Alias of `bgBlackBright`
      bgRedBright: [101, 49],
      bgGreenBright: [102, 49],
      bgYellowBright: [103, 49],
      bgBlueBright: [104, 49],
      bgMagentaBright: [105, 49],
      bgCyanBright: [106, 49],
      bgWhiteBright: [107, 49]
    }
  };
  var modifierNames = Object.keys(styles.modifier);
  var foregroundColorNames = Object.keys(styles.color);
  var backgroundColorNames = Object.keys(styles.bgColor);
  var colorNames = [...foregroundColorNames, ...backgroundColorNames];
  function assembleStyles() {
    const codes = /* @__PURE__ */ new Map();
    for (const [groupName, group] of Object.entries(styles)) {
      for (const [styleName, style] of Object.entries(group)) {
        styles[styleName] = {
          open: `\x1B[${style[0]}m`,
          close: `\x1B[${style[1]}m`
        };
        group[styleName] = styles[styleName];
        codes.set(style[0], style[1]);
      }
      Object.defineProperty(styles, groupName, {
        value: group,
        enumerable: false
      });
    }
    Object.defineProperty(styles, "codes", {
      value: codes,
      enumerable: false
    });
    styles.color.close = "\x1B[39m";
    styles.bgColor.close = "\x1B[49m";
    styles.color.ansi = wrapAnsi16();
    styles.color.ansi256 = wrapAnsi256();
    styles.color.ansi16m = wrapAnsi16m();
    styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
    styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
    styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
    Object.defineProperties(styles, {
      rgbToAnsi256: {
        value(red, green, blue) {
          if (red === green && green === blue) {
            if (red < 8) {
              return 16;
            }
            if (red > 248) {
              return 231;
            }
            return Math.round((red - 8) / 247 * 24) + 232;
          }
          return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
        },
        enumerable: false
      },
      hexToRgb: {
        value(hex) {
          const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
          if (!matches) {
            return [0, 0, 0];
          }
          let [colorString] = matches;
          if (colorString.length === 3) {
            colorString = [...colorString].map((character) => character + character).join("");
          }
          const integer = Number.parseInt(colorString, 16);
          return [
            /* eslint-disable no-bitwise */
            integer >> 16 & 255,
            integer >> 8 & 255,
            integer & 255
            /* eslint-enable no-bitwise */
          ];
        },
        enumerable: false
      },
      hexToAnsi256: {
        value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
        enumerable: false
      },
      ansi256ToAnsi: {
        value(code) {
          if (code < 8) {
            return 30 + code;
          }
          if (code < 16) {
            return 90 + (code - 8);
          }
          let red;
          let green;
          let blue;
          if (code >= 232) {
            red = ((code - 232) * 10 + 8) / 255;
            green = red;
            blue = red;
          } else {
            code -= 16;
            const remainder = code % 36;
            red = Math.floor(code / 36) / 5;
            green = Math.floor(remainder / 6) / 5;
            blue = remainder % 6 / 5;
          }
          const value = Math.max(red, green, blue) * 2;
          if (value === 0) {
            return 30;
          }
          let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
          if (value === 2) {
            result += 60;
          }
          return result;
        },
        enumerable: false
      },
      rgbToAnsi: {
        value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
        enumerable: false
      },
      hexToAnsi: {
        value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
        enumerable: false
      }
    });
    return styles;
  }
  var ansiStyles = assembleStyles();
  var ansi_styles_default = ansiStyles;

  // node_modules/.pnpm/chalk@5.4.1/node_modules/chalk/source/vendor/supports-color/browser.js
  var level = (() => {
    if (!("navigator" in globalThis)) {
      return 0;
    }
    if (globalThis.navigator.userAgentData) {
      const brand = navigator.userAgentData.brands.find(({ brand: brand2 }) => brand2 === "Chromium");
      if (brand && brand.version > 93) {
        return 3;
      }
    }
    if (/\b(Chrome|Chromium)\//.test(globalThis.navigator.userAgent)) {
      return 1;
    }
    return 0;
  })();
  var colorSupport = level !== 0 && {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
  var supportsColor = {
    stdout: colorSupport,
    stderr: colorSupport
  };
  var browser_default = supportsColor;

  // node_modules/.pnpm/chalk@5.4.1/node_modules/chalk/source/utilities.js
  function stringReplaceAll(string, substring, replacer) {
    let index = string.indexOf(substring);
    if (index === -1) {
      return string;
    }
    const substringLength = substring.length;
    let endIndex = 0;
    let returnValue = "";
    do {
      returnValue += string.slice(endIndex, index) + substring + replacer;
      endIndex = index + substringLength;
      index = string.indexOf(substring, endIndex);
    } while (index !== -1);
    returnValue += string.slice(endIndex);
    return returnValue;
  }
  function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
    let endIndex = 0;
    let returnValue = "";
    do {
      const gotCR = string[index - 1] === "\r";
      returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
      endIndex = index + 1;
      index = string.indexOf("\n", endIndex);
    } while (index !== -1);
    returnValue += string.slice(endIndex);
    return returnValue;
  }

  // node_modules/.pnpm/chalk@5.4.1/node_modules/chalk/source/index.js
  var { stdout: stdoutColor, stderr: stderrColor } = browser_default;
  var GENERATOR = Symbol("GENERATOR");
  var STYLER = Symbol("STYLER");
  var IS_EMPTY = Symbol("IS_EMPTY");
  var levelMapping = [
    "ansi",
    "ansi",
    "ansi256",
    "ansi16m"
  ];
  var styles2 = /* @__PURE__ */ Object.create(null);
  var applyOptions = (object2, options = {}) => {
    if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
      throw new Error("The `level` option should be an integer from 0 to 3");
    }
    const colorLevel = stdoutColor ? stdoutColor.level : 0;
    object2.level = options.level === void 0 ? colorLevel : options.level;
  };
  var chalkFactory = (options) => {
    const chalk2 = (...strings) => strings.join(" ");
    applyOptions(chalk2, options);
    Object.setPrototypeOf(chalk2, createChalk.prototype);
    return chalk2;
  };
  function createChalk(options) {
    return chalkFactory(options);
  }
  Object.setPrototypeOf(createChalk.prototype, Function.prototype);
  for (const [styleName, style] of Object.entries(ansi_styles_default)) {
    styles2[styleName] = {
      get() {
        const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
        Object.defineProperty(this, styleName, { value: builder });
        return builder;
      }
    };
  }
  styles2.visible = {
    get() {
      const builder = createBuilder(this, this[STYLER], true);
      Object.defineProperty(this, "visible", { value: builder });
      return builder;
    }
  };
  var getModelAnsi = (model, level2, type, ...arguments_) => {
    if (model === "rgb") {
      if (level2 === "ansi16m") {
        return ansi_styles_default[type].ansi16m(...arguments_);
      }
      if (level2 === "ansi256") {
        return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
      }
      return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
    }
    if (model === "hex") {
      return getModelAnsi("rgb", level2, type, ...ansi_styles_default.hexToRgb(...arguments_));
    }
    return ansi_styles_default[type][model](...arguments_);
  };
  var usedModels = ["rgb", "hex", "ansi256"];
  for (const model of usedModels) {
    styles2[model] = {
      get() {
        const { level: level2 } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level2], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
    const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
    styles2[bgModel] = {
      get() {
        const { level: level2 } = this;
        return function(...arguments_) {
          const styler = createStyler(getModelAnsi(model, levelMapping[level2], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
          return createBuilder(this, styler, this[IS_EMPTY]);
        };
      }
    };
  }
  var proto = Object.defineProperties(() => {
  }, {
    ...styles2,
    level: {
      enumerable: true,
      get() {
        return this[GENERATOR].level;
      },
      set(level2) {
        this[GENERATOR].level = level2;
      }
    }
  });
  var createStyler = (open, close, parent) => {
    let openAll;
    let closeAll;
    if (parent === void 0) {
      openAll = open;
      closeAll = close;
    } else {
      openAll = parent.openAll + open;
      closeAll = close + parent.closeAll;
    }
    return {
      open,
      close,
      openAll,
      closeAll,
      parent
    };
  };
  var createBuilder = (self2, _styler, _isEmpty) => {
    const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
    Object.setPrototypeOf(builder, proto);
    builder[GENERATOR] = self2;
    builder[STYLER] = _styler;
    builder[IS_EMPTY] = _isEmpty;
    return builder;
  };
  var applyStyle = (self2, string) => {
    if (self2.level <= 0 || !string) {
      return self2[IS_EMPTY] ? "" : string;
    }
    let styler = self2[STYLER];
    if (styler === void 0) {
      return string;
    }
    const { openAll, closeAll } = styler;
    if (string.includes("\x1B")) {
      while (styler !== void 0) {
        string = stringReplaceAll(string, styler.close, styler.open);
        styler = styler.parent;
      }
    }
    const lfIndex = string.indexOf("\n");
    if (lfIndex !== -1) {
      string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
    }
    return openAll + string + closeAll;
  };
  Object.defineProperties(createChalk.prototype, styles2);
  var chalk = createChalk();
  var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
  var source_default = chalk;

  // src/loggers.ts
  var ConsoleLogger = class {
    emitter = null;
    initialize(emitter) {
      this.emitter = emitter;
      emitter.onEvent("task:start" /* TASK_START */, this.handleTaskStart);
      emitter.onEvent("task:complete" /* TASK_COMPLETE */, this.handleTaskComplete);
      emitter.onEvent(
        "task:validation" /* TASK_VALIDATION */,
        this.handleTaskValidation
      );
      emitter.onEvent(
        "page:navigation" /* PAGE_NAVIGATION */,
        this.handlePageNavigation
      );
      emitter.onEvent("agent:current_step" /* CURRENT_STEP */, this.handleCurrentStep);
      emitter.onEvent("agent:observation" /* OBSERVATION */, this.handleObservation);
      emitter.onEvent("agent:thought" /* THOUGHT */, this.handleThought);
      emitter.onEvent("agent:extracted_data" /* EXTRACTED_DATA */, this.handleExtractedData);
      emitter.onEvent(
        "action:execution" /* ACTION_EXECUTION */,
        this.handleActionExecution
      );
      emitter.onEvent("action:result" /* ACTION_RESULT */, this.handleActionResult);
      emitter.onEvent(
        "debug:compression" /* DEBUG_COMPRESSION */,
        this.handleCompressionDebug
      );
      emitter.onEvent("debug:messages" /* DEBUG_MESSAGES */, this.handleMessagesDebug);
      emitter.onEvent("system:waiting" /* WAITING */, this.handleWaiting);
      emitter.onEvent(
        "system:network_waiting" /* NETWORK_WAITING */,
        this.handleNetworkWaiting
      );
      emitter.onEvent(
        "system:network_timeout" /* NETWORK_TIMEOUT */,
        this.handleNetworkTimeout
      );
    }
    dispose() {
      if (this.emitter) {
        this.emitter.offEvent("task:start" /* TASK_START */, this.handleTaskStart);
        this.emitter.offEvent(
          "task:complete" /* TASK_COMPLETE */,
          this.handleTaskComplete
        );
        this.emitter.offEvent(
          "task:validation" /* TASK_VALIDATION */,
          this.handleTaskValidation
        );
        this.emitter.offEvent(
          "page:navigation" /* PAGE_NAVIGATION */,
          this.handlePageNavigation
        );
        this.emitter.offEvent(
          "agent:current_step" /* CURRENT_STEP */,
          this.handleCurrentStep
        );
        this.emitter.offEvent(
          "agent:observation" /* OBSERVATION */,
          this.handleObservation
        );
        this.emitter.offEvent("agent:thought" /* THOUGHT */, this.handleThought);
        this.emitter.offEvent(
          "agent:extracted_data" /* EXTRACTED_DATA */,
          this.handleExtractedData
        );
        this.emitter.offEvent(
          "action:execution" /* ACTION_EXECUTION */,
          this.handleActionExecution
        );
        this.emitter.offEvent(
          "action:result" /* ACTION_RESULT */,
          this.handleActionResult
        );
        this.emitter.offEvent(
          "debug:compression" /* DEBUG_COMPRESSION */,
          this.handleCompressionDebug
        );
        this.emitter.offEvent(
          "debug:messages" /* DEBUG_MESSAGES */,
          this.handleMessagesDebug
        );
        this.emitter.offEvent("system:waiting" /* WAITING */, this.handleWaiting);
        this.emitter.offEvent(
          "system:network_waiting" /* NETWORK_WAITING */,
          this.handleNetworkWaiting
        );
        this.emitter.offEvent(
          "system:network_timeout" /* NETWORK_TIMEOUT */,
          this.handleNetworkTimeout
        );
        this.emitter = null;
      }
    }
    handleTaskStart = (data) => {
      console.log(source_default.cyan.bold("\n\u{1F3AF} Task: "), source_default.whiteBright(data.task));
      console.log(source_default.yellow.bold("\n\u{1F4A1} Explanation:"));
      console.log(source_default.whiteBright(data.explanation));
      console.log(source_default.magenta.bold("\n\u{1F4CB} Plan:"));
      console.log(source_default.whiteBright(data.plan));
      console.log(
        source_default.blue.bold("\u{1F310} Starting URL: "),
        source_default.blue.underline(data.url)
      );
    };
    handleTaskComplete = (data) => {
      if (data.finalAnswer) {
        console.log(
          source_default.green.bold("\n\u2728 Final Answer:"),
          source_default.whiteBright(data.finalAnswer)
        );
      }
    };
    handleTaskValidation = (data) => {
      if (data.isValid) {
        console.log(
          source_default.green.bold("\n\u2705 Task Validation:"),
          source_default.green("Answer is valid")
        );
      } else {
        console.log(
          source_default.yellow.bold("\n\u26A0\uFE0F Task Validation:"),
          source_default.yellow("Answer needs improvement")
        );
        if (data.feedback) {
          console.log(
            source_default.yellow("   Feedback:"),
            source_default.whiteBright(data.feedback)
          );
        }
      }
    };
    handlePageNavigation = (data) => {
      console.log(
        source_default.gray(
          "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"
        )
      );
      const truncatedTitle = data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;
      console.log(
        source_default.blue.bold("\u{1F4CD} Current Page:"),
        source_default.blue(truncatedTitle)
      );
    };
    handleCurrentStep = (data) => {
      console.log(source_default.magenta.bold("\u{1F504} Current Step:"));
      console.log(source_default.whiteBright("   " + data.currentStep));
    };
    handleObservation = (data) => {
      console.log(source_default.yellow.bold("\u{1F52D} Observation:"));
      console.log(source_default.whiteBright("   " + data.observation));
    };
    handleThought = (data) => {
      console.log(source_default.yellow.bold("\n\u{1F4AD} Thought:"));
      console.log(source_default.whiteBright("   " + data.thought));
    };
    handleExtractedData = (data) => {
      console.log(source_default.green.bold("\n\u{1F4CB} Extracted Data:"));
      console.log(source_default.whiteBright("   " + data.extractedData));
    };
    handleActionExecution = (data) => {
      console.log(source_default.yellow.bold("\n\u{1F3AF} Actions:"));
      console.log(
        source_default.whiteBright(`   1. ${data.action.toUpperCase()}`),
        data.ref ? source_default.cyan(`ref: ${data.ref}`) : "",
        data.value ? source_default.green(`value: "${data.value}"`) : ""
      );
      console.log(
        source_default.cyan.bold("\n\u25B6\uFE0F Executing action:"),
        source_default.whiteBright(data.action.toUpperCase()),
        data.ref ? source_default.cyan(`ref: ${data.ref}`) : "",
        data.value ? source_default.green(`value: "${data.value}"`) : ""
      );
    };
    handleActionResult = (data) => {
      if (!data.success) {
        console.error(
          source_default.red.bold(`\u274C Failed to execute action: `),
          source_default.whiteBright(data.error || "Unknown error")
        );
      }
    };
    handleCompressionDebug = (data) => {
      console.log(
        source_default.gray("\n\u{1F4DD} Compression:"),
        source_default.green(`${data.compressionPercent}%`),
        source_default.gray(`(${data.originalSize} \u2192 ${data.compressedSize} chars)`)
      );
    };
    handleMessagesDebug = (data) => {
      console.log(source_default.cyan.bold("\n\u{1F914} Messages:"));
      console.log(source_default.gray(JSON.stringify(data.messages, null, 2)));
    };
    handleWaiting = (data) => {
      console.log(
        source_default.yellow.bold(
          `\u23F3 Waiting for ${data.seconds} second${data.seconds !== 1 ? "s" : ""}...`
        )
      );
    };
    handleNetworkWaiting = (data) => {
      console.log(source_default.gray("   \u{1F310} Waiting for network activity to settle..."));
    };
    handleNetworkTimeout = (data) => {
      console.log(source_default.gray("   \u26A0\uFE0F  Network wait timed out, continuing..."));
    };
  };
  var SidebarLogger = class {
    emitter = null;
    logElement;
    constructor(elementId = "spark-log") {
      this.logElement = typeof document !== "undefined" ? document.getElementById(elementId) : null;
    }
    append(msg) {
      if (this.logElement) {
        const div = document.createElement("div");
        div.innerHTML = msg;
        this.logElement.appendChild(div);
        this.logElement.scrollTop = this.logElement.scrollHeight;
      }
    }
    initialize(emitter) {
      this.emitter = emitter;
      emitter.onEvent("task:start" /* TASK_START */, this.handleTaskStart);
      emitter.onEvent("task:complete" /* TASK_COMPLETE */, this.handleTaskComplete);
      emitter.onEvent("page:navigation" /* PAGE_NAVIGATION */, this.handlePageNavigation);
      emitter.onEvent("agent:observation" /* OBSERVATION */, this.handleObservation);
      emitter.onEvent("agent:thought" /* THOUGHT */, this.handleThought);
      emitter.onEvent("action:execution" /* ACTION_EXECUTION */, this.handleActionExecution);
      emitter.onEvent("action:result" /* ACTION_RESULT */, this.handleActionResult);
      emitter.onEvent("debug:compression" /* DEBUG_COMPRESSION */, this.handleCompressionDebug);
      emitter.onEvent("debug:messages" /* DEBUG_MESSAGES */, this.handleMessagesDebug);
      emitter.onEvent("system:waiting" /* WAITING */, this.handleWaiting);
      emitter.onEvent("system:network_waiting" /* NETWORK_WAITING */, this.handleNetworkWaiting);
      emitter.onEvent("system:network_timeout" /* NETWORK_TIMEOUT */, this.handleNetworkTimeout);
    }
    dispose() {
      if (this.emitter) {
        this.emitter.offEvent("task:start" /* TASK_START */, this.handleTaskStart);
        this.emitter.offEvent("task:complete" /* TASK_COMPLETE */, this.handleTaskComplete);
        this.emitter.offEvent("page:navigation" /* PAGE_NAVIGATION */, this.handlePageNavigation);
        this.emitter.offEvent("agent:observation" /* OBSERVATION */, this.handleObservation);
        this.emitter.offEvent("agent:thought" /* THOUGHT */, this.handleThought);
        this.emitter.offEvent("action:execution" /* ACTION_EXECUTION */, this.handleActionExecution);
        this.emitter.offEvent("action:result" /* ACTION_RESULT */, this.handleActionResult);
        this.emitter.offEvent("debug:compression" /* DEBUG_COMPRESSION */, this.handleCompressionDebug);
        this.emitter.offEvent("debug:messages" /* DEBUG_MESSAGES */, this.handleMessagesDebug);
        this.emitter.offEvent("system:waiting" /* WAITING */, this.handleWaiting);
        this.emitter.offEvent("system:network_waiting" /* NETWORK_WAITING */, this.handleNetworkWaiting);
        this.emitter.offEvent("system:network_timeout" /* NETWORK_TIMEOUT */, this.handleNetworkTimeout);
        this.emitter = null;
      }
    }
    handleTaskStart = (data) => {
      this.append(`<b>\u{1F3AF} Task:</b> <span>${data.task}</span>`);
      this.append(`<b>\u{1F4A1} Explanation:</b> <span>${data.explanation}</span>`);
      this.append(`<b>\u{1F4CB} Plan:</b> <span>${data.plan}</span>`);
      this.append(`<b>\u{1F310} Starting URL:</b> <span style='color:#0074d9;'>${data.url}</span>`);
    };
    handleTaskComplete = (data) => {
      if (data.finalAnswer) {
        this.append(`<b style='color:green;'>\u2728 Final Answer:</b> <span>${data.finalAnswer}</span>`);
      }
    };
    handlePageNavigation = (data) => {
      this.append(`<div style='color:#aaa;margin:8px 0 2px 0;'>\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501</div>`);
      const truncatedTitle = data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;
      this.append(`<b>\u{1F4CD} Current Page:</b> <span>${truncatedTitle}</span>`);
    };
    handleObservation = (data) => {
      this.append(`<b>\u{1F52D} Observation:</b> <span>${data.observation}</span>`);
    };
    handleThought = (data) => {
      this.append(`<b>\u{1F4AD} Thought:</b> <span>${data.thought}</span>`);
    };
    handleActionExecution = (data) => {
      let details = `<b>\u{1F3AF} Action:</b> <span>${data.action.toUpperCase()}</span>`;
      if (data.ref) details += ` <span style='color:#0074d9;'>ref: ${data.ref}</span>`;
      if (data.value) details += ` <span style='color:green;'>value: "${data.value}"</span>`;
      this.append(details);
      this.append(`<b>\u25B6\uFE0F Executing:</b> <span>${data.action.toUpperCase()}</span>`);
    };
    handleActionResult = (data) => {
      if (!data.success) {
        this.append(`<span style='color:red;'><b>\u274C Failed to execute action:</b> ${data.error || "Unknown error"}</span>`);
      }
    };
    handleCompressionDebug = (data) => {
      this.append(`<span style='color:#888;'>\u{1F4DD} Compression: <b>${data.compressionPercent}%</b> (${data.originalSize} \u2192 ${data.compressedSize} chars)</span>`);
    };
    handleMessagesDebug = (data) => {
      this.append(`<b>\u{1F914} Messages:</b> <pre style='white-space:pre-wrap;max-height:100px;overflow:auto;background:#f8f8f8;border:1px solid #eee;padding:4px;'>${JSON.stringify(data.messages, null, 2)}</pre>`);
    };
    handleWaiting = (data) => {
      this.append(`<span style='color:#b8860b;'>\u23F3 Waiting for ${data.seconds} second${data.seconds !== 1 ? "s" : ""}...</span>`);
    };
    handleNetworkWaiting = (data) => {
      this.append(`<span style='color:#888;'>\u{1F310} Waiting for network activity to settle...</span>`);
    };
    handleNetworkTimeout = (data) => {
      this.append(`<span style='color:#888;'>\u26A0\uFE0F  Network wait timed out, continuing...</span>`);
    };
  };

  // src/webAgent.ts
  var WebAgent = class {
    constructor(browser, options = {}) {
      this.browser = browser;
      this.DEBUG = options.debug || false;
      this.provider = options.provider || openai("gpt-4.1");
      this.eventEmitter = new WebAgentEventEmitter();
      this.logger = options.logger || new ConsoleLogger();
      this.logger.initialize(this.eventEmitter);
    }
    plan = "";
    url = "";
    messages = [];
    provider;
    DEBUG = false;
    taskExplanation = "";
    FILTERED_PREFIXES = ["/url:"];
    ARIA_TRANSFORMATIONS = [
      [/^listitem/g, "li"],
      [/(?<=\[)ref=/g, ""],
      [/^link/g, "a"],
      [/^text: (.*?)$/g, '"$1"'],
      [/^heading "([^"]+)" \[level=(\d+)\]/g, 'h$2 "$1"']
    ];
    eventEmitter;
    logger;
    currentPage = { url: "", title: "" };
    // Regex patterns for aria ref validation
    ARIA_REF_REGEX = /^s\d+e\d+$/;
    ARIA_REF_EXTRACT_REGEX = /\b(s\d+e\d+)\b/;
    async createPlan(task) {
      const response = await generateObject({
        model: this.provider,
        schema: planSchema,
        prompt: buildPlanPrompt(task),
        temperature: 0
      });
      this.taskExplanation = response.object.explanation;
      this.plan = response.object.plan;
      this.url = response.object.url;
      return { plan: this.plan, url: this.url };
    }
    setupMessages(task) {
      this.messages = [
        {
          role: "system",
          content: actionLoopPrompt
        },
        {
          role: "user",
          content: buildTaskAndPlanPrompt(task, this.taskExplanation, this.plan)
        }
      ];
      return this.messages;
    }
    validateAriaRef(ref) {
      if (!ref) {
        return { isValid: false, error: "Aria ref is required" };
      }
      if (this.ARIA_REF_REGEX.test(ref)) {
        return { isValid: true };
      }
      const match = ref.match(this.ARIA_REF_EXTRACT_REGEX);
      if (match?.[1]) {
        return { isValid: true, correctedRef: match[1] };
      }
      return {
        isValid: false,
        error: `Invalid aria ref format. Expected format: s<number>e<number> (e.g., s1e23). Got: ${ref}`
      };
    }
    validateActionResponse(response) {
      const errors = [];
      const correctedResponse = { ...response };
      if (!response.currentStep?.trim()) {
        errors.push('Missing or invalid "currentStep" field');
      }
      if (!response.observation?.trim()) {
        errors.push('Missing or invalid "observation" field');
      }
      if (!response.thought?.trim()) {
        errors.push('Missing or invalid "thought" field');
      }
      if (!response.extractedData?.trim()) {
        errors.push('Missing or invalid "extractedData" field');
      }
      if (!response.action || typeof response.action !== "object") {
        errors.push('Missing or invalid "action" field');
        return { isValid: false, errors };
      }
      const { action } = response;
      if (!action.action?.trim()) {
        errors.push('Missing or invalid "action.action" field');
      }
      switch (action.action) {
        case "select":
        case "fill":
        case "click":
        case "hover":
        case "check":
        case "uncheck":
          if (!action.ref) {
            errors.push(
              `Missing required "ref" field for ${action.action} action`
            );
          } else {
            const { isValid: isValid2, error, correctedRef } = this.validateAriaRef(
              action.ref
            );
            if (!isValid2 && error) {
              errors.push(error);
            } else if (correctedRef) {
              correctedResponse.action.ref = correctedRef;
            }
          }
          if ((action.action === "fill" || action.action === "select") && !action.value?.trim()) {
            errors.push(
              `Missing required "value" field for ${action.action} action`
            );
          }
          break;
        case "wait":
          if (!action.value || isNaN(Number(action.value))) {
            errors.push(
              'Missing or invalid "value" field for wait action (must be a number)'
            );
          }
          break;
        case "done":
          if (!action.value?.trim()) {
            errors.push('Missing required "value" field for done action');
          }
          break;
        case "goto":
          if (!action.value?.trim()) {
            errors.push('Missing required "value" field for goto action');
          }
          break;
        case "back":
        case "forward":
          if (action.ref || action.value) {
            errors.push(
              `${action.action} action should not have ref or value fields`
            );
          }
          break;
      }
      return {
        isValid: errors.length === 0,
        errors,
        correctedResponse: errors.length === 0 ? correctedResponse : void 0
      };
    }
    /**
     * Captures the current page state but doesn't emit navigation events
     * Only used when taking snapshots for AI processing
     */
    capturePageState(newTitle, newUrl) {
      this.currentPage = { url: newUrl, title: newTitle };
    }
    /**
     * Records a true navigation event (explicitly called only when we know navigation has occurred)
     * This emits the navigation event for logging/display purposes
     */
    recordNavigationEvent(title, url) {
      console.debug(`\u{1F4C4} Navigation occurred to: ${url}`);
      this.eventEmitter.emitEvent({
        type: "page:navigation" /* PAGE_NAVIGATION */,
        data: { timestamp: Date.now(), title, url }
      });
      this.currentPage = { url, title };
    }
    async getNextActions(pageSnapshot, retryCount = 0) {
      const compressedSnapshot = this.compressSnapshot(pageSnapshot);
      const [pageTitle, pageUrl] = await Promise.all([
        this.browser.getTitle(),
        this.browser.getUrl()
      ]);
      if (this.DEBUG) {
        this.logCompressionStats(pageSnapshot, compressedSnapshot);
      }
      this.capturePageState(pageTitle, pageUrl);
      this.updateMessagesWithSnapshot(pageTitle, pageUrl, compressedSnapshot);
      if (this.DEBUG) {
        this.emitDebugMessages();
      }
      const response = await generateObject({
        model: this.provider,
        schema: actionSchema,
        messages: this.messages,
        temperature: 0
      });
      const { isValid: isValid2, errors, correctedResponse } = this.validateActionResponse(
        response.object
      );
      if (!isValid2) {
        if (retryCount >= 2) {
          throw new Error(
            `Failed to get valid response after ${retryCount + 1} attempts. Errors: ${errors.join(", ")}`
          );
        }
        if (correctedResponse) {
          return correctedResponse;
        }
        this.addValidationFeedback(errors, response.object);
        return this.getNextActions(pageSnapshot, retryCount + 1);
      }
      return response.object;
    }
    logCompressionStats(original, compressed) {
      const originalSize = original.length;
      const compressedSize = compressed.length;
      const compressionPercent = Math.round(
        (1 - compressedSize / originalSize) * 100
      );
      this.eventEmitter.emitEvent({
        type: "debug:compression" /* DEBUG_COMPRESSION */,
        data: {
          timestamp: Date.now(),
          originalSize,
          compressedSize,
          compressionPercent
        }
      });
    }
    updateMessagesWithSnapshot(pageTitle, pageUrl, snapshot) {
      this.messages.forEach((msg) => {
        if (msg.role === "user" && msg.content.includes("snapshot") && msg.content.includes("```")) {
          msg.content = msg.content.replace(
            /```[\s\S]*$/g,
            "```[snapshot clipped for length]```"
          );
        }
      });
      this.messages.push({
        role: "user",
        content: buildPageSnapshotPrompt(pageTitle, pageUrl, snapshot)
      });
    }
    emitDebugMessages() {
      this.eventEmitter.emitEvent({
        type: "debug:messages" /* DEBUG_MESSAGES */,
        data: { timestamp: Date.now(), messages: this.messages }
      });
    }
    addValidationFeedback(errors, response) {
      this.messages.push({
        role: "assistant",
        content: JSON.stringify(response)
      });
      this.messages.push({
        role: "user",
        content: validationFeedbackPrompt.replace(
          "{validationErrors}",
          errors.join("\n")
        )
      });
    }
    // Helper function to wait for a specified number of seconds
    async wait(seconds) {
      this.eventEmitter.emitEvent({
        type: "system:waiting" /* WAITING */,
        data: {
          timestamp: Date.now(),
          seconds
        }
      });
      return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
    }
    emitTaskStartEvent(task) {
      this.eventEmitter.emitEvent({
        type: "task:start" /* TASK_START */,
        data: {
          timestamp: Date.now(),
          task,
          explanation: this.taskExplanation,
          plan: this.plan,
          url: this.url
        }
      });
    }
    // Reset the state for a new task
    resetState() {
      this.plan = "";
      this.url = "";
      this.messages = [];
      this.currentPage = { url: "", title: "" };
    }
    async validateTaskCompletion(task, finalAnswer) {
      const response = await generateObject({
        model: this.provider,
        schema: taskValidationSchema,
        prompt: buildTaskValidationPrompt(task, finalAnswer),
        temperature: 0
      });
      this.eventEmitter.emitEvent({
        type: "task:validation" /* TASK_VALIDATION */,
        data: {
          timestamp: Date.now(),
          isValid: response.object.isValid,
          feedback: response.object.feedback,
          finalAnswer
        }
      });
      return response.object;
    }
    async execute(task) {
      if (!task) {
        throw new Error("No task provided.");
      }
      this.resetState();
      await Promise.all([this.createPlan(task), this.browser.start()]);
      this.emitTaskStartEvent(task);
      await this.browser.goto(this.url);
      const [pageTitle, pageUrl] = await Promise.all([
        this.browser.getTitle(),
        this.browser.getUrl()
      ]);
      this.recordNavigationEvent(pageTitle, pageUrl);
      this.setupMessages(task);
      let finalAnswer = null;
      let validationAttempts = 0;
      let lastValidationFeedback = "";
      while (!finalAnswer && validationAttempts < 3) {
        const pageSnapshot = await this.browser.getText();
        const result = await this.getNextActions(pageSnapshot);
        this.eventEmitter.emitEvent({
          type: "agent:current_step" /* CURRENT_STEP */,
          data: {
            timestamp: Date.now(),
            currentStep: result.currentStep
          }
        });
        this.eventEmitter.emitEvent({
          type: "agent:observation" /* OBSERVATION */,
          data: {
            timestamp: Date.now(),
            observation: result.observation
          }
        });
        this.eventEmitter.emitEvent({
          type: "agent:extracted_data" /* EXTRACTED_DATA */,
          data: {
            timestamp: Date.now(),
            extractedData: result.extractedData || ""
          }
        });
        this.eventEmitter.emitEvent({
          type: "agent:thought" /* THOUGHT */,
          data: {
            timestamp: Date.now(),
            thought: result.thought
          }
        });
        this.eventEmitter.emitEvent({
          type: "action:execution" /* ACTION_EXECUTION */,
          data: {
            timestamp: Date.now(),
            action: result.action.action,
            ref: result.action.ref || void 0,
            value: result.action.value || void 0
          }
        });
        if (result.action.action === "done") {
          finalAnswer = result.action.value;
          if (!finalAnswer) {
            throw new Error("Missing final answer value in done action");
          }
          const { isValid: isValid2, feedback } = await this.validateTaskCompletion(
            task,
            finalAnswer
          );
          if (isValid2) {
            this.eventEmitter.emitEvent({
              type: "task:complete" /* TASK_COMPLETE */,
              data: {
                timestamp: Date.now(),
                finalAnswer
              }
            });
            break;
          } else {
            validationAttempts++;
            lastValidationFeedback = feedback || "Unknown validation error";
            if (validationAttempts < 3) {
              finalAnswer = null;
              this.messages.push({
                role: "assistant",
                content: JSON.stringify(result)
              });
              this.messages.push({
                role: "user",
                content: `Task not completed successfully. ${feedback} Please continue working on the task.`
              });
              continue;
            }
            throw new Error(
              `Failed to complete task after ${validationAttempts} attempts. Last feedback: ${lastValidationFeedback}`
            );
          }
        }
        try {
          switch (result.action.action) {
            case "wait":
              const seconds = parseInt(result.action.value || "1", 10);
              await this.wait(seconds);
              break;
            case "goto":
              if (result.action.value) {
                await this.browser.goto(result.action.value);
                const [navTitle, navUrl] = await Promise.all([
                  this.browser.getTitle(),
                  this.browser.getUrl()
                ]);
                this.recordNavigationEvent(navTitle, navUrl);
              } else {
                throw new Error("Missing URL for goto action");
              }
              break;
            case "back":
              await this.browser.goBack();
              const [backTitle, backUrl] = await Promise.all([
                this.browser.getTitle(),
                this.browser.getUrl()
              ]);
              this.recordNavigationEvent(backTitle, backUrl);
              break;
            case "forward":
              await this.browser.goForward();
              const [fwdTitle, fwdUrl] = await Promise.all([
                this.browser.getTitle(),
                this.browser.getUrl()
              ]);
              this.recordNavigationEvent(fwdTitle, fwdUrl);
              break;
            default:
              if (!result.action.ref) {
                throw new Error("Missing ref for action");
              }
              await this.browser.performAction(
                result.action.ref,
                result.action.action,
                result.action.value
              );
              if (["click", "select"].includes(result.action.action)) {
                const [actionTitle, actionUrl] = await Promise.all([
                  this.browser.getTitle(),
                  this.browser.getUrl()
                ]);
                if (actionUrl !== this.currentPage.url || actionTitle !== this.currentPage.title) {
                  this.recordNavigationEvent(actionTitle, actionUrl);
                }
              }
          }
          this.messages.push({
            role: "assistant",
            content: JSON.stringify(result)
          });
          this.eventEmitter.emitEvent({
            type: "action:result" /* ACTION_RESULT */,
            data: {
              timestamp: Date.now(),
              success: true
            }
          });
        } catch (error) {
          this.eventEmitter.emitEvent({
            type: "action:result" /* ACTION_RESULT */,
            data: {
              timestamp: Date.now(),
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }
          });
          this.messages.push({
            role: "assistant",
            content: `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
      return finalAnswer;
    }
    async close() {
      this.logger.dispose();
      await this.browser.shutdown();
    }
    /**
     * Compresses the aria tree snapshot to reduce token usage while maintaining essential information
     */
    compressSnapshot(snapshot) {
      const transformed = snapshot.split("\n").map((line) => line.trim()).map((line) => line.replace(/^- /, "")).filter(
        (line) => !this.FILTERED_PREFIXES.some((start) => line.startsWith(start))
      ).map((line) => {
        return this.ARIA_TRANSFORMATIONS.reduce(
          (processed, [pattern, replacement]) => processed.replace(pattern, replacement),
          line
        );
      }).filter(Boolean);
      let lastQuotedText = "";
      const deduped = transformed.map((line) => {
        const match = line.match(/^([^"]*)"([^"]+)"(.*)$/);
        if (!match) return line;
        const [, prefix, quotedText, suffix] = match;
        if (quotedText === lastQuotedText) {
          return `${prefix}[same as above]${suffix}`;
        }
        lastQuotedText = quotedText;
        return line;
      });
      return deduped.join("\n");
    }
  };

  // src/extension/extensionBrowser.ts
  var ExtensionBrowser = class {
    async start() {
      console.log("[ExtensionBrowser] start()");
    }
    async shutdown() {
      console.log("[ExtensionBrowser] shutdown()");
    }
    async goto(url) {
      console.log(`[ExtensionBrowser] goto(${url})`);
      throw new Error(`stopped after attempted goto(${url})`);
    }
    async goBack() {
      console.log("[ExtensionBrowser] goBack()");
    }
    async goForward() {
      console.log("[ExtensionBrowser] goForward()");
    }
    async getUrl() {
      console.log("[ExtensionBrowser] getUrl()");
      return "https://example.com";
    }
    async getTitle() {
      console.log("[ExtensionBrowser] getTitle()");
      return "Example Page Title";
    }
    async getText() {
      console.log("[ExtensionBrowser] getText()");
      return "[Mocked page text snapshot]";
    }
    async getScreenshot() {
      console.log("[ExtensionBrowser] getScreenshot()");
      return Buffer.from("");
    }
    async performAction(ref, action, value) {
      console.log(`[ExtensionBrowser] performAction(ref=${ref}, action=${action}, value=${value})`);
    }
    async waitForLoadState(state, options) {
      console.log(`[ExtensionBrowser] waitForLoadState(${state}, timeout=${options?.timeout})`);
    }
  };

  // src/extension/agentEntry.ts
  async function runWebAgentTask(task, apiKey, apiEndpoint, model, logger) {
    const browser = new ExtensionBrowser();
    const agent = new WebAgent(browser, {
      debug: true,
      logger,
      provider: createOpenAI({
        apiKey,
        baseURL: apiEndpoint
      })(model)
    });
    const result = await agent.execute(task);
    await agent.close();
    return result;
  }
  window.AgentAPI = { runWebAgentTask, SidebarLogger };
})();
