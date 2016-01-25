

/* @preserve
 * The MIT License (MIT)
 * 
 * Copyright (c) 2013-2015 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
/**
 * bluebird build version 2.10.2
 * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, cancel, using, filter, any, each, timers
*/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof _dereq_=="function"&&_dereq_;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof _dereq_=="function"&&_dereq_;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var SomePromiseArray = Promise._SomePromiseArray;
function any(promises) {
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function (promises) {
    return any(promises);
};

Promise.prototype.any = function () {
    return any(this);
};

};

},{}],2:[function(_dereq_,module,exports){
"use strict";
var firstLineError;
try {throw new Error(); } catch (e) {firstLineError = e;}
var schedule = _dereq_("./schedule.js");
var Queue = _dereq_("./queue.js");
var util = _dereq_("./util.js");

function Async() {
    this._isTickUsed = false;
    this._lateQueue = new Queue(16);
    this._normalQueue = new Queue(16);
    this._trampolineEnabled = true;
    var self = this;
    this.drainQueues = function () {
        self._drainQueues();
    };
    this._schedule =
        schedule.isStatic ? schedule(this.drainQueues) : schedule;
}

Async.prototype.disableTrampolineIfNecessary = function() {
    if (util.hasDevTools) {
        this._trampolineEnabled = false;
    }
};

Async.prototype.enableTrampoline = function() {
    if (!this._trampolineEnabled) {
        this._trampolineEnabled = true;
        this._schedule = function(fn) {
            setTimeout(fn, 0);
        };
    }
};

Async.prototype.haveItemsQueued = function () {
    return this._normalQueue.length() > 0;
};

Async.prototype.throwLater = function(fn, arg) {
    if (arguments.length === 1) {
        arg = fn;
        fn = function () { throw arg; };
    }
    if (typeof setTimeout !== "undefined") {
        setTimeout(function() {
            fn(arg);
        }, 0);
    } else try {
        this._schedule(function() {
            fn(arg);
        });
    } catch (e) {
        throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/m3OTXk\u000a");
    }
};

function AsyncInvokeLater(fn, receiver, arg) {
    this._lateQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncInvoke(fn, receiver, arg) {
    this._normalQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncSettlePromises(promise) {
    this._normalQueue._pushOne(promise);
    this._queueTick();
}

if (!util.hasDevTools) {
    Async.prototype.invokeLater = AsyncInvokeLater;
    Async.prototype.invoke = AsyncInvoke;
    Async.prototype.settlePromises = AsyncSettlePromises;
} else {
    if (schedule.isStatic) {
        schedule = function(fn) { setTimeout(fn, 0); };
    }
    Async.prototype.invokeLater = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvokeLater.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                setTimeout(function() {
                    fn.call(receiver, arg);
                }, 100);
            });
        }
    };

    Async.prototype.invoke = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvoke.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                fn.call(receiver, arg);
            });
        }
    };

    Async.prototype.settlePromises = function(promise) {
        if (this._trampolineEnabled) {
            AsyncSettlePromises.call(this, promise);
        } else {
            this._schedule(function() {
                promise._settlePromises();
            });
        }
    };
}

Async.prototype.invokeFirst = function (fn, receiver, arg) {
    this._normalQueue.unshift(fn, receiver, arg);
    this._queueTick();
};

Async.prototype._drainQueue = function(queue) {
    while (queue.length() > 0) {
        var fn = queue.shift();
        if (typeof fn !== "function") {
            fn._settlePromises();
            continue;
        }
        var receiver = queue.shift();
        var arg = queue.shift();
        fn.call(receiver, arg);
    }
};

Async.prototype._drainQueues = function () {
    this._drainQueue(this._normalQueue);
    this._reset();
    this._drainQueue(this._lateQueue);
};

Async.prototype._queueTick = function () {
    if (!this._isTickUsed) {
        this._isTickUsed = true;
        this._schedule(this.drainQueues);
    }
};

Async.prototype._reset = function () {
    this._isTickUsed = false;
};

module.exports = new Async();
module.exports.firstLineError = firstLineError;

},{"./queue.js":28,"./schedule.js":31,"./util.js":38}],3:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise) {
var rejectThis = function(_, e) {
    this._reject(e);
};

var targetRejected = function(e, context) {
    context.promiseRejectionQueued = true;
    context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
};

var bindingResolved = function(thisArg, context) {
    if (this._isPending()) {
        this._resolveCallback(context.target);
    }
};

var bindingRejected = function(e, context) {
    if (!context.promiseRejectionQueued) this._reject(e);
};

Promise.prototype.bind = function (thisArg) {
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 1);
    var target = this._target();

    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        var context = {
            promiseRejectionQueued: false,
            promise: ret,
            target: target,
            bindingPromise: maybePromise
        };
        target._then(INTERNAL, targetRejected, ret._progress, ret, context);
        maybePromise._then(
            bindingResolved, bindingRejected, ret._progress, ret, context);
    } else {
        ret._resolveCallback(target);
    }
    return ret;
};

Promise.prototype._setBoundTo = function (obj) {
    if (obj !== undefined) {
        this._bitField = this._bitField | 131072;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~131072);
    }
};

Promise.prototype._isBound = function () {
    return (this._bitField & 131072) === 131072;
};

Promise.bind = function (thisArg, value) {
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);

    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        maybePromise._then(function() {
            ret._resolveCallback(value);
        }, ret._reject, ret._progress, ret, null);
    } else {
        ret._resolveCallback(value);
    }
    return ret;
};
};

},{}],4:[function(_dereq_,module,exports){
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict() {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
var bluebird = _dereq_("./promise.js")();
bluebird.noConflict = noConflict;
module.exports = bluebird;

},{"./promise.js":23}],5:[function(_dereq_,module,exports){
"use strict";
var cr = Object.create;
if (cr) {
    var callerCache = cr(null);
    var getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
}

module.exports = function(Promise) {
var util = _dereq_("./util.js");
var canEvaluate = util.canEvaluate;
var isIdentifier = util.isIdentifier;

var getMethodCaller;
var getGetter;
if (!true) {
var makeMethodCaller = function (methodName) {
    return new Function("ensureMethod", "                                    \n\
        return function(obj) {                                               \n\
            'use strict'                                                     \n\
            var len = this.length;                                           \n\
            ensureMethod(obj, 'methodName');                                 \n\
            switch(len) {                                                    \n\
                case 1: return obj.methodName(this[0]);                      \n\
                case 2: return obj.methodName(this[0], this[1]);             \n\
                case 3: return obj.methodName(this[0], this[1], this[2]);    \n\
                case 0: return obj.methodName();                             \n\
                default:                                                     \n\
                    return obj.methodName.apply(obj, this);                  \n\
            }                                                                \n\
        };                                                                   \n\
        ".replace(/methodName/g, methodName))(ensureMethod);
};

var makeGetter = function (propertyName) {
    return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
};

var getCompiled = function(name, compiler, cache) {
    var ret = cache[name];
    if (typeof ret !== "function") {
        if (!isIdentifier(name)) {
            return null;
        }
        ret = compiler(name);
        cache[name] = ret;
        cache[" size"]++;
        if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0; i < 256; ++i) delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
        }
    }
    return ret;
};

getMethodCaller = function(name) {
    return getCompiled(name, makeMethodCaller, callerCache);
};

getGetter = function(name) {
    return getCompiled(name, makeGetter, getterCache);
};
}

function ensureMethod(obj, methodName) {
    var fn;
    if (obj != null) fn = obj[methodName];
    if (typeof fn !== "function") {
        var message = "Object " + util.classString(obj) + " has no method '" +
            util.toString(methodName) + "'";
        throw new Promise.TypeError(message);
    }
    return fn;
}

function caller(obj) {
    var methodName = this.pop();
    var fn = ensureMethod(obj, methodName);
    return fn.apply(obj, this);
}
Promise.prototype.call = function (methodName) {
    var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
    if (!true) {
        if (canEvaluate) {
            var maybeCaller = getMethodCaller(methodName);
            if (maybeCaller !== null) {
                return this._then(
                    maybeCaller, undefined, undefined, args, undefined);
            }
        }
    }
    args.push(methodName);
    return this._then(caller, undefined, undefined, args, undefined);
};

function namedGetter(obj) {
    return obj[this];
}
function indexedGetter(obj) {
    var index = +this;
    if (index < 0) index = Math.max(0, index + obj.length);
    return obj[index];
}
Promise.prototype.get = function (propertyName) {
    var isIndex = (typeof propertyName === "number");
    var getter;
    if (!isIndex) {
        if (canEvaluate) {
            var maybeGetter = getGetter(propertyName);
            getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
            getter = namedGetter;
        }
    } else {
        getter = indexedGetter;
    }
    return this._then(getter, undefined, undefined, propertyName, undefined);
};
};

},{"./util.js":38}],6:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var errors = _dereq_("./errors.js");
var async = _dereq_("./async.js");
var CancellationError = errors.CancellationError;

Promise.prototype._cancel = function (reason) {
    if (!this.isCancellable()) return this;
    var parent;
    var promiseToReject = this;
    while ((parent = promiseToReject._cancellationParent) !== undefined &&
        parent.isCancellable()) {
        promiseToReject = parent;
    }
    this._unsetCancellable();
    promiseToReject._target()._rejectCallback(reason, false, true);
};

Promise.prototype.cancel = function (reason) {
    if (!this.isCancellable()) return this;
    if (reason === undefined) reason = new CancellationError();
    async.invokeLater(this._cancel, this, reason);
    return this;
};

Promise.prototype.cancellable = function () {
    if (this._cancellable()) return this;
    async.enableTrampoline();
    this._setCancellable();
    this._cancellationParent = undefined;
    return this;
};

Promise.prototype.uncancellable = function () {
    var ret = this.then();
    ret._unsetCancellable();
    return ret;
};

Promise.prototype.fork = function (didFulfill, didReject, didProgress) {
    var ret = this._then(didFulfill, didReject, didProgress,
                         undefined, undefined);

    ret._setCancellable();
    ret._cancellationParent = undefined;
    return ret;
};
};

},{"./async.js":2,"./errors.js":13}],7:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var bluebirdFramePattern =
    /[\\\/]bluebird[\\\/]js[\\\/](main|debug|zalgo|instrumented)/;
var stackFramePattern = null;
var formatStack = null;
var indentStackFrames = false;
var warn;

function CapturedTrace(parent) {
    this._parent = parent;
    var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
    captureStackTrace(this, CapturedTrace);
    if (length > 32) this.uncycle();
}
util.inherits(CapturedTrace, Error);

CapturedTrace.prototype.uncycle = function() {
    var length = this._length;
    if (length < 2) return;
    var nodes = [];
    var stackToIndex = {};

    for (var i = 0, node = this; node !== undefined; ++i) {
        nodes.push(node);
        node = node._parent;
    }
    length = this._length = i;
    for (var i = length - 1; i >= 0; --i) {
        var stack = nodes[i].stack;
        if (stackToIndex[stack] === undefined) {
            stackToIndex[stack] = i;
        }
    }
    for (var i = 0; i < length; ++i) {
        var currentStack = nodes[i].stack;
        var index = stackToIndex[currentStack];
        if (index !== undefined && index !== i) {
            if (index > 0) {
                nodes[index - 1]._parent = undefined;
                nodes[index - 1]._length = 1;
            }
            nodes[i]._parent = undefined;
            nodes[i]._length = 1;
            var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;

            if (index < length - 1) {
                cycleEdgeNode._parent = nodes[index + 1];
                cycleEdgeNode._parent.uncycle();
                cycleEdgeNode._length =
                    cycleEdgeNode._parent._length + 1;
            } else {
                cycleEdgeNode._parent = undefined;
                cycleEdgeNode._length = 1;
            }
            var currentChildLength = cycleEdgeNode._length + 1;
            for (var j = i - 2; j >= 0; --j) {
                nodes[j]._length = currentChildLength;
                currentChildLength++;
            }
            return;
        }
    }
};

CapturedTrace.prototype.parent = function() {
    return this._parent;
};

CapturedTrace.prototype.hasParent = function() {
    return this._parent !== undefined;
};

CapturedTrace.prototype.attachExtraTrace = function(error) {
    if (error.__stackCleaned__) return;
    this.uncycle();
    var parsed = CapturedTrace.parseStackAndMessage(error);
    var message = parsed.message;
    var stacks = [parsed.stack];

    var trace = this;
    while (trace !== undefined) {
        stacks.push(cleanStack(trace.stack.split("\n")));
        trace = trace._parent;
    }
    removeCommonRoots(stacks);
    removeDuplicateOrEmptyJumps(stacks);
    util.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
    util.notEnumerableProp(error, "__stackCleaned__", true);
};

function reconstructStack(message, stacks) {
    for (var i = 0; i < stacks.length - 1; ++i) {
        stacks[i].push("From previous event:");
        stacks[i] = stacks[i].join("\n");
    }
    if (i < stacks.length) {
        stacks[i] = stacks[i].join("\n");
    }
    return message + "\n" + stacks.join("\n");
}

function removeDuplicateOrEmptyJumps(stacks) {
    for (var i = 0; i < stacks.length; ++i) {
        if (stacks[i].length === 0 ||
            ((i + 1 < stacks.length) && stacks[i][0] === stacks[i+1][0])) {
            stacks.splice(i, 1);
            i--;
        }
    }
}

function removeCommonRoots(stacks) {
    var current = stacks[0];
    for (var i = 1; i < stacks.length; ++i) {
        var prev = stacks[i];
        var currentLastIndex = current.length - 1;
        var currentLastLine = current[currentLastIndex];
        var commonRootMeetPoint = -1;

        for (var j = prev.length - 1; j >= 0; --j) {
            if (prev[j] === currentLastLine) {
                commonRootMeetPoint = j;
                break;
            }
        }

        for (var j = commonRootMeetPoint; j >= 0; --j) {
            var line = prev[j];
            if (current[currentLastIndex] === line) {
                current.pop();
                currentLastIndex--;
            } else {
                break;
            }
        }
        current = prev;
    }
}

function cleanStack(stack) {
    var ret = [];
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        var isTraceLine = stackFramePattern.test(line) ||
            "    (No stack trace)" === line;
        var isInternalFrame = isTraceLine && shouldIgnore(line);
        if (isTraceLine && !isInternalFrame) {
            if (indentStackFrames && line.charAt(0) !== " ") {
                line = "    " + line;
            }
            ret.push(line);
        }
    }
    return ret;
}

function stackFramesAsArray(error) {
    var stack = error.stack.replace(/\s+$/g, "").split("\n");
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        if ("    (No stack trace)" === line || stackFramePattern.test(line)) {
            break;
        }
    }
    if (i > 0) {
        stack = stack.slice(i);
    }
    return stack;
}

CapturedTrace.parseStackAndMessage = function(error) {
    var stack = error.stack;
    var message = error.toString();
    stack = typeof stack === "string" && stack.length > 0
                ? stackFramesAsArray(error) : ["    (No stack trace)"];
    return {
        message: message,
        stack: cleanStack(stack)
    };
};

CapturedTrace.formatAndLogError = function(error, title) {
    if (typeof console !== "undefined") {
        var message;
        if (typeof error === "object" || typeof error === "function") {
            var stack = error.stack;
            message = title + formatStack(stack, error);
        } else {
            message = title + String(error);
        }
        if (typeof warn === "function") {
            warn(message);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.unhandledRejection = function (reason) {
    CapturedTrace.formatAndLogError(reason, "^--- With additional stack trace: ");
};

CapturedTrace.isSupported = function () {
    return typeof captureStackTrace === "function";
};

CapturedTrace.fireRejectionEvent =
function(name, localHandler, reason, promise) {
    var localEventFired = false;
    try {
        if (typeof localHandler === "function") {
            localEventFired = true;
            if (name === "rejectionHandled") {
                localHandler(promise);
            } else {
                localHandler(reason, promise);
            }
        }
    } catch (e) {
        async.throwLater(e);
    }

    var globalEventFired = false;
    try {
        globalEventFired = fireGlobalEvent(name, reason, promise);
    } catch (e) {
        globalEventFired = true;
        async.throwLater(e);
    }

    var domEventFired = false;
    if (fireDomEvent) {
        try {
            domEventFired = fireDomEvent(name.toLowerCase(), {
                reason: reason,
                promise: promise
            });
        } catch (e) {
            domEventFired = true;
            async.throwLater(e);
        }
    }

    if (!globalEventFired && !localEventFired && !domEventFired &&
        name === "unhandledRejection") {
        CapturedTrace.formatAndLogError(reason, "Unhandled rejection ");
    }
};

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

var shouldIgnore = function() { return false; };
var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
function parseLineInfo(line) {
    var matches = line.match(parseLineInfoRegex);
    if (matches) {
        return {
            fileName: matches[1],
            line: parseInt(matches[2], 10)
        };
    }
}
CapturedTrace.setBounds = function(firstLineError, lastLineError) {
    if (!CapturedTrace.isSupported()) return;
    var firstStackLines = firstLineError.stack.split("\n");
    var lastStackLines = lastLineError.stack.split("\n");
    var firstIndex = -1;
    var lastIndex = -1;
    var firstFileName;
    var lastFileName;
    for (var i = 0; i < firstStackLines.length; ++i) {
        var result = parseLineInfo(firstStackLines[i]);
        if (result) {
            firstFileName = result.fileName;
            firstIndex = result.line;
            break;
        }
    }
    for (var i = 0; i < lastStackLines.length; ++i) {
        var result = parseLineInfo(lastStackLines[i]);
        if (result) {
            lastFileName = result.fileName;
            lastIndex = result.line;
            break;
        }
    }
    if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName ||
        firstFileName !== lastFileName || firstIndex >= lastIndex) {
        return;
    }

    shouldIgnore = function(line) {
        if (bluebirdFramePattern.test(line)) return true;
        var info = parseLineInfo(line);
        if (info) {
            if (info.fileName === firstFileName &&
                (firstIndex <= info.line && info.line <= lastIndex)) {
                return true;
            }
        }
        return false;
    };
};

var captureStackTrace = (function stackDetection() {
    var v8stackFramePattern = /^\s*at\s*/;
    var v8stackFormatter = function(stack, error) {
        if (typeof stack === "string") return stack;

        if (error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        Error.stackTraceLimit = Error.stackTraceLimit + 6;
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        var captureStackTrace = Error.captureStackTrace;

        shouldIgnore = function(line) {
            return bluebirdFramePattern.test(line);
        };
        return function(receiver, ignoreUntil) {
            Error.stackTraceLimit = Error.stackTraceLimit + 6;
            captureStackTrace(receiver, ignoreUntil);
            Error.stackTraceLimit = Error.stackTraceLimit - 6;
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
        stackFramePattern = /@/;
        formatStack = v8stackFormatter;
        indentStackFrames = true;
        return function captureStackTrace(o) {
            o.stack = new Error().stack;
        };
    }

    var hasStackAfterThrow;
    try { throw new Error(); }
    catch(e) {
        hasStackAfterThrow = ("stack" in e);
    }
    if (!("stack" in err) && hasStackAfterThrow &&
        typeof Error.stackTraceLimit === "number") {
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        return function captureStackTrace(o) {
            Error.stackTraceLimit = Error.stackTraceLimit + 6;
            try { throw new Error(); }
            catch(e) { o.stack = e.stack; }
            Error.stackTraceLimit = Error.stackTraceLimit - 6;
        };
    }

    formatStack = function(stack, error) {
        if (typeof stack === "string") return stack;

        if ((typeof error === "object" ||
            typeof error === "function") &&
            error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    return null;

})([]);

var fireDomEvent;
var fireGlobalEvent = (function() {
    if (util.isNode) {
        return function(name, reason, promise) {
            if (name === "rejectionHandled") {
                return process.emit(name, promise);
            } else {
                return process.emit(name, reason, promise);
            }
        };
    } else {
        var customEventWorks = false;
        var anyEventWorks = true;
        try {
            var ev = new self.CustomEvent("test");
            customEventWorks = ev instanceof CustomEvent;
        } catch (e) {}
        if (!customEventWorks) {
            try {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("testingtheevent", false, true, {});
                self.dispatchEvent(event);
            } catch (e) {
                anyEventWorks = false;
            }
        }
        if (anyEventWorks) {
            fireDomEvent = function(type, detail) {
                var event;
                if (customEventWorks) {
                    event = new self.CustomEvent(type, {
                        detail: detail,
                        bubbles: false,
                        cancelable: true
                    });
                } else if (self.dispatchEvent) {
                    event = document.createEvent("CustomEvent");
                    event.initCustomEvent(type, false, true, detail);
                }

                return event ? !self.dispatchEvent(event) : false;
            };
        }

        var toWindowMethodNameMap = {};
        toWindowMethodNameMap["unhandledRejection"] = ("on" +
            "unhandledRejection").toLowerCase();
        toWindowMethodNameMap["rejectionHandled"] = ("on" +
            "rejectionHandled").toLowerCase();

        return function(name, reason, promise) {
            var methodName = toWindowMethodNameMap[name];
            var method = self[methodName];
            if (!method) return false;
            if (name === "rejectionHandled") {
                method.call(self, promise);
            } else {
                method.call(self, reason, promise);
            }
            return true;
        };
    }
})();

if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
    warn = function (message) {
        console.warn(message);
    };
    if (util.isNode && process.stderr.isTTY) {
        warn = function(message) {
            process.stderr.write("\u001b[31m" + message + "\u001b[39m\n");
        };
    } else if (!util.isNode && typeof (new Error().stack) === "string") {
        warn = function(message) {
            console.warn("%c" + message, "color: red");
        };
    }
}

return CapturedTrace;
};

},{"./async.js":2,"./util.js":38}],8:[function(_dereq_,module,exports){
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util.js");
var errors = _dereq_("./errors.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var keys = _dereq_("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch(predicate).call(safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError("Catch filter must inherit from Error or be a simple predicate function\u000a\u000a    See http://goo.gl/o84o68\u000a");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function (e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._boundValue();
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch(cb).call(boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = safePredicate(item, e);
            if (shouldHandle === errorObj) {
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch(cb).call(boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":13,"./es5.js":14,"./util.js":38}],9:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, CapturedTrace, isDebugging) {
var contextStack = [];
function Context() {
    this._trace = new CapturedTrace(peekContext());
}
Context.prototype._pushContext = function () {
    if (!isDebugging()) return;
    if (this._trace !== undefined) {
        contextStack.push(this._trace);
    }
};

Context.prototype._popContext = function () {
    if (!isDebugging()) return;
    if (this._trace !== undefined) {
        contextStack.pop();
    }
};

function createContext() {
    if (isDebugging()) return new Context();
}

function peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return undefined;
}

Promise.prototype._peekContext = peekContext;
Promise.prototype._pushContext = Context.prototype._pushContext;
Promise.prototype._popContext = Context.prototype._popContext;

return createContext;
};

},{}],10:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, CapturedTrace) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var Warning = _dereq_("./errors.js").Warning;
var util = _dereq_("./util.js");
var canAttachTrace = util.canAttachTrace;
var unhandledRejectionHandled;
var possiblyUnhandledRejection;
var debugging = false || (util.isNode &&
                    (!!process.env["BLUEBIRD_DEBUG"] ||
                     process.env["NODE_ENV"] === "development"));

if (util.isNode && process.env["BLUEBIRD_DEBUG"] == 0) debugging = false;

if (debugging) {
    async.disableTrampolineIfNecessary();
}

Promise.prototype._ignoreRejections = function() {
    this._unsetRejectionIsUnhandled();
    this._bitField = this._bitField | 16777216;
};

Promise.prototype._ensurePossibleRejectionHandled = function () {
    if ((this._bitField & 16777216) !== 0) return;
    this._setRejectionIsUnhandled();
    async.invokeLater(this._notifyUnhandledRejection, this, undefined);
};

Promise.prototype._notifyUnhandledRejectionIsHandled = function () {
    CapturedTrace.fireRejectionEvent("rejectionHandled",
                                  unhandledRejectionHandled, undefined, this);
};

Promise.prototype._notifyUnhandledRejection = function () {
    if (this._isRejectionUnhandled()) {
        var reason = this._getCarriedStackTrace() || this._settledValue;
        this._setUnhandledRejectionIsNotified();
        CapturedTrace.fireRejectionEvent("unhandledRejection",
                                      possiblyUnhandledRejection, reason, this);
    }
};

Promise.prototype._setUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified = function () {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setRejectionIsUnhandled = function () {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled = function () {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled = function () {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setCarriedStackTrace = function (capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._isCarryingStackTrace = function () {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace = function () {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : undefined;
};

Promise.prototype._captureStackTrace = function () {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext());
    }
    return this;
};

Promise.prototype._attachExtraTrace = function (error, ignoreSelf) {
    if (debugging && canAttachTrace(error)) {
        var trace = this._trace;
        if (trace !== undefined) {
            if (ignoreSelf) trace = trace._parent;
        }
        if (trace !== undefined) {
            trace.attachExtraTrace(error);
        } else if (!error.__stackCleaned__) {
            var parsed = CapturedTrace.parseStackAndMessage(error);
            util.notEnumerableProp(error, "stack",
                parsed.message + "\n" + parsed.stack.join("\n"));
            util.notEnumerableProp(error, "__stackCleaned__", true);
        }
    }
};

Promise.prototype._warn = function(message) {
    var warning = new Warning(message);
    var ctx = this._peekContext();
    if (ctx) {
        ctx.attachExtraTrace(warning);
    } else {
        var parsed = CapturedTrace.parseStackAndMessage(warning);
        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
    }
    CapturedTrace.formatAndLogError(warning, "");
};

Promise.onPossiblyUnhandledRejection = function (fn) {
    var domain = getDomain();
    possiblyUnhandledRejection =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

Promise.onUnhandledRejectionHandled = function (fn) {
    var domain = getDomain();
    unhandledRejectionHandled =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

Promise.longStackTraces = function () {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/DT1qyG\u000a");
    }
    debugging = CapturedTrace.isSupported();
    if (debugging) {
        async.disableTrampolineIfNecessary();
    }
};

Promise.hasLongStackTraces = function () {
    return debugging && CapturedTrace.isSupported();
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

return function() {
    return debugging;
};
};

},{"./async.js":2,"./errors.js":13,"./util.js":38}],11:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;

module.exports = function(Promise) {
var returner = function () {
    return this;
};
var thrower = function () {
    throw this;
};
var returnUndefined = function() {};
var throwUndefined = function() {
    throw undefined;
};

var wrapper = function (value, action) {
    if (action === 1) {
        return function () {
            throw value;
        };
    } else if (action === 2) {
        return function () {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn = function (value) {
    if (value === undefined) return this.then(returnUndefined);

    if (isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            undefined,
            undefined,
            undefined,
            undefined
       );
    } else if (value instanceof Promise) {
        value._ignoreRejections();
    }
    return this._then(returner, undefined, undefined, value, undefined);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow = function (reason) {
    if (reason === undefined) return this.then(throwUndefined);

    if (isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            undefined,
            undefined,
            undefined,
            undefined
       );
    }
    return this._then(thrower, undefined, undefined, reason, undefined);
};
};

},{"./util.js":38}],12:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseReduce = Promise.reduce;

Promise.prototype.each = function (fn) {
    return PromiseReduce(this, fn, null, INTERNAL);
};

Promise.each = function (promises, fn) {
    return PromiseReduce(promises, fn, null, INTERNAL);
};
};

},{}],13:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5.js");
var Objectfreeze = es5.freeze;
var util = _dereq_("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        notEnumerableProp(this, "message",
            typeof message === "string" ? message : defaultMessage);
        notEnumerableProp(this, "name", nameProperty);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            Error.call(this);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var Warning = subError("Warning", "warning");
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

es5.defineProperty(AggregateError.prototype, "length", {
    value: 0,
    configurable: false,
    writable: true,
    enumerable: true
});
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    if (!(this instanceof OperationalError))
        return new OperationalError(message);
    notEnumerableProp(this, "name", "OperationalError");
    notEnumerableProp(this, "message", message);
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        notEnumerableProp(this, "message", message.message);
        notEnumerableProp(this, "stack", message.stack);
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var errorTypes = Error["__BluebirdErrorTypes__"];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    notEnumerableProp(Error, "__BluebirdErrorTypes__", errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    Warning: Warning
};

},{"./es5.js":14,"./util.js":38}],14:[function(_dereq_,module,exports){
var isES5 = (function(){
    "use strict";
    return this === undefined;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        getDescriptor: Object.getOwnPropertyDescriptor,
        keys: Object.keys,
        names: Object.getOwnPropertyNames,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5,
        propertyIsWritable: function(obj, prop) {
            var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            return !!(!descriptor || descriptor.writable || descriptor.set);
        }
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function (o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    };

    var ObjectGetDescriptor = function(o, key) {
        return {value: o[key]};
    };

    var ObjectDefineProperty = function (o, key, desc) {
        o[key] = desc.value;
        return o;
    };

    var ObjectFreeze = function (obj) {
        return obj;
    };

    var ObjectGetPrototypeOf = function (obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    };

    var ArrayIsArray = function (obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    };

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        names: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        getDescriptor: ObjectGetDescriptor,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5,
        propertyIsWritable: function() {
            return true;
        }
    };
}

},{}],15:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseMap = Promise.map;

Promise.prototype.filter = function (fn, options) {
    return PromiseMap(this, fn, options, INTERNAL);
};

Promise.filter = function (promises, fn, options) {
    return PromiseMap(promises, fn, options, INTERNAL);
};
};

},{}],16:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, NEXT_FILTER, tryConvertToPromise) {
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;

function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function() {
        return r;
    };
}
function throw$(r) {
    return function() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    } else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, undefined, reasonOrValue, undefined);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundValue())
                    : handler();

    if (ret !== undefined) {
        var maybePromise = tryConvertToPromise(ret, promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    } else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundValue(), value)
                    : handler(value);

    if (ret !== undefined) {
        var maybePromise = tryConvertToPromise(ret, promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler = function (handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : undefined, undefined,
            promiseAndHandler, undefined);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function (handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function (handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":38}],17:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          apiRejection,
                          INTERNAL,
                          tryConvertToPromise) {
var errors = _dereq_("./errors.js");
var TypeError = errors.TypeError;
var util = _dereq_("./util.js");
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
var yieldHandlers = [];

function promiseFromYieldHandler(value, yieldHandlers, traceParent) {
    for (var i = 0; i < yieldHandlers.length; ++i) {
        traceParent._pushContext();
        var result = tryCatch(yieldHandlers[i])(value);
        traceParent._popContext();
        if (result === errorObj) {
            traceParent._pushContext();
            var ret = Promise.reject(errorObj.e);
            traceParent._popContext();
            return ret;
        }
        var maybePromise = tryConvertToPromise(result, traceParent);
        if (maybePromise instanceof Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver, yieldHandler, stack) {
    var promise = this._promise = new Promise(INTERNAL);
    promise._captureStackTrace();
    this._stack = stack;
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = undefined;
    this._yieldHandlers = typeof yieldHandler === "function"
        ? [yieldHandler].concat(yieldHandlers)
        : yieldHandlers;
}

PromiseSpawn.prototype.promise = function () {
    return this._promise;
};

PromiseSpawn.prototype._run = function () {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = undefined;
    this._next(undefined);
};

PromiseSpawn.prototype._continue = function (result) {
    if (result === errorObj) {
        return this._promise._rejectCallback(result.e, false, true);
    }

    var value = result.value;
    if (result.done === true) {
        this._promise._resolveCallback(value);
    } else {
        var maybePromise = tryConvertToPromise(value, this._promise);
        if (!(maybePromise instanceof Promise)) {
            maybePromise =
                promiseFromYieldHandler(maybePromise,
                                        this._yieldHandlers,
                                        this._promise);
            if (maybePromise === null) {
                this._throw(
                    new TypeError(
                        "A value %s was yielded that could not be treated as a promise\u000a\u000a    See http://goo.gl/4Y4pDk\u000a\u000a".replace("%s", value) +
                        "From coroutine:\u000a" +
                        this._stack.split("\n").slice(1, -7).join("\n")
                    )
                );
                return;
            }
        }
        maybePromise._then(
            this._next,
            this._throw,
            undefined,
            this,
            null
       );
    }
};

PromiseSpawn.prototype._throw = function (reason) {
    this._promise._attachExtraTrace(reason);
    this._promise._pushContext();
    var result = tryCatch(this._generator["throw"])
        .call(this._generator, reason);
    this._promise._popContext();
    this._continue(result);
};

PromiseSpawn.prototype._next = function (value) {
    this._promise._pushContext();
    var result = tryCatch(this._generator.next).call(this._generator, value);
    this._promise._popContext();
    this._continue(result);
};

Promise.coroutine = function (generatorFunction, options) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function\u000a\u000a    See http://goo.gl/6Vqhm0\u000a");
    }
    var yieldHandler = Object(options).yieldHandler;
    var PromiseSpawn$ = PromiseSpawn;
    var stack = new Error().stack;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(undefined, undefined, yieldHandler,
                                      stack);
        spawn._generator = generator;
        spawn._next(undefined);
        return spawn.promise();
    };
};

Promise.coroutine.addYieldHandler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    yieldHandlers.push(fn);
};

Promise.spawn = function (generatorFunction) {
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function\u000a\u000a    See http://goo.gl/6Vqhm0\u000a");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors.js":13,"./util.js":38}],18:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, tryConvertToPromise, INTERNAL) {
var util = _dereq_("./util.js");
var canEvaluate = util.canEvaluate;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var reject;

if (!true) {
if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var caller = function(count) {
        var values = [];
        for (var i = 1; i <= count; ++i) values.push("holder.p" + i);
        return new Function("holder", "                                      \n\
            'use strict';                                                    \n\
            var callback = holder.fn;                                        \n\
            return callback(values);                                         \n\
            ".replace(/values/g, values.join(", ")));
    };
    var thenCallbacks = [];
    var callers = [undefined];
    for (var i = 1; i <= 5; ++i) {
        thenCallbacks.push(thenCallback(i));
        callers.push(caller(i));
    }

    var Holder = function(total, fn) {
        this.p1 = this.p2 = this.p3 = this.p4 = this.p5 = null;
        this.fn = fn;
        this.total = total;
        this.now = 0;
    };

    Holder.prototype.callers = callers;
    Holder.prototype.checkFulfillment = function(promise) {
        var now = this.now;
        now++;
        var total = this.total;
        if (now >= total) {
            var handler = this.callers[total];
            promise._pushContext();
            var ret = tryCatch(handler)(this);
            promise._popContext();
            if (ret === errorObj) {
                promise._rejectCallback(ret.e, false, true);
            } else {
                promise._resolveCallback(ret);
            }
        } else {
            this.now = now;
        }
    };

    var reject = function (reason) {
        this._reject(reason);
    };
}
}

Promise.join = function () {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (!true) {
            if (last < 6 && canEvaluate) {
                var ret = new Promise(INTERNAL);
                ret._captureStackTrace();
                var holder = new Holder(last, fn);
                var callbacks = thenCallbacks;
                for (var i = 0; i < last; ++i) {
                    var maybePromise = tryConvertToPromise(arguments[i], ret);
                    if (maybePromise instanceof Promise) {
                        maybePromise = maybePromise._target();
                        if (maybePromise._isPending()) {
                            maybePromise._then(callbacks[i], reject,
                                               undefined, ret, holder);
                        } else if (maybePromise._isFulfilled()) {
                            callbacks[i].call(ret,
                                              maybePromise._value(), holder);
                        } else {
                            ret._reject(maybePromise._reason());
                        }
                    } else {
                        callbacks[i].call(ret, maybePromise, holder);
                    }
                }
                return ret;
            }
        }
    }
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    if (fn) args.pop();
    var ret = new PromiseArray(args).promise();
    return fn !== undefined ? ret.spread(fn) : ret;
};

};

},{"./util.js":38}],19:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var PENDING = {};
var EMPTY_ARRAY = [];

function MappingPromiseArray(promises, fn, limit, _filter) {
    this.constructor$(promises);
    this._promise._captureStackTrace();
    var domain = getDomain();
    this._callback = domain === null ? fn : domain.bind(fn);
    this._preservedValues = _filter === INTERNAL
        ? new Array(this.length())
        : null;
    this._limit = limit;
    this._inFlight = 0;
    this._queue = limit >= 1 ? [] : EMPTY_ARRAY;
    async.invoke(init, this, undefined);
}
util.inherits(MappingPromiseArray, PromiseArray);
function init() {this._init$(undefined, -2);}

MappingPromiseArray.prototype._init = function () {};

MappingPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var values = this._values;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var limit = this._limit;
    if (values[index] === PENDING) {
        values[index] = value;
        if (limit >= 1) {
            this._inFlight--;
            this._drainQueue();
            if (this._isResolved()) return;
        }
    } else {
        if (limit >= 1 && this._inFlight >= limit) {
            values[index] = value;
            this._queue.push(index);
            return;
        }
        if (preservedValues !== null) preservedValues[index] = value;

        var callback = this._callback;
        var receiver = this._promise._boundValue();
        this._promise._pushContext();
        var ret = tryCatch(callback).call(receiver, value, index, length);
        this._promise._popContext();
        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (maybePromise._isPending()) {
                if (limit >= 1) this._inFlight++;
                values[index] = PENDING;
                return maybePromise._proxyPromiseArray(this, index);
            } else if (maybePromise._isFulfilled()) {
                ret = maybePromise._value();
            } else {
                return this._reject(maybePromise._reason());
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        if (preservedValues !== null) {
            this._filter(values, preservedValues);
        } else {
            this._resolve(values);
        }

    }
};

MappingPromiseArray.prototype._drainQueue = function () {
    var queue = this._queue;
    var limit = this._limit;
    var values = this._values;
    while (queue.length > 0 && this._inFlight < limit) {
        if (this._isResolved()) return;
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
    }
};

MappingPromiseArray.prototype._filter = function (booleans, values) {
    var len = values.length;
    var ret = new Array(len);
    var j = 0;
    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];
    }
    ret.length = j;
    this._resolve(ret);
};

MappingPromiseArray.prototype.preservedValues = function () {
    return this._preservedValues;
};

function map(promises, fn, options, _filter) {
    var limit = typeof options === "object" && options !== null
        ? options.concurrency
        : 0;
    limit = typeof limit === "number" &&
        isFinite(limit) && limit >= 1 ? limit : 0;
    return new MappingPromiseArray(promises, fn, limit, _filter);
}

Promise.prototype.map = function (fn, options) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");

    return map(this, fn, options, null).promise();
};

Promise.map = function (promises, fn, options, _filter) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    return map(promises, fn, options, _filter).promise();
};


};

},{"./async.js":2,"./util.js":38}],20:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, INTERNAL, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;

Promise.method = function (fn) {
    if (typeof fn !== "function") {
        throw new Promise.TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    return function () {
        var ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        ret._popContext();
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function (fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._pushContext();
    var value = util.isArray(args)
        ? tryCatch(fn).apply(ctx, args)
        : tryCatch(fn).call(ctx, args);
    ret._popContext();
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.prototype._resolveFromSyncValue = function (value) {
    if (value === util.errorObj) {
        this._rejectCallback(value.e, false, true);
    } else {
        this._resolveCallback(value, true);
    }
};
};

},{"./util.js":38}],21:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

function spreadAdapter(val, nodeback) {
    var promise = this;
    if (!util.isArray(val)) return successAdapter.call(promise, val, nodeback);
    var ret =
        tryCatch(nodeback).apply(promise._boundValue(), [null].concat(val));
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

function successAdapter(val, nodeback) {
    var promise = this;
    var receiver = promise._boundValue();
    var ret = val === undefined
        ? tryCatch(nodeback).call(receiver, null)
        : tryCatch(nodeback).call(receiver, null, val);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}
function errorAdapter(reason, nodeback) {
    var promise = this;
    if (!reason) {
        var target = promise._target();
        var newReason = target._getCarriedStackTrace();
        newReason.cause = reason;
        reason = newReason;
    }
    var ret = tryCatch(nodeback).call(promise._boundValue(), reason);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

Promise.prototype.asCallback =
Promise.prototype.nodeify = function (nodeback, options) {
    if (typeof nodeback == "function") {
        var adapter = successAdapter;
        if (options !== undefined && Object(options).spread) {
            adapter = spreadAdapter;
        }
        this._then(
            adapter,
            errorAdapter,
            undefined,
            this,
            nodeback
        );
    }
    return this;
};
};

},{"./async.js":2,"./util.js":38}],22:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, PromiseArray) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

Promise.prototype.progressed = function (handler) {
    return this._then(undefined, undefined, handler, undefined, undefined);
};

Promise.prototype._progress = function (progressValue) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._target()._progressUnchecked(progressValue);

};

Promise.prototype._progressHandlerAt = function (index) {
    return index === 0
        ? this._progressHandler0
        : this[(index << 2) + index - 5 + 2];
};

Promise.prototype._doProgressWith = function (progression) {
    var progressValue = progression.value;
    var handler = progression.handler;
    var promise = progression.promise;
    var receiver = progression.receiver;

    var ret = tryCatch(handler).call(receiver, progressValue);
    if (ret === errorObj) {
        if (ret.e != null &&
            ret.e.name !== "StopProgressPropagation") {
            var trace = util.canAttachTrace(ret.e)
                ? ret.e : new Error(util.toString(ret.e));
            promise._attachExtraTrace(trace);
            promise._progress(ret.e);
        }
    } else if (ret instanceof Promise) {
        ret._then(promise._progress, null, null, promise, undefined);
    } else {
        promise._progress(ret);
    }
};


Promise.prototype._progressUnchecked = function (progressValue) {
    var len = this._length();
    var progress = this._progress;
    for (var i = 0; i < len; i++) {
        var handler = this._progressHandlerAt(i);
        var promise = this._promiseAt(i);
        if (!(promise instanceof Promise)) {
            var receiver = this._receiverAt(i);
            if (typeof handler === "function") {
                handler.call(receiver, progressValue, promise);
            } else if (receiver instanceof PromiseArray &&
                       !receiver._isResolved()) {
                receiver._promiseProgressed(progressValue, promise);
            }
            continue;
        }

        if (typeof handler === "function") {
            async.invoke(this._doProgressWith, this, {
                handler: handler,
                promise: promise,
                receiver: this._receiverAt(i),
                value: progressValue
            });
        } else {
            async.invoke(progress, promise, progressValue);
        }
    }
};
};

},{"./async.js":2,"./util.js":38}],23:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var makeSelfResolutionError = function () {
    return new TypeError("circular promise resolution chain\u000a\u000a    See http://goo.gl/LhFpo0\u000a");
};
var reflect = function() {
    return new Promise.PromiseInspection(this._target());
};
var apiRejection = function(msg) {
    return Promise.reject(new TypeError(msg));
};

var util = _dereq_("./util.js");

var getDomain;
if (util.isNode) {
    getDomain = function() {
        var ret = process.domain;
        if (ret === undefined) ret = null;
        return ret;
    };
} else {
    getDomain = function() {
        return null;
    };
}
util.notEnumerableProp(Promise, "_getDomain", getDomain);

var UNDEFINED_BINDING = {};
var async = _dereq_("./async.js");
var errors = _dereq_("./errors.js");
var TypeError = Promise.TypeError = errors.TypeError;
Promise.RangeError = errors.RangeError;
Promise.CancellationError = errors.CancellationError;
Promise.TimeoutError = errors.TimeoutError;
Promise.OperationalError = errors.OperationalError;
Promise.RejectionError = errors.OperationalError;
Promise.AggregateError = errors.AggregateError;
var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};
var tryConvertToPromise = _dereq_("./thenables.js")(Promise, INTERNAL);
var PromiseArray =
    _dereq_("./promise_array.js")(Promise, INTERNAL,
                                    tryConvertToPromise, apiRejection);
var CapturedTrace = _dereq_("./captured_trace.js")();
var isDebugging = _dereq_("./debuggability.js")(Promise, CapturedTrace);
 /*jshint unused:false*/
var createContext =
    _dereq_("./context.js")(Promise, CapturedTrace, isDebugging);
var CatchFilter = _dereq_("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = _dereq_("./promise_resolver.js");
var nodebackForPromise = PromiseResolver._nodebackForPromise;
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function\u000a\u000a    See http://goo.gl/EC22Yn\u000a");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly\u000a\u000a    See http://goo.gl/KsIlge\u000a");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = undefined;
    this._rejectionHandler0 = undefined;
    this._progressHandler0 = undefined;
    this._promise0 = undefined;
    this._receiver0 = undefined;
    this._settledValue = undefined;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] = function (fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            } else {
                return Promise.reject(
                    new TypeError("Catch filter must inherit from Error or be a simple predicate function\u000a\u000a    See http://goo.gl/o84o68\u000a"));
            }
        }
        catchInstances.length = j;
        fn = arguments[i];
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(undefined, catchFilter.doFilter, undefined,
            catchFilter, undefined);
    }
    return this._then(undefined, fn, undefined, undefined, undefined);
};

Promise.prototype.reflect = function () {
    return this._then(reflect, reflect, undefined, this, undefined);
};

Promise.prototype.then = function (didFulfill, didReject, didProgress) {
    if (isDebugging() && arguments.length > 0 &&
        typeof didFulfill !== "function" &&
        typeof didReject !== "function") {
        var msg = ".then() only accepts functions but was passed: " +
                util.classString(didFulfill);
        if (arguments.length > 1) {
            msg += ", " + util.classString(didReject);
        }
        this._warn(msg);
    }
    return this._then(didFulfill, didReject, didProgress,
        undefined, undefined);
};

Promise.prototype.done = function (didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        undefined, undefined);
    promise._setIsFinal();
};

Promise.prototype.spread = function (didFulfill, didReject) {
    return this.all()._then(didFulfill, didReject, undefined, APPLY, undefined);
};

Promise.prototype.isCancellable = function () {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function () {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: undefined,
        rejectionReason: undefined
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this.value();
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this.reason();
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function () {
    return new PromiseArray(this).promise();
};

Promise.prototype.error = function (fn) {
    return this.caught(util.originatesFromRejection, fn);
};

Promise.is = function (val) {
    return val instanceof Promise;
};

Promise.fromNode = function(fn) {
    var ret = new Promise(INTERNAL);
    var result = tryCatch(fn)(nodebackForPromise(ret));
    if (result === errorObj) {
        ret._rejectCallback(result.e, true, true);
    }
    return ret;
};

Promise.all = function (promises) {
    return new PromiseArray(promises).promise();
};

Promise.defer = Promise.pending = function () {
    var promise = new Promise(INTERNAL);
    return new PromiseResolver(promise);
};

Promise.cast = function (obj) {
    var ret = tryConvertToPromise(obj);
    if (!(ret instanceof Promise)) {
        var val = ret;
        ret = new Promise(INTERNAL);
        ret._fulfillUnchecked(val);
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function (reason) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._rejectCallback(reason, true);
    return ret;
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    var prev = async._schedule;
    async._schedule = fn;
    return prev;
};

Promise.prototype._then = function (
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== undefined;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (!haveInternalData) {
        ret._propagateFrom(this, 4 | 1);
        ret._captureStackTrace();
    }

    var target = this._target();
    if (target !== this) {
        if (receiver === undefined) receiver = this._boundTo;
        if (!haveInternalData) ret._setIsMigrated();
    }

    var callbackIndex = target._addCallbacks(didFulfill,
                                             didReject,
                                             didProgress,
                                             ret,
                                             receiver,
                                             getDomain());

    if (target._isResolved() && !target._isSettlePromisesQueued()) {
        async.invoke(
            target._settlePromiseAtPostResolution, target, callbackIndex);
    }

    return ret;
};

Promise.prototype._settlePromiseAtPostResolution = function (index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    this._settlePromiseAt(index);
};

Promise.prototype._length = function () {
    return this._bitField & 131071;
};

Promise.prototype._isFollowingOrFulfilledOrRejected = function () {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function () {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function (len) {
    this._bitField = (this._bitField & -131072) |
        (len & 131071);
};

Promise.prototype._setFulfilled = function () {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function () {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function () {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function () {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function () {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function () {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function () {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function () {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setIsMigrated = function () {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetIsMigrated = function () {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isMigrated = function () {
    return (this._bitField & 4194304) > 0;
};

Promise.prototype._receiverAt = function (index) {
    var ret = index === 0
        ? this._receiver0
        : this[
            index * 5 - 5 + 4];
    if (ret === UNDEFINED_BINDING) {
        return undefined;
    } else if (ret === undefined && this._isBound()) {
        return this._boundValue();
    }
    return ret;
};

Promise.prototype._promiseAt = function (index) {
    return index === 0
        ? this._promise0
        : this[index * 5 - 5 + 3];
};

Promise.prototype._fulfillmentHandlerAt = function (index) {
    return index === 0
        ? this._fulfillmentHandler0
        : this[index * 5 - 5 + 0];
};

Promise.prototype._rejectionHandlerAt = function (index) {
    return index === 0
        ? this._rejectionHandler0
        : this[index * 5 - 5 + 1];
};

Promise.prototype._boundValue = function() {
    var ret = this._boundTo;
    if (ret !== undefined) {
        if (ret instanceof Promise) {
            if (ret.isFulfilled()) {
                return ret.value();
            } else {
                return undefined;
            }
        }
    }
    return ret;
};

Promise.prototype._migrateCallbacks = function (follower, index) {
    var fulfill = follower._fulfillmentHandlerAt(index);
    var reject = follower._rejectionHandlerAt(index);
    var progress = follower._progressHandlerAt(index);
    var promise = follower._promiseAt(index);
    var receiver = follower._receiverAt(index);
    if (promise instanceof Promise) promise._setIsMigrated();
    if (receiver === undefined) receiver = UNDEFINED_BINDING;
    this._addCallbacks(fulfill, reject, progress, promise, receiver, null);
};

Promise.prototype._addCallbacks = function (
    fulfill,
    reject,
    progress,
    promise,
    receiver,
    domain
) {
    var index = this._length();

    if (index >= 131071 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== undefined) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace()) {
            this._fulfillmentHandler0 =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this._rejectionHandler0 =
                domain === null ? reject : domain.bind(reject);
        }
        if (typeof progress === "function") {
            this._progressHandler0 =
                domain === null ? progress : domain.bind(progress);
        }
    } else {
        var base = index * 5 - 5;
        this[base + 3] = promise;
        this[base + 4] = receiver;
        if (typeof fulfill === "function") {
            this[base + 0] =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this[base + 1] =
                domain === null ? reject : domain.bind(reject);
        }
        if (typeof progress === "function") {
            this[base + 2] =
                domain === null ? progress : domain.bind(progress);
        }
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._setProxyHandlers = function (receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 131071 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    } else {
        var base = index * 5 - 5;
        this[base + 3] = promiseSlotValue;
        this[base + 4] = receiver;
    }
    this._setLength(index + 1);
};

Promise.prototype._proxyPromiseArray = function (promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._resolveCallback = function(value, shouldBind) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    if (value === this)
        return this._rejectCallback(makeSelfResolutionError(), false, true);
    var maybePromise = tryConvertToPromise(value, this);
    if (!(maybePromise instanceof Promise)) return this._fulfill(value);

    var propagationFlags = 1 | (shouldBind ? 4 : 0);
    this._propagateFrom(maybePromise, propagationFlags);
    var promise = maybePromise._target();
    if (promise._isPending()) {
        var len = this._length();
        for (var i = 0; i < len; ++i) {
            promise._migrateCallbacks(this, i);
        }
        this._setFollowing();
        this._setLength(0);
        this._setFollowee(promise);
    } else if (promise._isFulfilled()) {
        this._fulfillUnchecked(promise._value());
    } else {
        this._rejectUnchecked(promise._reason(),
            promise._getCarriedStackTrace());
    }
};

Promise.prototype._rejectCallback =
function(reason, synchronous, shouldNotMarkOriginatingFromRejection) {
    if (!shouldNotMarkOriginatingFromRejection) {
        util.markAsOriginatingFromRejection(reason);
    }
    var trace = util.ensureErrorObject(reason);
    var hasStack = trace === reason;
    this._attachExtraTrace(trace, synchronous ? hasStack : false);
    this._reject(reason, hasStack ? undefined : trace);
};

Promise.prototype._resolveFromResolver = function (resolver) {
    var promise = this;
    this._captureStackTrace();
    this._pushContext();
    var synchronous = true;
    var r = tryCatch(resolver)(function(value) {
        if (promise === null) return;
        promise._resolveCallback(value);
        promise = null;
    }, function (reason) {
        if (promise === null) return;
        promise._rejectCallback(reason, synchronous);
        promise = null;
    });
    synchronous = false;
    this._popContext();

    if (r !== undefined && r === errorObj && promise !== null) {
        promise._rejectCallback(r.e, true, true);
        promise = null;
    }
};

Promise.prototype._settlePromiseFromHandler = function (
    handler, receiver, value, promise
) {
    if (promise._isRejected()) return;
    promise._pushContext();
    var x;
    if (receiver === APPLY && !this._isRejected()) {
        x = tryCatch(handler).apply(this._boundValue(), value);
    } else {
        x = tryCatch(handler).call(receiver, value);
    }
    promise._popContext();

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise ? makeSelfResolutionError() : x.e;
        promise._rejectCallback(err, false, true);
    } else {
        promise._resolveCallback(x);
    }
};

Promise.prototype._target = function() {
    var ret = this;
    while (ret._isFollowing()) ret = ret._followee();
    return ret;
};

Promise.prototype._followee = function() {
    return this._rejectionHandler0;
};

Promise.prototype._setFollowee = function(promise) {
    this._rejectionHandler0 = promise;
};

Promise.prototype._cleanValues = function () {
    if (this._cancellable()) {
        this._cancellationParent = undefined;
    }
};

Promise.prototype._propagateFrom = function (parent, flags) {
    if ((flags & 1) > 0 && parent._cancellable()) {
        this._setCancellable();
        this._cancellationParent = parent;
    }
    if ((flags & 4) > 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
};

Promise.prototype._fulfill = function (value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject = function (reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function (index) {
    var promise = this._promiseAt(index);
    var isPromise = promise instanceof Promise;

    if (isPromise && promise._isMigrated()) {
        promise._unsetIsMigrated();
        return async.invoke(this._settlePromiseAt, this, index);
    }
    var handler = this._isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var carriedStackTrace =
        this._isCarryingStackTrace() ? this._getCarriedStackTrace() : undefined;
    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    this._clearCallbackDataAtIndex(index);

    if (typeof handler === "function") {
        if (!isPromise) {
            handler.call(receiver, value, promise);
        } else {
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (receiver instanceof PromiseArray) {
        if (!receiver._isResolved()) {
            if (this._isFulfilled()) {
                receiver._promiseFulfilled(value, promise);
            }
            else {
                receiver._promiseRejected(value, promise);
            }
        }
    } else if (isPromise) {
        if (this._isFulfilled()) {
            promise._fulfill(value);
        } else {
            promise._reject(value, carriedStackTrace);
        }
    }

    if (index >= 4 && (index & 31) === 4)
        async.invokeLater(this._setLength, this, 0);
};

Promise.prototype._clearCallbackDataAtIndex = function(index) {
    if (index === 0) {
        if (!this._isCarryingStackTrace()) {
            this._fulfillmentHandler0 = undefined;
        }
        this._rejectionHandler0 =
        this._progressHandler0 =
        this._receiver0 =
        this._promise0 = undefined;
    } else {
        var base = index * 5 - 5;
        this[base + 3] =
        this[base + 4] =
        this[base + 0] =
        this[base + 1] =
        this[base + 2] = undefined;
    }
};

Promise.prototype._isSettlePromisesQueued = function () {
    return (this._bitField &
            -1073741824) === -1073741824;
};

Promise.prototype._setSettlePromisesQueued = function () {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetSettlePromisesQueued = function () {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueSettlePromises = function() {
    async.settlePromises(this);
    this._setSettlePromisesQueued();
};

Promise.prototype._fulfillUnchecked = function (value) {
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, undefined);
    }
    this._setFulfilled();
    this._settledValue = value;
    this._cleanValues();

    if (this._length() > 0) {
        this._queueSettlePromises();
    }
};

Promise.prototype._rejectUncheckedCheckError = function (reason) {
    var trace = util.ensureErrorObject(reason);
    this._rejectUnchecked(reason, trace === reason ? undefined : trace);
};

Promise.prototype._rejectUnchecked = function (reason, trace) {
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._setRejected();
    this._settledValue = reason;
    this._cleanValues();

    if (this._isFinal()) {
        async.throwLater(function(e) {
            if ("stack" in e) {
                async.invokeFirst(
                    CapturedTrace.unhandledRejection, undefined, e);
            }
            throw e;
        }, trace === undefined ? reason : trace);
        return;
    }

    if (trace !== undefined && trace !== reason) {
        this._setCarriedStackTrace(trace);
    }

    if (this._length() > 0) {
        this._queueSettlePromises();
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._settlePromises = function () {
    this._unsetSettlePromisesQueued();
    var len = this._length();
    for (var i = 0; i < len; i++) {
        this._settlePromiseAt(i);
    }
};

util.notEnumerableProp(Promise,
                       "_makeSelfResolutionError",
                       makeSelfResolutionError);

_dereq_("./progress.js")(Promise, PromiseArray);
_dereq_("./method.js")(Promise, INTERNAL, tryConvertToPromise, apiRejection);
_dereq_("./bind.js")(Promise, INTERNAL, tryConvertToPromise);
_dereq_("./finally.js")(Promise, NEXT_FILTER, tryConvertToPromise);
_dereq_("./direct_resolve.js")(Promise);
_dereq_("./synchronous_inspection.js")(Promise);
_dereq_("./join.js")(Promise, PromiseArray, tryConvertToPromise, INTERNAL);
Promise.Promise = Promise;
_dereq_('./map.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL);
_dereq_('./cancel.js')(Promise);
_dereq_('./using.js')(Promise, apiRejection, tryConvertToPromise, createContext);
_dereq_('./generators.js')(Promise, apiRejection, INTERNAL, tryConvertToPromise);
_dereq_('./nodeify.js')(Promise);
_dereq_('./call_get.js')(Promise);
_dereq_('./props.js')(Promise, PromiseArray, tryConvertToPromise, apiRejection);
_dereq_('./race.js')(Promise, INTERNAL, tryConvertToPromise, apiRejection);
_dereq_('./reduce.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL);
_dereq_('./settle.js')(Promise, PromiseArray);
_dereq_('./some.js')(Promise, PromiseArray, apiRejection);
_dereq_('./promisify.js')(Promise, INTERNAL);
_dereq_('./any.js')(Promise);
_dereq_('./each.js')(Promise, INTERNAL);
_dereq_('./timers.js')(Promise, INTERNAL);
_dereq_('./filter.js')(Promise, INTERNAL);
                                                         
    util.toFastProperties(Promise);                                          
    util.toFastProperties(Promise.prototype);                                
    function fillTypes(value) {                                              
        var p = new Promise(INTERNAL);                                       
        p._fulfillmentHandler0 = value;                                      
        p._rejectionHandler0 = value;                                        
        p._progressHandler0 = value;                                         
        p._promise0 = value;                                                 
        p._receiver0 = value;                                                
        p._settledValue = value;                                             
    }                                                                        
    // Complete slack tracking, opt out of field-type tracking and           
    // stabilize map                                                         
    fillTypes({a: 1});                                                       
    fillTypes({b: 2});                                                       
    fillTypes({c: 3});                                                       
    fillTypes(1);                                                            
    fillTypes(function(){});                                                 
    fillTypes(undefined);                                                    
    fillTypes(false);                                                        
    fillTypes(new Promise(INTERNAL));                                        
    CapturedTrace.setBounds(async.firstLineError, util.lastLineError);       
    return Promise;                                                          

};

},{"./any.js":1,"./async.js":2,"./bind.js":3,"./call_get.js":5,"./cancel.js":6,"./captured_trace.js":7,"./catch_filter.js":8,"./context.js":9,"./debuggability.js":10,"./direct_resolve.js":11,"./each.js":12,"./errors.js":13,"./filter.js":15,"./finally.js":16,"./generators.js":17,"./join.js":18,"./map.js":19,"./method.js":20,"./nodeify.js":21,"./progress.js":22,"./promise_array.js":24,"./promise_resolver.js":25,"./promisify.js":26,"./props.js":27,"./race.js":29,"./reduce.js":30,"./settle.js":32,"./some.js":33,"./synchronous_inspection.js":34,"./thenables.js":35,"./timers.js":36,"./using.js":37,"./util.js":38}],24:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise,
    apiRejection) {
var util = _dereq_("./util.js");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent;
    if (values instanceof Promise) {
        parent = values;
        promise._propagateFrom(parent, 1 | 4);
    }
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(undefined, -2);
}
PromiseArray.prototype.length = function () {
    return this._length;
};

PromiseArray.prototype.promise = function () {
    return this._promise;
};

PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
    var values = tryConvertToPromise(this._values, this._promise);
    if (values instanceof Promise) {
        values = values._target();
        this._values = values;
        if (values._isFulfilled()) {
            values = values._value();
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a");
                this.__hardReject__(err);
                return;
            }
        } else if (values._isPending()) {
            values._then(
                init,
                this._reject,
                undefined,
                this,
                resolveValueIfEmpty
           );
            return;
        } else {
            this._reject(values._reason());
            return;
        }
    } else if (!isArray(values)) {
        this._promise._reject(apiRejection("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a")._reason());
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    var len = this.getActualLength(values.length);
    this._length = len;
    this._values = this.shouldCopyValues() ? new Array(len) : this._values;
    var promise = this._promise;
    for (var i = 0; i < len; ++i) {
        var isResolved = this._isResolved();
        var maybePromise = tryConvertToPromise(values[i], promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (isResolved) {
                maybePromise._ignoreRejections();
            } else if (maybePromise._isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise._isFulfilled()) {
                this._promiseFulfilled(maybePromise._value(), i);
            } else {
                this._promiseRejected(maybePromise._reason(), i);
            }
        } else if (!isResolved) {
            this._promiseFulfilled(maybePromise, i);
        }
    }
};

PromiseArray.prototype._isResolved = function () {
    return this._values === null;
};

PromiseArray.prototype._resolve = function (value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function (reason) {
    this._values = null;
    this._promise._rejectCallback(reason, false, true);
};

PromiseArray.prototype._promiseProgressed = function (progressValue, index) {
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected = function (reason, index) {
    this._totalResolved++;
    this._reject(reason);
};

PromiseArray.prototype.shouldCopyValues = function () {
    return true;
};

PromiseArray.prototype.getActualLength = function (len) {
    return len;
};

return PromiseArray;
};

},{"./util.js":38}],25:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors.js");
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var haveGetters = util.haveGetters;
var es5 = _dereq_("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

var rErrorKey = /^(?:name|message|stack|cause)$/;
function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
        ret.name = obj.name;
        ret.message = obj.message;
        ret.stack = obj.stack;
        var keys = es5.keys(obj);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (!rErrorKey.test(key)) {
                ret[key] = obj[key];
            }
        }
        return ret;
    }
    util.markAsOriginatingFromRejection(obj);
    return obj;
}

function nodebackForPromise(promise) {
    return function(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (arguments.length > 2) {
            var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
            promise._fulfill(args);
        } else {
            promise._fulfill(value);
        }

        promise = null;
    };
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function (promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function (promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function () {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function (value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._resolveCallback(value);
};

PromiseResolver.prototype.reject = function (reason) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._rejectCallback(reason);
};

PromiseResolver.prototype.progress = function (value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._progress(value);
};

PromiseResolver.prototype.cancel = function (err) {
    this.promise.cancel(err);
};

PromiseResolver.prototype.timeout = function () {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function () {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function () {
    return this.promise.toJSON();
};

module.exports = PromiseResolver;

},{"./errors.js":13,"./es5.js":14,"./util.js":38}],26:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = _dereq_("./util.js");
var nodebackForPromise = _dereq_("./promise_resolver.js")
    ._nodebackForPromise;
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var TypeError = _dereq_("./errors").TypeError;
var defaultSuffix = "Async";
var defaultPromisified = {__isPromisified__: true};
var noCopyProps = [
    "arity",    "length",
    "name",
    "arguments",
    "caller",
    "callee",
    "prototype",
    "__isPromisified__"
];
var noCopyPropsPattern = new RegExp("^(?:" + noCopyProps.join("|") + ")$");

var defaultFilter = function(name) {
    return util.isIdentifier(name) &&
        name.charAt(0) !== "_" &&
        name !== "constructor";
};

function propsFilter(key) {
    return !noCopyPropsPattern.test(key);
}

function isPromisified(fn) {
    try {
        return fn.__isPromisified__ === true;
    }
    catch (e) {
        return false;
    }
}

function hasPromisified(obj, key, suffix) {
    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                                            defaultPromisified);
    return val ? isPromisified(val) : false;
}
function checkValid(ret, suffix, suffixRegexp) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API that has normal methods with '%s'-suffix\u000a\u000a    See http://goo.gl/iWrZbw\u000a"
                        .replace("%s", suffix));
                }
            }
        }
    }
}

function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
    var keys = util.inheritedDataKeys(obj);
    var ret = [];
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        var passesDefaultFilter = filter === defaultFilter
            ? true : defaultFilter(key, value, obj);
        if (typeof value === "function" &&
            !isPromisified(value) &&
            !hasPromisified(obj, key, suffix) &&
            filter(key, value, obj, passesDefaultFilter)) {
            ret.push(key, value);
        }
    }
    checkValid(ret, suffix, suffixRegexp);
    return ret;
}

var escapeIdentRegex = function(str) {
    return str.replace(/([$])/, "\\$");
};

var makeNodePromisifiedEval;
if (!true) {
var switchCaseArgumentOrder = function(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 3);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 3; ++i) {
        ret.push(i);
    }
    return ret;
};

var argumentSequence = function(argumentCount) {
    return util.filledRange(argumentCount, "_arg", "");
};

var parameterDeclaration = function(parameterCount) {
    return util.filledRange(
        Math.max(parameterCount, 3), "_arg", "");
};

var parameterCount = function(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
};

makeNodePromisifiedEval =
function(callback, receiver, originalName, fn) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);
    var shouldProxyThis = typeof callback === "string" || receiver === THIS;

    function generateCallForArgumentCount(count) {
        var args = argumentSequence(count).join(", ");
        var comma = count > 0 ? ", " : "";
        var ret;
        if (shouldProxyThis) {
            ret = "ret = callback.call(this, {{args}}, nodeback); break;\n";
        } else {
            ret = receiver === undefined
                ? "ret = callback({{args}}, nodeback); break;\n"
                : "ret = callback.call(receiver, {{args}}, nodeback); break;\n";
        }
        return ret.replace("{{args}}", args).replace(", ", comma);
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for (var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }

        ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = nodeback;                                              \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", (shouldProxyThis
                                ? "ret = callback.apply(this, args);\n"
                                : "ret = callback.apply(receiver, args);\n"));
        return ret;
    }

    var getFunctionCode = typeof callback === "string"
                                ? ("this != null ? this['"+callback+"'] : fn")
                                : "fn";

    return new Function("Promise",
                        "fn",
                        "receiver",
                        "withAppended",
                        "maybeWrapAsError",
                        "nodebackForPromise",
                        "tryCatch",
                        "errorObj",
                        "notEnumerableProp",
                        "INTERNAL","'use strict';                            \n\
        var ret = function (Parameters) {                                    \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._captureStackTrace();                                    \n\
            var nodeback = nodebackForPromise(promise);                      \n\
            var ret;                                                         \n\
            var callback = tryCatch([GetFunctionCode]);                      \n\
            switch(len) {                                                    \n\
                [CodeForSwitchCase]                                          \n\
            }                                                                \n\
            if (ret === errorObj) {                                          \n\
                promise._rejectCallback(maybeWrapAsError(ret.e), true, true);\n\
            }                                                                \n\
            return promise;                                                  \n\
        };                                                                   \n\
        notEnumerableProp(ret, '__isPromisified__', true);                   \n\
        return ret;                                                          \n\
        "
        .replace("Parameters", parameterDeclaration(newParameterCount))
        .replace("[CodeForSwitchCase]", generateArgumentSwitchCase())
        .replace("[GetFunctionCode]", getFunctionCode))(
            Promise,
            fn,
            receiver,
            withAppended,
            maybeWrapAsError,
            nodebackForPromise,
            util.tryCatch,
            util.errorObj,
            util.notEnumerableProp,
            INTERNAL
        );
};
}

function makeNodePromisifiedClosure(callback, receiver, _, fn) {
    var defaultThis = (function() {return this;})();
    var method = callback;
    if (typeof method === "string") {
        callback = fn;
    }
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        var promise = new Promise(INTERNAL);
        promise._captureStackTrace();
        var cb = typeof method === "string" && this !== defaultThis
            ? this[method] : callback;
        var fn = nodebackForPromise(promise);
        try {
            cb.apply(_receiver, withAppended(arguments, fn));
        } catch(e) {
            promise._rejectCallback(maybeWrapAsError(e), true, true);
        }
        return promise;
    }
    util.notEnumerableProp(promisified, "__isPromisified__", true);
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function promisifyAll(obj, suffix, filter, promisifier) {
    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
    var methods =
        promisifiableMethods(obj, suffix, suffixRegexp, filter);

    for (var i = 0, len = methods.length; i < len; i+= 2) {
        var key = methods[i];
        var fn = methods[i+1];
        var promisifiedKey = key + suffix;
        if (promisifier === makeNodePromisified) {
            obj[promisifiedKey] =
                makeNodePromisified(key, THIS, key, fn, suffix);
        } else {
            var promisified = promisifier(fn, function() {
                return makeNodePromisified(key, THIS, key, fn, suffix);
            });
            util.notEnumerableProp(promisified, "__isPromisified__", true);
            obj[promisifiedKey] = promisified;
        }
    }
    util.toFastProperties(obj);
    return obj;
}

function promisify(callback, receiver) {
    return makeNodePromisified(callback, receiver, undefined, callback);
}

Promise.promisify = function (fn, receiver) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    if (isPromisified(fn)) {
        return fn;
    }
    var ret = promisify(fn, arguments.length < 2 ? THIS : receiver);
    util.copyDescriptors(fn, ret, propsFilter);
    return ret;
};

Promise.promisifyAll = function (target, options) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function\u000a\u000a    See http://goo.gl/9ITlV0\u000a");
    }
    options = Object(options);
    var suffix = options.suffix;
    if (typeof suffix !== "string") suffix = defaultSuffix;
    var filter = options.filter;
    if (typeof filter !== "function") filter = defaultFilter;
    var promisifier = options.promisifier;
    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

    if (!util.isIdentifier(suffix)) {
        throw new RangeError("suffix must be a valid identifier\u000a\u000a    See http://goo.gl/8FZo5V\u000a");
    }

    var keys = util.inheritedDataKeys(target);
    for (var i = 0; i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" &&
            util.isClass(value)) {
            promisifyAll(value.prototype, suffix, filter, promisifier);
            promisifyAll(value, suffix, filter, promisifier);
        }
    }

    return promisifyAll(target, suffix, filter, promisifier);
};
};


},{"./errors":13,"./promise_resolver.js":25,"./util.js":38}],27:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, PromiseArray, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util.js");
var isObject = util.isObject;
var es5 = _dereq_("./es5.js");

function PropertiesPromiseArray(obj) {
    var keys = es5.keys(obj);
    var len = keys.length;
    var values = new Array(len * 2);
    for (var i = 0; i < len; ++i) {
        var key = keys[i];
        values[i] = obj[key];
        values[i + len] = key;
    }
    this.constructor$(values);
}
util.inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init = function () {
    this._init$(undefined, -3) ;
};

PropertiesPromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val = {};
        var keyOffset = this.length();
        for (var i = 0, len = this.length(); i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
        }
        this._resolve(val);
    }
};

PropertiesPromiseArray.prototype._promiseProgressed = function (value, index) {
    this._promise._progress({
        key: this._values[index + this.length()],
        value: value
    });
};

PropertiesPromiseArray.prototype.shouldCopyValues = function () {
    return false;
};

PropertiesPromiseArray.prototype.getActualLength = function (len) {
    return len >> 1;
};

function props(promises) {
    var ret;
    var castValue = tryConvertToPromise(promises);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object\u000a\u000a    See http://goo.gl/OsFKC8\u000a");
    } else if (castValue instanceof Promise) {
        ret = castValue._then(
            Promise.props, undefined, undefined, undefined, undefined);
    } else {
        ret = new PropertiesPromiseArray(castValue).promise();
    }

    if (castValue instanceof Promise) {
        ret._propagateFrom(castValue, 4);
    }
    return ret;
}

Promise.prototype.props = function () {
    return props(this);
};

Promise.props = function (promises) {
    return props(promises);
};
};

},{"./es5.js":14,"./util.js":38}],28:[function(_dereq_,module,exports){
"use strict";
function arrayMove(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
        src[j + srcIndex] = void 0;
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
}

Queue.prototype._willBeOverCapacity = function (size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function (arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype._unshiftOne = function(value) {
    var capacity = this._capacity;
    this._checkCapacity(this.length() + 1);
    var front = this._front;
    var i = (((( front - 1 ) &
                    ( capacity - 1) ) ^ capacity ) - capacity );
    this[i] = value;
    this._front = i;
    this._length = this.length() + 1;
};

Queue.prototype.unshift = function(fn, receiver, arg) {
    this._unshiftOne(arg);
    this._unshiftOne(receiver);
    this._unshiftOne(fn);
};

Queue.prototype.push = function (fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function () {
    var front = this._front,
        ret = this[front];

    this[front] = undefined;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function () {
    return this._length;
};

Queue.prototype._checkCapacity = function (size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 1);
    }
};

Queue.prototype._resizeTo = function (capacity) {
    var oldCapacity = this._capacity;
    this._capacity = capacity;
    var front = this._front;
    var length = this._length;
    var moveItemsCount = (front + length) & (oldCapacity - 1);
    arrayMove(this, 0, this, oldCapacity, moveItemsCount);
};

module.exports = Queue;

},{}],29:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, INTERNAL, tryConvertToPromise, apiRejection) {
var isArray = _dereq_("./util.js").isArray;

var raceLater = function (promise) {
    return promise.then(function(array) {
        return race(array, promise);
    });
};

function race(promises, parent) {
    var maybePromise = tryConvertToPromise(promises);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    } else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a");
    }

    var ret = new Promise(INTERNAL);
    if (parent !== undefined) {
        ret._propagateFrom(parent, 4 | 1);
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === undefined && !(i in promises)) {
            continue;
        }

        Promise.cast(val)._then(fulfill, reject, undefined, ret, null);
    }
    return ret;
}

Promise.race = function (promises) {
    return race(promises, undefined);
};

Promise.prototype.race = function () {
    return race(this, undefined);
};

};

},{"./util.js":38}],30:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
function ReductionPromiseArray(promises, fn, accum, _each) {
    this.constructor$(promises);
    this._promise._captureStackTrace();
    this._preservedValues = _each === INTERNAL ? [] : null;
    this._zerothIsAccum = (accum === undefined);
    this._gotAccum = false;
    this._reducingIndex = (this._zerothIsAccum ? 1 : 0);
    this._valuesPhase = undefined;
    var maybePromise = tryConvertToPromise(accum, this._promise);
    var rejected = false;
    var isPromise = maybePromise instanceof Promise;
    if (isPromise) {
        maybePromise = maybePromise._target();
        if (maybePromise._isPending()) {
            maybePromise._proxyPromiseArray(this, -1);
        } else if (maybePromise._isFulfilled()) {
            accum = maybePromise._value();
            this._gotAccum = true;
        } else {
            this._reject(maybePromise._reason());
            rejected = true;
        }
    }
    if (!(isPromise || this._zerothIsAccum)) this._gotAccum = true;
    var domain = getDomain();
    this._callback = domain === null ? fn : domain.bind(fn);
    this._accum = accum;
    if (!rejected) async.invoke(init, this, undefined);
}
function init() {
    this._init$(undefined, -5);
}
util.inherits(ReductionPromiseArray, PromiseArray);

ReductionPromiseArray.prototype._init = function () {};

ReductionPromiseArray.prototype._resolveEmptyArray = function () {
    if (this._gotAccum || this._zerothIsAccum) {
        this._resolve(this._preservedValues !== null
                        ? [] : this._accum);
    }
};

ReductionPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var values = this._values;
    values[index] = value;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var isEach = preservedValues !== null;
    var gotAccum = this._gotAccum;
    var valuesPhase = this._valuesPhase;
    var valuesPhaseIndex;
    if (!valuesPhase) {
        valuesPhase = this._valuesPhase = new Array(length);
        for (valuesPhaseIndex=0; valuesPhaseIndex<length; ++valuesPhaseIndex) {
            valuesPhase[valuesPhaseIndex] = 0;
        }
    }
    valuesPhaseIndex = valuesPhase[index];

    if (index === 0 && this._zerothIsAccum) {
        this._accum = value;
        this._gotAccum = gotAccum = true;
        valuesPhase[index] = ((valuesPhaseIndex === 0)
            ? 1 : 2);
    } else if (index === -1) {
        this._accum = value;
        this._gotAccum = gotAccum = true;
    } else {
        if (valuesPhaseIndex === 0) {
            valuesPhase[index] = 1;
        } else {
            valuesPhase[index] = 2;
            this._accum = value;
        }
    }
    if (!gotAccum) return;

    var callback = this._callback;
    var receiver = this._promise._boundValue();
    var ret;

    for (var i = this._reducingIndex; i < length; ++i) {
        valuesPhaseIndex = valuesPhase[i];
        if (valuesPhaseIndex === 2) {
            this._reducingIndex = i + 1;
            continue;
        }
        if (valuesPhaseIndex !== 1) return;
        value = values[i];
        this._promise._pushContext();
        if (isEach) {
            preservedValues.push(value);
            ret = tryCatch(callback).call(receiver, value, i, length);
        }
        else {
            ret = tryCatch(callback)
                .call(receiver, this._accum, value, i, length);
        }
        this._promise._popContext();

        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (maybePromise._isPending()) {
                valuesPhase[i] = 4;
                return maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise._isFulfilled()) {
                ret = maybePromise._value();
            } else {
                return this._reject(maybePromise._reason());
            }
        }

        this._reducingIndex = i + 1;
        this._accum = ret;
    }

    this._resolve(isEach ? preservedValues : this._accum);
};

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

Promise.prototype.reduce = function (fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function (promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};
};

},{"./async.js":2,"./util.js":38}],31:[function(_dereq_,module,exports){
"use strict";
var schedule;
var util = _dereq_("./util");
var noAsyncScheduler = function() {
    throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/m3OTXk\u000a");
};
if (util.isNode && typeof MutationObserver === "undefined") {
    var GlobalSetImmediate = global.setImmediate;
    var ProcessNextTick = process.nextTick;
    schedule = util.isRecentNode
                ? function(fn) { GlobalSetImmediate.call(global, fn); }
                : function(fn) { ProcessNextTick.call(process, fn); };
} else if ((typeof MutationObserver !== "undefined") &&
          !(typeof window !== "undefined" &&
            window.navigator &&
            window.navigator.standalone)) {
    schedule = function(fn) {
        var div = document.createElement("div");
        var observer = new MutationObserver(fn);
        observer.observe(div, {attributes: true});
        return function() { div.classList.toggle("foo"); };
    };
    schedule.isStatic = true;
} else if (typeof setImmediate !== "undefined") {
    schedule = function (fn) {
        setImmediate(fn);
    };
} else if (typeof setTimeout !== "undefined") {
    schedule = function (fn) {
        setTimeout(fn, 0);
    };
} else {
    schedule = noAsyncScheduler;
}
module.exports = schedule;

},{"./util":38}],32:[function(_dereq_,module,exports){
"use strict";
module.exports =
    function(Promise, PromiseArray) {
var PromiseInspection = Promise.PromiseInspection;
var util = _dereq_("./util.js");

function SettledPromiseArray(values) {
    this.constructor$(values);
}
util.inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved = function (index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

SettledPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var ret = new PromiseInspection();
    ret._bitField = 268435456;
    ret._settledValue = value;
    this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected = function (reason, index) {
    var ret = new PromiseInspection();
    ret._bitField = 134217728;
    ret._settledValue = reason;
    this._promiseResolved(index, ret);
};

Promise.settle = function (promises) {
    return new SettledPromiseArray(promises).promise();
};

Promise.prototype.settle = function () {
    return new SettledPromiseArray(this).promise();
};
};

},{"./util.js":38}],33:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, apiRejection) {
var util = _dereq_("./util.js");
var RangeError = _dereq_("./errors.js").RangeError;
var AggregateError = _dereq_("./errors.js").AggregateError;
var isArray = util.isArray;


function SomePromiseArray(values) {
    this.constructor$(values);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
util.inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function () {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(undefined, -5);
    var isArrayResolved = isArray(this._values);
    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
    }
};

SomePromiseArray.prototype.init = function () {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function () {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function () {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany = function (count) {
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled = function (value) {
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        } else {
            this._resolve(this._values);
        }
    }

};
SomePromiseArray.prototype._promiseRejected = function (reason) {
    this._addRejected(reason);
    if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError();
        for (var i = this.length(); i < this._values.length; ++i) {
            e.push(this._values[i]);
        }
        this._reject(e);
    }
};

SomePromiseArray.prototype._fulfilled = function () {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function () {
    return this._values.length - this.length();
};

SomePromiseArray.prototype._addRejected = function (reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled = function (value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill = function () {
    return this.length() - this._rejected();
};

SomePromiseArray.prototype._getRangeError = function (count) {
    var message = "Input array must contain at least " +
            this._howMany + " items but contains only " + count + " items";
    return new RangeError(message);
};

SomePromiseArray.prototype._resolveEmptyArray = function () {
    this._reject(this._getRangeError(0));
};

function some(promises, howMany) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer\u000a\u000a    See http://goo.gl/1wAmHx\u000a");
    }
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function (promises, howMany) {
    return some(promises, howMany);
};

Promise.prototype.some = function (howMany) {
    return some(this, howMany);
};

Promise._SomePromiseArray = SomePromiseArray;
};

},{"./errors.js":13,"./util.js":38}],34:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== undefined) {
        promise = promise._target();
        this._bitField = promise._bitField;
        this._settledValue = promise._settledValue;
    }
    else {
        this._bitField = 0;
        this._settledValue = undefined;
    }
}

PromiseInspection.prototype.value = function () {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/hc1DLj\u000a");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason = function () {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/hPuiwB\u000a");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isFulfilled =
Promise.prototype._isFulfilled = function () {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype._isRejected = function () {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype._isPending = function () {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.isResolved =
Promise.prototype._isResolved = function () {
    return (this._bitField & 402653184) > 0;
};

Promise.prototype.isPending = function() {
    return this._target()._isPending();
};

Promise.prototype.isRejected = function() {
    return this._target()._isRejected();
};

Promise.prototype.isFulfilled = function() {
    return this._target()._isFulfilled();
};

Promise.prototype.isResolved = function() {
    return this._target()._isResolved();
};

Promise.prototype._value = function() {
    return this._settledValue;
};

Promise.prototype._reason = function() {
    this._unsetRejectionIsUnhandled();
    return this._settledValue;
};

Promise.prototype.value = function() {
    var target = this._target();
    if (!target.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/hc1DLj\u000a");
    }
    return target._settledValue;
};

Promise.prototype.reason = function() {
    var target = this._target();
    if (!target.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/hPuiwB\u000a");
    }
    target._unsetRejectionIsUnhandled();
    return target._settledValue;
};


Promise.PromiseInspection = PromiseInspection;
};

},{}],35:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var errorObj = util.errorObj;
var isObject = util.isObject;

function tryConvertToPromise(obj, context) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            return ret;
        }
        var then = util.tryCatch(getThen)(obj);
        if (then === errorObj) {
            if (context) context._pushContext();
            var ret = Promise.reject(then.e);
            if (context) context._popContext();
            return ret;
        } else if (typeof then === "function") {
            return doThenable(obj, then, context);
        }
    }
    return obj;
}

function getThen(obj) {
    return obj.then;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function doThenable(x, then, context) {
    var promise = new Promise(INTERNAL);
    var ret = promise;
    if (context) context._pushContext();
    promise._captureStackTrace();
    if (context) context._popContext();
    var synchronous = true;
    var result = util.tryCatch(then).call(x,
                                        resolveFromThenable,
                                        rejectFromThenable,
                                        progressFromThenable);
    synchronous = false;
    if (promise && result === errorObj) {
        promise._rejectCallback(result.e, true, true);
        promise = null;
    }

    function resolveFromThenable(value) {
        if (!promise) return;
        promise._resolveCallback(value);
        promise = null;
    }

    function rejectFromThenable(reason) {
        if (!promise) return;
        promise._rejectCallback(reason, synchronous, true);
        promise = null;
    }

    function progressFromThenable(value) {
        if (!promise) return;
        if (typeof promise._progress === "function") {
            promise._progress(value);
        }
    }
    return ret;
}

return tryConvertToPromise;
};

},{"./util.js":38}],36:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var TimeoutError = Promise.TimeoutError;

var afterTimeout = function (promise, message) {
    if (!promise.isPending()) return;
    
    var err;
    if(!util.isPrimitive(message) && (message instanceof Error)) {
        err = message;
    } else {
        if (typeof message !== "string") {
            message = "operation timed out";
        }
        err = new TimeoutError(message);
    }
    util.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._cancel(err);
};

var afterValue = function(value) { return delay(+this).thenReturn(value); };
var delay = Promise.delay = function (value, ms) {
    if (ms === undefined) {
        ms = value;
        value = undefined;
        var ret = new Promise(INTERNAL);
        setTimeout(function() { ret._fulfill(); }, ms);
        return ret;
    }
    ms = +ms;
    return Promise.resolve(value)._then(afterValue, null, null, ms, undefined);
};

Promise.prototype.delay = function (ms) {
    return delay(this, ms);
};

function successClear(value) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    return value;
}

function failureClear(reason) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    throw reason;
}

Promise.prototype.timeout = function (ms, message) {
    ms = +ms;
    var ret = this.then().cancellable();
    ret._cancellationParent = this;
    var handle = setTimeout(function timeoutTimeout() {
        afterTimeout(ret, message);
    }, ms);
    return ret._then(successClear, failureClear, undefined, handle, undefined);
};

};

},{"./util.js":38}],37:[function(_dereq_,module,exports){
"use strict";
module.exports = function (Promise, apiRejection, tryConvertToPromise,
    createContext) {
    var TypeError = _dereq_("./errors.js").TypeError;
    var inherits = _dereq_("./util.js").inherits;
    var PromiseInspection = Promise.PromiseInspection;

    function inspectionMapper(inspections) {
        var len = inspections.length;
        for (var i = 0; i < len; ++i) {
            var inspection = inspections[i];
            if (inspection.isRejected()) {
                return Promise.reject(inspection.error());
            }
            inspections[i] = inspection._settledValue;
        }
        return inspections;
    }

    function thrower(e) {
        setTimeout(function(){throw e;}, 0);
    }

    function castPreservingDisposable(thenable) {
        var maybePromise = tryConvertToPromise(thenable);
        if (maybePromise !== thenable &&
            typeof thenable._isDisposable === "function" &&
            typeof thenable._getDisposer === "function" &&
            thenable._isDisposable()) {
            maybePromise._setDisposable(thenable._getDisposer());
        }
        return maybePromise;
    }
    function dispose(resources, inspection) {
        var i = 0;
        var len = resources.length;
        var ret = Promise.defer();
        function iterator() {
            if (i >= len) return ret.resolve();
            var maybePromise = castPreservingDisposable(resources[i++]);
            if (maybePromise instanceof Promise &&
                maybePromise._isDisposable()) {
                try {
                    maybePromise = tryConvertToPromise(
                        maybePromise._getDisposer().tryDispose(inspection),
                        resources.promise);
                } catch (e) {
                    return thrower(e);
                }
                if (maybePromise instanceof Promise) {
                    return maybePromise._then(iterator, thrower,
                                              null, null, null);
                }
            }
            iterator();
        }
        iterator();
        return ret.promise;
    }

    function disposerSuccess(value) {
        var inspection = new PromiseInspection();
        inspection._settledValue = value;
        inspection._bitField = 268435456;
        return dispose(this, inspection).thenReturn(value);
    }

    function disposerFail(reason) {
        var inspection = new PromiseInspection();
        inspection._settledValue = reason;
        inspection._bitField = 134217728;
        return dispose(this, inspection).thenThrow(reason);
    }

    function Disposer(data, promise, context) {
        this._data = data;
        this._promise = promise;
        this._context = context;
    }

    Disposer.prototype.data = function () {
        return this._data;
    };

    Disposer.prototype.promise = function () {
        return this._promise;
    };

    Disposer.prototype.resource = function () {
        if (this.promise().isFulfilled()) {
            return this.promise().value();
        }
        return null;
    };

    Disposer.prototype.tryDispose = function(inspection) {
        var resource = this.resource();
        var context = this._context;
        if (context !== undefined) context._pushContext();
        var ret = resource !== null
            ? this.doDispose(resource, inspection) : null;
        if (context !== undefined) context._popContext();
        this._promise._unsetDisposable();
        this._data = null;
        return ret;
    };

    Disposer.isDisposer = function (d) {
        return (d != null &&
                typeof d.resource === "function" &&
                typeof d.tryDispose === "function");
    };

    function FunctionDisposer(fn, promise, context) {
        this.constructor$(fn, promise, context);
    }
    inherits(FunctionDisposer, Disposer);

    FunctionDisposer.prototype.doDispose = function (resource, inspection) {
        var fn = this.data();
        return fn.call(resource, resource, inspection);
    };

    function maybeUnwrapDisposer(value) {
        if (Disposer.isDisposer(value)) {
            this.resources[this.index]._setDisposable(value);
            return value.promise();
        }
        return value;
    }

    Promise.using = function () {
        var len = arguments.length;
        if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
        var fn = arguments[len - 1];
        if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");

        var input;
        var spreadArgs = true;
        if (len === 2 && Array.isArray(arguments[0])) {
            input = arguments[0];
            len = input.length;
            spreadArgs = false;
        } else {
            input = arguments;
            len--;
        }
        var resources = new Array(len);
        for (var i = 0; i < len; ++i) {
            var resource = input[i];
            if (Disposer.isDisposer(resource)) {
                var disposer = resource;
                resource = resource.promise();
                resource._setDisposable(disposer);
            } else {
                var maybePromise = tryConvertToPromise(resource);
                if (maybePromise instanceof Promise) {
                    resource =
                        maybePromise._then(maybeUnwrapDisposer, null, null, {
                            resources: resources,
                            index: i
                    }, undefined);
                }
            }
            resources[i] = resource;
        }

        var promise = Promise.settle(resources)
            .then(inspectionMapper)
            .then(function(vals) {
                promise._pushContext();
                var ret;
                try {
                    ret = spreadArgs
                        ? fn.apply(undefined, vals) : fn.call(undefined,  vals);
                } finally {
                    promise._popContext();
                }
                return ret;
            })
            ._then(
                disposerSuccess, disposerFail, undefined, resources, undefined);
        resources.promise = promise;
        return promise;
    };

    Promise.prototype._setDisposable = function (disposer) {
        this._bitField = this._bitField | 262144;
        this._disposer = disposer;
    };

    Promise.prototype._isDisposable = function () {
        return (this._bitField & 262144) > 0;
    };

    Promise.prototype._getDisposer = function () {
        return this._disposer;
    };

    Promise.prototype._unsetDisposable = function () {
        this._bitField = this._bitField & (~262144);
        this._disposer = undefined;
    };

    Promise.prototype.disposer = function (fn) {
        if (typeof fn === "function") {
            return new FunctionDisposer(fn, this, createContext());
        }
        throw new TypeError();
    };

};

},{"./errors.js":13,"./util.js":38}],38:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5.js");
var canEvaluate = typeof navigator == "undefined";
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();

var errorObj = {e: {}};
var tryCatchTarget;
function tryCatcher() {
    try {
        var target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};


function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(safeToString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);

        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    var excludedPrototypes = [
        Array.prototype,
        Object.prototype,
        Function.prototype
    ];

    var isExcludedProto = function(val) {
        for (var i = 0; i < excludedPrototypes.length; ++i) {
            if (excludedPrototypes[i] === val) {
                return true;
            }
        }
        return false;
    };

    if (es5.isES5) {
        var getKeys = Object.getOwnPropertyNames;
        return function(obj) {
            var ret = [];
            var visitedKeys = Object.create(null);
            while (obj != null && !isExcludedProto(obj)) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        var hasProp = {}.hasOwnProperty;
        return function(obj) {
            if (isExcludedProto(obj)) return [];
            var ret = [];

            /*jshint forin:false */
            enumeration: for (var key in obj) {
                if (hasProp.call(obj, key)) {
                    ret.push(key);
                } else {
                    for (var i = 0; i < excludedPrototypes.length; ++i) {
                        if (hasProp.call(excludedPrototypes[i], key)) {
                            continue enumeration;
                        }
                    }
                    ret.push(key);
                }
            }
            return ret;
        };
    }

})();

var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.names(fn.prototype);

            var hasMethods = es5.isES5 && keys.length > 1;
            var hasMethodsOtherThanConstructor = keys.length > 0 &&
                !(keys.length === 1 && keys[0] === "constructor");
            var hasThisAssignmentAndStaticMethods =
                thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;

            if (hasMethods || hasMethodsOtherThanConstructor ||
                hasThisAssignmentAndStaticMethods) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027,-W055,-W031*/
    function f() {}
    f.prototype = obj;
    var l = 8;
    while (l--) new f();
    return obj;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

function safeToString(obj) {
    try {
        return obj + "";
    } catch (e) {
        return "[no string representation]";
    }
}

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof Error["__BluebirdErrorTypes__"].OperationalError) ||
        e["isOperational"] === true);
}

function canAttachTrace(obj) {
    return obj instanceof Error && es5.propertyIsWritable(obj, "stack");
}

var ensureErrorObject = (function() {
    if (!("stack" in new Error())) {
        return function(value) {
            if (canAttachTrace(value)) return value;
            try {throw new Error(safeToString(value));}
            catch(err) {return err;}
        };
    } else {
        return function(value) {
            if (canAttachTrace(value)) return value;
            return new Error(safeToString(value));
        };
    }
})();

function classString(obj) {
    return {}.toString.call(obj);
}

function copyDescriptors(from, to, filter) {
    var keys = es5.names(from);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        if (filter(key)) {
            try {
                es5.defineProperty(to, key, es5.getDescriptor(from, key));
            } catch (ignore) {}
        }
    }
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch: tryCatch,
    inherits: inherits,
    withAppended: withAppended,
    maybeWrapAsError: maybeWrapAsError,
    toFastProperties: toFastProperties,
    filledRange: filledRange,
    toString: safeToString,
    canAttachTrace: canAttachTrace,
    ensureErrorObject: ensureErrorObject,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    classString: classString,
    copyDescriptors: copyDescriptors,
    hasDevTools: typeof chrome !== "undefined" && chrome &&
                 typeof chrome.loadTimes === "function",
    isNode: typeof process !== "undefined" &&
        classString(process).toLowerCase() === "[object process]"
};
ret.isRecentNode = ret.isNode && (function() {
    var version = process.versions.node.split(".").map(Number);
    return (version[0] === 0 && version[1] > 10) || (version[0] > 0);
})();

if (ret.isNode) ret.toFastProperties(process);

try {throw new Error(); } catch (e) {ret.lastLineError = e;}
module.exports = ret;

},{"./es5.js":14}]},{},[4])(4)
});                    ;if (typeof window !== 'undefined' && window !== null) {                               window.P = window.Promise;                                                     } else if (typeof self !== 'undefined' && self !== null) {                             self.P = self.Promise;                                                         }

require=function t(e,n,r){function o(a,s){if(!n[a]){if(!e[a]){var c="function"==typeof require&&require;if(!s&&c)return c(a,!0);if(i)return i(a,!0);var u=new Error("Cannot find module '"+a+"'");throw u.code="MODULE_NOT_FOUND",u}var f=n[a]={exports:{}};e[a][0].call(f.exports,function(t){var n=e[a][1][t];return o(n?n:t)},f,f.exports,t,e,n,r)}return n[a].exports}for(var i="function"==typeof require&&require,a=0;a<r.length;a++)o(r[a]);return o}({1:[function(t,e,n){e.exports=[{constant:!0,inputs:[{name:"_owner",type:"address"}],name:"name",outputs:[{name:"o_name",type:"bytes32"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"owner",outputs:[{name:"",type:"address"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"content",outputs:[{name:"",type:"bytes32"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"addr",outputs:[{name:"",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"}],name:"reserve",outputs:[],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"subRegistrar",outputs:[{name:"",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_newOwner",type:"address"}],name:"transfer",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_registrar",type:"address"}],name:"setSubRegistrar",outputs:[],type:"function"},{constant:!1,inputs:[],name:"Registrar",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_a",type:"address"},{name:"_primary",type:"bool"}],name:"setAddress",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_content",type:"bytes32"}],name:"setContent",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"}],name:"disown",outputs:[],type:"function"},{anonymous:!1,inputs:[{indexed:!0,name:"_name",type:"bytes32"},{indexed:!1,name:"_winner",type:"address"}],name:"AuctionEnded",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"_name",type:"bytes32"},{indexed:!1,name:"_bidder",type:"address"},{indexed:!1,name:"_value",type:"uint256"}],name:"NewBid",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"name",type:"bytes32"}],name:"Changed",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"name",type:"bytes32"},{indexed:!0,name:"addr",type:"address"}],name:"PrimaryChanged",type:"event"}]},{}],2:[function(t,e,n){e.exports=[{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"owner",outputs:[{name:"",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_refund",type:"address"}],name:"disown",outputs:[],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"addr",outputs:[{name:"",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"}],name:"reserve",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_newOwner",type:"address"}],name:"transfer",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_a",type:"address"}],name:"setAddr",outputs:[],type:"function"},{anonymous:!1,inputs:[{indexed:!0,name:"name",type:"bytes32"}],name:"Changed",type:"event"}]},{}],3:[function(t,e,n){e.exports=[{constant:!1,inputs:[{name:"from",type:"bytes32"},{name:"to",type:"address"},{name:"value",type:"uint256"}],name:"transfer",outputs:[],type:"function"},{constant:!1,inputs:[{name:"from",type:"bytes32"},{name:"to",type:"address"},{name:"indirectId",type:"bytes32"},{name:"value",type:"uint256"}],name:"icapTransfer",outputs:[],type:"function"},{constant:!1,inputs:[{name:"to",type:"bytes32"}],name:"deposit",outputs:[],type:"function"},{anonymous:!1,inputs:[{indexed:!0,name:"from",type:"address"},{indexed:!1,name:"value",type:"uint256"}],name:"AnonymousDeposit",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"from",type:"address"},{indexed:!0,name:"to",type:"bytes32"},{indexed:!1,name:"value",type:"uint256"}],name:"Deposit",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"from",type:"bytes32"},{indexed:!0,name:"to",type:"address"},{indexed:!1,name:"value",type:"uint256"}],name:"Transfer",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"from",type:"bytes32"},{indexed:!0,name:"to",type:"address"},{indexed:!1,name:"indirectId",type:"bytes32"},{indexed:!1,name:"value",type:"uint256"}],name:"IcapTransfer",type:"event"}]},{}],4:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputAddress};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/address(\[([0-9]*)\])?/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],5:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputBool,this._outputFormatter=r.formatOutputBool};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bool(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],6:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputBytes,this._outputFormatter=r.formatOutputBytes};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bytes([0-9]{1,})(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){var e=t.match(/^bytes([0-9]*)/),n=parseInt(e[1]);return n*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],7:[function(t,e,n){var r=t("./formatters"),o=t("./address"),i=t("./bool"),a=t("./int"),s=t("./uint"),c=t("./dynamicbytes"),u=t("./string"),f=t("./real"),p=t("./ureal"),l=t("./bytes"),h=function(t){this._types=t};h.prototype._requireType=function(t){var e=this._types.filter(function(e){return e.isType(t)})[0];if(!e)throw Error("invalid solidity type!: "+t);return e},h.prototype.encodeParam=function(t,e){return this.encodeParams([t],[e])},h.prototype.encodeParams=function(t,e){var n=this.getSolidityTypes(t),r=n.map(function(n,r){return n.encode(e[r],t[r])}),o=n.reduce(function(e,n,r){var o=n.staticPartLength(t[r]),i=32*Math.floor((o+31)/32);return e+i},0),i=this.encodeMultiWithOffset(t,n,r,o);return i},h.prototype.encodeMultiWithOffset=function(t,e,n,o){var i="",a=this,s=function(n){return e[n].isDynamicArray(t[n])||e[n].isDynamicType(t[n])};return t.forEach(function(c,u){if(s(u)){i+=r.formatInputInt(o).encode();var f=a.encodeWithOffset(t[u],e[u],n[u],o);o+=f.length/2}else i+=a.encodeWithOffset(t[u],e[u],n[u],o)}),t.forEach(function(r,c){if(s(c)){var u=a.encodeWithOffset(t[c],e[c],n[c],o);o+=u.length/2,i+=u}}),i},h.prototype.encodeWithOffset=function(t,e,n,o){var i=this;return e.isDynamicArray(t)?function(){var a=e.nestedName(t),s=e.staticPartLength(a),c=n[0];return function(){var t=2;if(e.isDynamicArray(a))for(var i=1;i<n.length;i++)t+=+n[i-1][0]||0,c+=r.formatInputInt(o+i*s+32*t).encode()}(),function(){for(var t=0;t<n.length-1;t++){var r=c/2;c+=i.encodeWithOffset(a,e,n[t+1],o+r)}}(),c}():e.isStaticArray(t)?function(){var a=e.nestedName(t),s=e.staticPartLength(a),c="";return e.isDynamicArray(a)&&!function(){for(var t=0,e=0;e<n.length;e++)t+=+(n[e-1]||[])[0]||0,c+=r.formatInputInt(o+e*s+32*t).encode()}(),function(){for(var t=0;t<n.length;t++){var r=c/2;c+=i.encodeWithOffset(a,e,n[t],o+r)}}(),c}():n},h.prototype.decodeParam=function(t,e){return this.decodeParams([t],e)[0]},h.prototype.decodeParams=function(t,e){var n=this.getSolidityTypes(t),r=this.getOffsets(t,n);return n.map(function(n,o){return n.decode(e,r[o],t[o],o)})},h.prototype.getOffsets=function(t,e){for(var n=e.map(function(e,n){return e.staticPartLength(t[n])}),r=1;r<n.length;r++)n[r]+=n[r-1];return n.map(function(n,r){var o=e[r].staticPartLength(t[r]);return n-o})},h.prototype.getSolidityTypes=function(t){var e=this;return t.map(function(t){return e._requireType(t)})};var d=new h([new o,new i,new a,new s,new c,new l,new u,new f,new p]);e.exports=d},{"./address":4,"./bool":5,"./bytes":6,"./dynamicbytes":8,"./formatters":9,"./int":10,"./real":12,"./string":13,"./uint":15,"./ureal":16}],8:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputDynamicBytes,this._outputFormatter=r.formatOutputDynamicBytes};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bytes(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},i.prototype.isDynamicType=function(){return!0},e.exports=i},{"./formatters":9,"./type":14}],9:[function(t,e,n){var r=t("bignumber.js"),o=t("../utils/utils"),i=t("../utils/config"),a=t("./param"),s=function(t){r.config(i.ETH_BIGNUMBER_ROUNDING_MODE);var e=o.padLeft(o.toTwosComplement(t).round().toString(16),64);return new a(e)},c=function(t){var e=o.toHex(t).substr(2),n=Math.floor((e.length+63)/64);return e=o.padRight(e,64*n),new a(e)},u=function(t){var e=o.toHex(t).substr(2),n=e.length/2,r=Math.floor((e.length+63)/64);return e=o.padRight(e,64*r),new a(s(n).value+e)},f=function(t){var e=o.fromUtf8(t).substr(2),n=e.length/2,r=Math.floor((e.length+63)/64);return e=o.padRight(e,64*r),new a(s(n).value+e)},p=function(t){var e="000000000000000000000000000000000000000000000000000000000000000"+(t?"1":"0");return new a(e)},l=function(t){return s(new r(t).times(new r(2).pow(128)))},h=function(t){return"1"===new r(t.substr(0,1),16).toString(2).substr(0,1)},d=function(t){var e=t.staticPart()||"0";return h(e)?new r(e,16).minus(new r("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16)).minus(1):new r(e,16)},m=function(t){var e=t.staticPart()||"0";return new r(e,16)},y=function(t){return d(t).dividedBy(new r(2).pow(128))},g=function(t){return m(t).dividedBy(new r(2).pow(128))},v=function(t){return"0000000000000000000000000000000000000000000000000000000000000001"===t.staticPart()?!0:!1},b=function(t){return"0x"+t.staticPart()},_=function(t){var e=2*new r(t.dynamicPart().slice(0,64),16).toNumber();return"0x"+t.dynamicPart().substr(64,e)},w=function(t){var e=2*new r(t.dynamicPart().slice(0,64),16).toNumber();return o.toUtf8(t.dynamicPart().substr(64,e))},x=function(t){var e=t.staticPart();return"0x"+e.slice(e.length-40,e.length)};e.exports={formatInputInt:s,formatInputBytes:c,formatInputDynamicBytes:u,formatInputString:f,formatInputBool:p,formatInputReal:l,formatOutputInt:d,formatOutputUInt:m,formatOutputReal:y,formatOutputUReal:g,formatOutputBool:v,formatOutputBytes:b,formatOutputDynamicBytes:_,formatOutputString:w,formatOutputAddress:x}},{"../utils/config":18,"../utils/utils":20,"./param":11,"bignumber.js":"bignumber.js"}],10:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputInt};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^int([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],11:[function(t,e,n){var r=t("../utils/utils"),o=function(t,e){this.value=t||"",this.offset=e};o.prototype.dynamicPartLength=function(){return this.dynamicPart().length/2},o.prototype.withOffset=function(t){return new o(this.value,t)},o.prototype.combine=function(t){return new o(this.value+t.value)},o.prototype.isDynamic=function(){return void 0!==this.offset},o.prototype.offsetAsBytes=function(){return this.isDynamic()?r.padLeft(r.toTwosComplement(this.offset).toString(16),64):""},o.prototype.staticPart=function(){return this.isDynamic()?this.offsetAsBytes():this.value},o.prototype.dynamicPart=function(){return this.isDynamic()?this.value:""},o.prototype.encode=function(){return this.staticPart()+this.dynamicPart()},o.encodeList=function(t){var e=32*t.length,n=t.map(function(t){if(!t.isDynamic())return t;var n=e;return e+=t.dynamicPartLength(),t.withOffset(n)});return n.reduce(function(t,e){return t+e.dynamicPart()},n.reduce(function(t,e){return t+e.staticPart()},""))},e.exports=o},{"../utils/utils":20}],12:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputReal,this._outputFormatter=r.formatOutputReal};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/real([0-9]*)?(\[([0-9]*)\])?/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],13:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputString,this._outputFormatter=r.formatOutputString};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^string(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},i.prototype.isDynamicType=function(){return!0},e.exports=i},{"./formatters":9,"./type":14}],14:[function(t,e,n){var r=t("./formatters"),o=t("./param"),i=function(t){this._inputFormatter=t.inputFormatter,this._outputFormatter=t.outputFormatter};i.prototype.isType=function(t){throw"this method should be overrwritten for type "+t},i.prototype.staticPartLength=function(t){throw"this method should be overrwritten for type: "+t},i.prototype.isDynamicArray=function(t){var e=this.nestedTypes(t);return!!e&&!e[e.length-1].match(/[0-9]{1,}/g)},i.prototype.isStaticArray=function(t){var e=this.nestedTypes(t);return!!e&&!!e[e.length-1].match(/[0-9]{1,}/g)},i.prototype.staticArrayLength=function(t){var e=this.nestedTypes(t);return e?parseInt(e[e.length-1].match(/[0-9]{1,}/g)||1):1},i.prototype.nestedName=function(t){var e=this.nestedTypes(t);return e?t.substr(0,t.length-e[e.length-1].length):t},i.prototype.isDynamicType=function(){return!1},i.prototype.nestedTypes=function(t){return t.match(/(\[[0-9]*\])/g)},i.prototype.encode=function(t,e){var n=this;return this.isDynamicArray(e)?function(){var o=t.length,i=n.nestedName(e),a=[];return a.push(r.formatInputInt(o).encode()),t.forEach(function(t){a.push(n.encode(t,i))}),a}():this.isStaticArray(e)?function(){for(var r=n.staticArrayLength(e),o=n.nestedName(e),i=[],a=0;r>a;a++)i.push(n.encode(t[a],o));return i}():this._inputFormatter(t,e).encode()},i.prototype.decode=function(t,e,n){var r=this;if(this.isDynamicArray(n))return function(){for(var o=parseInt("0x"+t.substr(2*e,64)),i=parseInt("0x"+t.substr(2*o,64)),a=o+32,s=r.nestedName(n),c=r.staticPartLength(s),u=32*Math.floor((c+31)/32),f=[],p=0;i*u>p;p+=u)f.push(r.decode(t,a+p,s));return f}();if(this.isStaticArray(n))return function(){for(var o=r.staticArrayLength(n),i=e,a=r.nestedName(n),s=r.staticPartLength(a),c=32*Math.floor((s+31)/32),u=[],f=0;o*c>f;f+=c)u.push(r.decode(t,i+f,a));return u}();if(this.isDynamicType(n))return function(){var n=parseInt("0x"+t.substr(2*e,64)),i=parseInt("0x"+t.substr(2*n,64)),a=Math.floor((i+31)/32);return r._outputFormatter(new o(t.substr(2*n,64*(1+a)),0))}();var i=this.staticPartLength(n);return this._outputFormatter(new o(t.substr(2*e,2*i)))},e.exports=i},{"./formatters":9,"./param":11}],15:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputUInt};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^uint([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],16:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputReal,this._outputFormatter=r.formatOutputUReal};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^ureal([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":9,"./type":14}],17:[function(t,e,n){"use strict";"undefined"==typeof XMLHttpRequest?n.XMLHttpRequest={}:n.XMLHttpRequest=XMLHttpRequest},{}],18:[function(t,e,n){var r=t("bignumber.js"),o=["wei","kwei","Mwei","Gwei","szabo","finney","femtoether","picoether","nanoether","microether","milliether","nano","micro","milli","ether","grand","Mether","Gether","Tether","Pether","Eether","Zether","Yether","Nether","Dether","Vether","Uether"];e.exports={ETH_PADDING:32,ETH_SIGNATURE_LENGTH:4,ETH_UNITS:o,ETH_BIGNUMBER_ROUNDING_MODE:{ROUNDING_MODE:r.ROUND_DOWN},ETH_POLLING_TIMEOUT:500,defaultBlock:"latest",defaultAccount:void 0}},{"bignumber.js":"bignumber.js"}],19:[function(t,e,n){var r=t("crypto-js"),o=t("crypto-js/sha3");e.exports=function(t,e){return e&&"hex"===e.encoding&&(t.length>2&&"0x"===t.substr(0,2)&&(t=t.substr(2)),t=r.enc.Hex.parse(t)),o(t,{outputLength:256}).toString()}},{"crypto-js":57,"crypto-js/sha3":78}],20:[function(t,e,n){var r=t("bignumber.js"),o=t("utf8"),i={wei:"1",kwei:"1000",ada:"1000",femtoether:"1000",mwei:"1000000",babbage:"1000000",picoether:"1000000",gwei:"1000000000",shannon:"1000000000",nanoether:"1000000000",nano:"1000000000",szabo:"1000000000000",microether:"1000000000000",micro:"1000000000000",finney:"1000000000000000",milliether:"1000000000000000",milli:"1000000000000000",ether:"1000000000000000000",kether:"1000000000000000000000",grand:"1000000000000000000000",einstein:"1000000000000000000000",mether:"1000000000000000000000000",gether:"1000000000000000000000000000",tether:"1000000000000000000000000000000"},a=function(t,e,n){return new Array(e-t.length+1).join(n?n:"0")+t},s=function(t,e,n){return t+new Array(e-t.length+1).join(n?n:"0")},c=function(t){var e="",n=0,r=t.length;for("0x"===t.substring(0,2)&&(n=2);r>n;n+=2){var i=parseInt(t.substr(n,2),16);if(0===i)break;e+=String.fromCharCode(i)}return o.decode(e)},u=function(t){var e="",n=0,r=t.length;for("0x"===t.substring(0,2)&&(n=2);r>n;n+=2){var o=parseInt(t.substr(n,2),16);e+=String.fromCharCode(o)}return e},f=function(t){t=o.encode(t);for(var e="",n=0;n<t.length;n++){var r=t.charCodeAt(n);if(0===r)break;var i=r.toString(16);e+=i.length<2?"0"+i:i}return"0x"+e},p=function(t){for(var e="",n=0;n<t.length;n++){var r=t.charCodeAt(n),o=r.toString(16);e+=o.length<2?"0"+o:o}return"0x"+e},l=function(t){if(-1!==t.name.indexOf("("))return t.name;var e=t.inputs.map(function(t){return t.type}).join();return t.name+"("+e+")"},h=function(t){var e=t.indexOf("(");return-1!==e?t.substr(0,e):t},d=function(t){var e=t.indexOf("(");return-1!==e?t.substr(e+1,t.length-1-(e+1)).replace(" ",""):""},m=function(t){return w(t).toNumber()},y=function(t){var e=w(t),n=e.toString(16);return e.lessThan(0)?"-0x"+n.substr(1):"0x"+n},g=function(t){if(N(t))return y(+t);if(C(t))return y(t);if(I(t))return f(JSON.stringify(t));if(A(t)){if(0===t.indexOf("-0x"))return y(t);if(0===t.indexOf("0x"))return t;if(!isFinite(t))return p(t)}return y(t)},v=function(t){t=t?t.toLowerCase():"ether";var e=i[t];if(void 0===e)throw new Error("This unit doesn't exists, please use the one of the following units"+JSON.stringify(i,null,2));return new r(e,10)},b=function(t,e){var n=w(t).dividedBy(v(e));return C(t)?n:n.toString(10)},_=function(t,e){var n=w(t).times(v(e));return C(t)?n:n.toString(10)},w=function(t){return t=t||0,C(t)?t:!A(t)||0!==t.indexOf("0x")&&0!==t.indexOf("-0x")?new r(t.toString(10),10):new r(t.replace("0x",""),16)},x=function(t){var e=w(t);return e.lessThan(0)?new r("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16).plus(e).plus(1):e},k=function(t){return/^0x[0-9a-f]{40}$/i.test(t)},B=function(t){return/^(0x)?[0-9a-f]{40}$/i.test(t)},S=function(t){return k(t)?t:/^[0-9a-f]{40}$/.test(t)?"0x"+t:"0x"+a(g(t).substr(2),40)},C=function(t){return t instanceof r||t&&t.constructor&&"BigNumber"===t.constructor.name},A=function(t){return"string"==typeof t||t&&t.constructor&&"String"===t.constructor.name},F=function(t){return"function"==typeof t},I=function(t){return"object"==typeof t},N=function(t){return"boolean"==typeof t},O=function(t){return t instanceof Array},D=function(t){try{return!!JSON.parse(t)}catch(e){return!1}};e.exports={padLeft:a,padRight:s,toHex:g,toDecimal:m,fromDecimal:y,toUtf8:c,toAscii:u,fromUtf8:f,fromAscii:p,transformToFullName:l,extractDisplayName:h,extractTypeName:d,toWei:_,fromWei:b,toBigNumber:w,toTwosComplement:x,toAddress:S,isBigNumber:C,isStrictAddress:k,isAddress:B,isFunction:F,isString:A,isObject:I,isBoolean:N,isArray:O,isJson:D}},{"bignumber.js":"bignumber.js",utf8:83}],21:[function(t,e,n){e.exports={version:"0.14.0"}},{}],22:[function(t,e,n){function r(t){this._requestManager=new o(t),this.currentProvider=t,this.eth=new a(this),this.db=new s(this),this.shh=new c(this),this.net=new u(this),this.settings=new f,this.version={version:p.version},this.providers={HttpProvider:g,IpcProvider:v},this._extend=d(this),this._extend({properties:b()})}var o=t("./web3/requestmanager"),i=t("./web3/iban"),a=t("./web3/methods/eth"),s=t("./web3/methods/db"),c=t("./web3/methods/shh"),u=t("./web3/methods/net"),f=t("./web3/settings"),p=t("./version.json"),l=t("./utils/utils"),h=t("./utils/sha3"),d=t("./web3/extend"),m=t("./web3/batch"),y=t("./web3/property"),g=t("./web3/httpprovider"),v=t("./web3/ipcprovider");r.providers={HttpProvider:g,IpcProvider:v},r.prototype.setProvider=function(t){this._requestManager.setProvider(t),this.currentProvider=t},r.prototype.reset=function(t){this._requestManager.reset(t),this.settings=new f},r.prototype.toHex=l.toHex,r.prototype.toAscii=l.toAscii,r.prototype.toUtf8=l.toUtf8,r.prototype.fromAscii=l.fromAscii,r.prototype.fromUtf8=l.fromUtf8,r.prototype.toDecimal=l.toDecimal,r.prototype.fromDecimal=l.fromDecimal,r.prototype.toBigNumber=l.toBigNumber,r.prototype.toWei=l.toWei,r.prototype.fromWei=l.fromWei,r.prototype.isAddress=l.isAddress,r.prototype.isIBAN=l.isIBAN,r.prototype.sha3=h,r.prototype.fromICAP=function(t){var e=new i(t);return e.address()};var b=function(){return[new y({name:"version.client",getter:"web3_clientVersion"}),new y({name:"version.network",getter:"net_version",inputFormatter:l.toDecimal}),new y({name:"version.ethereum",getter:"eth_protocolVersion",inputFormatter:l.toDecimal}),new y({name:"version.whisper",getter:"shh_version",inputFormatter:l.toDecimal})]};r.prototype.isConnected=function(){return this.currentProvider&&this.currentProvider.isConnected()},r.prototype.createBatch=function(){return new m(this)},e.exports=r},{"./utils/sha3":19,"./utils/utils":20,"./version.json":21,"./web3/batch":24,"./web3/extend":28,"./web3/httpprovider":32,"./web3/iban":33,"./web3/ipcprovider":34,"./web3/methods/db":37,"./web3/methods/eth":38,"./web3/methods/net":39,"./web3/methods/shh":40,"./web3/property":43,"./web3/requestmanager":44,"./web3/settings":45}],23:[function(t,e,n){var r=t("../utils/sha3"),o=t("./event"),i=t("./formatters"),a=t("../utils/utils"),s=t("./filter"),c=t("./methods/watches"),u=function(t,e,n){this._web3=t,this._json=e,this._address=n};u.prototype.encode=function(t){t=t||{};var e={};return["fromBlock","toBlock"].filter(function(e){return void 0!==t[e]}).forEach(function(n){e[n]=i.inputBlockNumberFormatter(t[n])}),e.address=this._address,e},u.prototype.decode=function(t){t.data=t.data||"",t.topics=t.topics||[];var e=t.topics[0].slice(2),n=this._json.filter(function(t){return e===r(a.transformToFullName(t))})[0];if(!n)return console.warn("cannot find event for log"),t;var i=new o(this._web3,n,this._address);return i.decode(t)},u.prototype.execute=function(t,e){a.isFunction(arguments[arguments.length-1])&&(e=arguments[arguments.length-1],1===arguments.length&&(t=null));var n=this.encode(t),r=this.decode.bind(this);return new s(this._web3,n,c.eth(),r,e)},u.prototype.attachToContract=function(t){var e=this.execute.bind(this);t.allEvents=e},e.exports=u},{"../utils/sha3":19,"../utils/utils":20,"./event":27,"./filter":29,"./formatters":30,"./methods/watches":41}],24:[function(t,e,n){var r=t("./jsonrpc"),o=t("./errors"),i=function(t){this.requestManager=t._requestManager,this.requests=[]};i.prototype.add=function(t){this.requests.push(t)},i.prototype.execute=function(){var t=this.requests;this.requestManager.sendBatch(t,function(e,n){n=n||[],t.map(function(t,e){return n[e]||{}}).forEach(function(e,n){if(t[n].callback){if(!r.getInstance().isValidResponse(e))return t[n].callback(o.InvalidResponse(e));t[n].callback(null,t[n].format?t[n].format(e.result):e.result)}})})},e.exports=i},{"./errors":26,"./jsonrpc":35}],25:[function(t,e,n){var r=t("../utils/utils"),o=t("../solidity/coder"),i=t("./event"),a=t("./function"),s=t("./allevents"),c=function(t,e){return t.filter(function(t){return"constructor"===t.type&&t.inputs.length===e.length}).map(function(t){return t.inputs.map(function(t){return t.type})}).map(function(t){return o.encodeParams(t,e)})[0]||""},u=function(t){t.abi.filter(function(t){return"function"===t.type}).map(function(e){return new a(t._web3,e,t.address)}).forEach(function(e){e.attachToContract(t)})},f=function(t){var e=t.abi.filter(function(t){return"event"===t.type}),n=new s(t._web3,e,t.address);n.attachToContract(t),e.map(function(e){return new i(t._web3,e,t.address)}).forEach(function(e){e.attachToContract(t)})},p=function(t,e){var n=0,r=!1,o=t._web3.eth.filter("latest",function(i){if(!i&&!r)if(n++,n>50){if(o.stopWatching(),r=!0,!e)throw new Error("Contract transaction couldn't be found after 50 blocks");e(new Error("Contract transaction couldn't be found after 50 blocks"))}else t._web3.eth.getTransactionReceipt(t.transactionHash,function(n,i){i&&!r&&t._web3.eth.getCode(i.contractAddress,function(n,a){if(!r)if(o.stopWatching(),r=!0,a.length>2)t.address=i.contractAddress,u(t),f(t),e&&e(null,t);else{if(!e)throw new Error("The contract code couldn't be stored, please check your gas amount.");e(new Error("The contract code couldn't be stored, please check your gas amount."))}})})})},l=function(t,e){this.web3=t,this.abi=e};l.prototype["new"]=function(){var t,e=new h(this.web3,this.abi),n={},o=Array.prototype.slice.call(arguments);r.isFunction(o[o.length-1])&&(t=o.pop());var i=o[o.length-1];r.isObject(i)&&!r.isArray(i)&&(n=o.pop());var a=c(this.abi,o);if(n.data+=a,t)this.web3.eth.sendTransaction(n,function(n,r){n?t(n):(e.transactionHash=r,t(null,e),p(e,t))});else{var s=this.web3.eth.sendTransaction(n);e.transactionHash=s,p(e)}return e},l.prototype.at=function(t,e){var n=new h(this.web3,this.abi,t);return u(n),f(n),e&&e(null,n),n};var h=function(t,e,n){this._web3=t,this.transactionHash=null,this.address=n,this.abi=e};e.exports=l},{"../solidity/coder":7,"../utils/utils":20,"./allevents":23,"./event":27,"./function":31}],26:[function(t,e,n){e.exports={InvalidNumberOfParams:function(){return new Error("Invalid number of input parameters")},InvalidConnection:function(t){return new Error("CONNECTION ERROR: Couldn't connect to node "+t+".")},InvalidProvider:function(){return new Error("Provider not set or invalid")},InvalidResponse:function(t){var e=t&&t.error&&t.error.message?t.error.message:"Invalid JSON RPC response: "+JSON.stringify(t);return new Error(e)}}},{}],27:[function(t,e,n){var r=t("../utils/utils"),o=t("../solidity/coder"),i=t("./formatters"),a=t("../utils/sha3"),s=t("./filter"),c=t("./methods/watches"),u=function(t,e,n){this._web3=t,this._params=e.inputs,this._name=r.transformToFullName(e),this._address=n,this._anonymous=e.anonymous};u.prototype.types=function(t){return this._params.filter(function(e){return e.indexed===t}).map(function(t){return t.type})},u.prototype.displayName=function(){return r.extractDisplayName(this._name)},u.prototype.typeName=function(){return r.extractTypeName(this._name)},u.prototype.signature=function(){return a(this._name)},u.prototype.encode=function(t,e){t=t||{},e=e||{};var n={};["fromBlock","toBlock"].filter(function(t){return void 0!==e[t]}).forEach(function(t){n[t]=i.inputBlockNumberFormatter(e[t])}),n.topics=[],n.address=this._address,this._anonymous||n.topics.push("0x"+this.signature());var a=this._params.filter(function(t){return t.indexed===!0}).map(function(e){var n=t[e.name];return void 0===n||null===n?null:r.isArray(n)?n.map(function(t){return"0x"+o.encodeParam(e.type,t)}):"0x"+o.encodeParam(e.type,n)});return n.topics=n.topics.concat(a),n},u.prototype.decode=function(t){t.data=t.data||"",t.topics=t.topics||[];var e=this._anonymous?t.topics:t.topics.slice(1),n=e.map(function(t){return t.slice(2)}).join(""),r=o.decodeParams(this.types(!0),n),a=t.data.slice(2),s=o.decodeParams(this.types(!1),a),c=i.outputLogFormatter(t);return c.event=this.displayName(),c.address=t.address,c.args=this._params.reduce(function(t,e){return t[e.name]=e.indexed?r.shift():s.shift(),t},{}),delete c.data,delete c.topics,c},u.prototype.execute=function(t,e,n){r.isFunction(arguments[arguments.length-1])&&(n=arguments[arguments.length-1],2===arguments.length&&(e=null),1===arguments.length&&(e=null,t={}));var o=this.encode(t,e),i=this.decode.bind(this);return new s(this._web3,o,c.eth(),i,n)},u.prototype.attachToContract=function(t){var e=this.execute.bind(this),n=this.displayName();t[n]||(t[n]=e),t[n][this.typeName()]=this.execute.bind(this,t)},e.exports=u},{"../solidity/coder":7,"../utils/sha3":19,"../utils/utils":20,"./filter":29,"./formatters":30,"./methods/watches":41}],28:[function(t,e,n){var r=t("./formatters"),o=t("./../utils/utils"),i=t("./method"),a=t("./property"),s=function(t){var e=function(e){var n;e.property?(t[e.property]||(t[e.property]={}),n=t[e.property]):n=t,e.methods&&e.methods.forEach(function(e){e.attachToObject(n),e.setRequestManager(t._requestManager)}),e.properties&&e.properties.forEach(function(e){e.attachToObject(n),e.setRequestManager(t._requestManager)})};return e.formatters=r,e.utils=o,e.Method=i,e.Property=a,e};e.exports=s},{"./../utils/utils":20,"./formatters":30,"./method":36,"./property":43}],29:[function(t,e,n){var r=t("./formatters"),o=t("../utils/utils"),i=function(t){return null===t||"undefined"==typeof t?null:(t=String(t),0===t.indexOf("0x")?t:o.fromUtf8(t))},a=function(t){return o.isString(t)?t:(t=t||{},t.topics=t.topics||[],t.topics=t.topics.map(function(t){return o.isArray(t)?t.map(i):i(t)}),{topics:t.topics,to:t.to,address:t.address,fromBlock:r.inputBlockNumberFormatter(t.fromBlock),toBlock:r.inputBlockNumberFormatter(t.toBlock)})},s=function(t,e){o.isString(t.options)||t.get(function(t,n){t&&e(t),o.isArray(n)&&n.forEach(function(t){e(null,t)})})},c=function(t){var e=function(e,n){return e?t.callbacks.forEach(function(t){t(e)}):void(o.isArray(n)&&n.forEach(function(e){e=t.formatter?t.formatter(e):e,t.callbacks.forEach(function(t){t(null,e)})}))};t.requestManager.startPolling({method:t.implementation.poll.call,params:[t.filterId]},t.filterId,e,t.stopWatching.bind(t))},u=function(t,e,n,r,o){var i=this,u={};return n.forEach(function(e){e.setRequestManager(t._requestManager),e.attachToObject(u)}),this.requestManager=t._requestManager,this.options=a(e),this.implementation=u,this.filterId=null,this.callbacks=[],this.getLogsCallbacks=[],this.pollFilters=[],this.formatter=r,this.implementation.newFilter(this.options,function(t,e){if(t)i.callbacks.forEach(function(e){e(t)});else if(i.filterId=e,i.getLogsCallbacks.forEach(function(t){i.get(t)}),i.getLogsCallbacks=[],i.callbacks.forEach(function(t){s(i,t)}),i.callbacks.length>0&&c(i),o)return i.watch(o)}),this};u.prototype.watch=function(t){return this.callbacks.push(t),this.filterId&&(s(this,t),c(this)),this},u.prototype.stopWatching=function(){this.requestManager.stopPolling(this.filterId),this.implementation.uninstallFilter(this.filterId,function(){}),this.callbacks=[]},u.prototype.get=function(t){var e=this;if(!o.isFunction(t)){if(null===this.filterId)throw new Error("Filter ID Error: filter().get() can't be chained synchronous, please provide a callback for the get() method.");var n=this.implementation.getLogs(this.filterId);return n.map(function(t){return e.formatter?e.formatter(t):t})}return null===this.filterId?this.getLogsCallbacks.push(t):this.implementation.getLogs(this.filterId,function(n,r){
n?t(n):t(null,r.map(function(t){return e.formatter?e.formatter(t):t}))}),this},e.exports=u},{"../utils/utils":20,"./formatters":30}],30:[function(t,e,n){var r=t("../utils/utils"),o=t("../utils/config"),i=t("./iban"),a=function(t){return r.toBigNumber(t)},s=function(t){return"latest"===t||"pending"===t||"earliest"===t},c=function(t){return void 0===t?o.defaultBlock:u(t)},u=function(t){return void 0===t?void 0:s(t)?t:r.toHex(t)},f=function(t){return t.from=t.from||o.defaultAccount,t.from&&(t.from=v(t.from)),t.to&&(t.to=v(t.to)),["gasPrice","gas","value","nonce"].filter(function(e){return void 0!==t[e]}).forEach(function(e){t[e]=r.fromDecimal(t[e])}),t},p=function(t){return t.from=t.from||o.defaultAccount,t.from=v(t.from),t.to&&(t.to=v(t.to)),["gasPrice","gas","value","nonce"].filter(function(e){return void 0!==t[e]}).forEach(function(e){t[e]=r.fromDecimal(t[e])}),t},l=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),t.nonce=r.toDecimal(t.nonce),t.gas=r.toDecimal(t.gas),t.gasPrice=r.toBigNumber(t.gasPrice),t.value=r.toBigNumber(t.value),t},h=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),t.cumulativeGasUsed=r.toDecimal(t.cumulativeGasUsed),t.gasUsed=r.toDecimal(t.gasUsed),r.isArray(t.logs)&&(t.logs=t.logs.map(function(t){return m(t)})),t},d=function(t){return t.gasLimit=r.toDecimal(t.gasLimit),t.gasUsed=r.toDecimal(t.gasUsed),t.size=r.toDecimal(t.size),t.timestamp=r.toDecimal(t.timestamp),null!==t.number&&(t.number=r.toDecimal(t.number)),t.difficulty=r.toBigNumber(t.difficulty),t.totalDifficulty=r.toBigNumber(t.totalDifficulty),r.isArray(t.transactions)&&t.transactions.forEach(function(t){return r.isString(t)?void 0:l(t)}),t},m=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),null!==t.logIndex&&(t.logIndex=r.toDecimal(t.logIndex)),t},y=function(t){return t.payload=r.toHex(t.payload),t.ttl=r.fromDecimal(t.ttl),t.workToProve=r.fromDecimal(t.workToProve),t.priority=r.fromDecimal(t.priority),r.isArray(t.topics)||(t.topics=t.topics?[t.topics]:[]),t.topics=t.topics.map(function(t){return r.fromUtf8(t)}),t},g=function(t){return t.expiry=r.toDecimal(t.expiry),t.sent=r.toDecimal(t.sent),t.ttl=r.toDecimal(t.ttl),t.workProved=r.toDecimal(t.workProved),t.payloadRaw=t.payload,t.payload=r.toUtf8(t.payload),r.isJson(t.payload)&&(t.payload=JSON.parse(t.payload)),t.topics||(t.topics=[]),t.topics=t.topics.map(function(t){return r.toUtf8(t)}),t},v=function(t){var e=new i(t);if(e.isValid()&&e.isDirect())return"0x"+e.address();if(r.isStrictAddress(t))return t;if(r.isAddress(t))return"0x"+t;throw"invalid address"},b=function(t){return t.startingBlock=r.toDecimal(t.startingBlock),t.currentBlock=r.toDecimal(t.currentBlock),t.highestBlock=r.toDecimal(t.highestBlock),t};e.exports={inputDefaultBlockNumberFormatter:c,inputBlockNumberFormatter:u,inputCallFormatter:f,inputTransactionFormatter:p,inputAddressFormatter:v,inputPostFormatter:y,outputBigNumberFormatter:a,outputTransactionFormatter:l,outputTransactionReceiptFormatter:h,outputBlockFormatter:d,outputLogFormatter:m,outputPostFormatter:g,outputSyncingFormatter:b}},{"../utils/config":18,"../utils/utils":20,"./iban":33}],31:[function(t,e,n){var r=t("../solidity/coder"),o=t("../utils/utils"),i=t("./formatters"),a=t("../utils/sha3"),s=function(t,e,n){this._web3=t,this._inputTypes=e.inputs.map(function(t){return t.type}),this._outputTypes=e.outputs.map(function(t){return t.type}),this._constant=e.constant,this._name=o.transformToFullName(e),this._address=n};s.prototype.extractCallback=function(t){return o.isFunction(t[t.length-1])?t.pop():void 0},s.prototype.extractDefaultBlock=function(t){return t.length>this._inputTypes.length&&!o.isObject(t[t.length-1])?i.inputDefaultBlockNumberFormatter(t.pop()):void 0},s.prototype.toPayload=function(t){var e={};return t.length>this._inputTypes.length&&o.isObject(t[t.length-1])&&(e=t[t.length-1]),e.to=this._address,e.data="0x"+this.signature()+r.encodeParams(this._inputTypes,t),e},s.prototype.signature=function(){return a(this._name).slice(0,8)},s.prototype.unpackOutput=function(t){if(t){t=t.length>=2?t.slice(2):t;var e=r.decodeParams(this._outputTypes,t);return 1===e.length?e[0]:e}},s.prototype.call=function(){var t=Array.prototype.slice.call(arguments).filter(function(t){return void 0!==t}),e=this.extractCallback(t),n=this.extractDefaultBlock(t),r=this.toPayload(t);if(!e){var o=this._web3.eth.call(r,n);return this.unpackOutput(o)}var i=this;this._web3.eth.call(r,n,function(t,n){e(t,i.unpackOutput(n))})},s.prototype.sendTransaction=function(){var t=Array.prototype.slice.call(arguments).filter(function(t){return void 0!==t}),e=this.extractCallback(t),n=this.toPayload(t);return e?void this._web3.eth.sendTransaction(n,e):this._web3.eth.sendTransaction(n)},s.prototype.estimateGas=function(){var t=Array.prototype.slice.call(arguments),e=this.extractCallback(t),n=this.toPayload(t);return e?void this._web3.eth.estimateGas(n,e):this._web3.eth.estimateGas(n)},s.prototype.displayName=function(){return o.extractDisplayName(this._name)},s.prototype.typeName=function(){return o.extractTypeName(this._name)},s.prototype.request=function(){var t=Array.prototype.slice.call(arguments),e=this.extractCallback(t),n=this.toPayload(t),r=this.unpackOutput.bind(this);return{method:this._constant?"eth_call":"eth_sendTransaction",callback:e,params:[n],format:r}},s.prototype.execute=function(){var t=!this._constant;return t?this.sendTransaction.apply(this,Array.prototype.slice.call(arguments)):this.call.apply(this,Array.prototype.slice.call(arguments))},s.prototype.attachToContract=function(t){var e=this.execute.bind(this);e.request=this.request.bind(this),e.call=this.call.bind(this),e.sendTransaction=this.sendTransaction.bind(this),e.estimateGas=this.estimateGas.bind(this);var n=this.displayName();t[n]||(t[n]=e),t[n][this.typeName()]=e},e.exports=s},{"../solidity/coder":7,"../utils/sha3":19,"../utils/utils":20,"./formatters":30}],32:[function(t,e,n){"use strict";var r,o=t("./errors");r="undefined"!=typeof Meteor&&Meteor.isServer?Npm.require("xmlhttprequest").XMLHttpRequest:"undefined"!=typeof window&&window.XMLHttpRequest?window.XMLHttpRequest:t("xmlhttprequest").XMLHttpRequest;var i=function(t){this.host=t||"http://localhost:8545"};i.prototype.prepareRequest=function(t){var e=new r;return e.open("POST",this.host,t),e.setRequestHeader("Content-Type","application/json"),e},i.prototype.send=function(t){var e=this.prepareRequest(!1);try{e.send(JSON.stringify(t))}catch(n){throw o.InvalidConnection(this.host)}var r=e.responseText;try{r=JSON.parse(r)}catch(i){throw o.InvalidResponse(e.responseText)}return r},i.prototype.sendAsync=function(t,e){var n=this.prepareRequest(!0);n.onreadystatechange=function(){if(4===n.readyState){var t=n.responseText,r=null;try{t=JSON.parse(t)}catch(i){r=o.InvalidResponse(n.responseText)}e(r,t)}};try{n.send(JSON.stringify(t))}catch(r){e(o.InvalidConnection(this.host))}},i.prototype.isConnected=function(){try{return this.send({id:9999999999,jsonrpc:"2.0",method:"net_listening",params:[]}),!0}catch(t){return!1}},e.exports=i},{"./errors":26,xmlhttprequest:17}],33:[function(t,e,n){var r=t("bignumber.js"),o=function(t,e){for(var n=t;n.length<2*e;)n="00"+n;return n},i=function(t){var e="A".charCodeAt(0),n="Z".charCodeAt(0);return t=t.toUpperCase(),t=t.substr(4)+t.substr(0,4),t.split("").map(function(t){var r=t.charCodeAt(0);return r>=e&&n>=r?r-e+10:t}).join("")},a=function(t){for(var e,n=t;n.length>2;)e=n.slice(0,9),n=parseInt(e,10)%97+n.slice(e.length);return parseInt(n,10)%97},s=function(t){this._iban=t};s.fromAddress=function(t){var e=new r(t,16),n=e.toString(36),i=o(n,15);return s.fromBban(i.toUpperCase())},s.fromBban=function(t){var e="XE",n=a(i(e+"00"+t)),r=("0"+(98-n)).slice(-2);return new s(e+r+t)},s.createIndirect=function(t){return s.fromBban("ETH"+t.institution+t.identifier)},s.isValid=function(t){var e=new s(t);return e.isValid()},s.prototype.isValid=function(){return/^XE[0-9]{2}(ETH[0-9A-Z]{13}|[0-9A-Z]{30,31})$/.test(this._iban)&&1===a(i(this._iban))},s.prototype.isDirect=function(){return 34===this._iban.length||35===this._iban.length},s.prototype.isIndirect=function(){return 20===this._iban.length},s.prototype.checksum=function(){return this._iban.substr(2,2)},s.prototype.institution=function(){return this.isIndirect()?this._iban.substr(7,4):""},s.prototype.client=function(){return this.isIndirect()?this._iban.substr(11):""},s.prototype.address=function(){if(this.isDirect()){var t=this._iban.substr(4),e=new r(t,36);return o(e.toString(16),20)}return""},s.prototype.toString=function(){return this._iban},e.exports=s},{"bignumber.js":"bignumber.js"}],34:[function(t,e,n){"use strict";var r=t("../utils/utils"),o=t("./errors"),i=function(t,e){var n=this;this.responseCallbacks={},this.path=t,this.connection=e.connect({path:this.path}),this.connection.on("error",function(t){console.error("IPC Connection Error",t),n._timeout()}),this.connection.on("end",function(){n._timeout()}),this.connection.on("data",function(t){n._parseResponse(t.toString()).forEach(function(t){var e=null;r.isArray(t)?t.forEach(function(t){n.responseCallbacks[t.id]&&(e=t.id)}):e=t.id,n.responseCallbacks[e]&&(n.responseCallbacks[e](null,t),delete n.responseCallbacks[e])})})};i.prototype._parseResponse=function(t){var e=this,n=[],r=t.replace(/\}\{/g,"}|--|{").replace(/\}\]\[\{/g,"}]|--|[{").replace(/\}\[\{/g,"}|--|[{").replace(/\}\]\{/g,"}]|--|{").split("|--|");return r.forEach(function(t){e.lastChunk&&(t=e.lastChunk+t);var r=null;try{r=JSON.parse(t)}catch(i){return e.lastChunk=t,clearTimeout(e.lastChunkTimeout),void(e.lastChunkTimeout=setTimeout(function(){throw e.timeout(),o.InvalidResponse(t)},15e3))}clearTimeout(e.lastChunkTimeout),e.lastChunk=null,r&&n.push(r)}),n},i.prototype._addResponseCallback=function(t,e){var n=t.id||t[0].id,r=t.method||t[0].method;this.responseCallbacks[n]=e,this.responseCallbacks[n].method=r},i.prototype._timeout=function(){for(var t in this.responseCallbacks)this.responseCallbacks.hasOwnProperty(t)&&(this.responseCallbacks[t](o.InvalidConnection("on IPC")),delete this.responseCallbacks[t])},i.prototype.isConnected=function(){var t=this;return t.connection.writable||t.connection.connect({path:t.path}),!!this.connection.writable},i.prototype.send=function(t){if(this.connection.writeSync){var e;this.connection.writable||this.connection.connect({path:this.path});var n=this.connection.writeSync(JSON.stringify(t));try{e=JSON.parse(n)}catch(r){throw o.InvalidResponse(n)}return e}throw new Error('You tried to send "'+t.method+'" synchronously. Synchronous requests are not supported by the IPC provider.')},i.prototype.sendAsync=function(t,e){this.connection.writable||this.connection.connect({path:this.path}),this.connection.write(JSON.stringify(t)),this._addResponseCallback(t,e)},e.exports=i},{"../utils/utils":20,"./errors":26}],35:[function(t,e,n){var r=function(){return arguments.callee._singletonInstance?arguments.callee._singletonInstance:(arguments.callee._singletonInstance=this,void(this.messageId=1))};r.getInstance=function(){var t=new r;return t},r.prototype.toPayload=function(t,e){return t||console.error("jsonrpc method should be specified!"),{jsonrpc:"2.0",method:t,params:e||[],id:this.messageId++}},r.prototype.isValidResponse=function(t){return!!t&&!t.error&&"2.0"===t.jsonrpc&&"number"==typeof t.id&&void 0!==t.result},r.prototype.toBatchPayload=function(t){var e=this;return t.map(function(t){return e.toPayload(t.method,t.params)})},e.exports=r},{}],36:[function(t,e,n){var r=t("../utils/utils"),o=t("./errors"),i=function(t){this.name=t.name,this.call=t.call,this.params=t.params||0,this.inputFormatter=t.inputFormatter,this.outputFormatter=t.outputFormatter,this.requestManager=null};i.prototype.setRequestManager=function(t){this.requestManager=t},i.prototype.getCall=function(t){return r.isFunction(this.call)?this.call(t):this.call},i.prototype.extractCallback=function(t){return r.isFunction(t[t.length-1])?t.pop():void 0},i.prototype.validateArgs=function(t){if(t.length!==this.params)throw o.InvalidNumberOfParams()},i.prototype.formatInput=function(t){return this.inputFormatter?this.inputFormatter.map(function(e,n){return e?e(t[n]):t[n]}):t},i.prototype.formatOutput=function(t){return this.outputFormatter&&t?this.outputFormatter(t):t},i.prototype.toPayload=function(t){var e=this.getCall(t),n=this.extractCallback(t),r=this.formatInput(t);return this.validateArgs(r),{method:e,params:r,callback:n}},i.prototype.attachToObject=function(t){var e=this.buildCall();e.call=this.call;var n=this.name.split(".");n.length>1?(t[n[0]]=t[n[0]]||{},t[n[0]][n[1]]=e):t[n[0]]=e},i.prototype.buildCall=function(){var t=this,e=function(){var e=t.toPayload(Array.prototype.slice.call(arguments));return e.callback?t.requestManager.sendAsync(e,function(n,r){e.callback(n,t.formatOutput(r))}):t.formatOutput(t.requestManager.send(e))};return e.request=this.request.bind(this),e},i.prototype.request=function(){var t=this.toPayload(Array.prototype.slice.call(arguments));return t.format=this.formatOutput.bind(this),t},e.exports=i},{"../utils/utils":20,"./errors":26}],37:[function(t,e,n){var r=t("../method"),o=function(t){this._requestManager=t._requestManager;var e=this;i().forEach(function(n){n.attachToObject(e),n.setRequestManager(t._requestManager)})},i=function(){var t=new r({name:"putString",call:"db_putString",params:3}),e=new r({name:"getString",call:"db_getString",params:2}),n=new r({name:"putHex",call:"db_putHex",params:3}),o=new r({name:"getHex",call:"db_getHex",params:2});return[t,e,n,o]};e.exports=o},{"../method":36}],38:[function(t,e,n){"use strict";function r(t){this.web3=t;var e=this;w().forEach(function(n){n.attachToObject(e),n.setRequestManager(t._requestManager)}),x().forEach(function(n){n.attachToObject(e),n.setRequestManager(t._requestManager)}),this.namereg=this.contract(h.global.abi).at(h.global.address),this.icapNamereg=this.contract(h.icap.abi).at(h.icap.address),this.iban=d,this.sendIBANTransaction=m.bind(null,t)}var o=t("../formatters"),i=t("../../utils/utils"),a=t("../method"),s=t("../property"),c=t("../../utils/config"),u=t("../contract"),f=t("./watches"),p=t("../filter"),l=t("../syncing"),h=t("../namereg"),d=t("../iban"),m=t("../transfer"),y=function(t){return i.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getBlockByHash":"eth_getBlockByNumber"},g=function(t){return i.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getTransactionByBlockHashAndIndex":"eth_getTransactionByBlockNumberAndIndex"},v=function(t){return i.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getUncleByBlockHashAndIndex":"eth_getUncleByBlockNumberAndIndex"},b=function(t){return i.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getBlockTransactionCountByHash":"eth_getBlockTransactionCountByNumber"},_=function(t){return i.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getUncleCountByBlockHash":"eth_getUncleCountByBlockNumber"};Object.defineProperty(r.prototype,"defaultBlock",{get:function(){return c.defaultBlock},set:function(t){return c.defaultBlock=t,t}}),Object.defineProperty(r.prototype,"defaultAccount",{get:function(){return c.defaultAccount},set:function(t){return c.defaultAccount=t,t}});var w=function(){var t=new a({name:"getBalance",call:"eth_getBalance",params:2,inputFormatter:[o.inputAddressFormatter,o.inputDefaultBlockNumberFormatter],outputFormatter:o.outputBigNumberFormatter}),e=new a({name:"getStorageAt",call:"eth_getStorageAt",params:3,inputFormatter:[null,i.toHex,o.inputDefaultBlockNumberFormatter]}),n=new a({name:"getCode",call:"eth_getCode",params:2,inputFormatter:[o.inputAddressFormatter,o.inputDefaultBlockNumberFormatter]}),r=new a({name:"getBlock",call:y,params:2,inputFormatter:[o.inputBlockNumberFormatter,function(t){return!!t}],outputFormatter:o.outputBlockFormatter}),s=new a({name:"getUncle",call:v,params:2,inputFormatter:[o.inputBlockNumberFormatter,i.toHex],outputFormatter:o.outputBlockFormatter}),c=new a({name:"getCompilers",call:"eth_getCompilers",params:0}),u=new a({name:"getBlockTransactionCount",call:b,params:1,inputFormatter:[o.inputBlockNumberFormatter],outputFormatter:i.toDecimal}),f=new a({name:"getBlockUncleCount",call:_,params:1,inputFormatter:[o.inputBlockNumberFormatter],outputFormatter:i.toDecimal}),p=new a({name:"getTransaction",call:"eth_getTransactionByHash",params:1,outputFormatter:o.outputTransactionFormatter}),l=new a({name:"getTransactionFromBlock",call:g,params:2,inputFormatter:[o.inputBlockNumberFormatter,i.toHex],outputFormatter:o.outputTransactionFormatter}),h=new a({name:"getTransactionReceipt",call:"eth_getTransactionReceipt",params:1,outputFormatter:o.outputTransactionReceiptFormatter}),d=new a({name:"getTransactionCount",call:"eth_getTransactionCount",params:2,inputFormatter:[null,o.inputDefaultBlockNumberFormatter],outputFormatter:i.toDecimal}),m=new a({name:"sendRawTransaction",call:"eth_sendRawTransaction",params:1,inputFormatter:[null]}),w=new a({name:"sendTransaction",call:"eth_sendTransaction",params:1,inputFormatter:[o.inputTransactionFormatter]}),x=new a({name:"call",call:"eth_call",params:2,inputFormatter:[o.inputCallFormatter,o.inputDefaultBlockNumberFormatter]}),k=new a({name:"estimateGas",call:"eth_estimateGas",params:1,inputFormatter:[o.inputCallFormatter],outputFormatter:i.toDecimal}),B=new a({name:"compile.solidity",call:"eth_compileSolidity",params:1}),S=new a({name:"compile.lll",call:"eth_compileLLL",params:1}),C=new a({name:"compile.serpent",call:"eth_compileSerpent",params:1}),A=new a({name:"submitWork",call:"eth_submitWork",params:3}),F=new a({name:"getWork",call:"eth_getWork",params:0});return[t,e,n,r,s,c,u,f,p,l,h,d,x,k,m,w,B,S,C,A,F]},x=function(){return[new s({name:"coinbase",getter:"eth_coinbase"}),new s({name:"mining",getter:"eth_mining"}),new s({name:"hashrate",getter:"eth_hashrate",outputFormatter:i.toDecimal}),new s({name:"syncing",getter:"eth_syncing",outputFormatter:o.outputSyncingFormatter}),new s({name:"gasPrice",getter:"eth_gasPrice",outputFormatter:o.outputBigNumberFormatter}),new s({name:"accounts",getter:"eth_accounts"}),new s({name:"blockNumber",getter:"eth_blockNumber",outputFormatter:i.toDecimal})]};r.prototype.contract=function(t){var e=new u(this.web3,t);return e},r.prototype.filter=function(t,e){return new p(this.web3,t,f.eth(),o.outputLogFormatter,e)},r.prototype.isSyncing=function(t){return new l(this.web3,t)},e.exports=r},{"../../utils/config":18,"../../utils/utils":20,"../contract":25,"../filter":29,"../formatters":30,"../iban":33,"../method":36,"../namereg":42,"../property":43,"../syncing":46,"../transfer":47,"./watches":41}],39:[function(t,e,n){var r=t("../../utils/utils"),o=t("../property"),i=function(t){this._requestManager=t._requestManager;var e=this;a().forEach(function(n){n.attachToObject(e),n.setRequestManager(t._requestManager)})},a=function(){return[new o({name:"listening",getter:"net_listening"}),new o({name:"peerCount",getter:"net_peerCount",outputFormatter:r.toDecimal})]};e.exports=i},{"../../utils/utils":20,"../property":43}],40:[function(t,e,n){var r=t("../method"),o=t("../formatters"),i=t("../filter"),a=t("./watches"),s=function(t){this.web3=t;var e=this;c().forEach(function(n){n.attachToObject(e),n.setRequestManager(t._requestManager)})};s.prototype.filter=function(t,e){return new i(this.web3,t,a.shh(),o.outputPostFormatter,e)};var c=function(){var t=new r({name:"post",call:"shh_post",params:1,inputFormatter:[o.inputPostFormatter]}),e=new r({name:"newIdentity",call:"shh_newIdentity",params:0}),n=new r({name:"hasIdentity",call:"shh_hasIdentity",params:1}),i=new r({name:"newGroup",call:"shh_newGroup",params:0}),a=new r({name:"addToGroup",call:"shh_addToGroup",params:0});return[t,e,n,i,a]};e.exports=s},{"../filter":29,"../formatters":30,"../method":36,"./watches":41}],41:[function(t,e,n){var r=t("../method"),o=function(){var t=function(t){var e=t[0];switch(e){case"latest":return t.shift(),this.params=0,"eth_newBlockFilter";case"pending":return t.shift(),this.params=0,"eth_newPendingTransactionFilter";default:return"eth_newFilter"}},e=new r({name:"newFilter",call:t,params:1}),n=new r({name:"uninstallFilter",call:"eth_uninstallFilter",params:1}),o=new r({name:"getLogs",call:"eth_getFilterLogs",params:1}),i=new r({name:"poll",call:"eth_getFilterChanges",params:1});return[e,n,o,i]},i=function(){var t=new r({name:"newFilter",call:"shh_newFilter",params:1}),e=new r({name:"uninstallFilter",call:"shh_uninstallFilter",params:1}),n=new r({name:"getLogs",call:"shh_getMessages",params:1}),o=new r({name:"poll",call:"shh_getFilterChanges",params:1});return[t,e,n,o]};e.exports={eth:o,shh:i}},{"../method":36}],42:[function(t,e,n){var r=t("../contracts/GlobalRegistrar.json"),o=t("../contracts/ICAPRegistrar.json"),i="0xc6d9d2cd449a754c494264e1809c50e34d64562b",a="0xa1a111bc074c9cfa781f0c38e63bd51c91b8af00";e.exports={global:{abi:r,address:i},icap:{abi:o,address:a}}},{"../contracts/GlobalRegistrar.json":1,"../contracts/ICAPRegistrar.json":2}],43:[function(t,e,n){var r=t("../utils/utils"),o=function(t){this.name=t.name,this.getter=t.getter,this.setter=t.setter,this.outputFormatter=t.outputFormatter,this.inputFormatter=t.inputFormatter,this.requestManager=null};o.prototype.setRequestManager=function(t){this.requestManager=t},o.prototype.formatInput=function(t){return this.inputFormatter?this.inputFormatter(t):t},o.prototype.formatOutput=function(t){return this.outputFormatter&&null!==t?this.outputFormatter(t):t},o.prototype.extractCallback=function(t){return r.isFunction(t[t.length-1])?t.pop():void 0},o.prototype.attachToObject=function(t){var e={get:this.buildGet()},n=this.name.split("."),r=n[0];n.length>1&&(t[n[0]]=t[n[0]]||{},t=t[n[0]],r=n[1]),Object.defineProperty(t,r,e),t[i(r)]=this.buildAsyncGet()};var i=function(t){return"get"+t.charAt(0).toUpperCase()+t.slice(1)};o.prototype.buildGet=function(){var t=this;return function(){return t.formatOutput(t.requestManager.send({method:t.getter}))}},o.prototype.buildAsyncGet=function(){var t=this,e=function(e){t.requestManager.sendAsync({method:t.getter},function(n,r){e(n,t.formatOutput(r))})};return e.request=this.request.bind(this),e},o.prototype.request=function(){var t={method:this.getter,params:[],callback:this.extractCallback(Array.prototype.slice.call(arguments))};return t.format=this.formatOutput.bind(this),t},e.exports=o},{"../utils/utils":20}],44:[function(t,e,n){var r=t("./jsonrpc"),o=t("../utils/utils"),i=t("../utils/config"),a=t("./errors"),s=function(t){this.provider=t,this.polls={},this.timeout=null};s.prototype.send=function(t){if(!this.provider)return console.error(a.InvalidProvider()),null;var e=r.getInstance().toPayload(t.method,t.params),n=this.provider.send(e);if(!r.getInstance().isValidResponse(n))throw a.InvalidResponse(n);return n.result},s.prototype.sendAsync=function(t,e){if(!this.provider)return e(a.InvalidProvider());var n=r.getInstance().toPayload(t.method,t.params);this.provider.sendAsync(n,function(t,n){return t?e(t):r.getInstance().isValidResponse(n)?void e(null,n.result):e(a.InvalidResponse(n))})},s.prototype.sendBatch=function(t,e){if(!this.provider)return e(a.InvalidProvider());var n=r.getInstance().toBatchPayload(t);this.provider.sendAsync(n,function(t,n){return t?e(t):o.isArray(n)?void e(t,n):e(a.InvalidResponse(n))})},s.prototype.setProvider=function(t){this.provider=t},s.prototype.startPolling=function(t,e,n,r){this.polls[e]={data:t,id:e,callback:n,uninstall:r},this.timeout||this.poll()},s.prototype.stopPolling=function(t){delete this.polls[t],0===Object.keys(this.polls).length&&this.timeout&&(clearTimeout(this.timeout),this.timeout=null)},s.prototype.reset=function(t){for(var e in this.polls)t&&-1!==e.indexOf("syncPoll_")||(this.polls[e].uninstall(),delete this.polls[e]);0===Object.keys(this.polls).length&&this.timeout&&(clearTimeout(this.timeout),this.timeout=null)},s.prototype.poll=function(){if(this.timeout=setTimeout(this.poll.bind(this),i.ETH_POLLING_TIMEOUT),0!==Object.keys(this.polls).length){if(!this.provider)return void console.error(a.InvalidProvider());var t=[],e=[];for(var n in this.polls)t.push(this.polls[n].data),e.push(n);if(0!==t.length){var s=r.getInstance().toBatchPayload(t),c={};s.forEach(function(t,n){c[t.id]=e[n]});var u=this;this.provider.sendAsync(s,function(t,e){if(!t){if(!o.isArray(e))throw a.InvalidResponse(e);e.map(function(t){var e=c[t.id];return u.polls[e]?(t.callback=u.polls[e].callback,t):!1}).filter(function(t){return!!t}).filter(function(t){var e=r.getInstance().isValidResponse(t);return e||t.callback(a.InvalidResponse(t)),e}).forEach(function(t){t.callback(null,t.result)})}})}}},e.exports=s},{"../utils/config":18,"../utils/utils":20,"./errors":26,"./jsonrpc":35}],45:[function(t,e,n){var r=function(){this.defaultBlock="latest",this.defaultAccount=void 0};e.exports=r},{}],46:[function(t,e,n){var r=t("./formatters"),o=t("../utils/utils"),i=1,a=function(t){var e=function(e,n){return e?t.callbacks.forEach(function(t){t(e)}):(o.isObject(n)&&(n=r.outputSyncingFormatter(n)),void t.callbacks.forEach(function(e){t.lastSyncState!==n&&(!t.lastSyncState&&o.isObject(n)&&e(null,!0),setTimeout(function(){e(null,n)},0),t.lastSyncState=n)}))};t.requestManager.startPolling({method:"eth_syncing",params:[]},t.pollId,e,t.stopWatching.bind(t))},s=function(t,e){return this._web3=t,this.requestManager=t._requestManager,this.pollId="syncPoll_"+i++,this.callbacks=[],this.addCallback(e),this.lastSyncState=!1,a(this),this};s.prototype.addCallback=function(t){return t&&this.callbacks.push(t),this},s.prototype.stopWatching=function(){this._web3._requestManager.stopPolling(this.pollId),this.callbacks=[]},e.exports=s},{"../utils/utils":20,"./formatters":30}],47:[function(t,e,n){var r=t("./iban"),o=t("../contracts/SmartExchange.json"),i=function(t,e,n,o,i){var c=new r(n);if(!c.isValid())throw new Error("invalid iban address");if(c.isDirect())return a(t,e,c.address(),o,i);if(!i){var u=t.eth.icapNamereg.addr(c.institution());return s(t,e,u,o,c.client())}t.eth.icapNamereg.addr(c.institution(),function(n,r){return s(t,e,r,o,c.client(),i)})},a=function(t,e,n,r,o){return t.eth.sendTransaction({address:n,from:e,value:r},o)},s=function(t,e,n,r,i,a){var s=o;return t.eth.contract(s).at(n).deposit(i,{from:e,value:r},a)};e.exports=i},{"../contracts/SmartExchange.json":3,"./iban":33}],48:[function(t,e,n){},{}],49:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./enc-base64"),t("./md5"),t("./evpkdf"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.BlockCipher,o=e.algo,i=[],a=[],s=[],c=[],u=[],f=[],p=[],l=[],h=[],d=[];!function(){for(var t=[],e=0;256>e;e++)128>e?t[e]=e<<1:t[e]=e<<1^283;for(var n=0,r=0,e=0;256>e;e++){var o=r^r<<1^r<<2^r<<3^r<<4;o=o>>>8^255&o^99,i[n]=o,a[o]=n;var m=t[n],y=t[m],g=t[y],v=257*t[o]^16843008*o;s[n]=v<<24|v>>>8,c[n]=v<<16|v>>>16,u[n]=v<<8|v>>>24,f[n]=v;var v=16843009*g^65537*y^257*m^16843008*n;p[o]=v<<24|v>>>8,l[o]=v<<16|v>>>16,h[o]=v<<8|v>>>24,d[o]=v,n?(n=m^t[t[t[g^m]]],r^=t[t[r]]):n=r=1}}();var m=[0,1,2,4,8,16,32,64,128,27,54],y=o.AES=r.extend({_doReset:function(){for(var t=this._key,e=t.words,n=t.sigBytes/4,r=this._nRounds=n+6,o=4*(r+1),a=this._keySchedule=[],s=0;o>s;s++)if(n>s)a[s]=e[s];else{var c=a[s-1];s%n?n>6&&s%n==4&&(c=i[c>>>24]<<24|i[c>>>16&255]<<16|i[c>>>8&255]<<8|i[255&c]):(c=c<<8|c>>>24,c=i[c>>>24]<<24|i[c>>>16&255]<<16|i[c>>>8&255]<<8|i[255&c],c^=m[s/n|0]<<24),a[s]=a[s-n]^c}for(var u=this._invKeySchedule=[],f=0;o>f;f++){var s=o-f;if(f%4)var c=a[s];else var c=a[s-4];4>f||4>=s?u[f]=c:u[f]=p[i[c>>>24]]^l[i[c>>>16&255]]^h[i[c>>>8&255]]^d[i[255&c]]}},encryptBlock:function(t,e){this._doCryptBlock(t,e,this._keySchedule,s,c,u,f,i)},decryptBlock:function(t,e){var n=t[e+1];t[e+1]=t[e+3],t[e+3]=n,this._doCryptBlock(t,e,this._invKeySchedule,p,l,h,d,a);var n=t[e+1];t[e+1]=t[e+3],t[e+3]=n},_doCryptBlock:function(t,e,n,r,o,i,a,s){for(var c=this._nRounds,u=t[e]^n[0],f=t[e+1]^n[1],p=t[e+2]^n[2],l=t[e+3]^n[3],h=4,d=1;c>d;d++){var m=r[u>>>24]^o[f>>>16&255]^i[p>>>8&255]^a[255&l]^n[h++],y=r[f>>>24]^o[p>>>16&255]^i[l>>>8&255]^a[255&u]^n[h++],g=r[p>>>24]^o[l>>>16&255]^i[u>>>8&255]^a[255&f]^n[h++],v=r[l>>>24]^o[u>>>16&255]^i[f>>>8&255]^a[255&p]^n[h++];u=m,f=y,p=g,l=v}var m=(s[u>>>24]<<24|s[f>>>16&255]<<16|s[p>>>8&255]<<8|s[255&l])^n[h++],y=(s[f>>>24]<<24|s[p>>>16&255]<<16|s[l>>>8&255]<<8|s[255&u])^n[h++],g=(s[p>>>24]<<24|s[l>>>16&255]<<16|s[u>>>8&255]<<8|s[255&f])^n[h++],v=(s[l>>>24]<<24|s[u>>>16&255]<<16|s[f>>>8&255]<<8|s[255&p])^n[h++];t[e]=m,t[e+1]=y,t[e+2]=g,t[e+3]=v},keySize:8});e.AES=r._createHelper(y)}(),t.AES})},{"./cipher-core":50,"./core":51,"./enc-base64":52,"./evpkdf":54,"./md5":59}],50:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){t.lib.Cipher||function(e){var n=t,r=n.lib,o=r.Base,i=r.WordArray,a=r.BufferedBlockAlgorithm,s=n.enc,c=(s.Utf8,s.Base64),u=n.algo,f=u.EvpKDF,p=r.Cipher=a.extend({cfg:o.extend(),createEncryptor:function(t,e){return this.create(this._ENC_XFORM_MODE,t,e)},createDecryptor:function(t,e){return this.create(this._DEC_XFORM_MODE,t,e)},init:function(t,e,n){this.cfg=this.cfg.extend(n),this._xformMode=t,this._key=e,this.reset()},reset:function(){a.reset.call(this),this._doReset()},process:function(t){return this._append(t),this._process()},finalize:function(t){t&&this._append(t);var e=this._doFinalize();return e},keySize:4,ivSize:4,_ENC_XFORM_MODE:1,_DEC_XFORM_MODE:2,_createHelper:function(){function t(t){return"string"==typeof t?k:_}return function(e){return{encrypt:function(n,r,o){return t(r).encrypt(e,n,r,o)},decrypt:function(n,r,o){return t(r).decrypt(e,n,r,o)}}}}()}),l=(r.StreamCipher=p.extend({_doFinalize:function(){var t=this._process(!0);return t},blockSize:1}),n.mode={}),h=r.BlockCipherMode=o.extend({createEncryptor:function(t,e){return this.Encryptor.create(t,e)},createDecryptor:function(t,e){return this.Decryptor.create(t,e)},init:function(t,e){this._cipher=t,this._iv=e}}),d=l.CBC=function(){function t(t,n,r){var o=this._iv;if(o){var i=o;this._iv=e}else var i=this._prevBlock;for(var a=0;r>a;a++)t[n+a]^=i[a]}var n=h.extend();return n.Encryptor=n.extend({processBlock:function(e,n){var r=this._cipher,o=r.blockSize;t.call(this,e,n,o),r.encryptBlock(e,n),this._prevBlock=e.slice(n,n+o)}}),n.Decryptor=n.extend({processBlock:function(e,n){var r=this._cipher,o=r.blockSize,i=e.slice(n,n+o);r.decryptBlock(e,n),t.call(this,e,n,o),this._prevBlock=i}}),n}(),m=n.pad={},y=m.Pkcs7={pad:function(t,e){for(var n=4*e,r=n-t.sigBytes%n,o=r<<24|r<<16|r<<8|r,a=[],s=0;r>s;s+=4)a.push(o);var c=i.create(a,r);t.concat(c)},unpad:function(t){var e=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=e}},g=(r.BlockCipher=p.extend({cfg:p.cfg.extend({mode:d,padding:y}),reset:function(){p.reset.call(this);var t=this.cfg,e=t.iv,n=t.mode;if(this._xformMode==this._ENC_XFORM_MODE)var r=n.createEncryptor;else{var r=n.createDecryptor;this._minBufferSize=1}this._mode=r.call(n,this,e&&e.words)},_doProcessBlock:function(t,e){this._mode.processBlock(t,e)},_doFinalize:function(){var t=this.cfg.padding;if(this._xformMode==this._ENC_XFORM_MODE){t.pad(this._data,this.blockSize);var e=this._process(!0)}else{var e=this._process(!0);t.unpad(e)}return e},blockSize:4}),r.CipherParams=o.extend({init:function(t){this.mixIn(t)},toString:function(t){return(t||this.formatter).stringify(this)}})),v=n.format={},b=v.OpenSSL={stringify:function(t){var e=t.ciphertext,n=t.salt;if(n)var r=i.create([1398893684,1701076831]).concat(n).concat(e);else var r=e;return r.toString(c)},parse:function(t){var e=c.parse(t),n=e.words;if(1398893684==n[0]&&1701076831==n[1]){var r=i.create(n.slice(2,4));n.splice(0,4),
e.sigBytes-=16}return g.create({ciphertext:e,salt:r})}},_=r.SerializableCipher=o.extend({cfg:o.extend({format:b}),encrypt:function(t,e,n,r){r=this.cfg.extend(r);var o=t.createEncryptor(n,r),i=o.finalize(e),a=o.cfg;return g.create({ciphertext:i,key:n,iv:a.iv,algorithm:t,mode:a.mode,padding:a.padding,blockSize:t.blockSize,formatter:r.format})},decrypt:function(t,e,n,r){r=this.cfg.extend(r),e=this._parse(e,r.format);var o=t.createDecryptor(n,r).finalize(e.ciphertext);return o},_parse:function(t,e){return"string"==typeof t?e.parse(t,this):t}}),w=n.kdf={},x=w.OpenSSL={execute:function(t,e,n,r){r||(r=i.random(8));var o=f.create({keySize:e+n}).compute(t,r),a=i.create(o.words.slice(e),4*n);return o.sigBytes=4*e,g.create({key:o,iv:a,salt:r})}},k=r.PasswordBasedCipher=_.extend({cfg:_.cfg.extend({kdf:x}),encrypt:function(t,e,n,r){r=this.cfg.extend(r);var o=r.kdf.execute(n,t.keySize,t.ivSize);r.iv=o.iv;var i=_.encrypt.call(this,t,e,o.key,r);return i.mixIn(o),i},decrypt:function(t,e,n,r){r=this.cfg.extend(r),e=this._parse(e,r.format);var o=r.kdf.execute(n,t.keySize,t.ivSize,e.salt);r.iv=o.iv;var i=_.decrypt.call(this,t,e,o.key,r);return i}})}()})},{"./core":51}],51:[function(t,e,n){!function(t,r){"object"==typeof n?e.exports=n=r():"function"==typeof define&&define.amd?define([],r):t.CryptoJS=r()}(this,function(){var t=t||function(t,e){var n={},r=n.lib={},o=r.Base=function(){function t(){}return{extend:function(e){t.prototype=this;var n=new t;return e&&n.mixIn(e),n.hasOwnProperty("init")||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var e in t)t.hasOwnProperty(e)&&(this[e]=t[e]);t.hasOwnProperty("toString")&&(this.toString=t.toString)},clone:function(){return this.init.prototype.extend(this)}}}(),i=r.WordArray=o.extend({init:function(t,n){t=this.words=t||[],n!=e?this.sigBytes=n:this.sigBytes=4*t.length},toString:function(t){return(t||s).stringify(this)},concat:function(t){var e=this.words,n=t.words,r=this.sigBytes,o=t.sigBytes;if(this.clamp(),r%4)for(var i=0;o>i;i++){var a=n[i>>>2]>>>24-i%4*8&255;e[r+i>>>2]|=a<<24-(r+i)%4*8}else for(var i=0;o>i;i+=4)e[r+i>>>2]=n[i>>>2];return this.sigBytes+=o,this},clamp:function(){var e=this.words,n=this.sigBytes;e[n>>>2]&=4294967295<<32-n%4*8,e.length=t.ceil(n/4)},clone:function(){var t=o.clone.call(this);return t.words=this.words.slice(0),t},random:function(e){for(var n,r=[],o=function(e){var e=e,n=987654321,r=4294967295;return function(){n=36969*(65535&n)+(n>>16)&r,e=18e3*(65535&e)+(e>>16)&r;var o=(n<<16)+e&r;return o/=4294967296,o+=.5,o*(t.random()>.5?1:-1)}},a=0;e>a;a+=4){var s=o(4294967296*(n||t.random()));n=987654071*s(),r.push(4294967296*s()|0)}return new i.init(r,e)}}),a=n.enc={},s=a.Hex={stringify:function(t){for(var e=t.words,n=t.sigBytes,r=[],o=0;n>o;o++){var i=e[o>>>2]>>>24-o%4*8&255;r.push((i>>>4).toString(16)),r.push((15&i).toString(16))}return r.join("")},parse:function(t){for(var e=t.length,n=[],r=0;e>r;r+=2)n[r>>>3]|=parseInt(t.substr(r,2),16)<<24-r%8*4;return new i.init(n,e/2)}},c=a.Latin1={stringify:function(t){for(var e=t.words,n=t.sigBytes,r=[],o=0;n>o;o++){var i=e[o>>>2]>>>24-o%4*8&255;r.push(String.fromCharCode(i))}return r.join("")},parse:function(t){for(var e=t.length,n=[],r=0;e>r;r++)n[r>>>2]|=(255&t.charCodeAt(r))<<24-r%4*8;return new i.init(n,e)}},u=a.Utf8={stringify:function(t){try{return decodeURIComponent(escape(c.stringify(t)))}catch(e){throw new Error("Malformed UTF-8 data")}},parse:function(t){return c.parse(unescape(encodeURIComponent(t)))}},f=r.BufferedBlockAlgorithm=o.extend({reset:function(){this._data=new i.init,this._nDataBytes=0},_append:function(t){"string"==typeof t&&(t=u.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(e){var n=this._data,r=n.words,o=n.sigBytes,a=this.blockSize,s=4*a,c=o/s;c=e?t.ceil(c):t.max((0|c)-this._minBufferSize,0);var u=c*a,f=t.min(4*u,o);if(u){for(var p=0;u>p;p+=a)this._doProcessBlock(r,p);var l=r.splice(0,u);n.sigBytes-=f}return new i.init(l,f)},clone:function(){var t=o.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0}),p=(r.Hasher=f.extend({cfg:o.extend(),init:function(t){this.cfg=this.cfg.extend(t),this.reset()},reset:function(){f.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){t&&this._append(t);var e=this._doFinalize();return e},blockSize:16,_createHelper:function(t){return function(e,n){return new t.init(n).finalize(e)}},_createHmacHelper:function(t){return function(e,n){return new p.HMAC.init(t,n).finalize(e)}}}),n.algo={});return n}(Math);return t})},{}],52:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.WordArray,o=e.enc;o.Base64={stringify:function(t){var e=t.words,n=t.sigBytes,r=this._map;t.clamp();for(var o=[],i=0;n>i;i+=3)for(var a=e[i>>>2]>>>24-i%4*8&255,s=e[i+1>>>2]>>>24-(i+1)%4*8&255,c=e[i+2>>>2]>>>24-(i+2)%4*8&255,u=a<<16|s<<8|c,f=0;4>f&&n>i+.75*f;f++)o.push(r.charAt(u>>>6*(3-f)&63));var p=r.charAt(64);if(p)for(;o.length%4;)o.push(p);return o.join("")},parse:function(t){var e=t.length,n=this._map,o=n.charAt(64);if(o){var i=t.indexOf(o);-1!=i&&(e=i)}for(var a=[],s=0,c=0;e>c;c++)if(c%4){var u=n.indexOf(t.charAt(c-1))<<c%4*2,f=n.indexOf(t.charAt(c))>>>6-c%4*2;a[s>>>2]|=(u|f)<<24-s%4*8,s++}return r.create(a,s)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}(),t.enc.Base64})},{"./core":51}],53:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(t){return t<<8&4278255360|t>>>8&16711935}var n=t,r=n.lib,o=r.WordArray,i=n.enc;i.Utf16=i.Utf16BE={stringify:function(t){for(var e=t.words,n=t.sigBytes,r=[],o=0;n>o;o+=2){var i=e[o>>>2]>>>16-o%4*8&65535;r.push(String.fromCharCode(i))}return r.join("")},parse:function(t){for(var e=t.length,n=[],r=0;e>r;r++)n[r>>>1]|=t.charCodeAt(r)<<16-r%2*16;return o.create(n,2*e)}};i.Utf16LE={stringify:function(t){for(var n=t.words,r=t.sigBytes,o=[],i=0;r>i;i+=2){var a=e(n[i>>>2]>>>16-i%4*8&65535);o.push(String.fromCharCode(a))}return o.join("")},parse:function(t){for(var n=t.length,r=[],i=0;n>i;i++)r[i>>>1]|=e(t.charCodeAt(i)<<16-i%2*16);return o.create(r,2*n)}}}(),t.enc.Utf16})},{"./core":51}],54:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./sha1"),t("./hmac")):"function"==typeof define&&define.amd?define(["./core","./sha1","./hmac"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.Base,o=n.WordArray,i=e.algo,a=i.MD5,s=i.EvpKDF=r.extend({cfg:r.extend({keySize:4,hasher:a,iterations:1}),init:function(t){this.cfg=this.cfg.extend(t)},compute:function(t,e){for(var n=this.cfg,r=n.hasher.create(),i=o.create(),a=i.words,s=n.keySize,c=n.iterations;a.length<s;){u&&r.update(u);var u=r.update(t).finalize(e);r.reset();for(var f=1;c>f;f++)u=r.finalize(u),r.reset();i.concat(u)}return i.sigBytes=4*s,i}});e.EvpKDF=function(t,e,n){return s.create(n).compute(t,e)}}(),t.EvpKDF})},{"./core":51,"./hmac":56,"./sha1":75}],55:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(e){var n=t,r=n.lib,o=r.CipherParams,i=n.enc,a=i.Hex,s=n.format;s.Hex={stringify:function(t){return t.ciphertext.toString(a)},parse:function(t){var e=a.parse(t);return o.create({ciphertext:e})}}}(),t.format.Hex})},{"./cipher-core":50,"./core":51}],56:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){!function(){var e=t,n=e.lib,r=n.Base,o=e.enc,i=o.Utf8,a=e.algo;a.HMAC=r.extend({init:function(t,e){t=this._hasher=new t.init,"string"==typeof e&&(e=i.parse(e));var n=t.blockSize,r=4*n;e.sigBytes>r&&(e=t.finalize(e)),e.clamp();for(var o=this._oKey=e.clone(),a=this._iKey=e.clone(),s=o.words,c=a.words,u=0;n>u;u++)s[u]^=1549556828,c[u]^=909522486;o.sigBytes=a.sigBytes=r,this.reset()},reset:function(){var t=this._hasher;t.reset(),t.update(this._iKey)},update:function(t){return this._hasher.update(t),this},finalize:function(t){var e=this._hasher,n=e.finalize(t);e.reset();var r=e.finalize(this._oKey.clone().concat(n));return r}})}()})},{"./core":51}],57:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./x64-core"),t("./lib-typedarrays"),t("./enc-utf16"),t("./enc-base64"),t("./md5"),t("./sha1"),t("./sha256"),t("./sha224"),t("./sha512"),t("./sha384"),t("./sha3"),t("./ripemd160"),t("./hmac"),t("./pbkdf2"),t("./evpkdf"),t("./cipher-core"),t("./mode-cfb"),t("./mode-ctr"),t("./mode-ctr-gladman"),t("./mode-ofb"),t("./mode-ecb"),t("./pad-ansix923"),t("./pad-iso10126"),t("./pad-iso97971"),t("./pad-zeropadding"),t("./pad-nopadding"),t("./format-hex"),t("./aes"),t("./tripledes"),t("./rc4"),t("./rabbit"),t("./rabbit-legacy")):"function"==typeof define&&define.amd?define(["./core","./x64-core","./lib-typedarrays","./enc-utf16","./enc-base64","./md5","./sha1","./sha256","./sha224","./sha512","./sha384","./sha3","./ripemd160","./hmac","./pbkdf2","./evpkdf","./cipher-core","./mode-cfb","./mode-ctr","./mode-ctr-gladman","./mode-ofb","./mode-ecb","./pad-ansix923","./pad-iso10126","./pad-iso97971","./pad-zeropadding","./pad-nopadding","./format-hex","./aes","./tripledes","./rc4","./rabbit","./rabbit-legacy"],o):r.CryptoJS=o(r.CryptoJS)}(this,function(t){return t})},{"./aes":49,"./cipher-core":50,"./core":51,"./enc-base64":52,"./enc-utf16":53,"./evpkdf":54,"./format-hex":55,"./hmac":56,"./lib-typedarrays":58,"./md5":59,"./mode-cfb":60,"./mode-ctr":62,"./mode-ctr-gladman":61,"./mode-ecb":63,"./mode-ofb":64,"./pad-ansix923":65,"./pad-iso10126":66,"./pad-iso97971":67,"./pad-nopadding":68,"./pad-zeropadding":69,"./pbkdf2":70,"./rabbit":72,"./rabbit-legacy":71,"./rc4":73,"./ripemd160":74,"./sha1":75,"./sha224":76,"./sha256":77,"./sha3":78,"./sha384":79,"./sha512":80,"./tripledes":81,"./x64-core":82}],58:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(){if("function"==typeof ArrayBuffer){var e=t,n=e.lib,r=n.WordArray,o=r.init,i=r.init=function(t){if(t instanceof ArrayBuffer&&(t=new Uint8Array(t)),(t instanceof Int8Array||"undefined"!=typeof Uint8ClampedArray&&t instanceof Uint8ClampedArray||t instanceof Int16Array||t instanceof Uint16Array||t instanceof Int32Array||t instanceof Uint32Array||t instanceof Float32Array||t instanceof Float64Array)&&(t=new Uint8Array(t.buffer,t.byteOffset,t.byteLength)),t instanceof Uint8Array){for(var e=t.byteLength,n=[],r=0;e>r;r++)n[r>>>2]|=t[r]<<24-r%4*8;o.call(this,n,e)}else o.apply(this,arguments)};i.prototype=r}}(),t.lib.WordArray})},{"./core":51}],59:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(e){function n(t,e,n,r,o,i,a){var s=t+(e&n|~e&r)+o+a;return(s<<i|s>>>32-i)+e}function r(t,e,n,r,o,i,a){var s=t+(e&r|n&~r)+o+a;return(s<<i|s>>>32-i)+e}function o(t,e,n,r,o,i,a){var s=t+(e^n^r)+o+a;return(s<<i|s>>>32-i)+e}function i(t,e,n,r,o,i,a){var s=t+(n^(e|~r))+o+a;return(s<<i|s>>>32-i)+e}var a=t,s=a.lib,c=s.WordArray,u=s.Hasher,f=a.algo,p=[];!function(){for(var t=0;64>t;t++)p[t]=4294967296*e.abs(e.sin(t+1))|0}();var l=f.MD5=u.extend({_doReset:function(){this._hash=new c.init([1732584193,4023233417,2562383102,271733878])},_doProcessBlock:function(t,e){for(var a=0;16>a;a++){var s=e+a,c=t[s];t[s]=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8)}var u=this._hash.words,f=t[e+0],l=t[e+1],h=t[e+2],d=t[e+3],m=t[e+4],y=t[e+5],g=t[e+6],v=t[e+7],b=t[e+8],_=t[e+9],w=t[e+10],x=t[e+11],k=t[e+12],B=t[e+13],S=t[e+14],C=t[e+15],A=u[0],F=u[1],I=u[2],N=u[3];A=n(A,F,I,N,f,7,p[0]),N=n(N,A,F,I,l,12,p[1]),I=n(I,N,A,F,h,17,p[2]),F=n(F,I,N,A,d,22,p[3]),A=n(A,F,I,N,m,7,p[4]),N=n(N,A,F,I,y,12,p[5]),I=n(I,N,A,F,g,17,p[6]),F=n(F,I,N,A,v,22,p[7]),A=n(A,F,I,N,b,7,p[8]),N=n(N,A,F,I,_,12,p[9]),I=n(I,N,A,F,w,17,p[10]),F=n(F,I,N,A,x,22,p[11]),A=n(A,F,I,N,k,7,p[12]),N=n(N,A,F,I,B,12,p[13]),I=n(I,N,A,F,S,17,p[14]),F=n(F,I,N,A,C,22,p[15]),A=r(A,F,I,N,l,5,p[16]),N=r(N,A,F,I,g,9,p[17]),I=r(I,N,A,F,x,14,p[18]),F=r(F,I,N,A,f,20,p[19]),A=r(A,F,I,N,y,5,p[20]),N=r(N,A,F,I,w,9,p[21]),I=r(I,N,A,F,C,14,p[22]),F=r(F,I,N,A,m,20,p[23]),A=r(A,F,I,N,_,5,p[24]),N=r(N,A,F,I,S,9,p[25]),I=r(I,N,A,F,d,14,p[26]),F=r(F,I,N,A,b,20,p[27]),A=r(A,F,I,N,B,5,p[28]),N=r(N,A,F,I,h,9,p[29]),I=r(I,N,A,F,v,14,p[30]),F=r(F,I,N,A,k,20,p[31]),A=o(A,F,I,N,y,4,p[32]),N=o(N,A,F,I,b,11,p[33]),I=o(I,N,A,F,x,16,p[34]),F=o(F,I,N,A,S,23,p[35]),A=o(A,F,I,N,l,4,p[36]),N=o(N,A,F,I,m,11,p[37]),I=o(I,N,A,F,v,16,p[38]),F=o(F,I,N,A,w,23,p[39]),A=o(A,F,I,N,B,4,p[40]),N=o(N,A,F,I,f,11,p[41]),I=o(I,N,A,F,d,16,p[42]),F=o(F,I,N,A,g,23,p[43]),A=o(A,F,I,N,_,4,p[44]),N=o(N,A,F,I,k,11,p[45]),I=o(I,N,A,F,C,16,p[46]),F=o(F,I,N,A,h,23,p[47]),A=i(A,F,I,N,f,6,p[48]),N=i(N,A,F,I,v,10,p[49]),I=i(I,N,A,F,S,15,p[50]),F=i(F,I,N,A,y,21,p[51]),A=i(A,F,I,N,k,6,p[52]),N=i(N,A,F,I,d,10,p[53]),I=i(I,N,A,F,w,15,p[54]),F=i(F,I,N,A,l,21,p[55]),A=i(A,F,I,N,b,6,p[56]),N=i(N,A,F,I,C,10,p[57]),I=i(I,N,A,F,g,15,p[58]),F=i(F,I,N,A,B,21,p[59]),A=i(A,F,I,N,m,6,p[60]),N=i(N,A,F,I,x,10,p[61]),I=i(I,N,A,F,h,15,p[62]),F=i(F,I,N,A,_,21,p[63]),u[0]=u[0]+A|0,u[1]=u[1]+F|0,u[2]=u[2]+I|0,u[3]=u[3]+N|0},_doFinalize:function(){var t=this._data,n=t.words,r=8*this._nDataBytes,o=8*t.sigBytes;n[o>>>5]|=128<<24-o%32;var i=e.floor(r/4294967296),a=r;n[(o+64>>>9<<4)+15]=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8),n[(o+64>>>9<<4)+14]=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),t.sigBytes=4*(n.length+1),this._process();for(var s=this._hash,c=s.words,u=0;4>u;u++){var f=c[u];c[u]=16711935&(f<<8|f>>>24)|4278255360&(f<<24|f>>>8)}return s},clone:function(){var t=u.clone.call(this);return t._hash=this._hash.clone(),t}});a.MD5=u._createHelper(l),a.HmacMD5=u._createHmacHelper(l)}(Math),t.MD5})},{"./core":51}],60:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.mode.CFB=function(){function e(t,e,n,r){var o=this._iv;if(o){var i=o.slice(0);this._iv=void 0}else var i=this._prevBlock;r.encryptBlock(i,0);for(var a=0;n>a;a++)t[e+a]^=i[a]}var n=t.lib.BlockCipherMode.extend();return n.Encryptor=n.extend({processBlock:function(t,n){var r=this._cipher,o=r.blockSize;e.call(this,t,n,o,r),this._prevBlock=t.slice(n,n+o)}}),n.Decryptor=n.extend({processBlock:function(t,n){var r=this._cipher,o=r.blockSize,i=t.slice(n,n+o);e.call(this,t,n,o,r),this._prevBlock=i}}),n}(),t.mode.CFB})},{"./cipher-core":50,"./core":51}],61:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.mode.CTRGladman=function(){function e(t){if(255===(t>>24&255)){var e=t>>16&255,n=t>>8&255,r=255&t;255===e?(e=0,255===n?(n=0,255===r?r=0:++r):++n):++e,t=0,t+=e<<16,t+=n<<8,t+=r}else t+=1<<24;return t}function n(t){return 0===(t[0]=e(t[0]))&&(t[1]=e(t[1])),t}var r=t.lib.BlockCipherMode.extend(),o=r.Encryptor=r.extend({processBlock:function(t,e){var r=this._cipher,o=r.blockSize,i=this._iv,a=this._counter;i&&(a=this._counter=i.slice(0),this._iv=void 0),n(a);var s=a.slice(0);r.encryptBlock(s,0);for(var c=0;o>c;c++)t[e+c]^=s[c]}});return r.Decryptor=o,r}(),t.mode.CTRGladman})},{"./cipher-core":50,"./core":51}],62:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.mode.CTR=function(){var e=t.lib.BlockCipherMode.extend(),n=e.Encryptor=e.extend({processBlock:function(t,e){var n=this._cipher,r=n.blockSize,o=this._iv,i=this._counter;o&&(i=this._counter=o.slice(0),this._iv=void 0);var a=i.slice(0);n.encryptBlock(a,0),i[r-1]=i[r-1]+1|0;for(var s=0;r>s;s++)t[e+s]^=a[s]}});return e.Decryptor=n,e}(),t.mode.CTR})},{"./cipher-core":50,"./core":51}],63:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.mode.ECB=function(){var e=t.lib.BlockCipherMode.extend();return e.Encryptor=e.extend({processBlock:function(t,e){this._cipher.encryptBlock(t,e)}}),e.Decryptor=e.extend({processBlock:function(t,e){this._cipher.decryptBlock(t,e)}}),e}(),t.mode.ECB})},{"./cipher-core":50,"./core":51}],64:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.mode.OFB=function(){var e=t.lib.BlockCipherMode.extend(),n=e.Encryptor=e.extend({processBlock:function(t,e){var n=this._cipher,r=n.blockSize,o=this._iv,i=this._keystream;o&&(i=this._keystream=o.slice(0),this._iv=void 0),n.encryptBlock(i,0);for(var a=0;r>a;a++)t[e+a]^=i[a]}});return e.Decryptor=n,e}(),t.mode.OFB})},{"./cipher-core":50,"./core":51}],65:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.pad.AnsiX923={pad:function(t,e){var n=t.sigBytes,r=4*e,o=r-n%r,i=n+o-1;t.clamp(),t.words[i>>>2]|=o<<24-i%4*8,t.sigBytes+=o},unpad:function(t){var e=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=e}},t.pad.Ansix923})},{"./cipher-core":50,"./core":51}],66:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.pad.Iso10126={pad:function(e,n){var r=4*n,o=r-e.sigBytes%r;e.concat(t.lib.WordArray.random(o-1)).concat(t.lib.WordArray.create([o<<24],1))},unpad:function(t){var e=255&t.words[t.sigBytes-1>>>2];t.sigBytes-=e}},t.pad.Iso10126})},{"./cipher-core":50,"./core":51}],67:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.pad.Iso97971={pad:function(e,n){e.concat(t.lib.WordArray.create([2147483648],1)),t.pad.ZeroPadding.pad(e,n)},unpad:function(e){t.pad.ZeroPadding.unpad(e),e.sigBytes--}},t.pad.Iso97971})},{"./cipher-core":50,"./core":51}],68:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.pad.NoPadding={pad:function(){},unpad:function(){}},t.pad.NoPadding})},{"./cipher-core":50,"./core":51}],69:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return t.pad.ZeroPadding={pad:function(t,e){var n=4*e;t.clamp(),t.sigBytes+=n-(t.sigBytes%n||n)},unpad:function(t){for(var e=t.words,n=t.sigBytes-1;!(e[n>>>2]>>>24-n%4*8&255);)n--;t.sigBytes=n+1}},t.pad.ZeroPadding})},{"./cipher-core":50,"./core":51}],70:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./sha1"),t("./hmac")):"function"==typeof define&&define.amd?define(["./core","./sha1","./hmac"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.Base,o=n.WordArray,i=e.algo,a=i.SHA1,s=i.HMAC,c=i.PBKDF2=r.extend({cfg:r.extend({keySize:4,hasher:a,iterations:1}),init:function(t){this.cfg=this.cfg.extend(t)},compute:function(t,e){for(var n=this.cfg,r=s.create(n.hasher,t),i=o.create(),a=o.create([1]),c=i.words,u=a.words,f=n.keySize,p=n.iterations;c.length<f;){var l=r.update(e).finalize(a);r.reset();for(var h=l.words,d=h.length,m=l,y=1;p>y;y++){m=r.finalize(m),r.reset();for(var g=m.words,v=0;d>v;v++)h[v]^=g[v]}i.concat(l),u[0]++}return i.sigBytes=4*f,i}});e.PBKDF2=function(t,e,n){return c.create(n).compute(t,e)}}(),t.PBKDF2})},{"./core":51,"./hmac":56,"./sha1":75}],71:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./enc-base64"),t("./md5"),t("./evpkdf"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(){for(var t=this._X,e=this._C,n=0;8>n;n++)s[n]=e[n];e[0]=e[0]+1295307597+this._b|0,e[1]=e[1]+3545052371+(e[0]>>>0<s[0]>>>0?1:0)|0,e[2]=e[2]+886263092+(e[1]>>>0<s[1]>>>0?1:0)|0,e[3]=e[3]+1295307597+(e[2]>>>0<s[2]>>>0?1:0)|0,e[4]=e[4]+3545052371+(e[3]>>>0<s[3]>>>0?1:0)|0,e[5]=e[5]+886263092+(e[4]>>>0<s[4]>>>0?1:0)|0,e[6]=e[6]+1295307597+(e[5]>>>0<s[5]>>>0?1:0)|0,e[7]=e[7]+3545052371+(e[6]>>>0<s[6]>>>0?1:0)|0,this._b=e[7]>>>0<s[7]>>>0?1:0;for(var n=0;8>n;n++){var r=t[n]+e[n],o=65535&r,i=r>>>16,a=((o*o>>>17)+o*i>>>15)+i*i,u=((4294901760&r)*r|0)+((65535&r)*r|0);c[n]=a^u}t[0]=c[0]+(c[7]<<16|c[7]>>>16)+(c[6]<<16|c[6]>>>16)|0,t[1]=c[1]+(c[0]<<8|c[0]>>>24)+c[7]|0,t[2]=c[2]+(c[1]<<16|c[1]>>>16)+(c[0]<<16|c[0]>>>16)|0,t[3]=c[3]+(c[2]<<8|c[2]>>>24)+c[1]|0,t[4]=c[4]+(c[3]<<16|c[3]>>>16)+(c[2]<<16|c[2]>>>16)|0,t[5]=c[5]+(c[4]<<8|c[4]>>>24)+c[3]|0,t[6]=c[6]+(c[5]<<16|c[5]>>>16)+(c[4]<<16|c[4]>>>16)|0,t[7]=c[7]+(c[6]<<8|c[6]>>>24)+c[5]|0}var n=t,r=n.lib,o=r.StreamCipher,i=n.algo,a=[],s=[],c=[],u=i.RabbitLegacy=o.extend({_doReset:function(){var t=this._key.words,n=this.cfg.iv,r=this._X=[t[0],t[3]<<16|t[2]>>>16,t[1],t[0]<<16|t[3]>>>16,t[2],t[1]<<16|t[0]>>>16,t[3],t[2]<<16|t[1]>>>16],o=this._C=[t[2]<<16|t[2]>>>16,4294901760&t[0]|65535&t[1],t[3]<<16|t[3]>>>16,4294901760&t[1]|65535&t[2],t[0]<<16|t[0]>>>16,4294901760&t[2]|65535&t[3],t[1]<<16|t[1]>>>16,4294901760&t[3]|65535&t[0]];this._b=0;for(var i=0;4>i;i++)e.call(this);for(var i=0;8>i;i++)o[i]^=r[i+4&7];if(n){var a=n.words,s=a[0],c=a[1],u=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8),f=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8),p=u>>>16|4294901760&f,l=f<<16|65535&u;o[0]^=u,o[1]^=p,o[2]^=f,o[3]^=l,o[4]^=u,o[5]^=p,o[6]^=f,o[7]^=l;for(var i=0;4>i;i++)e.call(this)}},_doProcessBlock:function(t,n){var r=this._X;e.call(this),a[0]=r[0]^r[5]>>>16^r[3]<<16,a[1]=r[2]^r[7]>>>16^r[5]<<16,a[2]=r[4]^r[1]>>>16^r[7]<<16,a[3]=r[6]^r[3]>>>16^r[1]<<16;for(var o=0;4>o;o++)a[o]=16711935&(a[o]<<8|a[o]>>>24)|4278255360&(a[o]<<24|a[o]>>>8),t[n+o]^=a[o]},blockSize:4,ivSize:2});n.RabbitLegacy=o._createHelper(u)}(),t.RabbitLegacy})},{"./cipher-core":50,"./core":51,"./enc-base64":52,"./evpkdf":54,"./md5":59}],72:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./enc-base64"),t("./md5"),t("./evpkdf"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(){for(var t=this._X,e=this._C,n=0;8>n;n++)s[n]=e[n];e[0]=e[0]+1295307597+this._b|0,e[1]=e[1]+3545052371+(e[0]>>>0<s[0]>>>0?1:0)|0,e[2]=e[2]+886263092+(e[1]>>>0<s[1]>>>0?1:0)|0,e[3]=e[3]+1295307597+(e[2]>>>0<s[2]>>>0?1:0)|0,e[4]=e[4]+3545052371+(e[3]>>>0<s[3]>>>0?1:0)|0,e[5]=e[5]+886263092+(e[4]>>>0<s[4]>>>0?1:0)|0,e[6]=e[6]+1295307597+(e[5]>>>0<s[5]>>>0?1:0)|0,e[7]=e[7]+3545052371+(e[6]>>>0<s[6]>>>0?1:0)|0,this._b=e[7]>>>0<s[7]>>>0?1:0;for(var n=0;8>n;n++){var r=t[n]+e[n],o=65535&r,i=r>>>16,a=((o*o>>>17)+o*i>>>15)+i*i,u=((4294901760&r)*r|0)+((65535&r)*r|0);c[n]=a^u}t[0]=c[0]+(c[7]<<16|c[7]>>>16)+(c[6]<<16|c[6]>>>16)|0,t[1]=c[1]+(c[0]<<8|c[0]>>>24)+c[7]|0,t[2]=c[2]+(c[1]<<16|c[1]>>>16)+(c[0]<<16|c[0]>>>16)|0,t[3]=c[3]+(c[2]<<8|c[2]>>>24)+c[1]|0,t[4]=c[4]+(c[3]<<16|c[3]>>>16)+(c[2]<<16|c[2]>>>16)|0,t[5]=c[5]+(c[4]<<8|c[4]>>>24)+c[3]|0,t[6]=c[6]+(c[5]<<16|c[5]>>>16)+(c[4]<<16|c[4]>>>16)|0,t[7]=c[7]+(c[6]<<8|c[6]>>>24)+c[5]|0}var n=t,r=n.lib,o=r.StreamCipher,i=n.algo,a=[],s=[],c=[],u=i.Rabbit=o.extend({_doReset:function(){for(var t=this._key.words,n=this.cfg.iv,r=0;4>r;r++)t[r]=16711935&(t[r]<<8|t[r]>>>24)|4278255360&(t[r]<<24|t[r]>>>8);var o=this._X=[t[0],t[3]<<16|t[2]>>>16,t[1],t[0]<<16|t[3]>>>16,t[2],t[1]<<16|t[0]>>>16,t[3],t[2]<<16|t[1]>>>16],i=this._C=[t[2]<<16|t[2]>>>16,4294901760&t[0]|65535&t[1],t[3]<<16|t[3]>>>16,4294901760&t[1]|65535&t[2],t[0]<<16|t[0]>>>16,4294901760&t[2]|65535&t[3],t[1]<<16|t[1]>>>16,4294901760&t[3]|65535&t[0]];this._b=0;for(var r=0;4>r;r++)e.call(this);for(var r=0;8>r;r++)i[r]^=o[r+4&7];if(n){var a=n.words,s=a[0],c=a[1],u=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8),f=16711935&(c<<8|c>>>24)|4278255360&(c<<24|c>>>8),p=u>>>16|4294901760&f,l=f<<16|65535&u;i[0]^=u,i[1]^=p,i[2]^=f,i[3]^=l,i[4]^=u,i[5]^=p,i[6]^=f,i[7]^=l;for(var r=0;4>r;r++)e.call(this)}},_doProcessBlock:function(t,n){var r=this._X;e.call(this),a[0]=r[0]^r[5]>>>16^r[3]<<16,a[1]=r[2]^r[7]>>>16^r[5]<<16,a[2]=r[4]^r[1]>>>16^r[7]<<16,a[3]=r[6]^r[3]>>>16^r[1]<<16;for(var o=0;4>o;o++)a[o]=16711935&(a[o]<<8|a[o]>>>24)|4278255360&(a[o]<<24|a[o]>>>8),t[n+o]^=a[o]},blockSize:4,ivSize:2});n.Rabbit=o._createHelper(u)}(),t.Rabbit})},{"./cipher-core":50,"./core":51,"./enc-base64":52,"./evpkdf":54,"./md5":59}],73:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./enc-base64"),t("./md5"),t("./evpkdf"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(){for(var t=this._S,e=this._i,n=this._j,r=0,o=0;4>o;o++){e=(e+1)%256,n=(n+t[e])%256;var i=t[e];t[e]=t[n],t[n]=i,r|=t[(t[e]+t[n])%256]<<24-8*o}return this._i=e,this._j=n,r}var n=t,r=n.lib,o=r.StreamCipher,i=n.algo,a=i.RC4=o.extend({_doReset:function(){for(var t=this._key,e=t.words,n=t.sigBytes,r=this._S=[],o=0;256>o;o++)r[o]=o;for(var o=0,i=0;256>o;o++){var a=o%n,s=e[a>>>2]>>>24-a%4*8&255;i=(i+r[o]+s)%256;var c=r[o];r[o]=r[i],r[i]=c}this._i=this._j=0},_doProcessBlock:function(t,n){t[n]^=e.call(this)},keySize:8,ivSize:0});n.RC4=o._createHelper(a);var s=i.RC4Drop=a.extend({cfg:a.cfg.extend({drop:192}),_doReset:function(){a._doReset.call(this);for(var t=this.cfg.drop;t>0;t--)e.call(this)}});n.RC4Drop=o._createHelper(s)}(),t.RC4})},{"./cipher-core":50,"./core":51,"./enc-base64":52,"./evpkdf":54,"./md5":59}],74:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(e){function n(t,e,n){return t^e^n}function r(t,e,n){return t&e|~t&n}function o(t,e,n){return(t|~e)^n}function i(t,e,n){return t&n|e&~n}function a(t,e,n){return t^(e|~n)}function s(t,e){return t<<e|t>>>32-e}var c=t,u=c.lib,f=u.WordArray,p=u.Hasher,l=c.algo,h=f.create([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]),d=f.create([5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]),m=f.create([11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]),y=f.create([8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]),g=f.create([0,1518500249,1859775393,2400959708,2840853838]),v=f.create([1352829926,1548603684,1836072691,2053994217,0]),b=l.RIPEMD160=p.extend({_doReset:function(){this._hash=f.create([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(t,e){for(var c=0;16>c;c++){var u=e+c,f=t[u];t[u]=16711935&(f<<8|f>>>24)|4278255360&(f<<24|f>>>8)}var p,l,b,_,w,x,k,B,S,C,A=this._hash.words,F=g.words,I=v.words,N=h.words,O=d.words,D=m.words,P=y.words;x=p=A[0],k=l=A[1],B=b=A[2],S=_=A[3],C=w=A[4];for(var T,c=0;80>c;c+=1)T=p+t[e+N[c]]|0,T+=16>c?n(l,b,_)+F[0]:32>c?r(l,b,_)+F[1]:48>c?o(l,b,_)+F[2]:64>c?i(l,b,_)+F[3]:a(l,b,_)+F[4],T=0|T,T=s(T,D[c]),T=T+w|0,p=w,w=_,_=s(b,10),b=l,l=T,T=x+t[e+O[c]]|0,T+=16>c?a(k,B,S)+I[0]:32>c?i(k,B,S)+I[1]:48>c?o(k,B,S)+I[2]:64>c?r(k,B,S)+I[3]:n(k,B,S)+I[4],T=0|T,T=s(T,P[c]),T=T+C|0,x=C,C=S,S=s(B,10),B=k,k=T;T=A[1]+b+S|0,A[1]=A[2]+_+C|0,A[2]=A[3]+w+x|0,A[3]=A[4]+p+k|0,A[4]=A[0]+l+B|0,A[0]=T},_doFinalize:function(){var t=this._data,e=t.words,n=8*this._nDataBytes,r=8*t.sigBytes;e[r>>>5]|=128<<24-r%32,e[(r+64>>>9<<4)+14]=16711935&(n<<8|n>>>24)|4278255360&(n<<24|n>>>8),t.sigBytes=4*(e.length+1),this._process();for(var o=this._hash,i=o.words,a=0;5>a;a++){var s=i[a];i[a]=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8)}return o},clone:function(){var t=p.clone.call(this);return t._hash=this._hash.clone(),t}});c.RIPEMD160=p._createHelper(b),c.HmacRIPEMD160=p._createHmacHelper(b)}(Math),t.RIPEMD160})},{"./core":51}],75:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.WordArray,o=n.Hasher,i=e.algo,a=[],s=i.SHA1=o.extend({_doReset:function(){this._hash=new r.init([1732584193,4023233417,2562383102,271733878,3285377520])},_doProcessBlock:function(t,e){for(var n=this._hash.words,r=n[0],o=n[1],i=n[2],s=n[3],c=n[4],u=0;80>u;u++){if(16>u)a[u]=0|t[e+u];else{var f=a[u-3]^a[u-8]^a[u-14]^a[u-16];a[u]=f<<1|f>>>31}var p=(r<<5|r>>>27)+c+a[u];p+=20>u?(o&i|~o&s)+1518500249:40>u?(o^i^s)+1859775393:60>u?(o&i|o&s|i&s)-1894007588:(o^i^s)-899497514,c=s,s=i,i=o<<30|o>>>2,o=r,r=p}n[0]=n[0]+r|0,n[1]=n[1]+o|0,n[2]=n[2]+i|0,n[3]=n[3]+s|0,n[4]=n[4]+c|0},_doFinalize:function(){var t=this._data,e=t.words,n=8*this._nDataBytes,r=8*t.sigBytes;return e[r>>>5]|=128<<24-r%32,e[(r+64>>>9<<4)+14]=Math.floor(n/4294967296),e[(r+64>>>9<<4)+15]=n,t.sigBytes=4*e.length,this._process(),this._hash},clone:function(){var t=o.clone.call(this);return t._hash=this._hash.clone(),t}});e.SHA1=o._createHelper(s),e.HmacSHA1=o._createHmacHelper(s)}(),t.SHA1})},{"./core":51}],76:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./sha256")):"function"==typeof define&&define.amd?define(["./core","./sha256"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.lib,r=n.WordArray,o=e.algo,i=o.SHA256,a=o.SHA224=i.extend({_doReset:function(){this._hash=new r.init([3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428])},_doFinalize:function(){var t=i._doFinalize.call(this);return t.sigBytes-=4,t}});e.SHA224=i._createHelper(a),e.HmacSHA224=i._createHmacHelper(a)}(),t.SHA224})},{"./core":51,"./sha256":77}],77:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(e){var n=t,r=n.lib,o=r.WordArray,i=r.Hasher,a=n.algo,s=[],c=[];!function(){function t(t){for(var n=e.sqrt(t),r=2;n>=r;r++)if(!(t%r))return!1;return!0}function n(t){return 4294967296*(t-(0|t))|0}for(var r=2,o=0;64>o;)t(r)&&(8>o&&(s[o]=n(e.pow(r,.5))),c[o]=n(e.pow(r,1/3)),o++),r++}();var u=[],f=a.SHA256=i.extend({_doReset:function(){this._hash=new o.init(s.slice(0))},_doProcessBlock:function(t,e){for(var n=this._hash.words,r=n[0],o=n[1],i=n[2],a=n[3],s=n[4],f=n[5],p=n[6],l=n[7],h=0;64>h;h++){
if(16>h)u[h]=0|t[e+h];else{var d=u[h-15],m=(d<<25|d>>>7)^(d<<14|d>>>18)^d>>>3,y=u[h-2],g=(y<<15|y>>>17)^(y<<13|y>>>19)^y>>>10;u[h]=m+u[h-7]+g+u[h-16]}var v=s&f^~s&p,b=r&o^r&i^o&i,_=(r<<30|r>>>2)^(r<<19|r>>>13)^(r<<10|r>>>22),w=(s<<26|s>>>6)^(s<<21|s>>>11)^(s<<7|s>>>25),x=l+w+v+c[h]+u[h],k=_+b;l=p,p=f,f=s,s=a+x|0,a=i,i=o,o=r,r=x+k|0}n[0]=n[0]+r|0,n[1]=n[1]+o|0,n[2]=n[2]+i|0,n[3]=n[3]+a|0,n[4]=n[4]+s|0,n[5]=n[5]+f|0,n[6]=n[6]+p|0,n[7]=n[7]+l|0},_doFinalize:function(){var t=this._data,n=t.words,r=8*this._nDataBytes,o=8*t.sigBytes;return n[o>>>5]|=128<<24-o%32,n[(o+64>>>9<<4)+14]=e.floor(r/4294967296),n[(o+64>>>9<<4)+15]=r,t.sigBytes=4*n.length,this._process(),this._hash},clone:function(){var t=i.clone.call(this);return t._hash=this._hash.clone(),t}});n.SHA256=i._createHelper(f),n.HmacSHA256=i._createHmacHelper(f)}(Math),t.SHA256})},{"./core":51}],78:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./x64-core")):"function"==typeof define&&define.amd?define(["./core","./x64-core"],o):o(r.CryptoJS)}(this,function(t){return function(e){var n=t,r=n.lib,o=r.WordArray,i=r.Hasher,a=n.x64,s=a.Word,c=n.algo,u=[],f=[],p=[];!function(){for(var t=1,e=0,n=0;24>n;n++){u[t+5*e]=(n+1)*(n+2)/2%64;var r=e%5,o=(2*t+3*e)%5;t=r,e=o}for(var t=0;5>t;t++)for(var e=0;5>e;e++)f[t+5*e]=e+(2*t+3*e)%5*5;for(var i=1,a=0;24>a;a++){for(var c=0,l=0,h=0;7>h;h++){if(1&i){var d=(1<<h)-1;32>d?l^=1<<d:c^=1<<d-32}128&i?i=i<<1^113:i<<=1}p[a]=s.create(c,l)}}();var l=[];!function(){for(var t=0;25>t;t++)l[t]=s.create()}();var h=c.SHA3=i.extend({cfg:i.cfg.extend({outputLength:512}),_doReset:function(){for(var t=this._state=[],e=0;25>e;e++)t[e]=new s.init;this.blockSize=(1600-2*this.cfg.outputLength)/32},_doProcessBlock:function(t,e){for(var n=this._state,r=this.blockSize/2,o=0;r>o;o++){var i=t[e+2*o],a=t[e+2*o+1];i=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8),a=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8);var s=n[o];s.high^=a,s.low^=i}for(var c=0;24>c;c++){for(var h=0;5>h;h++){for(var d=0,m=0,y=0;5>y;y++){var s=n[h+5*y];d^=s.high,m^=s.low}var g=l[h];g.high=d,g.low=m}for(var h=0;5>h;h++)for(var v=l[(h+4)%5],b=l[(h+1)%5],_=b.high,w=b.low,d=v.high^(_<<1|w>>>31),m=v.low^(w<<1|_>>>31),y=0;5>y;y++){var s=n[h+5*y];s.high^=d,s.low^=m}for(var x=1;25>x;x++){var s=n[x],k=s.high,B=s.low,S=u[x];if(32>S)var d=k<<S|B>>>32-S,m=B<<S|k>>>32-S;else var d=B<<S-32|k>>>64-S,m=k<<S-32|B>>>64-S;var C=l[f[x]];C.high=d,C.low=m}var A=l[0],F=n[0];A.high=F.high,A.low=F.low;for(var h=0;5>h;h++)for(var y=0;5>y;y++){var x=h+5*y,s=n[x],I=l[x],N=l[(h+1)%5+5*y],O=l[(h+2)%5+5*y];s.high=I.high^~N.high&O.high,s.low=I.low^~N.low&O.low}var s=n[0],D=p[c];s.high^=D.high,s.low^=D.low}},_doFinalize:function(){var t=this._data,n=t.words,r=(8*this._nDataBytes,8*t.sigBytes),i=32*this.blockSize;n[r>>>5]|=1<<24-r%32,n[(e.ceil((r+1)/i)*i>>>5)-1]|=128,t.sigBytes=4*n.length,this._process();for(var a=this._state,s=this.cfg.outputLength/8,c=s/8,u=[],f=0;c>f;f++){var p=a[f],l=p.high,h=p.low;l=16711935&(l<<8|l>>>24)|4278255360&(l<<24|l>>>8),h=16711935&(h<<8|h>>>24)|4278255360&(h<<24|h>>>8),u.push(h),u.push(l)}return new o.init(u,s)},clone:function(){for(var t=i.clone.call(this),e=t._state=this._state.slice(0),n=0;25>n;n++)e[n]=e[n].clone();return t}});n.SHA3=i._createHelper(h),n.HmacSHA3=i._createHmacHelper(h)}(Math),t.SHA3})},{"./core":51,"./x64-core":82}],79:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./x64-core"),t("./sha512")):"function"==typeof define&&define.amd?define(["./core","./x64-core","./sha512"],o):o(r.CryptoJS)}(this,function(t){return function(){var e=t,n=e.x64,r=n.Word,o=n.WordArray,i=e.algo,a=i.SHA512,s=i.SHA384=a.extend({_doReset:function(){this._hash=new o.init([new r.init(3418070365,3238371032),new r.init(1654270250,914150663),new r.init(2438529370,812702999),new r.init(355462360,4144912697),new r.init(1731405415,4290775857),new r.init(2394180231,1750603025),new r.init(3675008525,1694076839),new r.init(1203062813,3204075428)])},_doFinalize:function(){var t=a._doFinalize.call(this);return t.sigBytes-=16,t}});e.SHA384=a._createHelper(s),e.HmacSHA384=a._createHmacHelper(s)}(),t.SHA384})},{"./core":51,"./sha512":80,"./x64-core":82}],80:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./x64-core")):"function"==typeof define&&define.amd?define(["./core","./x64-core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(){return a.create.apply(a,arguments)}var n=t,r=n.lib,o=r.Hasher,i=n.x64,a=i.Word,s=i.WordArray,c=n.algo,u=[e(1116352408,3609767458),e(1899447441,602891725),e(3049323471,3964484399),e(3921009573,2173295548),e(961987163,4081628472),e(1508970993,3053834265),e(2453635748,2937671579),e(2870763221,3664609560),e(3624381080,2734883394),e(310598401,1164996542),e(607225278,1323610764),e(1426881987,3590304994),e(1925078388,4068182383),e(2162078206,991336113),e(2614888103,633803317),e(3248222580,3479774868),e(3835390401,2666613458),e(4022224774,944711139),e(264347078,2341262773),e(604807628,2007800933),e(770255983,1495990901),e(1249150122,1856431235),e(1555081692,3175218132),e(1996064986,2198950837),e(2554220882,3999719339),e(2821834349,766784016),e(2952996808,2566594879),e(3210313671,3203337956),e(3336571891,1034457026),e(3584528711,2466948901),e(113926993,3758326383),e(338241895,168717936),e(666307205,1188179964),e(773529912,1546045734),e(1294757372,1522805485),e(1396182291,2643833823),e(1695183700,2343527390),e(1986661051,1014477480),e(2177026350,1206759142),e(2456956037,344077627),e(2730485921,1290863460),e(2820302411,3158454273),e(3259730800,3505952657),e(3345764771,106217008),e(3516065817,3606008344),e(3600352804,1432725776),e(4094571909,1467031594),e(275423344,851169720),e(430227734,3100823752),e(506948616,1363258195),e(659060556,3750685593),e(883997877,3785050280),e(958139571,3318307427),e(1322822218,3812723403),e(1537002063,2003034995),e(1747873779,3602036899),e(1955562222,1575990012),e(2024104815,1125592928),e(2227730452,2716904306),e(2361852424,442776044),e(2428436474,593698344),e(2756734187,3733110249),e(3204031479,2999351573),e(3329325298,3815920427),e(3391569614,3928383900),e(3515267271,566280711),e(3940187606,3454069534),e(4118630271,4000239992),e(116418474,1914138554),e(174292421,2731055270),e(289380356,3203993006),e(460393269,320620315),e(685471733,587496836),e(852142971,1086792851),e(1017036298,365543100),e(1126000580,2618297676),e(1288033470,3409855158),e(1501505948,4234509866),e(1607167915,987167468),e(1816402316,1246189591)],f=[];!function(){for(var t=0;80>t;t++)f[t]=e()}();var p=c.SHA512=o.extend({_doReset:function(){this._hash=new s.init([new a.init(1779033703,4089235720),new a.init(3144134277,2227873595),new a.init(1013904242,4271175723),new a.init(2773480762,1595750129),new a.init(1359893119,2917565137),new a.init(2600822924,725511199),new a.init(528734635,4215389547),new a.init(1541459225,327033209)])},_doProcessBlock:function(t,e){for(var n=this._hash.words,r=n[0],o=n[1],i=n[2],a=n[3],s=n[4],c=n[5],p=n[6],l=n[7],h=r.high,d=r.low,m=o.high,y=o.low,g=i.high,v=i.low,b=a.high,_=a.low,w=s.high,x=s.low,k=c.high,B=c.low,S=p.high,C=p.low,A=l.high,F=l.low,I=h,N=d,O=m,D=y,P=g,T=v,E=b,R=_,H=w,M=x,j=k,L=B,q=S,z=C,U=A,W=F,J=0;80>J;J++){var G=f[J];if(16>J)var X=G.high=0|t[e+2*J],$=G.low=0|t[e+2*J+1];else{var V=f[J-15],K=V.high,Z=V.low,Y=(K>>>1|Z<<31)^(K>>>8|Z<<24)^K>>>7,Q=(Z>>>1|K<<31)^(Z>>>8|K<<24)^(Z>>>7|K<<25),tt=f[J-2],et=tt.high,nt=tt.low,rt=(et>>>19|nt<<13)^(et<<3|nt>>>29)^et>>>6,ot=(nt>>>19|et<<13)^(nt<<3|et>>>29)^(nt>>>6|et<<26),it=f[J-7],at=it.high,st=it.low,ct=f[J-16],ut=ct.high,ft=ct.low,$=Q+st,X=Y+at+(Q>>>0>$>>>0?1:0),$=$+ot,X=X+rt+(ot>>>0>$>>>0?1:0),$=$+ft,X=X+ut+(ft>>>0>$>>>0?1:0);G.high=X,G.low=$}var pt=H&j^~H&q,lt=M&L^~M&z,ht=I&O^I&P^O&P,dt=N&D^N&T^D&T,mt=(I>>>28|N<<4)^(I<<30|N>>>2)^(I<<25|N>>>7),yt=(N>>>28|I<<4)^(N<<30|I>>>2)^(N<<25|I>>>7),gt=(H>>>14|M<<18)^(H>>>18|M<<14)^(H<<23|M>>>9),vt=(M>>>14|H<<18)^(M>>>18|H<<14)^(M<<23|H>>>9),bt=u[J],_t=bt.high,wt=bt.low,xt=W+vt,kt=U+gt+(W>>>0>xt>>>0?1:0),xt=xt+lt,kt=kt+pt+(lt>>>0>xt>>>0?1:0),xt=xt+wt,kt=kt+_t+(wt>>>0>xt>>>0?1:0),xt=xt+$,kt=kt+X+($>>>0>xt>>>0?1:0),Bt=yt+dt,St=mt+ht+(yt>>>0>Bt>>>0?1:0);U=q,W=z,q=j,z=L,j=H,L=M,M=R+xt|0,H=E+kt+(R>>>0>M>>>0?1:0)|0,E=P,R=T,P=O,T=D,O=I,D=N,N=xt+Bt|0,I=kt+St+(xt>>>0>N>>>0?1:0)|0}d=r.low=d+N,r.high=h+I+(N>>>0>d>>>0?1:0),y=o.low=y+D,o.high=m+O+(D>>>0>y>>>0?1:0),v=i.low=v+T,i.high=g+P+(T>>>0>v>>>0?1:0),_=a.low=_+R,a.high=b+E+(R>>>0>_>>>0?1:0),x=s.low=x+M,s.high=w+H+(M>>>0>x>>>0?1:0),B=c.low=B+L,c.high=k+j+(L>>>0>B>>>0?1:0),C=p.low=C+z,p.high=S+q+(z>>>0>C>>>0?1:0),F=l.low=F+W,l.high=A+U+(W>>>0>F>>>0?1:0)},_doFinalize:function(){var t=this._data,e=t.words,n=8*this._nDataBytes,r=8*t.sigBytes;e[r>>>5]|=128<<24-r%32,e[(r+128>>>10<<5)+30]=Math.floor(n/4294967296),e[(r+128>>>10<<5)+31]=n,t.sigBytes=4*e.length,this._process();var o=this._hash.toX32();return o},clone:function(){var t=o.clone.call(this);return t._hash=this._hash.clone(),t},blockSize:32});n.SHA512=o._createHelper(p),n.HmacSHA512=o._createHmacHelper(p)}(),t.SHA512})},{"./core":51,"./x64-core":82}],81:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./enc-base64"),t("./md5"),t("./evpkdf"),t("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./enc-base64","./md5","./evpkdf","./cipher-core"],o):o(r.CryptoJS)}(this,function(t){return function(){function e(t,e){var n=(this._lBlock>>>t^this._rBlock)&e;this._rBlock^=n,this._lBlock^=n<<t}function n(t,e){var n=(this._rBlock>>>t^this._lBlock)&e;this._lBlock^=n,this._rBlock^=n<<t}var r=t,o=r.lib,i=o.WordArray,a=o.BlockCipher,s=r.algo,c=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4],u=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32],f=[1,2,4,6,8,10,12,14,15,17,19,21,23,25,27,28],p=[{0:8421888,268435456:32768,536870912:8421378,805306368:2,1073741824:512,1342177280:8421890,1610612736:8389122,1879048192:8388608,2147483648:514,2415919104:8389120,2684354560:33280,2952790016:8421376,3221225472:32770,3489660928:8388610,3758096384:0,4026531840:33282,134217728:0,402653184:8421890,671088640:33282,939524096:32768,1207959552:8421888,1476395008:512,1744830464:8421378,2013265920:2,2281701376:8389120,2550136832:33280,2818572288:8421376,3087007744:8389122,3355443200:8388610,3623878656:32770,3892314112:514,4160749568:8388608,1:32768,268435457:2,536870913:8421888,805306369:8388608,1073741825:8421378,1342177281:33280,1610612737:512,1879048193:8389122,2147483649:8421890,2415919105:8421376,2684354561:8388610,2952790017:33282,3221225473:514,3489660929:8389120,3758096385:32770,4026531841:0,134217729:8421890,402653185:8421376,671088641:8388608,939524097:512,1207959553:32768,1476395009:8388610,1744830465:2,2013265921:33282,2281701377:32770,2550136833:8389122,2818572289:514,3087007745:8421888,3355443201:8389120,3623878657:0,3892314113:33280,4160749569:8421378},{0:1074282512,16777216:16384,33554432:524288,50331648:1074266128,67108864:1073741840,83886080:1074282496,100663296:1073758208,117440512:16,134217728:540672,150994944:1073758224,167772160:1073741824,184549376:540688,201326592:524304,218103808:0,234881024:16400,251658240:1074266112,8388608:1073758208,25165824:540688,41943040:16,58720256:1073758224,75497472:1074282512,92274688:1073741824,109051904:524288,125829120:1074266128,142606336:524304,159383552:0,176160768:16384,192937984:1074266112,209715200:1073741840,226492416:540672,243269632:1074282496,260046848:16400,268435456:0,285212672:1074266128,301989888:1073758224,318767104:1074282496,335544320:1074266112,352321536:16,369098752:540688,385875968:16384,402653184:16400,419430400:524288,436207616:524304,452984832:1073741840,469762048:540672,486539264:1073758208,503316480:1073741824,520093696:1074282512,276824064:540688,293601280:524288,310378496:1074266112,327155712:16384,343932928:1073758208,360710144:1074282512,377487360:16,394264576:1073741824,411041792:1074282496,427819008:1073741840,444596224:1073758224,461373440:524304,478150656:0,494927872:16400,511705088:1074266128,528482304:540672},{0:260,1048576:0,2097152:67109120,3145728:65796,4194304:65540,5242880:67108868,6291456:67174660,7340032:67174400,8388608:67108864,9437184:67174656,10485760:65792,11534336:67174404,12582912:67109124,13631488:65536,14680064:4,15728640:256,524288:67174656,1572864:67174404,2621440:0,3670016:67109120,4718592:67108868,5767168:65536,6815744:65540,7864320:260,8912896:4,9961472:256,11010048:67174400,12058624:65796,13107200:65792,14155776:67109124,15204352:67174660,16252928:67108864,16777216:67174656,17825792:65540,18874368:65536,19922944:67109120,20971520:256,22020096:67174660,23068672:67108868,24117248:0,25165824:67109124,26214400:67108864,27262976:4,28311552:65792,29360128:67174400,30408704:260,31457280:65796,32505856:67174404,17301504:67108864,18350080:260,19398656:67174656,20447232:0,21495808:65540,22544384:67109120,23592960:256,24641536:67174404,25690112:65536,26738688:67174660,27787264:65796,28835840:67108868,29884416:67109124,30932992:67174400,31981568:4,33030144:65792},{0:2151682048,65536:2147487808,131072:4198464,196608:2151677952,262144:0,327680:4198400,393216:2147483712,458752:4194368,524288:2147483648,589824:4194304,655360:64,720896:2147487744,786432:2151678016,851968:4160,917504:4096,983040:2151682112,32768:2147487808,98304:64,163840:2151678016,229376:2147487744,294912:4198400,360448:2151682112,425984:0,491520:2151677952,557056:4096,622592:2151682048,688128:4194304,753664:4160,819200:2147483648,884736:4194368,950272:4198464,1015808:2147483712,1048576:4194368,1114112:4198400,1179648:2147483712,1245184:0,1310720:4160,1376256:2151678016,1441792:2151682048,1507328:2147487808,1572864:2151682112,1638400:2147483648,1703936:2151677952,1769472:4198464,1835008:2147487744,1900544:4194304,1966080:64,2031616:4096,1081344:2151677952,1146880:2151682112,1212416:0,1277952:4198400,1343488:4194368,1409024:2147483648,1474560:2147487808,1540096:64,1605632:2147483712,1671168:4096,1736704:2147487744,1802240:2151678016,1867776:4160,1933312:2151682048,1998848:4194304,2064384:4198464},{0:128,4096:17039360,8192:262144,12288:536870912,16384:537133184,20480:16777344,24576:553648256,28672:262272,32768:16777216,36864:537133056,40960:536871040,45056:553910400,49152:553910272,53248:0,57344:17039488,61440:553648128,2048:17039488,6144:553648256,10240:128,14336:17039360,18432:262144,22528:537133184,26624:553910272,30720:536870912,34816:537133056,38912:0,43008:553910400,47104:16777344,51200:536871040,55296:553648128,59392:16777216,63488:262272,65536:262144,69632:128,73728:536870912,77824:553648256,81920:16777344,86016:553910272,90112:537133184,94208:16777216,98304:553910400,102400:553648128,106496:17039360,110592:537133056,114688:262272,118784:536871040,122880:0,126976:17039488,67584:553648256,71680:16777216,75776:17039360,79872:537133184,83968:536870912,88064:17039488,92160:128,96256:553910272,100352:262272,104448:553910400,108544:0,112640:553648128,116736:16777344,120832:262144,124928:537133056,129024:536871040},{0:268435464,256:8192,512:270532608,768:270540808,1024:268443648,1280:2097152,1536:2097160,1792:268435456,2048:0,2304:268443656,2560:2105344,2816:8,3072:270532616,3328:2105352,3584:8200,3840:270540800,128:270532608,384:270540808,640:8,896:2097152,1152:2105352,1408:268435464,1664:268443648,1920:8200,2176:2097160,2432:8192,2688:268443656,2944:270532616,3200:0,3456:270540800,3712:2105344,3968:268435456,4096:268443648,4352:270532616,4608:270540808,4864:8200,5120:2097152,5376:268435456,5632:268435464,5888:2105344,6144:2105352,6400:0,6656:8,6912:270532608,7168:8192,7424:268443656,7680:270540800,7936:2097160,4224:8,4480:2105344,4736:2097152,4992:268435464,5248:268443648,5504:8200,5760:270540808,6016:270532608,6272:270540800,6528:270532616,6784:8192,7040:2105352,7296:2097160,7552:0,7808:268435456,8064:268443656},{0:1048576,16:33555457,32:1024,48:1049601,64:34604033,80:0,96:1,112:34603009,128:33555456,144:1048577,160:33554433,176:34604032,192:34603008,208:1025,224:1049600,240:33554432,8:34603009,24:0,40:33555457,56:34604032,72:1048576,88:33554433,104:33554432,120:1025,136:1049601,152:33555456,168:34603008,184:1048577,200:1024,216:34604033,232:1,248:1049600,256:33554432,272:1048576,288:33555457,304:34603009,320:1048577,336:33555456,352:34604032,368:1049601,384:1025,400:34604033,416:1049600,432:1,448:0,464:34603008,480:33554433,496:1024,264:1049600,280:33555457,296:34603009,312:1,328:33554432,344:1048576,360:1025,376:34604032,392:33554433,408:34603008,424:0,440:34604033,456:1049601,472:1024,488:33555456,504:1048577},{0:134219808,1:131072,2:134217728,3:32,4:131104,5:134350880,6:134350848,7:2048,8:134348800,9:134219776,10:133120,11:134348832,12:2080,13:0,14:134217760,15:133152,2147483648:2048,2147483649:134350880,2147483650:134219808,2147483651:134217728,2147483652:134348800,2147483653:133120,2147483654:133152,2147483655:32,2147483656:134217760,2147483657:2080,2147483658:131104,2147483659:134350848,2147483660:0,2147483661:134348832,2147483662:134219776,2147483663:131072,16:133152,17:134350848,18:32,19:2048,20:134219776,21:134217760,22:134348832,23:131072,24:0,25:131104,26:134348800,27:134219808,28:134350880,29:133120,30:2080,31:134217728,2147483664:131072,2147483665:2048,2147483666:134348832,2147483667:133152,2147483668:32,2147483669:134348800,2147483670:134217728,2147483671:134219808,2147483672:134350880,2147483673:134217760,2147483674:134219776,2147483675:0,2147483676:133120,2147483677:2080,2147483678:131104,2147483679:134350848}],l=[4160749569,528482304,33030144,2064384,129024,8064,504,2147483679],h=s.DES=a.extend({_doReset:function(){for(var t=this._key,e=t.words,n=[],r=0;56>r;r++){var o=c[r]-1;n[r]=e[o>>>5]>>>31-o%32&1}for(var i=this._subKeys=[],a=0;16>a;a++){for(var s=i[a]=[],p=f[a],r=0;24>r;r++)s[r/6|0]|=n[(u[r]-1+p)%28]<<31-r%6,s[4+(r/6|0)]|=n[28+(u[r+24]-1+p)%28]<<31-r%6;s[0]=s[0]<<1|s[0]>>>31;for(var r=1;7>r;r++)s[r]=s[r]>>>4*(r-1)+3;s[7]=s[7]<<5|s[7]>>>27}for(var l=this._invSubKeys=[],r=0;16>r;r++)l[r]=i[15-r]},encryptBlock:function(t,e){this._doCryptBlock(t,e,this._subKeys)},decryptBlock:function(t,e){this._doCryptBlock(t,e,this._invSubKeys)},_doCryptBlock:function(t,r,o){this._lBlock=t[r],this._rBlock=t[r+1],e.call(this,4,252645135),e.call(this,16,65535),n.call(this,2,858993459),n.call(this,8,16711935),e.call(this,1,1431655765);for(var i=0;16>i;i++){for(var a=o[i],s=this._lBlock,c=this._rBlock,u=0,f=0;8>f;f++)u|=p[f][((c^a[f])&l[f])>>>0];this._lBlock=c,this._rBlock=s^u}var h=this._lBlock;this._lBlock=this._rBlock,this._rBlock=h,e.call(this,1,1431655765),n.call(this,8,16711935),n.call(this,2,858993459),e.call(this,16,65535),e.call(this,4,252645135),t[r]=this._lBlock,t[r+1]=this._rBlock},keySize:2,ivSize:2,blockSize:2});r.DES=a._createHelper(h);var d=s.TripleDES=a.extend({_doReset:function(){var t=this._key,e=t.words;this._des1=h.createEncryptor(i.create(e.slice(0,2))),this._des2=h.createEncryptor(i.create(e.slice(2,4))),this._des3=h.createEncryptor(i.create(e.slice(4,6)))},encryptBlock:function(t,e){this._des1.encryptBlock(t,e),this._des2.decryptBlock(t,e),this._des3.encryptBlock(t,e)},decryptBlock:function(t,e){this._des3.decryptBlock(t,e),this._des2.encryptBlock(t,e),this._des1.decryptBlock(t,e)},keySize:6,ivSize:2,blockSize:2});r.TripleDES=a._createHelper(d)}(),t.TripleDES})},{"./cipher-core":50,"./core":51,"./enc-base64":52,"./evpkdf":54,"./md5":59}],82:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(e){var n=t,r=n.lib,o=r.Base,i=r.WordArray,a=n.x64={};a.Word=o.extend({init:function(t,e){this.high=t,this.low=e}}),a.WordArray=o.extend({init:function(t,n){t=this.words=t||[],n!=e?this.sigBytes=n:this.sigBytes=8*t.length},toX32:function(){for(var t=this.words,e=t.length,n=[],r=0;e>r;r++){var o=t[r];n.push(o.high),n.push(o.low)}return i.create(n,this.sigBytes)},clone:function(){for(var t=o.clone.call(this),e=t.words=this.words.slice(0),n=e.length,r=0;n>r;r++)e[r]=e[r].clone();return t}})}(),t})},{"./core":51}],83:[function(t,e,n){!function(t){function r(t){for(var e,n,r=[],o=0,i=t.length;i>o;)e=t.charCodeAt(o++),e>=55296&&56319>=e&&i>o?(n=t.charCodeAt(o++),56320==(64512&n)?r.push(((1023&e)<<10)+(1023&n)+65536):(r.push(e),o--)):r.push(e);return r}function o(t){for(var e,n=t.length,r=-1,o="";++r<n;)e=t[r],e>65535&&(e-=65536,o+=v(e>>>10&1023|55296),e=56320|1023&e),o+=v(e);return o}function i(t){if(t>=55296&&57343>=t)throw Error("Lone surrogate U+"+t.toString(16).toUpperCase()+" is not a scalar value")}function a(t,e){return v(t>>e&63|128)}function s(t){if(0==(4294967168&t))return v(t);var e="";return 0==(4294965248&t)?e=v(t>>6&31|192):0==(4294901760&t)?(i(t),e=v(t>>12&15|224),e+=a(t,6)):0==(4292870144&t)&&(e=v(t>>18&7|240),e+=a(t,12),e+=a(t,6)),e+=v(63&t|128)}function c(t){for(var e,n=r(t),o=n.length,i=-1,a="";++i<o;)e=n[i],a+=s(e);return a}function u(){if(g>=y)throw Error("Invalid byte index");var t=255&m[g];if(g++,128==(192&t))return 63&t;throw Error("Invalid continuation byte")}function f(){var t,e,n,r,o;if(g>y)throw Error("Invalid byte index");if(g==y)return!1;if(t=255&m[g],g++,0==(128&t))return t;if(192==(224&t)){var e=u();if(o=(31&t)<<6|e,o>=128)return o;throw Error("Invalid continuation byte")}if(224==(240&t)){if(e=u(),n=u(),o=(15&t)<<12|e<<6|n,o>=2048)return i(o),o;throw Error("Invalid continuation byte")}if(240==(248&t)&&(e=u(),n=u(),r=u(),o=(15&t)<<18|e<<12|n<<6|r,o>=65536&&1114111>=o))return o;throw Error("Invalid UTF-8 detected")}function p(t){m=r(t),y=m.length,g=0;for(var e,n=[];(e=f())!==!1;)n.push(e);return o(n)}var l="object"==typeof n&&n,h="object"==typeof e&&e&&e.exports==l&&e,d="object"==typeof global&&global;(d.global===d||d.window===d)&&(t=d);var m,y,g,v=String.fromCharCode,b={version:"2.0.0",encode:c,decode:p};if("function"==typeof define&&"object"==typeof define.amd&&define.amd)define(function(){return b});else if(l&&!l.nodeType)if(h)h.exports=b;else{var _={},w=_.hasOwnProperty;for(var x in b)w.call(b,x)&&(l[x]=b[x])}else t.utf8=b}(this)},{}],"bignumber.js":[function(t,e,n){!function(n){"use strict";function r(t){function e(t,r){var o,i,a,s,c,u,f=this;if(!(f instanceof e))return W&&D(26,"constructor call without new",t),new e(t,r);if(null!=r&&J(r,2,64,E,"base")){if(r=0|r,u=t+"",10==r)return f=new e(t instanceof e?t:u),P(f,M+f.e+1,j);if((s="number"==typeof t)&&0*t!=0||!new RegExp("^-?"+(o="["+x.slice(0,r)+"]+")+"(?:\\."+o+")?$",37>r?"i":"").test(u))return m(f,u,s,r);s?(f.s=0>1/t?(u=u.slice(1),-1):1,W&&u.replace(/^0\.0*|\./,"").length>15&&D(E,w,t),s=!1):f.s=45===u.charCodeAt(0)?(u=u.slice(1),-1):1,u=n(u,10,r,f.s)}else{if(t instanceof e)return f.s=t.s,f.e=t.e,f.c=(t=t.c)?t.slice():t,void(E=0);if((s="number"==typeof t)&&0*t==0){if(f.s=0>1/t?(t=-t,-1):1,t===~~t){for(i=0,a=t;a>=10;a/=10,i++);return f.e=i,f.c=[t],void(E=0)}u=t+""}else{if(!y.test(u=t+""))return m(f,u,s);f.s=45===u.charCodeAt(0)?(u=u.slice(1),-1):1}}for((i=u.indexOf("."))>-1&&(u=u.replace(".","")),(a=u.search(/e/i))>0?(0>i&&(i=a),i+=+u.slice(a+1),u=u.substring(0,a)):0>i&&(i=u.length),a=0;48===u.charCodeAt(a);a++);for(c=u.length;48===u.charCodeAt(--c););if(u=u.slice(a,c+1))if(c=u.length,s&&W&&c>15&&D(E,w,f.s*t),i=i-a-1,i>U)f.c=f.e=null;else if(z>i)f.c=[f.e=0];else{if(f.e=i,f.c=[],a=(i+1)%B,0>i&&(a+=B),c>a){for(a&&f.c.push(+u.slice(0,a)),c-=B;c>a;)f.c.push(+u.slice(a,a+=B));u=u.slice(a),a=B-u.length}else a-=c;for(;a--;u+="0");f.c.push(+u)}else f.c=[f.e=0];E=0}function n(t,n,r,o){var a,s,c,f,l,h,d,m=t.indexOf("."),y=M,g=j;for(37>r&&(t=t.toLowerCase()),m>=0&&(c=$,$=0,t=t.replace(".",""),d=new e(r),l=d.pow(t.length-m),$=c,d.c=u(p(i(l.c),l.e),10,n),d.e=d.c.length),h=u(t,r,n),s=c=h.length;0==h[--c];h.pop());if(!h[0])return"0";if(0>m?--s:(l.c=h,l.e=s,l.s=o,l=T(l,d,y,g,n),h=l.c,f=l.r,s=l.e),a=s+y+1,m=h[a],c=n/2,f=f||0>a||null!=h[a+1],f=4>g?(null!=m||f)&&(0==g||g==(l.s<0?3:2)):m>c||m==c&&(4==g||f||6==g&&1&h[a-1]||g==(l.s<0?8:7)),1>a||!h[0])t=f?p("1",-y):"0";else{if(h.length=a,f)for(--n;++h[--a]>n;)h[a]=0,a||(++s,h.unshift(1));for(c=h.length;!h[--c];);for(m=0,t="";c>=m;t+=x.charAt(h[m++]));t=p(t,s)}return t}function h(t,n,r,o){var a,s,c,u,l;if(r=null!=r&&J(r,0,8,o,_)?0|r:j,!t.c)return t.toString();if(a=t.c[0],c=t.e,null==n)l=i(t.c),l=19==o||24==o&&L>=c?f(l,c):p(l,c);else if(t=P(new e(t),n,r),s=t.e,l=i(t.c),u=l.length,19==o||24==o&&(s>=n||L>=s)){for(;n>u;l+="0",u++);l=f(l,s)}else if(n-=c,l=p(l,s),s+1>u){if(--n>0)for(l+=".";n--;l+="0");}else if(n+=s-u,n>0)for(s+1==u&&(l+=".");n--;l+="0");return t.s<0&&a?"-"+l:l}function I(t,n){var r,o,i=0;for(c(t[0])&&(t=t[0]),r=new e(t[0]);++i<t.length;){if(o=new e(t[i]),!o.s){r=o;break}n.call(r,o)&&(r=o)}return r}function N(t,e,n,r,o){return(e>t||t>n||t!=l(t))&&D(r,(o||"decimal places")+(e>t||t>n?" out of range":" not an integer"),t),!0}function O(t,e,n){for(var r=1,o=e.length;!e[--o];e.pop());for(o=e[0];o>=10;o/=10,r++);return(n=r+n*B-1)>U?t.c=t.e=null:z>n?t.c=[t.e=0]:(t.e=n,t.c=e),t}function D(t,e,n){var r=new Error(["new BigNumber","cmp","config","div","divToInt","eq","gt","gte","lt","lte","minus","mod","plus","precision","random","round","shift","times","toDigits","toExponential","toFixed","toFormat","toFraction","pow","toPrecision","toString","BigNumber"][t]+"() "+e+": "+n);throw r.name="BigNumber Error",E=0,r}function P(t,e,n,r){var o,i,a,s,c,u,f,p=t.c,l=C;if(p){t:{for(o=1,s=p[0];s>=10;s/=10,o++);if(i=e-o,0>i)i+=B,a=e,c=p[u=0],f=c/l[o-a-1]%10|0;else if(u=g((i+1)/B),u>=p.length){if(!r)break t;for(;p.length<=u;p.push(0));c=f=0,o=1,i%=B,a=i-B+1}else{for(c=s=p[u],o=1;s>=10;s/=10,o++);i%=B,a=i-B+o,f=0>a?0:c/l[o-a-1]%10|0}if(r=r||0>e||null!=p[u+1]||(0>a?c:c%l[o-a-1]),r=4>n?(f||r)&&(0==n||n==(t.s<0?3:2)):f>5||5==f&&(4==n||r||6==n&&(i>0?a>0?c/l[o-a]:0:p[u-1])%10&1||n==(t.s<0?8:7)),1>e||!p[0])return p.length=0,r?(e-=t.e+1,p[0]=l[e%B],t.e=-e||0):p[0]=t.e=0,t;if(0==i?(p.length=u,s=1,u--):(p.length=u+1,s=l[B-i],p[u]=a>0?v(c/l[o-a]%l[a])*s:0),r)for(;;){if(0==u){for(i=1,a=p[0];a>=10;a/=10,i++);for(a=p[0]+=s,s=1;a>=10;a/=10,s++);i!=s&&(t.e++,p[0]==k&&(p[0]=1));break}if(p[u]+=s,p[u]!=k)break;p[u--]=0,s=1}for(i=p.length;0===p[--i];p.pop());}t.e>U?t.c=t.e=null:t.e<z&&(t.c=[t.e=0])}return t}var T,E=0,R=e.prototype,H=new e(1),M=20,j=4,L=-7,q=21,z=-1e7,U=1e7,W=!0,J=N,G=!1,X=1,$=100,V={decimalSeparator:".",groupSeparator:",",groupSize:3,secondaryGroupSize:0,fractionGroupSeparator:" ",fractionGroupSize:0};return e.another=r,e.ROUND_UP=0,e.ROUND_DOWN=1,e.ROUND_CEIL=2,e.ROUND_FLOOR=3,e.ROUND_HALF_UP=4,e.ROUND_HALF_DOWN=5,e.ROUND_HALF_EVEN=6,e.ROUND_HALF_CEIL=7,e.ROUND_HALF_FLOOR=8,e.EUCLID=9,e.config=function(){var t,e,n=0,r={},o=arguments,i=o[0],a=i&&"object"==typeof i?function(){return i.hasOwnProperty(e)?null!=(t=i[e]):void 0}:function(){return o.length>n?null!=(t=o[n++]):void 0};return a(e="DECIMAL_PLACES")&&J(t,0,F,2,e)&&(M=0|t),r[e]=M,a(e="ROUNDING_MODE")&&J(t,0,8,2,e)&&(j=0|t),r[e]=j,a(e="EXPONENTIAL_AT")&&(c(t)?J(t[0],-F,0,2,e)&&J(t[1],0,F,2,e)&&(L=0|t[0],q=0|t[1]):J(t,-F,F,2,e)&&(L=-(q=0|(0>t?-t:t)))),r[e]=[L,q],a(e="RANGE")&&(c(t)?J(t[0],-F,-1,2,e)&&J(t[1],1,F,2,e)&&(z=0|t[0],U=0|t[1]):J(t,-F,F,2,e)&&(0|t?z=-(U=0|(0>t?-t:t)):W&&D(2,e+" cannot be zero",t))),r[e]=[z,U],a(e="ERRORS")&&(t===!!t||1===t||0===t?(E=0,J=(W=!!t)?N:s):W&&D(2,e+b,t)),r[e]=W,a(e="CRYPTO")&&(t===!!t||1===t||0===t?(G=!(!t||!d||"object"!=typeof d),t&&!G&&W&&D(2,"crypto unavailable",d)):W&&D(2,e+b,t)),r[e]=G,a(e="MODULO_MODE")&&J(t,0,9,2,e)&&(X=0|t),r[e]=X,a(e="POW_PRECISION")&&J(t,0,F,2,e)&&($=0|t),r[e]=$,a(e="FORMAT")&&("object"==typeof t?V=t:W&&D(2,e+" not an object",t)),r[e]=V,r},e.max=function(){return I(arguments,R.lt)},e.min=function(){return I(arguments,R.gt)},e.random=function(){var t=9007199254740992,n=Math.random()*t&2097151?function(){return v(Math.random()*t)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)};return function(t){var r,o,i,a,s,c=0,u=[],f=new e(H);if(t=null!=t&&J(t,0,F,14)?0|t:M,a=g(t/B),G)if(d&&d.getRandomValues){for(r=d.getRandomValues(new Uint32Array(a*=2));a>c;)s=131072*r[c]+(r[c+1]>>>11),s>=9e15?(o=d.getRandomValues(new Uint32Array(2)),r[c]=o[0],r[c+1]=o[1]):(u.push(s%1e14),c+=2);c=a/2}else if(d&&d.randomBytes){for(r=d.randomBytes(a*=7);a>c;)s=281474976710656*(31&r[c])+1099511627776*r[c+1]+4294967296*r[c+2]+16777216*r[c+3]+(r[c+4]<<16)+(r[c+5]<<8)+r[c+6],s>=9e15?d.randomBytes(7).copy(r,c):(u.push(s%1e14),c+=7);c=a/7}else W&&D(14,"crypto unavailable",d);if(!c)for(;a>c;)s=n(),9e15>s&&(u[c++]=s%1e14);for(a=u[--c],t%=B,a&&t&&(s=C[B-t],u[c]=v(a/s)*s);0===u[c];u.pop(),c--);if(0>c)u=[i=0];else{for(i=-1;0===u[0];u.shift(),i-=B);for(c=1,s=u[0];s>=10;s/=10,c++);B>c&&(i-=B-c)}return f.e=i,f.c=u,f}}(),T=function(){function t(t,e,n){var r,o,i,a,s=0,c=t.length,u=e%A,f=e/A|0;for(t=t.slice();c--;)i=t[c]%A,a=t[c]/A|0,r=f*i+a*u,o=u*i+r%A*A+s,s=(o/n|0)+(r/A|0)+f*a,t[c]=o%n;return s&&t.unshift(s),t}function n(t,e,n,r){var o,i;if(n!=r)i=n>r?1:-1;else for(o=i=0;n>o;o++)if(t[o]!=e[o]){i=t[o]>e[o]?1:-1;break}return i}function r(t,e,n,r){for(var o=0;n--;)t[n]-=o,o=t[n]<e[n]?1:0,t[n]=o*r+t[n]-e[n];for(;!t[0]&&t.length>1;t.shift());}return function(i,a,s,c,u){var f,p,l,h,d,m,y,g,b,_,w,x,S,C,A,F,I,N=i.s==a.s?1:-1,O=i.c,D=a.c;if(!(O&&O[0]&&D&&D[0]))return new e(i.s&&a.s&&(O?!D||O[0]!=D[0]:D)?O&&0==O[0]||!D?0*N:N/0:NaN);for(g=new e(N),b=g.c=[],p=i.e-a.e,N=s+p+1,u||(u=k,p=o(i.e/B)-o(a.e/B),N=N/B|0),l=0;D[l]==(O[l]||0);l++);if(D[l]>(O[l]||0)&&p--,0>N)b.push(1),h=!0;else{for(C=O.length,F=D.length,l=0,N+=2,d=v(u/(D[0]+1)),d>1&&(D=t(D,d,u),O=t(O,d,u),F=D.length,C=O.length),S=F,_=O.slice(0,F),w=_.length;F>w;_[w++]=0);I=D.slice(),I.unshift(0),A=D[0],D[1]>=u/2&&A++;do{if(d=0,f=n(D,_,F,w),0>f){if(x=_[0],F!=w&&(x=x*u+(_[1]||0)),d=v(x/A),d>1)for(d>=u&&(d=u-1),m=t(D,d,u),y=m.length,w=_.length;1==n(m,_,y,w);)d--,r(m,y>F?I:D,y,u),y=m.length,f=1;else 0==d&&(f=d=1),m=D.slice(),y=m.length;if(w>y&&m.unshift(0),r(_,m,w,u),w=_.length,-1==f)for(;n(D,_,F,w)<1;)d++,r(_,w>F?I:D,w,u),w=_.length}else 0===f&&(d++,_=[0]);b[l++]=d,_[0]?_[w++]=O[S]||0:(_=[O[S]],w=1)}while((S++<C||null!=_[0])&&N--);h=null!=_[0],b[0]||b.shift()}if(u==k){for(l=1,N=b[0];N>=10;N/=10,l++);P(g,s+(g.e=l+p*B-1)+1,c,h)}else g.e=p,g.r=+h;return g}}(),m=function(){var t=/^(-?)0([xbo])/i,n=/^([^.]+)\.$/,r=/^\.([^.]+)$/,o=/^-?(Infinity|NaN)$/,i=/^\s*\+|^\s+|\s+$/g;return function(a,s,c,u){var f,p=c?s:s.replace(i,"");if(o.test(p))a.s=isNaN(p)?null:0>p?-1:1;else{if(!c&&(p=p.replace(t,function(t,e,n){return f="x"==(n=n.toLowerCase())?16:"b"==n?2:8,u&&u!=f?t:e}),u&&(f=u,p=p.replace(n,"$1").replace(r,"0.$1")),s!=p))return new e(p,f);W&&D(E,"not a"+(u?" base "+u:"")+" number",s),a.s=null}a.c=a.e=null,E=0}}(),R.absoluteValue=R.abs=function(){var t=new e(this);return t.s<0&&(t.s=1),t},R.ceil=function(){return P(new e(this),this.e+1,2)},R.comparedTo=R.cmp=function(t,n){return E=1,a(this,new e(t,n))},R.decimalPlaces=R.dp=function(){var t,e,n=this.c;if(!n)return null;if(t=((e=n.length-1)-o(this.e/B))*B,e=n[e])for(;e%10==0;e/=10,t--);return 0>t&&(t=0),t},R.dividedBy=R.div=function(t,n){return E=3,T(this,new e(t,n),M,j)},R.dividedToIntegerBy=R.divToInt=function(t,n){return E=4,T(this,new e(t,n),0,1)},R.equals=R.eq=function(t,n){return E=5,0===a(this,new e(t,n))},R.floor=function(){return P(new e(this),this.e+1,3)},R.greaterThan=R.gt=function(t,n){return E=6,a(this,new e(t,n))>0},R.greaterThanOrEqualTo=R.gte=function(t,n){return E=7,1===(n=a(this,new e(t,n)))||0===n},R.isFinite=function(){return!!this.c},R.isInteger=R.isInt=function(){return!!this.c&&o(this.e/B)>this.c.length-2},R.isNaN=function(){return!this.s},R.isNegative=R.isNeg=function(){return this.s<0},R.isZero=function(){return!!this.c&&0==this.c[0]},R.lessThan=R.lt=function(t,n){return E=8,a(this,new e(t,n))<0},R.lessThanOrEqualTo=R.lte=function(t,n){return E=9,-1===(n=a(this,new e(t,n)))||0===n},R.minus=R.sub=function(t,n){var r,i,a,s,c=this,u=c.s;if(E=10,t=new e(t,n),n=t.s,!u||!n)return new e(NaN);if(u!=n)return t.s=-n,c.plus(t);var f=c.e/B,p=t.e/B,l=c.c,h=t.c;
if(!f||!p){if(!l||!h)return l?(t.s=-n,t):new e(h?c:NaN);if(!l[0]||!h[0])return h[0]?(t.s=-n,t):new e(l[0]?c:3==j?-0:0)}if(f=o(f),p=o(p),l=l.slice(),u=f-p){for((s=0>u)?(u=-u,a=l):(p=f,a=h),a.reverse(),n=u;n--;a.push(0));a.reverse()}else for(i=(s=(u=l.length)<(n=h.length))?u:n,u=n=0;i>n;n++)if(l[n]!=h[n]){s=l[n]<h[n];break}if(s&&(a=l,l=h,h=a,t.s=-t.s),n=(i=h.length)-(r=l.length),n>0)for(;n--;l[r++]=0);for(n=k-1;i>u;){if(l[--i]<h[i]){for(r=i;r&&!l[--r];l[r]=n);--l[r],l[i]+=k}l[i]-=h[i]}for(;0==l[0];l.shift(),--p);return l[0]?O(t,l,p):(t.s=3==j?-1:1,t.c=[t.e=0],t)},R.modulo=R.mod=function(t,n){var r,o,i=this;return E=11,t=new e(t,n),!i.c||!t.s||t.c&&!t.c[0]?new e(NaN):!t.c||i.c&&!i.c[0]?new e(i):(9==X?(o=t.s,t.s=1,r=T(i,t,0,3),t.s=o,r.s*=o):r=T(i,t,0,X),i.minus(r.times(t)))},R.negated=R.neg=function(){var t=new e(this);return t.s=-t.s||null,t},R.plus=R.add=function(t,n){var r,i=this,a=i.s;if(E=12,t=new e(t,n),n=t.s,!a||!n)return new e(NaN);if(a!=n)return t.s=-n,i.minus(t);var s=i.e/B,c=t.e/B,u=i.c,f=t.c;if(!s||!c){if(!u||!f)return new e(a/0);if(!u[0]||!f[0])return f[0]?t:new e(u[0]?i:0*a)}if(s=o(s),c=o(c),u=u.slice(),a=s-c){for(a>0?(c=s,r=f):(a=-a,r=u),r.reverse();a--;r.push(0));r.reverse()}for(a=u.length,n=f.length,0>a-n&&(r=f,f=u,u=r,n=a),a=0;n;)a=(u[--n]=u[n]+f[n]+a)/k|0,u[n]%=k;return a&&(u.unshift(a),++c),O(t,u,c)},R.precision=R.sd=function(t){var e,n,r=this,o=r.c;if(null!=t&&t!==!!t&&1!==t&&0!==t&&(W&&D(13,"argument"+b,t),t!=!!t&&(t=null)),!o)return null;if(n=o.length-1,e=n*B+1,n=o[n]){for(;n%10==0;n/=10,e--);for(n=o[0];n>=10;n/=10,e++);}return t&&r.e+1>e&&(e=r.e+1),e},R.round=function(t,n){var r=new e(this);return(null==t||J(t,0,F,15))&&P(r,~~t+this.e+1,null!=n&&J(n,0,8,15,_)?0|n:j),r},R.shift=function(t){var n=this;return J(t,-S,S,16,"argument")?n.times("1e"+l(t)):new e(n.c&&n.c[0]&&(-S>t||t>S)?n.s*(0>t?0:1/0):n)},R.squareRoot=R.sqrt=function(){var t,n,r,a,s,c=this,u=c.c,f=c.s,p=c.e,l=M+4,h=new e("0.5");if(1!==f||!u||!u[0])return new e(!f||0>f&&(!u||u[0])?NaN:u?c:1/0);if(f=Math.sqrt(+c),0==f||f==1/0?(n=i(u),(n.length+p)%2==0&&(n+="0"),f=Math.sqrt(n),p=o((p+1)/2)-(0>p||p%2),f==1/0?n="1e"+p:(n=f.toExponential(),n=n.slice(0,n.indexOf("e")+1)+p),r=new e(n)):r=new e(f+""),r.c[0])for(p=r.e,f=p+l,3>f&&(f=0);;)if(s=r,r=h.times(s.plus(T(c,s,l,1))),i(s.c).slice(0,f)===(n=i(r.c)).slice(0,f)){if(r.e<p&&--f,n=n.slice(f-3,f+1),"9999"!=n&&(a||"4999"!=n)){(!+n||!+n.slice(1)&&"5"==n.charAt(0))&&(P(r,r.e+M+2,1),t=!r.times(r).eq(c));break}if(!a&&(P(s,s.e+M+2,0),s.times(s).eq(c))){r=s;break}l+=4,f+=4,a=1}return P(r,r.e+M+1,j,t)},R.times=R.mul=function(t,n){var r,i,a,s,c,u,f,p,l,h,d,m,y,g,v,b=this,_=b.c,w=(E=17,t=new e(t,n)).c;if(!(_&&w&&_[0]&&w[0]))return!b.s||!t.s||_&&!_[0]&&!w||w&&!w[0]&&!_?t.c=t.e=t.s=null:(t.s*=b.s,_&&w?(t.c=[0],t.e=0):t.c=t.e=null),t;for(i=o(b.e/B)+o(t.e/B),t.s*=b.s,f=_.length,h=w.length,h>f&&(y=_,_=w,w=y,a=f,f=h,h=a),a=f+h,y=[];a--;y.push(0));for(g=k,v=A,a=h;--a>=0;){for(r=0,d=w[a]%v,m=w[a]/v|0,c=f,s=a+c;s>a;)p=_[--c]%v,l=_[c]/v|0,u=m*p+l*d,p=d*p+u%v*v+y[s]+r,r=(p/g|0)+(u/v|0)+m*l,y[s--]=p%g;y[s]=r}return r?++i:y.shift(),O(t,y,i)},R.toDigits=function(t,n){var r=new e(this);return t=null!=t&&J(t,1,F,18,"precision")?0|t:null,n=null!=n&&J(n,0,8,18,_)?0|n:j,t?P(r,t,n):r},R.toExponential=function(t,e){return h(this,null!=t&&J(t,0,F,19)?~~t+1:null,e,19)},R.toFixed=function(t,e){return h(this,null!=t&&J(t,0,F,20)?~~t+this.e+1:null,e,20)},R.toFormat=function(t,e){var n=h(this,null!=t&&J(t,0,F,21)?~~t+this.e+1:null,e,21);if(this.c){var r,o=n.split("."),i=+V.groupSize,a=+V.secondaryGroupSize,s=V.groupSeparator,c=o[0],u=o[1],f=this.s<0,p=f?c.slice(1):c,l=p.length;if(a&&(r=i,i=a,a=r,l-=r),i>0&&l>0){for(r=l%i||i,c=p.substr(0,r);l>r;r+=i)c+=s+p.substr(r,i);a>0&&(c+=s+p.slice(r)),f&&(c="-"+c)}n=u?c+V.decimalSeparator+((a=+V.fractionGroupSize)?u.replace(new RegExp("\\d{"+a+"}\\B","g"),"$&"+V.fractionGroupSeparator):u):c}return n},R.toFraction=function(t){var n,r,o,a,s,c,u,f,p,l=W,h=this,d=h.c,m=new e(H),y=r=new e(H),g=u=new e(H);if(null!=t&&(W=!1,c=new e(t),W=l,(!(l=c.isInt())||c.lt(H))&&(W&&D(22,"max denominator "+(l?"out of range":"not an integer"),t),t=!l&&c.c&&P(c,c.e+1,1).gte(H)?c:null)),!d)return h.toString();for(p=i(d),a=m.e=p.length-h.e-1,m.c[0]=C[(s=a%B)<0?B+s:s],t=!t||c.cmp(m)>0?a>0?m:y:c,s=U,U=1/0,c=new e(p),u.c[0]=0;f=T(c,m,0,1),o=r.plus(f.times(g)),1!=o.cmp(t);)r=g,g=o,y=u.plus(f.times(o=y)),u=o,m=c.minus(f.times(o=m)),c=o;return o=T(t.minus(r),g,0,1),u=u.plus(o.times(y)),r=r.plus(o.times(g)),u.s=y.s=h.s,a*=2,n=T(y,g,a,j).minus(h).abs().cmp(T(u,r,a,j).minus(h).abs())<1?[y.toString(),g.toString()]:[u.toString(),r.toString()],U=s,n},R.toNumber=function(){var t=this;return+t||(t.s?0*t.s:NaN)},R.toPower=R.pow=function(t){var n,r,o=v(0>t?-t:+t),i=this;if(!J(t,-S,S,23,"exponent")&&(!isFinite(t)||o>S&&(t/=0)||parseFloat(t)!=t&&!(t=NaN)))return new e(Math.pow(+i,t));for(n=$?g($/B+2):0,r=new e(H);;){if(o%2){if(r=r.times(i),!r.c)break;n&&r.c.length>n&&(r.c.length=n)}if(o=v(o/2),!o)break;i=i.times(i),n&&i.c&&i.c.length>n&&(i.c.length=n)}return 0>t&&(r=H.div(r)),n?P(r,$,j):r},R.toPrecision=function(t,e){return h(this,null!=t&&J(t,1,F,24,"precision")?0|t:null,e,24)},R.toString=function(t){var e,r=this,o=r.s,a=r.e;return null===a?o?(e="Infinity",0>o&&(e="-"+e)):e="NaN":(e=i(r.c),e=null!=t&&J(t,2,64,25,"base")?n(p(e,a),0|t,10,o):L>=a||a>=q?f(e,a):p(e,a),0>o&&r.c[0]&&(e="-"+e)),e},R.truncated=R.trunc=function(){return P(new e(this),this.e+1,1)},R.valueOf=R.toJSON=function(){return this.toString()},null!=t&&e.config(t),e}function o(t){var e=0|t;return t>0||t===e?e:e-1}function i(t){for(var e,n,r=1,o=t.length,i=t[0]+"";o>r;){for(e=t[r++]+"",n=B-e.length;n--;e="0"+e);i+=e}for(o=i.length;48===i.charCodeAt(--o););return i.slice(0,o+1||1)}function a(t,e){var n,r,o=t.c,i=e.c,a=t.s,s=e.s,c=t.e,u=e.e;if(!a||!s)return null;if(n=o&&!o[0],r=i&&!i[0],n||r)return n?r?0:-s:a;if(a!=s)return a;if(n=0>a,r=c==u,!o||!i)return r?0:!o^n?1:-1;if(!r)return c>u^n?1:-1;for(s=(c=o.length)<(u=i.length)?c:u,a=0;s>a;a++)if(o[a]!=i[a])return o[a]>i[a]^n?1:-1;return c==u?0:c>u^n?1:-1}function s(t,e,n){return(t=l(t))>=e&&n>=t}function c(t){return"[object Array]"==Object.prototype.toString.call(t)}function u(t,e,n){for(var r,o,i=[0],a=0,s=t.length;s>a;){for(o=i.length;o--;i[o]*=e);for(i[r=0]+=x.indexOf(t.charAt(a++));r<i.length;r++)i[r]>n-1&&(null==i[r+1]&&(i[r+1]=0),i[r+1]+=i[r]/n|0,i[r]%=n)}return i.reverse()}function f(t,e){return(t.length>1?t.charAt(0)+"."+t.slice(1):t)+(0>e?"e":"e+")+e}function p(t,e){var n,r;if(0>e){for(r="0.";++e;r+="0");t=r+t}else if(n=t.length,++e>n){for(r="0",e-=n;--e;r+="0");t+=r}else n>e&&(t=t.slice(0,e)+"."+t.slice(e));return t}function l(t){return t=parseFloat(t),0>t?g(t):v(t)}var h,d,m,y=/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,g=Math.ceil,v=Math.floor,b=" not a boolean or binary digit",_="rounding mode",w="number type has more than 15 significant digits",x="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_",k=1e14,B=14,S=9007199254740991,C=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],A=1e7,F=1e9;if(h=r(),"function"==typeof define&&define.amd)define(function(){return h});else if("undefined"!=typeof e&&e.exports){if(e.exports=h,!d)try{d=t("crypto")}catch(I){}}else n.BigNumber=h}(this)},{crypto:48}],web3:[function(t,e,n){var r=t("./lib/web3");"undefined"!=typeof window&&"undefined"==typeof window.Web3&&(window.Web3=r),e.exports=r},{"./lib/web3":22}]},{},["web3"]);



"use strict";

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { var object = _x2, property = _x3, receiver = _x4; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var factory = function factory(Promise, web3) {
  var Pudding = (function () {
    function Pudding(contract) {
      _classCallCheck(this, Pudding);

      if (!this.constructor.abi) {
        throw new Error("Contract ABI not set. Please inherit Pudding and set static .abi variable with contract abi.");
      }

      this.contract = contract;
      this.address = contract.address;

      if (!this.web3) {
        this.web3 = Pudding.web3;
      }

      if (!this.web3) {
        throw new Error("Please call Pudding.setWeb3() before using any Pudding class.");
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.constructor.abi[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var fn = _step.value;

          if (fn.type == "function") {
            if (fn.constant == true) {
              this[fn.name] = this.constructor.promisifyFunction(this.contract[fn.name]);
            } else {
              this[fn.name] = this.constructor.synchronizeFunction(this.contract[fn.name]);
            }

            this[fn.name].call = this.constructor.promisifyFunction(this.contract[fn.name].call);
            this[fn.name].sendTransaction = this.constructor.promisifyFunction(this.contract[fn.name].sendTransaction);
            this[fn.name].request = this.contract[fn.name].request;
          }

          if (fn.type == "event") {
            this[fn.name] = this.contract[fn.name];
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator["return"]) {
            _iterator["return"]();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.allEvents = this.contract.allEvents;
    }

    //

    _createClass(Pudding, null, [{
      key: "new",
      value: function _new() {
        var _this = this;

        var args = Array.prototype.slice.call(arguments);

        if (!this.binary) {
          throw new Error("Contract binary not set. Please override Pudding and set .binary before calling new()");
        }

        var self = this;

        return new Promise(function (accept, reject) {
          var contract_class = _this.web3.eth.contract(_this.abi);
          var tx_params = {};
          var last_arg = args[args.length - 1];

          // It's only tx_params if it's an object and not a BigNumber.
          if (_this.is_object(last_arg) && last_arg instanceof Pudding.BigNumber == false) {
            tx_params = args.pop();
          }

          tx_params = _this.merge(Pudding.class_defaults, _this.class_defaults, tx_params);

          if (tx_params.data == null) {
            tx_params.data = _this.binary;
          }

          // web3 0.9.0 and above calls new twice this callback twice.
          // Why, I have no idea...
          var intermediary = function intermediary(err, web3_instance) {
            if (err != null) {
              reject(err);
              return;
            }

            if (err == null && web3_instance != null && web3_instance.address != null) {
              accept(new self(web3_instance));
            }
          };

          args.push(tx_params, intermediary);

          contract_class["new"].apply(contract_class, args);
        });
      }
    }, {
      key: "at",
      value: function at(address) {
        var contract_class = this.web3.eth.contract(this.abi);
        var contract = contract_class.at(address);
        return new this(contract);
      }
    }, {
      key: "deployed",
      value: function deployed() {
        if (!this.address) {
          throw new Error("Contract address not set - deployed() relies on the contract class having a static 'address' value; please set that before using deployed().");
        }

        return this.at(this.address);
      }

      // Backward compatibility.
    }, {
      key: "extend",
      value: function extend() {
        var args = Array.prototype.slice.call(arguments);

        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = arguments[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var object = _step2.value;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = Object.keys(object)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var key = _step3.value;

                var value = object[key];
                this.prototype[key] = value;
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3["return"]) {
                  _iterator3["return"]();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
              _iterator2["return"]();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      // Backward compatibility.
    }, {
      key: "whisk",
      value: function whisk(abi, binary) {
        var defaults = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        var Contract = (function (_ref) {
          _inherits(Contract, _ref);

          function Contract() {
            _classCallCheck(this, Contract);

            _get(Object.getPrototypeOf(Contract.prototype), "constructor", this).apply(this, arguments);
          }

          return Contract;
        })(this);

        ;
        Contract.abi = abi;
        Contract.binary = binary;
        Contract.class_defaults = defaults;
        return Contract;
      }
    }, {
      key: "defaults",
      value: function defaults(class_defaults) {
        if (this.class_defaults == null) {
          this.class_defaults = {};
        }

        if (class_defaults == null) {
          class_defaults = {};
        }

        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = Object.keys(class_defaults)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var key = _step4.value;

            var value = class_defaults[key];
            this.class_defaults[key] = value;
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4["return"]) {
              _iterator4["return"]();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }

        return this.class_defaults;
      }
    }, {
      key: "setWeb3",
      value: function setWeb3(web3) {
        this.web3 = web3;

        if (this.web3.toBigNumber == null) {
          throw new Error("Pudding.setWeb3() must be passed an instance of Web3 and not Web3 itself.");
        }

        this.BigNumber = this.web3.toBigNumber(0).constructor;
      }
    }, {
      key: "is_object",
      value: function is_object(val) {
        return typeof val == "object" && !(val instanceof Array);
      }
    }, {
      key: "merge",
      value: function merge() {
        var merged = {};
        var args = Array.prototype.slice.call(arguments);

        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = args[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var object = _step5.value;
            var _iteratorNormalCompletion6 = true;
            var _didIteratorError6 = false;
            var _iteratorError6 = undefined;

            try {
              for (var _iterator6 = Object.keys(object)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                var key = _step6.value;

                var value = object[key];
                merged[key] = value;
              }
            } catch (err) {
              _didIteratorError6 = true;
              _iteratorError6 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion6 && _iterator6["return"]) {
                  _iterator6["return"]();
                }
              } finally {
                if (_didIteratorError6) {
                  throw _iteratorError6;
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError5 = true;
          _iteratorError5 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion5 && _iterator5["return"]) {
              _iterator5["return"]();
            }
          } finally {
            if (_didIteratorError5) {
              throw _iteratorError5;
            }
          }
        }

        return merged;
      }
    }, {
      key: "promisifyFunction",
      value: function promisifyFunction(fn) {
        var self = this;
        return function () {
          var _this2 = this;

          var args = Array.prototype.slice.call(arguments);
          var tx_params = {};
          var last_arg = args[args.length - 1];

          // It's only tx_params if it's an object and not a BigNumber.
          if (self.is_object(last_arg) && last_arg instanceof Pudding.BigNumber == false) {
            tx_params = args.pop();
          }

          tx_params = self.merge(Pudding.class_defaults, self.class_defaults, tx_params);

          return new Promise(function (accept, reject) {
            var callback = function callback(error, result) {
              if (error != null) {
                reject(error);
              } else {
                accept(result);
              }
            };
            args.push(tx_params, callback);
            fn.apply(_this2.contract, args);
          });
        };
      }
    }, {
      key: "synchronizeFunction",
      value: function synchronizeFunction(fn) {
        var self = this;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var tx_params = {};
          var last_arg = args[args.length - 1];

          // It's only tx_params if it's an object and not a BigNumber.
          if (self.is_object(last_arg) && last_arg instanceof Pudding.BigNumber == false) {
            tx_params = args.pop();
          }

          tx_params = self.merge(Pudding.class_defaults, self.class_defaults, tx_params);

          return new Promise(function (accept, reject) {

            var callback = function callback(error, tx) {
              var interval = null;
              var max_attempts = 240;
              var attempts = 0;

              if (error != null) {
                reject(error);
                return;
              }

              var interval;

              var make_attempt = function make_attempt() {
                //console.log "Interval check //{attempts}..."
                self.web3.eth.getTransaction(tx, function (e, tx_info) {
                  // If there's an error ignore it.
                  if (e != null) {
                    return;
                  }

                  if (tx_info.blockHash != null) {
                    clearInterval(interval);
                    accept(tx);
                  }

                  if (attempts >= max_attempts) {
                    clearInterval(interval);
                    reject(new Error("Transaction " + tx + " wasn't processed in " + attempts + " attempts!"));
                  }

                  attempts += 1;
                });
              };

              interval = setInterval(make_attempt, 1000);
              make_attempt();
            };

            args.push(tx_params, callback);
            fn.apply(undefined, _toConsumableArray(args));
          });
        };
      }
    }, {
      key: "load",
      value: function load(factories, scope) {
        // Use the global scope if none specified.
        if (scope == null) {
          if (typeof module == "undefined") {
            scope = window;
          } else {
            scope = global;
          }
        }

        if (!(factories instanceof Array)) {
          factories = [factories];
        }

        var names = [];

        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;
        var _iteratorError7 = undefined;

        try {
          for (var _iterator7 = factories[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
            var factory = _step7.value;

            var result = factory(this);
            names.push(result.contract_name);
            scope[result.contract_name] = result;
          }
        } catch (err) {
          _didIteratorError7 = true;
          _iteratorError7 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion7 && _iterator7["return"]) {
              _iterator7["return"]();
            }
          } finally {
            if (_didIteratorError7) {
              throw _iteratorError7;
            }
          }
        }

        return names;
      }
    }]);

    return Pudding;
  })();

  ; // end class

  Pudding.class_defaults = {};
  Pudding.version = "1.0.3";

  return Pudding;
};

if (typeof module != "undefined") {
  module.exports = factory(require("bluebird"));
} else {
  // We expect Promise to already be included.
  window.Pudding = factory(Promise);
}


"use strict";

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var factory = function factory(Pudding) {
  // Inherit from Pudding. The dependency on Babel sucks, but it's
  // the easiest way to extend a Babel-based class. Note that the
  // resulting .js file does not have a dependency on Babel.

  var MetaCoin = (function (_Pudding) {
    _inherits(MetaCoin, _Pudding);

    function MetaCoin() {
      _classCallCheck(this, MetaCoin);

      _get(Object.getPrototypeOf(MetaCoin.prototype), "constructor", this).apply(this, arguments);
    }

    return MetaCoin;
  })(Pudding);

  ;

  // Set up specific data for this class.
  MetaCoin.abi = [{ "constant": false, "inputs": [{ "name": "receiver", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "sendCoin", "outputs": [{ "name": "sufficient", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "addr", "type": "address" }], "name": "getBalance", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "inputs": [], "type": "constructor" }];
  MetaCoin.binary = "6060604052600160a060020a03321660009081526020819052604090206127109055609f80602d6000396000f3606060405260e060020a600035046390b98a1181146024578063f8b2cb4f146050575b005b606c60043560243533600160a060020a0316600090815260208190526040812054829010156076576099565b600160a060020a03600435166000908152602081905260409020545b6060908152602090f35b604080822080548490039055600160a060020a0384168252902080548201905560015b9291505056";

  if ("0xf204d7cb2445fc36cb310e4e32e5471dde2a3490" != "") {
    MetaCoin.address = "0xf204d7cb2445fc36cb310e4e32e5471dde2a3490";

    // Backward compatibility; Deprecated.
    MetaCoin.deployed_address = "0xf204d7cb2445fc36cb310e4e32e5471dde2a3490";
  }

  MetaCoin.generated_with = "1.0.3";
  MetaCoin.contract_name = "MetaCoin";

  return MetaCoin;
};

// Nicety for Node.
factory.load = factory;

if (typeof module != "undefined") {
  module.exports = factory;
} else {
  // There will only be one version of Pudding in the browser,
  // and we can use that.
  window.MetaCoin = factory;
};

"use strict";

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var factory = function factory(Pudding) {
  // Inherit from Pudding. The dependency on Babel sucks, but it's
  // the easiest way to extend a Babel-based class. Note that the
  // resulting .js file does not have a dependency on Babel.

  var PublishedDocument = (function (_Pudding) {
    _inherits(PublishedDocument, _Pudding);

    function PublishedDocument() {
      _classCallCheck(this, PublishedDocument);

      _get(Object.getPrototypeOf(PublishedDocument.prototype), "constructor", this).apply(this, arguments);
    }

    return PublishedDocument;
  })(Pudding);

  ;

  // Set up specific data for this class.
  PublishedDocument.abi = [{ "inputs": [{ "name": "ipfsDocument", "type": "string" }], "type": "constructor" }];
  PublishedDocument.binary = "606060405260405160f038038060f08339810160405280510160605160008054600160a060020a0319163317815582516001805492819052926020601f6002600019868816156101000201909516949094048401047fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf69081019390916080019083901060b957805160ff19168380011785555b5060aa9291505b8082111560e6576000815583016099565b50505060068060ea6000396000f35b828001600101855582156092579182015b82811115609257825182600050559160200191906001019060ca565b509056606060405200";

  if ("" != "") {
    PublishedDocument.address = "";

    // Backward compatibility; Deprecated.
    PublishedDocument.deployed_address = "";
  }

  PublishedDocument.generated_with = "1.0.3";
  PublishedDocument.contract_name = "PublishedDocument";

  return PublishedDocument;
};

// Nicety for Node.
factory.load = factory;

if (typeof module != "undefined") {
  module.exports = factory;
} else {
  // There will only be one version of Pudding in the browser,
  // and we can use that.
  window.PublishedDocument = factory;
};

;



window.onload = function() {
  initFileAPI();
  initDropzone();
  initCrypto();
  initIpfs();
  initRequireJs();
  initWeb3();
}

function message(msg) {
  document.getElementById('message').innerHTML = msg;
}


var crypto,ipfs, Buffer, account;

function initFileAPI() {
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert("File API is not supported"); 
    }
};

function initDropzone() {
    var dropZone = document.getElementById('dropzone');
    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);
}

function initCrypto() {
    crypto = window.crypto || window.msCrypto;
    if(!crypto.subtle) {
        alert('Crypto API is not available!');
    }   
}

function initIpfs(){
    if(window.ipfsAPI){
        ipfs = window.ipfsAPI('localhost', '5001');    
    }else {
        alert('IPFS not available!');
    }
    
}

function initWeb3(){
    web3.eth.getAccounts(function(err, accs) {
    if (err != null) {
      message("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      message("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[0];
    document.getElementById('balance').textContent = web3.fromWei(web3.eth.getBalance(account)) + ' ETH';
  });
}

function initRequireJs(){
    requirejs.config({
        baseUrl: './',

        paths: {
            app: '../app'
        }
});

    // Start the main app logic.
    requirejs(['buffer'],
       function   (buffer) {
            Buffer = buffer.Buffer;
        }
    );
}

var reader, symKeyPromise;

function abortRead() {
  if(reader) {
    reader.abort();
  }
}

function initReader(progress) {
  reader = new FileReader();
  reader.onerror = errorHandler;
  reader.onprogress = updateProgress;

  reader.onloadstart = function(e) {
    document.getElementById('progressbar').className = 'loading';
  };

  reader.onload = function(e) {
    // Ensure that the progress bar displays 100% at the end.
    progress.style.width = '100%';
    progress.textContent = '100%';
    transitToStep2();
    message('wait for the key to be generated ...');
    symKeyPromise.then(encryptFile);
  }
}

function transitToStep2(){
  document.getElementById('progressbar').className='';
  document.getElementById('abort').className='';
  document.getElementById('message').className='';
  document.getElementById('dropzone').textContent='Document Ready!';
  document.getElementById('step2').className='step-active';
  var dropZone = document.getElementById('dropzone');
  dropZone.removeEventListener('dragover');
  dropZone.removeEventListener('drop');
}

function encryptFile(symKey) {
  message('encrypting file ...');
  var vector = crypto.getRandomValues(new Uint8Array(16));
  var encryptPromise = crypto.subtle.encrypt({name: "AES-CBC", iv: vector}, symKey, reader.result);

    encryptPromise.then(
        function(result){
          message('encryption done!');
          uploadFile(result);
        }, 
        function(e){
            message(e.message);
        }
    );

}

function processFile(file){
    var progress = document.querySelector('.percent');
    // Reset progress indicator on new file selection.
    progress.style.width = '0%';
    progress.textContent = '0%';

    initReader(progress);
    // Read in the image file as a binary string.
    reader.readAsArrayBuffer(file);
    message('reading file ...');
    symKeyPromise = generateSymKey();
    document.getElementById('abort').className='button-active';

}


function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.
    processFile(files[0]);
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function errorHandler(evt) {
    message(evt.target.error.message);
}

function encryptPart(evt) {
  var vector = crypto.getRandomValues(new Uint8Array(16)); 
}

function updateProgress(evt) {
    var progress = document.querySelector('.percent');
    // evt is an ProgressEvent.
    
    if (evt.lengthComputable) {
      var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
      // Increase the progress bar length.
      if (percentLoaded < 100) {
        progress.style.width = percentLoaded + '%';
        progress.textContent = percentLoaded + '%';
      }
    }
}

function generateSymKey(){
	return crypto.subtle.generateKey({name: "AES-CBC", length: 128}, false, ["encrypt", "decrypt"])
	.catch(function(){
		message('error while generating AES-CBC key');
	});
}



var ipfsAPI=function(modules){function __webpack_require__(moduleId){if(installedModules[moduleId])return installedModules[moduleId].exports;var module=installedModules[moduleId]={exports:{},id:moduleId,loaded:!1};return modules[moduleId].call(module.exports,module,module.exports,__webpack_require__),module.loaded=!0,module.exports}var installedModules={};return __webpack_require__.m=modules,__webpack_require__.c=installedModules,__webpack_require__.p="/_karma_webpack_//",__webpack_require__(0)}([function(module,exports,__webpack_require__){(function(Buffer){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}function IpfsAPI(host_or_multiaddr,port,opts){var config=getConfig();try{var maddr=multiaddr(host_or_multiaddr).nodeAddress();config.host=maddr.address,config.port=maddr.port}catch(e){"string"==typeof host_or_multiaddr&&(config.host=host_or_multiaddr,config.port=port&&"object"!==("undefined"==typeof port?"undefined":(0,_typeof3["default"])(port))?port:config.port)}for(var lastIndex=arguments.length;!opts&&lastIndex-- >0&&!(opts=arguments[lastIndex]););if((0,_assign2["default"])(config,opts),!config.host&&"undefined"!=typeof window){var split=window.location.host.split(":");config.host=split[0],config.port=split[1]}var requestAPI=getRequestAPI(config),cmds=loadCommands(requestAPI);return cmds.send=requestAPI,cmds.Buffer=Buffer,cmds}var _assign=__webpack_require__(123),_assign2=_interopRequireDefault(_assign),_typeof2=__webpack_require__(22),_typeof3=_interopRequireDefault(_typeof2),multiaddr=__webpack_require__(207),loadCommands=__webpack_require__(120),getConfig=__webpack_require__(118),getRequestAPI=__webpack_require__(121);exports=module.exports=IpfsAPI}).call(exports,__webpack_require__(2).Buffer)},function(module,exports){function cleanUpNextTick(){draining=!1,currentQueue.length?queue=currentQueue.concat(queue):queueIndex=-1,queue.length&&drainQueue()}function drainQueue(){if(!draining){var timeout=setTimeout(cleanUpNextTick);draining=!0;for(var len=queue.length;len;){for(currentQueue=queue,queue=[];++queueIndex<len;)currentQueue&&currentQueue[queueIndex].run();queueIndex=-1,len=queue.length}currentQueue=null,draining=!1,clearTimeout(timeout)}}function Item(fun,array){this.fun=fun,this.array=array}function noop(){}var currentQueue,process=module.exports={},queue=[],draining=!1,queueIndex=-1;process.nextTick=function(fun){var args=new Array(arguments.length-1);if(arguments.length>1)for(var i=1;i<arguments.length;i++)args[i-1]=arguments[i];queue.push(new Item(fun,args)),1!==queue.length||draining||setTimeout(drainQueue,0)},Item.prototype.run=function(){this.fun.apply(null,this.array)},process.title="browser",process.browser=!0,process.env={},process.argv=[],process.version="",process.versions={},process.on=noop,process.addListener=noop,process.once=noop,process.off=noop,process.removeListener=noop,process.removeAllListeners=noop,process.emit=noop,process.binding=function(name){throw new Error("process.binding is not supported")},process.cwd=function(){return"/"},process.chdir=function(dir){throw new Error("process.chdir is not supported")},process.umask=function(){return 0}},function(module,exports,__webpack_require__){(function(Buffer,global){/*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
   * @license  MIT
   */
"use strict";function typedArraySupport(){function Bar(){}try{var arr=new Uint8Array(1);return arr.foo=function(){return 42},arr.constructor=Bar,42===arr.foo()&&arr.constructor===Bar&&"function"==typeof arr.subarray&&0===arr.subarray(1,1).byteLength}catch(e){return!1}}function kMaxLength(){return Buffer.TYPED_ARRAY_SUPPORT?2147483647:1073741823}function Buffer(arg){return this instanceof Buffer?(Buffer.TYPED_ARRAY_SUPPORT||(this.length=0,this.parent=void 0),"number"==typeof arg?fromNumber(this,arg):"string"==typeof arg?fromString(this,arg,arguments.length>1?arguments[1]:"utf8"):fromObject(this,arg)):arguments.length>1?new Buffer(arg,arguments[1]):new Buffer(arg)}function fromNumber(that,length){if(that=allocate(that,0>length?0:0|checked(length)),!Buffer.TYPED_ARRAY_SUPPORT)for(var i=0;length>i;i++)that[i]=0;return that}function fromString(that,string,encoding){("string"!=typeof encoding||""===encoding)&&(encoding="utf8");var length=0|byteLength(string,encoding);return that=allocate(that,length),that.write(string,encoding),that}function fromObject(that,object){if(Buffer.isBuffer(object))return fromBuffer(that,object);if(isArray(object))return fromArray(that,object);if(null==object)throw new TypeError("must start with number, buffer, array or string");if("undefined"!=typeof ArrayBuffer){if(object.buffer instanceof ArrayBuffer)return fromTypedArray(that,object);if(object instanceof ArrayBuffer)return fromArrayBuffer(that,object)}return object.length?fromArrayLike(that,object):fromJsonObject(that,object)}function fromBuffer(that,buffer){var length=0|checked(buffer.length);return that=allocate(that,length),buffer.copy(that,0,0,length),that}function fromArray(that,array){var length=0|checked(array.length);that=allocate(that,length);for(var i=0;length>i;i+=1)that[i]=255&array[i];return that}function fromTypedArray(that,array){var length=0|checked(array.length);that=allocate(that,length);for(var i=0;length>i;i+=1)that[i]=255&array[i];return that}function fromArrayBuffer(that,array){return Buffer.TYPED_ARRAY_SUPPORT?(array.byteLength,that=Buffer._augment(new Uint8Array(array))):that=fromTypedArray(that,new Uint8Array(array)),that}function fromArrayLike(that,array){var length=0|checked(array.length);that=allocate(that,length);for(var i=0;length>i;i+=1)that[i]=255&array[i];return that}function fromJsonObject(that,object){var array,length=0;"Buffer"===object.type&&isArray(object.data)&&(array=object.data,length=0|checked(array.length)),that=allocate(that,length);for(var i=0;length>i;i+=1)that[i]=255&array[i];return that}function allocate(that,length){Buffer.TYPED_ARRAY_SUPPORT?(that=Buffer._augment(new Uint8Array(length)),that.__proto__=Buffer.prototype):(that.length=length,that._isBuffer=!0);var fromPool=0!==length&&length<=Buffer.poolSize>>>1;return fromPool&&(that.parent=rootParent),that}function checked(length){if(length>=kMaxLength())throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+kMaxLength().toString(16)+" bytes");return 0|length}function SlowBuffer(subject,encoding){if(!(this instanceof SlowBuffer))return new SlowBuffer(subject,encoding);var buf=new Buffer(subject,encoding);return delete buf.parent,buf}function byteLength(string,encoding){"string"!=typeof string&&(string=""+string);var len=string.length;if(0===len)return 0;for(var loweredCase=!1;;)switch(encoding){case"ascii":case"binary":case"raw":case"raws":return len;case"utf8":case"utf-8":return utf8ToBytes(string).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return 2*len;case"hex":return len>>>1;case"base64":return base64ToBytes(string).length;default:if(loweredCase)return utf8ToBytes(string).length;encoding=(""+encoding).toLowerCase(),loweredCase=!0}}function slowToString(encoding,start,end){var loweredCase=!1;if(start=0|start,end=void 0===end||end===1/0?this.length:0|end,encoding||(encoding="utf8"),0>start&&(start=0),end>this.length&&(end=this.length),start>=end)return"";for(;;)switch(encoding){case"hex":return hexSlice(this,start,end);case"utf8":case"utf-8":return utf8Slice(this,start,end);case"ascii":return asciiSlice(this,start,end);case"binary":return binarySlice(this,start,end);case"base64":return base64Slice(this,start,end);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return utf16leSlice(this,start,end);default:if(loweredCase)throw new TypeError("Unknown encoding: "+encoding);encoding=(encoding+"").toLowerCase(),loweredCase=!0}}function hexWrite(buf,string,offset,length){offset=Number(offset)||0;var remaining=buf.length-offset;length?(length=Number(length),length>remaining&&(length=remaining)):length=remaining;var strLen=string.length;if(strLen%2!==0)throw new Error("Invalid hex string");length>strLen/2&&(length=strLen/2);for(var i=0;length>i;i++){var parsed=parseInt(string.substr(2*i,2),16);if(isNaN(parsed))throw new Error("Invalid hex string");buf[offset+i]=parsed}return i}function utf8Write(buf,string,offset,length){return blitBuffer(utf8ToBytes(string,buf.length-offset),buf,offset,length)}function asciiWrite(buf,string,offset,length){return blitBuffer(asciiToBytes(string),buf,offset,length)}function binaryWrite(buf,string,offset,length){return asciiWrite(buf,string,offset,length)}function base64Write(buf,string,offset,length){return blitBuffer(base64ToBytes(string),buf,offset,length)}function ucs2Write(buf,string,offset,length){return blitBuffer(utf16leToBytes(string,buf.length-offset),buf,offset,length)}function base64Slice(buf,start,end){return 0===start&&end===buf.length?base64.fromByteArray(buf):base64.fromByteArray(buf.slice(start,end))}function utf8Slice(buf,start,end){end=Math.min(buf.length,end);for(var res=[],i=start;end>i;){var firstByte=buf[i],codePoint=null,bytesPerSequence=firstByte>239?4:firstByte>223?3:firstByte>191?2:1;if(end>=i+bytesPerSequence){var secondByte,thirdByte,fourthByte,tempCodePoint;switch(bytesPerSequence){case 1:128>firstByte&&(codePoint=firstByte);break;case 2:secondByte=buf[i+1],128===(192&secondByte)&&(tempCodePoint=(31&firstByte)<<6|63&secondByte,tempCodePoint>127&&(codePoint=tempCodePoint));break;case 3:secondByte=buf[i+1],thirdByte=buf[i+2],128===(192&secondByte)&&128===(192&thirdByte)&&(tempCodePoint=(15&firstByte)<<12|(63&secondByte)<<6|63&thirdByte,tempCodePoint>2047&&(55296>tempCodePoint||tempCodePoint>57343)&&(codePoint=tempCodePoint));break;case 4:secondByte=buf[i+1],thirdByte=buf[i+2],fourthByte=buf[i+3],128===(192&secondByte)&&128===(192&thirdByte)&&128===(192&fourthByte)&&(tempCodePoint=(15&firstByte)<<18|(63&secondByte)<<12|(63&thirdByte)<<6|63&fourthByte,tempCodePoint>65535&&1114112>tempCodePoint&&(codePoint=tempCodePoint))}}null===codePoint?(codePoint=65533,bytesPerSequence=1):codePoint>65535&&(codePoint-=65536,res.push(codePoint>>>10&1023|55296),codePoint=56320|1023&codePoint),res.push(codePoint),i+=bytesPerSequence}return decodeCodePointsArray(res)}function decodeCodePointsArray(codePoints){var len=codePoints.length;if(MAX_ARGUMENTS_LENGTH>=len)return String.fromCharCode.apply(String,codePoints);for(var res="",i=0;len>i;)res+=String.fromCharCode.apply(String,codePoints.slice(i,i+=MAX_ARGUMENTS_LENGTH));return res}function asciiSlice(buf,start,end){var ret="";end=Math.min(buf.length,end);for(var i=start;end>i;i++)ret+=String.fromCharCode(127&buf[i]);return ret}function binarySlice(buf,start,end){var ret="";end=Math.min(buf.length,end);for(var i=start;end>i;i++)ret+=String.fromCharCode(buf[i]);return ret}function hexSlice(buf,start,end){var len=buf.length;(!start||0>start)&&(start=0),(!end||0>end||end>len)&&(end=len);for(var out="",i=start;end>i;i++)out+=toHex(buf[i]);return out}function utf16leSlice(buf,start,end){for(var bytes=buf.slice(start,end),res="",i=0;i<bytes.length;i+=2)res+=String.fromCharCode(bytes[i]+256*bytes[i+1]);return res}function checkOffset(offset,ext,length){if(offset%1!==0||0>offset)throw new RangeError("offset is not uint");if(offset+ext>length)throw new RangeError("Trying to access beyond buffer length")}function checkInt(buf,value,offset,ext,max,min){if(!Buffer.isBuffer(buf))throw new TypeError("buffer must be a Buffer instance");if(value>max||min>value)throw new RangeError("value is out of bounds");if(offset+ext>buf.length)throw new RangeError("index out of range")}function objectWriteUInt16(buf,value,offset,littleEndian){0>value&&(value=65535+value+1);for(var i=0,j=Math.min(buf.length-offset,2);j>i;i++)buf[offset+i]=(value&255<<8*(littleEndian?i:1-i))>>>8*(littleEndian?i:1-i)}function objectWriteUInt32(buf,value,offset,littleEndian){0>value&&(value=4294967295+value+1);for(var i=0,j=Math.min(buf.length-offset,4);j>i;i++)buf[offset+i]=value>>>8*(littleEndian?i:3-i)&255}function checkIEEE754(buf,value,offset,ext,max,min){if(value>max||min>value)throw new RangeError("value is out of bounds");if(offset+ext>buf.length)throw new RangeError("index out of range");if(0>offset)throw new RangeError("index out of range")}function writeFloat(buf,value,offset,littleEndian,noAssert){return noAssert||checkIEEE754(buf,value,offset,4,3.4028234663852886e38,-3.4028234663852886e38),ieee754.write(buf,value,offset,littleEndian,23,4),offset+4}function writeDouble(buf,value,offset,littleEndian,noAssert){return noAssert||checkIEEE754(buf,value,offset,8,1.7976931348623157e308,-1.7976931348623157e308),ieee754.write(buf,value,offset,littleEndian,52,8),offset+8}function base64clean(str){if(str=stringtrim(str).replace(INVALID_BASE64_RE,""),str.length<2)return"";for(;str.length%4!==0;)str+="=";return str}function stringtrim(str){return str.trim?str.trim():str.replace(/^\s+|\s+$/g,"")}function toHex(n){return 16>n?"0"+n.toString(16):n.toString(16)}function utf8ToBytes(string,units){units=units||1/0;for(var codePoint,length=string.length,leadSurrogate=null,bytes=[],i=0;length>i;i++){if(codePoint=string.charCodeAt(i),codePoint>55295&&57344>codePoint){if(!leadSurrogate){if(codePoint>56319){(units-=3)>-1&&bytes.push(239,191,189);continue}if(i+1===length){(units-=3)>-1&&bytes.push(239,191,189);continue}leadSurrogate=codePoint;continue}if(56320>codePoint){(units-=3)>-1&&bytes.push(239,191,189),leadSurrogate=codePoint;continue}codePoint=(leadSurrogate-55296<<10|codePoint-56320)+65536}else leadSurrogate&&(units-=3)>-1&&bytes.push(239,191,189);if(leadSurrogate=null,128>codePoint){if((units-=1)<0)break;bytes.push(codePoint)}else if(2048>codePoint){if((units-=2)<0)break;bytes.push(codePoint>>6|192,63&codePoint|128)}else if(65536>codePoint){if((units-=3)<0)break;bytes.push(codePoint>>12|224,codePoint>>6&63|128,63&codePoint|128)}else{if(!(1114112>codePoint))throw new Error("Invalid code point");if((units-=4)<0)break;bytes.push(codePoint>>18|240,codePoint>>12&63|128,codePoint>>6&63|128,63&codePoint|128)}}return bytes}function asciiToBytes(str){for(var byteArray=[],i=0;i<str.length;i++)byteArray.push(255&str.charCodeAt(i));return byteArray}function utf16leToBytes(str,units){for(var c,hi,lo,byteArray=[],i=0;i<str.length&&!((units-=2)<0);i++)c=str.charCodeAt(i),hi=c>>8,lo=c%256,byteArray.push(lo),byteArray.push(hi);return byteArray}function base64ToBytes(str){return base64.toByteArray(base64clean(str))}function blitBuffer(src,dst,offset,length){for(var i=0;length>i&&!(i+offset>=dst.length||i>=src.length);i++)dst[i+offset]=src[i];return i}var base64=__webpack_require__(131),ieee754=__webpack_require__(186),isArray=__webpack_require__(134);exports.Buffer=Buffer,exports.SlowBuffer=SlowBuffer,exports.INSPECT_MAX_BYTES=50,Buffer.poolSize=8192;var rootParent={};Buffer.TYPED_ARRAY_SUPPORT=void 0!==global.TYPED_ARRAY_SUPPORT?global.TYPED_ARRAY_SUPPORT:typedArraySupport(),Buffer.TYPED_ARRAY_SUPPORT?(Buffer.prototype.__proto__=Uint8Array.prototype,Buffer.__proto__=Uint8Array):(Buffer.prototype.length=void 0,Buffer.prototype.parent=void 0),Buffer.isBuffer=function(b){return!(null==b||!b._isBuffer)},Buffer.compare=function(a,b){if(!Buffer.isBuffer(a)||!Buffer.isBuffer(b))throw new TypeError("Arguments must be Buffers");if(a===b)return 0;for(var x=a.length,y=b.length,i=0,len=Math.min(x,y);len>i&&a[i]===b[i];)++i;return i!==len&&(x=a[i],y=b[i]),y>x?-1:x>y?1:0},Buffer.isEncoding=function(encoding){switch(String(encoding).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},Buffer.concat=function(list,length){if(!isArray(list))throw new TypeError("list argument must be an Array of Buffers.");if(0===list.length)return new Buffer(0);var i;if(void 0===length)for(length=0,i=0;i<list.length;i++)length+=list[i].length;var buf=new Buffer(length),pos=0;for(i=0;i<list.length;i++){var item=list[i];item.copy(buf,pos),pos+=item.length}return buf},Buffer.byteLength=byteLength,Buffer.prototype.toString=function(){var length=0|this.length;return 0===length?"":0===arguments.length?utf8Slice(this,0,length):slowToString.apply(this,arguments)},Buffer.prototype.equals=function(b){if(!Buffer.isBuffer(b))throw new TypeError("Argument must be a Buffer");return this===b?!0:0===Buffer.compare(this,b)},Buffer.prototype.inspect=function(){var str="",max=exports.INSPECT_MAX_BYTES;return this.length>0&&(str=this.toString("hex",0,max).match(/.{2}/g).join(" "),this.length>max&&(str+=" ... ")),"<Buffer "+str+">"},Buffer.prototype.compare=function(b){if(!Buffer.isBuffer(b))throw new TypeError("Argument must be a Buffer");return this===b?0:Buffer.compare(this,b)},Buffer.prototype.indexOf=function(val,byteOffset){function arrayIndexOf(arr,val,byteOffset){for(var foundIndex=-1,i=0;byteOffset+i<arr.length;i++)if(arr[byteOffset+i]===val[-1===foundIndex?0:i-foundIndex]){if(-1===foundIndex&&(foundIndex=i),i-foundIndex+1===val.length)return byteOffset+foundIndex}else foundIndex=-1;return-1}if(byteOffset>2147483647?byteOffset=2147483647:-2147483648>byteOffset&&(byteOffset=-2147483648),byteOffset>>=0,0===this.length)return-1;if(byteOffset>=this.length)return-1;if(0>byteOffset&&(byteOffset=Math.max(this.length+byteOffset,0)),"string"==typeof val)return 0===val.length?-1:String.prototype.indexOf.call(this,val,byteOffset);if(Buffer.isBuffer(val))return arrayIndexOf(this,val,byteOffset);if("number"==typeof val)return Buffer.TYPED_ARRAY_SUPPORT&&"function"===Uint8Array.prototype.indexOf?Uint8Array.prototype.indexOf.call(this,val,byteOffset):arrayIndexOf(this,[val],byteOffset);throw new TypeError("val must be string, number or Buffer")},Buffer.prototype.get=function(offset){return console.log(".get() is deprecated. Access using array indexes instead."),this.readUInt8(offset)},Buffer.prototype.set=function(v,offset){return console.log(".set() is deprecated. Access using array indexes instead."),this.writeUInt8(v,offset)},Buffer.prototype.write=function(string,offset,length,encoding){if(void 0===offset)encoding="utf8",length=this.length,offset=0;else if(void 0===length&&"string"==typeof offset)encoding=offset,length=this.length,offset=0;else if(isFinite(offset))offset=0|offset,isFinite(length)?(length=0|length,void 0===encoding&&(encoding="utf8")):(encoding=length,length=void 0);else{var swap=encoding;encoding=offset,offset=0|length,length=swap}var remaining=this.length-offset;if((void 0===length||length>remaining)&&(length=remaining),string.length>0&&(0>length||0>offset)||offset>this.length)throw new RangeError("attempt to write outside buffer bounds");encoding||(encoding="utf8");for(var loweredCase=!1;;)switch(encoding){case"hex":return hexWrite(this,string,offset,length);case"utf8":case"utf-8":return utf8Write(this,string,offset,length);case"ascii":return asciiWrite(this,string,offset,length);case"binary":return binaryWrite(this,string,offset,length);case"base64":return base64Write(this,string,offset,length);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return ucs2Write(this,string,offset,length);default:if(loweredCase)throw new TypeError("Unknown encoding: "+encoding);encoding=(""+encoding).toLowerCase(),loweredCase=!0}},Buffer.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};var MAX_ARGUMENTS_LENGTH=4096;Buffer.prototype.slice=function(start,end){var len=this.length;start=~~start,end=void 0===end?len:~~end,0>start?(start+=len,0>start&&(start=0)):start>len&&(start=len),0>end?(end+=len,0>end&&(end=0)):end>len&&(end=len),start>end&&(end=start);var newBuf;if(Buffer.TYPED_ARRAY_SUPPORT)newBuf=Buffer._augment(this.subarray(start,end));else{var sliceLen=end-start;newBuf=new Buffer(sliceLen,void 0);for(var i=0;sliceLen>i;i++)newBuf[i]=this[i+start]}return newBuf.length&&(newBuf.parent=this.parent||this),newBuf},Buffer.prototype.readUIntLE=function(offset,byteLength,noAssert){offset=0|offset,byteLength=0|byteLength,noAssert||checkOffset(offset,byteLength,this.length);for(var val=this[offset],mul=1,i=0;++i<byteLength&&(mul*=256);)val+=this[offset+i]*mul;return val},Buffer.prototype.readUIntBE=function(offset,byteLength,noAssert){offset=0|offset,byteLength=0|byteLength,noAssert||checkOffset(offset,byteLength,this.length);for(var val=this[offset+--byteLength],mul=1;byteLength>0&&(mul*=256);)val+=this[offset+--byteLength]*mul;return val},Buffer.prototype.readUInt8=function(offset,noAssert){return noAssert||checkOffset(offset,1,this.length),this[offset]},Buffer.prototype.readUInt16LE=function(offset,noAssert){return noAssert||checkOffset(offset,2,this.length),this[offset]|this[offset+1]<<8},Buffer.prototype.readUInt16BE=function(offset,noAssert){return noAssert||checkOffset(offset,2,this.length),this[offset]<<8|this[offset+1]},Buffer.prototype.readUInt32LE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),(this[offset]|this[offset+1]<<8|this[offset+2]<<16)+16777216*this[offset+3]},Buffer.prototype.readUInt32BE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),16777216*this[offset]+(this[offset+1]<<16|this[offset+2]<<8|this[offset+3])},Buffer.prototype.readIntLE=function(offset,byteLength,noAssert){offset=0|offset,byteLength=0|byteLength,noAssert||checkOffset(offset,byteLength,this.length);for(var val=this[offset],mul=1,i=0;++i<byteLength&&(mul*=256);)val+=this[offset+i]*mul;return mul*=128,val>=mul&&(val-=Math.pow(2,8*byteLength)),val},Buffer.prototype.readIntBE=function(offset,byteLength,noAssert){offset=0|offset,byteLength=0|byteLength,noAssert||checkOffset(offset,byteLength,this.length);for(var i=byteLength,mul=1,val=this[offset+--i];i>0&&(mul*=256);)val+=this[offset+--i]*mul;return mul*=128,val>=mul&&(val-=Math.pow(2,8*byteLength)),val},Buffer.prototype.readInt8=function(offset,noAssert){return noAssert||checkOffset(offset,1,this.length),128&this[offset]?-1*(255-this[offset]+1):this[offset]},Buffer.prototype.readInt16LE=function(offset,noAssert){noAssert||checkOffset(offset,2,this.length);var val=this[offset]|this[offset+1]<<8;return 32768&val?4294901760|val:val},Buffer.prototype.readInt16BE=function(offset,noAssert){noAssert||checkOffset(offset,2,this.length);var val=this[offset+1]|this[offset]<<8;return 32768&val?4294901760|val:val},Buffer.prototype.readInt32LE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),this[offset]|this[offset+1]<<8|this[offset+2]<<16|this[offset+3]<<24},Buffer.prototype.readInt32BE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),this[offset]<<24|this[offset+1]<<16|this[offset+2]<<8|this[offset+3]},Buffer.prototype.readFloatLE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),ieee754.read(this,offset,!0,23,4)},Buffer.prototype.readFloatBE=function(offset,noAssert){return noAssert||checkOffset(offset,4,this.length),ieee754.read(this,offset,!1,23,4)},Buffer.prototype.readDoubleLE=function(offset,noAssert){return noAssert||checkOffset(offset,8,this.length),ieee754.read(this,offset,!0,52,8)},Buffer.prototype.readDoubleBE=function(offset,noAssert){return noAssert||checkOffset(offset,8,this.length),ieee754.read(this,offset,!1,52,8)},Buffer.prototype.writeUIntLE=function(value,offset,byteLength,noAssert){value=+value,offset=0|offset,byteLength=0|byteLength,noAssert||checkInt(this,value,offset,byteLength,Math.pow(2,8*byteLength),0);var mul=1,i=0;for(this[offset]=255&value;++i<byteLength&&(mul*=256);)this[offset+i]=value/mul&255;return offset+byteLength},Buffer.prototype.writeUIntBE=function(value,offset,byteLength,noAssert){value=+value,offset=0|offset,byteLength=0|byteLength,noAssert||checkInt(this,value,offset,byteLength,Math.pow(2,8*byteLength),0);var i=byteLength-1,mul=1;for(this[offset+i]=255&value;--i>=0&&(mul*=256);)this[offset+i]=value/mul&255;return offset+byteLength},Buffer.prototype.writeUInt8=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,1,255,0),Buffer.TYPED_ARRAY_SUPPORT||(value=Math.floor(value)),this[offset]=255&value,offset+1},Buffer.prototype.writeUInt16LE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,2,65535,0),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=255&value,this[offset+1]=value>>>8):objectWriteUInt16(this,value,offset,!0),offset+2},Buffer.prototype.writeUInt16BE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,2,65535,0),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=value>>>8,this[offset+1]=255&value):objectWriteUInt16(this,value,offset,!1),offset+2},Buffer.prototype.writeUInt32LE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,4,4294967295,0),Buffer.TYPED_ARRAY_SUPPORT?(this[offset+3]=value>>>24,this[offset+2]=value>>>16,this[offset+1]=value>>>8,this[offset]=255&value):objectWriteUInt32(this,value,offset,!0),offset+4},Buffer.prototype.writeUInt32BE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,4,4294967295,0),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=value>>>24,this[offset+1]=value>>>16,this[offset+2]=value>>>8,this[offset+3]=255&value):objectWriteUInt32(this,value,offset,!1),offset+4},Buffer.prototype.writeIntLE=function(value,offset,byteLength,noAssert){if(value=+value,offset=0|offset,!noAssert){var limit=Math.pow(2,8*byteLength-1);checkInt(this,value,offset,byteLength,limit-1,-limit)}var i=0,mul=1,sub=0>value?1:0;for(this[offset]=255&value;++i<byteLength&&(mul*=256);)this[offset+i]=(value/mul>>0)-sub&255;return offset+byteLength},Buffer.prototype.writeIntBE=function(value,offset,byteLength,noAssert){if(value=+value,offset=0|offset,!noAssert){var limit=Math.pow(2,8*byteLength-1);checkInt(this,value,offset,byteLength,limit-1,-limit)}var i=byteLength-1,mul=1,sub=0>value?1:0;for(this[offset+i]=255&value;--i>=0&&(mul*=256);)this[offset+i]=(value/mul>>0)-sub&255;return offset+byteLength},Buffer.prototype.writeInt8=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,1,127,-128),Buffer.TYPED_ARRAY_SUPPORT||(value=Math.floor(value)),0>value&&(value=255+value+1),this[offset]=255&value,offset+1},Buffer.prototype.writeInt16LE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,2,32767,-32768),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=255&value,this[offset+1]=value>>>8):objectWriteUInt16(this,value,offset,!0),offset+2},Buffer.prototype.writeInt16BE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,2,32767,-32768),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=value>>>8,this[offset+1]=255&value):objectWriteUInt16(this,value,offset,!1),offset+2},Buffer.prototype.writeInt32LE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,4,2147483647,-2147483648),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=255&value,this[offset+1]=value>>>8,this[offset+2]=value>>>16,this[offset+3]=value>>>24):objectWriteUInt32(this,value,offset,!0),offset+4},Buffer.prototype.writeInt32BE=function(value,offset,noAssert){return value=+value,offset=0|offset,noAssert||checkInt(this,value,offset,4,2147483647,-2147483648),0>value&&(value=4294967295+value+1),Buffer.TYPED_ARRAY_SUPPORT?(this[offset]=value>>>24,this[offset+1]=value>>>16,this[offset+2]=value>>>8,this[offset+3]=255&value):objectWriteUInt32(this,value,offset,!1),offset+4},Buffer.prototype.writeFloatLE=function(value,offset,noAssert){return writeFloat(this,value,offset,!0,noAssert)},Buffer.prototype.writeFloatBE=function(value,offset,noAssert){return writeFloat(this,value,offset,!1,noAssert)},Buffer.prototype.writeDoubleLE=function(value,offset,noAssert){return writeDouble(this,value,offset,!0,noAssert)},Buffer.prototype.writeDoubleBE=function(value,offset,noAssert){return writeDouble(this,value,offset,!1,noAssert)},Buffer.prototype.copy=function(target,targetStart,start,end){if(start||(start=0),end||0===end||(end=this.length),targetStart>=target.length&&(targetStart=target.length),targetStart||(targetStart=0),end>0&&start>end&&(end=start),end===start)return 0;if(0===target.length||0===this.length)return 0;if(0>targetStart)throw new RangeError("targetStart out of bounds");if(0>start||start>=this.length)throw new RangeError("sourceStart out of bounds");if(0>end)throw new RangeError("sourceEnd out of bounds");end>this.length&&(end=this.length),target.length-targetStart<end-start&&(end=target.length-targetStart+start);var i,len=end-start;if(this===target&&targetStart>start&&end>targetStart)for(i=len-1;i>=0;i--)target[i+targetStart]=this[i+start];else if(1e3>len||!Buffer.TYPED_ARRAY_SUPPORT)for(i=0;len>i;i++)target[i+targetStart]=this[i+start];else target._set(this.subarray(start,start+len),targetStart);return len},Buffer.prototype.fill=function(value,start,end){if(value||(value=0),start||(start=0),end||(end=this.length),start>end)throw new RangeError("end < start");if(end!==start&&0!==this.length){if(0>start||start>=this.length)throw new RangeError("start out of bounds");if(0>end||end>this.length)throw new RangeError("end out of bounds");var i;if("number"==typeof value)for(i=start;end>i;i++)this[i]=value;else{var bytes=utf8ToBytes(value.toString()),len=bytes.length;for(i=start;end>i;i++)this[i]=bytes[i%len]}return this}},Buffer.prototype.toArrayBuffer=function(){if("undefined"!=typeof Uint8Array){if(Buffer.TYPED_ARRAY_SUPPORT)return new Buffer(this).buffer;for(var buf=new Uint8Array(this.length),i=0,len=buf.length;len>i;i+=1)buf[i]=this[i];return buf.buffer}throw new TypeError("Buffer.toArrayBuffer not supported in this browser")};var BP=Buffer.prototype;Buffer._augment=function(arr){return arr.constructor=Buffer,arr._isBuffer=!0,arr._set=arr.set,arr.get=BP.get,arr.set=BP.set,arr.write=BP.write,arr.toString=BP.toString,arr.toLocaleString=BP.toString,arr.toJSON=BP.toJSON,arr.equals=BP.equals,arr.compare=BP.compare,arr.indexOf=BP.indexOf,arr.copy=BP.copy,arr.slice=BP.slice,arr.readUIntLE=BP.readUIntLE,arr.readUIntBE=BP.readUIntBE,arr.readUInt8=BP.readUInt8,arr.readUInt16LE=BP.readUInt16LE,arr.readUInt16BE=BP.readUInt16BE,arr.readUInt32LE=BP.readUInt32LE,arr.readUInt32BE=BP.readUInt32BE,arr.readIntLE=BP.readIntLE,arr.readIntBE=BP.readIntBE,arr.readInt8=BP.readInt8,arr.readInt16LE=BP.readInt16LE,arr.readInt16BE=BP.readInt16BE,arr.readInt32LE=BP.readInt32LE,arr.readInt32BE=BP.readInt32BE,arr.readFloatLE=BP.readFloatLE,arr.readFloatBE=BP.readFloatBE,arr.readDoubleLE=BP.readDoubleLE,arr.readDoubleBE=BP.readDoubleBE,arr.writeUInt8=BP.writeUInt8,arr.writeUIntLE=BP.writeUIntLE,arr.writeUIntBE=BP.writeUIntBE,arr.writeUInt16LE=BP.writeUInt16LE,arr.writeUInt16BE=BP.writeUInt16BE,arr.writeUInt32LE=BP.writeUInt32LE,arr.writeUInt32BE=BP.writeUInt32BE,arr.writeIntLE=BP.writeIntLE,arr.writeIntBE=BP.writeIntBE,arr.writeInt8=BP.writeInt8,arr.writeInt16LE=BP.writeInt16LE,arr.writeInt16BE=BP.writeInt16BE,arr.writeInt32LE=BP.writeInt32LE,arr.writeInt32BE=BP.writeInt32BE,arr.writeFloatLE=BP.writeFloatLE,arr.writeFloatBE=BP.writeFloatBE,arr.writeDoubleLE=BP.writeDoubleLE,arr.writeDoubleBE=BP.writeDoubleBE,arr.fill=BP.fill,arr.inspect=BP.inspect,arr.toArrayBuffer=BP.toArrayBuffer,arr};var INVALID_BASE64_RE=/[^+\/0-9A-Za-z-_]/g}).call(exports,__webpack_require__(2).Buffer,function(){return this}())},function(module,exports,__webpack_require__){function Stream(){EE.call(this)}module.exports=Stream;var EE=__webpack_require__(13).EventEmitter,inherits=__webpack_require__(4);inherits(Stream,EE),Stream.Readable=__webpack_require__(225),Stream.Writable=__webpack_require__(227),Stream.Duplex=__webpack_require__(223),Stream.Transform=__webpack_require__(226),Stream.PassThrough=__webpack_require__(224),Stream.Stream=Stream,Stream.prototype.pipe=function(dest,options){function ondata(chunk){dest.writable&&!1===dest.write(chunk)&&source.pause&&source.pause()}function ondrain(){source.readable&&source.resume&&source.resume()}function onend(){didOnEnd||(didOnEnd=!0,dest.end())}function onclose(){didOnEnd||(didOnEnd=!0,"function"==typeof dest.destroy&&dest.destroy())}function onerror(er){if(cleanup(),0===EE.listenerCount(this,"error"))throw er}function cleanup(){source.removeListener("data",ondata),dest.removeListener("drain",ondrain),source.removeListener("end",onend),source.removeListener("close",onclose),source.removeListener("error",onerror),dest.removeListener("error",onerror),source.removeListener("end",cleanup),source.removeListener("close",cleanup),dest.removeListener("close",cleanup)}var source=this;source.on("data",ondata),dest.on("drain",ondrain),dest._isStdio||options&&options.end===!1||(source.on("end",onend),source.on("close",onclose));var didOnEnd=!1;return source.on("error",onerror),dest.on("error",onerror),source.on("end",cleanup),source.on("close",cleanup),dest.on("close",cleanup),dest.emit("pipe",source),dest}},function(module,exports){"function"==typeof Object.create?module.exports=function(ctor,superCtor){ctor.super_=superCtor,ctor.prototype=Object.create(superCtor.prototype,{constructor:{value:ctor,enumerable:!1,writable:!0,configurable:!0}})}:module.exports=function(ctor,superCtor){ctor.super_=superCtor;var TempCtor=function(){};TempCtor.prototype=superCtor.prototype,ctor.prototype=new TempCtor,ctor.prototype.constructor=ctor}},function(module,exports){module.exports={}},function(module,exports,__webpack_require__){(function(process){function normalizeArray(parts,allowAboveRoot){for(var up=0,i=parts.length-1;i>=0;i--){var last=parts[i];"."===last?parts.splice(i,1):".."===last?(parts.splice(i,1),up++):up&&(parts.splice(i,1),up--)}if(allowAboveRoot)for(;up--;up)parts.unshift("..");return parts}function filter(xs,f){if(xs.filter)return xs.filter(f);for(var res=[],i=0;i<xs.length;i++)f(xs[i],i,xs)&&res.push(xs[i]);return res}var splitPathRe=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/,splitPath=function(filename){return splitPathRe.exec(filename).slice(1)};exports.resolve=function(){for(var resolvedPath="",resolvedAbsolute=!1,i=arguments.length-1;i>=-1&&!resolvedAbsolute;i--){var path=i>=0?arguments[i]:process.cwd();if("string"!=typeof path)throw new TypeError("Arguments to path.resolve must be strings");path&&(resolvedPath=path+"/"+resolvedPath,resolvedAbsolute="/"===path.charAt(0))}return resolvedPath=normalizeArray(filter(resolvedPath.split("/"),function(p){return!!p}),!resolvedAbsolute).join("/"),(resolvedAbsolute?"/":"")+resolvedPath||"."},exports.normalize=function(path){var isAbsolute=exports.isAbsolute(path),trailingSlash="/"===substr(path,-1);return path=normalizeArray(filter(path.split("/"),function(p){return!!p}),!isAbsolute).join("/"),path||isAbsolute||(path="."),path&&trailingSlash&&(path+="/"),(isAbsolute?"/":"")+path},exports.isAbsolute=function(path){return"/"===path.charAt(0)},exports.join=function(){var paths=Array.prototype.slice.call(arguments,0);return exports.normalize(filter(paths,function(p,index){if("string"!=typeof p)throw new TypeError("Arguments to path.join must be strings");return p}).join("/"))},exports.relative=function(from,to){function trim(arr){for(var start=0;start<arr.length&&""===arr[start];start++);for(var end=arr.length-1;end>=0&&""===arr[end];end--);return start>end?[]:arr.slice(start,end-start+1)}from=exports.resolve(from).substr(1),
to=exports.resolve(to).substr(1);for(var fromParts=trim(from.split("/")),toParts=trim(to.split("/")),length=Math.min(fromParts.length,toParts.length),samePartsLength=length,i=0;length>i;i++)if(fromParts[i]!==toParts[i]){samePartsLength=i;break}for(var outputParts=[],i=samePartsLength;i<fromParts.length;i++)outputParts.push("..");return outputParts=outputParts.concat(toParts.slice(samePartsLength)),outputParts.join("/")},exports.sep="/",exports.delimiter=":",exports.dirname=function(path){var result=splitPath(path),root=result[0],dir=result[1];return root||dir?(dir&&(dir=dir.substr(0,dir.length-1)),root+dir):"."},exports.basename=function(path,ext){var f=splitPath(path)[2];return ext&&f.substr(-1*ext.length)===ext&&(f=f.substr(0,f.length-ext.length)),f},exports.extname=function(path){return splitPath(path)[3]};var substr="b"==="ab".substr(-1)?function(str,start,len){return str.substr(start,len)}:function(str,start,len){return 0>start&&(start=str.length+start),str.substr(start,len)}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(global,process){function inspect(obj,opts){var ctx={seen:[],stylize:stylizeNoColor};return arguments.length>=3&&(ctx.depth=arguments[2]),arguments.length>=4&&(ctx.colors=arguments[3]),isBoolean(opts)?ctx.showHidden=opts:opts&&exports._extend(ctx,opts),isUndefined(ctx.showHidden)&&(ctx.showHidden=!1),isUndefined(ctx.depth)&&(ctx.depth=2),isUndefined(ctx.colors)&&(ctx.colors=!1),isUndefined(ctx.customInspect)&&(ctx.customInspect=!0),ctx.colors&&(ctx.stylize=stylizeWithColor),formatValue(ctx,obj,ctx.depth)}function stylizeWithColor(str,styleType){var style=inspect.styles[styleType];return style?"["+inspect.colors[style][0]+"m"+str+"["+inspect.colors[style][1]+"m":str}function stylizeNoColor(str,styleType){return str}function arrayToHash(array){var hash={};return array.forEach(function(val,idx){hash[val]=!0}),hash}function formatValue(ctx,value,recurseTimes){if(ctx.customInspect&&value&&isFunction(value.inspect)&&value.inspect!==exports.inspect&&(!value.constructor||value.constructor.prototype!==value)){var ret=value.inspect(recurseTimes,ctx);return isString(ret)||(ret=formatValue(ctx,ret,recurseTimes)),ret}var primitive=formatPrimitive(ctx,value);if(primitive)return primitive;var keys=Object.keys(value),visibleKeys=arrayToHash(keys);if(ctx.showHidden&&(keys=Object.getOwnPropertyNames(value)),isError(value)&&(keys.indexOf("message")>=0||keys.indexOf("description")>=0))return formatError(value);if(0===keys.length){if(isFunction(value)){var name=value.name?": "+value.name:"";return ctx.stylize("[Function"+name+"]","special")}if(isRegExp(value))return ctx.stylize(RegExp.prototype.toString.call(value),"regexp");if(isDate(value))return ctx.stylize(Date.prototype.toString.call(value),"date");if(isError(value))return formatError(value)}var base="",array=!1,braces=["{","}"];if(isArray(value)&&(array=!0,braces=["[","]"]),isFunction(value)){var n=value.name?": "+value.name:"";base=" [Function"+n+"]"}if(isRegExp(value)&&(base=" "+RegExp.prototype.toString.call(value)),isDate(value)&&(base=" "+Date.prototype.toUTCString.call(value)),isError(value)&&(base=" "+formatError(value)),0===keys.length&&(!array||0==value.length))return braces[0]+base+braces[1];if(0>recurseTimes)return isRegExp(value)?ctx.stylize(RegExp.prototype.toString.call(value),"regexp"):ctx.stylize("[Object]","special");ctx.seen.push(value);var output;return output=array?formatArray(ctx,value,recurseTimes,visibleKeys,keys):keys.map(function(key){return formatProperty(ctx,value,recurseTimes,visibleKeys,key,array)}),ctx.seen.pop(),reduceToSingleString(output,base,braces)}function formatPrimitive(ctx,value){if(isUndefined(value))return ctx.stylize("undefined","undefined");if(isString(value)){var simple="'"+JSON.stringify(value).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'";return ctx.stylize(simple,"string")}return isNumber(value)?ctx.stylize(""+value,"number"):isBoolean(value)?ctx.stylize(""+value,"boolean"):isNull(value)?ctx.stylize("null","null"):void 0}function formatError(value){return"["+Error.prototype.toString.call(value)+"]"}function formatArray(ctx,value,recurseTimes,visibleKeys,keys){for(var output=[],i=0,l=value.length;l>i;++i)hasOwnProperty(value,String(i))?output.push(formatProperty(ctx,value,recurseTimes,visibleKeys,String(i),!0)):output.push("");return keys.forEach(function(key){key.match(/^\d+$/)||output.push(formatProperty(ctx,value,recurseTimes,visibleKeys,key,!0))}),output}function formatProperty(ctx,value,recurseTimes,visibleKeys,key,array){var name,str,desc;if(desc=Object.getOwnPropertyDescriptor(value,key)||{value:value[key]},desc.get?str=desc.set?ctx.stylize("[Getter/Setter]","special"):ctx.stylize("[Getter]","special"):desc.set&&(str=ctx.stylize("[Setter]","special")),hasOwnProperty(visibleKeys,key)||(name="["+key+"]"),str||(ctx.seen.indexOf(desc.value)<0?(str=isNull(recurseTimes)?formatValue(ctx,desc.value,null):formatValue(ctx,desc.value,recurseTimes-1),str.indexOf("\n")>-1&&(str=array?str.split("\n").map(function(line){return"  "+line}).join("\n").substr(2):"\n"+str.split("\n").map(function(line){return"   "+line}).join("\n"))):str=ctx.stylize("[Circular]","special")),isUndefined(name)){if(array&&key.match(/^\d+$/))return str;name=JSON.stringify(""+key),name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?(name=name.substr(1,name.length-2),name=ctx.stylize(name,"name")):(name=name.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'"),name=ctx.stylize(name,"string"))}return name+": "+str}function reduceToSingleString(output,base,braces){var numLinesEst=0,length=output.reduce(function(prev,cur){return numLinesEst++,cur.indexOf("\n")>=0&&numLinesEst++,prev+cur.replace(/\u001b\[\d\d?m/g,"").length+1},0);return length>60?braces[0]+(""===base?"":base+"\n ")+" "+output.join(",\n  ")+" "+braces[1]:braces[0]+base+" "+output.join(", ")+" "+braces[1]}function isArray(ar){return Array.isArray(ar)}function isBoolean(arg){return"boolean"==typeof arg}function isNull(arg){return null===arg}function isNullOrUndefined(arg){return null==arg}function isNumber(arg){return"number"==typeof arg}function isString(arg){return"string"==typeof arg}function isSymbol(arg){return"symbol"==typeof arg}function isUndefined(arg){return void 0===arg}function isRegExp(re){return isObject(re)&&"[object RegExp]"===objectToString(re)}function isObject(arg){return"object"==typeof arg&&null!==arg}function isDate(d){return isObject(d)&&"[object Date]"===objectToString(d)}function isError(e){return isObject(e)&&("[object Error]"===objectToString(e)||e instanceof Error)}function isFunction(arg){return"function"==typeof arg}function isPrimitive(arg){return null===arg||"boolean"==typeof arg||"number"==typeof arg||"string"==typeof arg||"symbol"==typeof arg||"undefined"==typeof arg}function objectToString(o){return Object.prototype.toString.call(o)}function pad(n){return 10>n?"0"+n.toString(10):n.toString(10)}function timestamp(){var d=new Date,time=[pad(d.getHours()),pad(d.getMinutes()),pad(d.getSeconds())].join(":");return[d.getDate(),months[d.getMonth()],time].join(" ")}function hasOwnProperty(obj,prop){return Object.prototype.hasOwnProperty.call(obj,prop)}var formatRegExp=/%[sdj%]/g;exports.format=function(f){if(!isString(f)){for(var objects=[],i=0;i<arguments.length;i++)objects.push(inspect(arguments[i]));return objects.join(" ")}for(var i=1,args=arguments,len=args.length,str=String(f).replace(formatRegExp,function(x){if("%%"===x)return"%";if(i>=len)return x;switch(x){case"%s":return String(args[i++]);case"%d":return Number(args[i++]);case"%j":try{return JSON.stringify(args[i++])}catch(_){return"[Circular]"}default:return x}}),x=args[i];len>i;x=args[++i])str+=isNull(x)||!isObject(x)?" "+x:" "+inspect(x);return str},exports.deprecate=function(fn,msg){function deprecated(){if(!warned){if(process.throwDeprecation)throw new Error(msg);process.traceDeprecation?console.trace(msg):console.error(msg),warned=!0}return fn.apply(this,arguments)}if(isUndefined(global.process))return function(){return exports.deprecate(fn,msg).apply(this,arguments)};if(process.noDeprecation===!0)return fn;var warned=!1;return deprecated};var debugEnviron,debugs={};exports.debuglog=function(set){if(isUndefined(debugEnviron)&&(debugEnviron=process.env.NODE_DEBUG||""),set=set.toUpperCase(),!debugs[set])if(new RegExp("\\b"+set+"\\b","i").test(debugEnviron)){var pid=process.pid;debugs[set]=function(){var msg=exports.format.apply(exports,arguments);console.error("%s %d: %s",set,pid,msg)}}else debugs[set]=function(){};return debugs[set]},exports.inspect=inspect,inspect.colors={bold:[1,22],italic:[3,23],underline:[4,24],inverse:[7,27],white:[37,39],grey:[90,39],black:[30,39],blue:[34,39],cyan:[36,39],green:[32,39],magenta:[35,39],red:[31,39],yellow:[33,39]},inspect.styles={special:"cyan",number:"yellow","boolean":"yellow",undefined:"grey","null":"bold",string:"green",date:"magenta",regexp:"red"},exports.isArray=isArray,exports.isBoolean=isBoolean,exports.isNull=isNull,exports.isNullOrUndefined=isNullOrUndefined,exports.isNumber=isNumber,exports.isString=isString,exports.isSymbol=isSymbol,exports.isUndefined=isUndefined,exports.isRegExp=isRegExp,exports.isObject=isObject,exports.isDate=isDate,exports.isError=isError,exports.isFunction=isFunction,exports.isPrimitive=isPrimitive,exports.isBuffer=__webpack_require__(240);var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];exports.log=function(){console.log("%s - %s",timestamp(),exports.format.apply(exports,arguments))},exports.inherits=__webpack_require__(4),exports._extend=function(origin,add){if(!add||!isObject(add))return origin;for(var keys=Object.keys(add),i=keys.length;i--;)origin[keys[i]]=add[keys[i]];return origin}}).call(exports,function(){return this}(),__webpack_require__(1))},function(module,exports,__webpack_require__){(function(Buffer){function isArray(arg){return Array.isArray?Array.isArray(arg):"[object Array]"===objectToString(arg)}function isBoolean(arg){return"boolean"==typeof arg}function isNull(arg){return null===arg}function isNullOrUndefined(arg){return null==arg}function isNumber(arg){return"number"==typeof arg}function isString(arg){return"string"==typeof arg}function isSymbol(arg){return"symbol"==typeof arg}function isUndefined(arg){return void 0===arg}function isRegExp(re){return"[object RegExp]"===objectToString(re)}function isObject(arg){return"object"==typeof arg&&null!==arg}function isDate(d){return"[object Date]"===objectToString(d)}function isError(e){return"[object Error]"===objectToString(e)||e instanceof Error}function isFunction(arg){return"function"==typeof arg}function isPrimitive(arg){return null===arg||"boolean"==typeof arg||"number"==typeof arg||"string"==typeof arg||"symbol"==typeof arg||"undefined"==typeof arg}function objectToString(o){return Object.prototype.toString.call(o)}exports.isArray=isArray,exports.isBoolean=isBoolean,exports.isNull=isNull,exports.isNullOrUndefined=isNullOrUndefined,exports.isNumber=isNumber,exports.isString=isString,exports.isSymbol=isSymbol,exports.isUndefined=isUndefined,exports.isRegExp=isRegExp,exports.isObject=isObject,exports.isDate=isDate,exports.isError=isError,exports.isFunction=isFunction,exports.isPrimitive=isPrimitive,exports.isBuffer=Buffer.isBuffer}).call(exports,__webpack_require__(2).Buffer)},function(module,exports){"use strict";exports.command=function(send,name){return function(opts,cb){return"function"==typeof opts&&(cb=opts,opts={}),send(name,null,opts,null,cb)}},exports.argCommand=function(send,name){return function(arg,opts,cb){return"function"==typeof opts&&(cb=opts,opts={}),send(name,arg,opts,null,cb)}}},function(module,exports){var $Object=Object;module.exports={create:$Object.create,getProto:$Object.getPrototypeOf,isEnum:{}.propertyIsEnumerable,getDesc:$Object.getOwnPropertyDescriptor,setDesc:$Object.defineProperty,setDescs:$Object.defineProperties,getKeys:$Object.keys,getNames:$Object.getOwnPropertyNames,getSymbols:$Object.getOwnPropertySymbols,each:[].forEach}},function(module,exports,__webpack_require__){(function(process){function noop(){}function patch(fs){function readFile(path,options,cb){function go$readFile(path,options,cb){return fs$readFile(path,options,function(err){!err||"EMFILE"!==err.code&&"ENFILE"!==err.code?("function"==typeof cb&&cb.apply(this,arguments),retry()):enqueue([go$readFile,[path,options,cb]])})}return"function"==typeof options&&(cb=options,options=null),go$readFile(path,options,cb)}function writeFile(path,data,options,cb){function go$writeFile(path,data,options,cb){return fs$writeFile(path,data,options,function(err){!err||"EMFILE"!==err.code&&"ENFILE"!==err.code?("function"==typeof cb&&cb.apply(this,arguments),retry()):enqueue([go$writeFile,[path,data,options,cb]])})}return"function"==typeof options&&(cb=options,options=null),go$writeFile(path,data,options,cb)}function appendFile(path,data,options,cb){function go$appendFile(path,data,options,cb){return fs$appendFile(path,data,options,function(err){!err||"EMFILE"!==err.code&&"ENFILE"!==err.code?("function"==typeof cb&&cb.apply(this,arguments),retry()):enqueue([go$appendFile,[path,data,options,cb]])})}return"function"==typeof options&&(cb=options,options=null),go$appendFile(path,data,options,cb)}function readdir(path,cb){function go$readdir(){return fs$readdir(path,function(err,files){files&&files.sort&&files.sort(),!err||"EMFILE"!==err.code&&"ENFILE"!==err.code?("function"==typeof cb&&cb.apply(this,arguments),retry()):enqueue([go$readdir,[path,cb]])})}return go$readdir(path,cb)}function ReadStream(path,options){return this instanceof ReadStream?(fs$ReadStream.apply(this,arguments),this):ReadStream.apply(Object.create(ReadStream.prototype),arguments)}function ReadStream$open(){var that=this;open(that.path,that.flags,that.mode,function(err,fd){err?(that.autoClose&&that.destroy(),that.emit("error",err)):(that.fd=fd,that.emit("open",fd),that.read())})}function WriteStream(path,options){return this instanceof WriteStream?(fs$WriteStream.apply(this,arguments),this):WriteStream.apply(Object.create(WriteStream.prototype),arguments)}function WriteStream$open(){var that=this;open(that.path,that.flags,that.mode,function(err,fd){err?(that.destroy(),that.emit("error",err)):(that.fd=fd,that.emit("open",fd))})}function createReadStream(path,options){return new ReadStream(path,options)}function createWriteStream(path,options){return new WriteStream(path,options)}function open(path,flags,mode,cb){function go$open(path,flags,mode,cb){return fs$open(path,flags,mode,function(err,fd){!err||"EMFILE"!==err.code&&"ENFILE"!==err.code?("function"==typeof cb&&cb.apply(this,arguments),retry()):enqueue([go$open,[path,flags,mode,cb]])})}return"function"==typeof mode&&(cb=mode,mode=null),go$open(path,flags,mode,cb)}polyfills(fs),fs.gracefulify=patch,fs.FileReadStream=ReadStream,fs.FileWriteStream=WriteStream,fs.createReadStream=createReadStream,fs.createWriteStream=createWriteStream;var fs$readFile=fs.readFile;fs.readFile=readFile;var fs$writeFile=fs.writeFile;fs.writeFile=writeFile;var fs$appendFile=fs.appendFile;fs$appendFile&&(fs.appendFile=appendFile);var fs$readdir=fs.readdir;if(fs.readdir=readdir,"v0.8"===process.version.substr(0,4)){var legStreams=legacy(fs);ReadStream=legStreams.ReadStream,WriteStream=legStreams.WriteStream}var fs$ReadStream=fs.ReadStream;ReadStream.prototype=Object.create(fs$ReadStream.prototype),ReadStream.prototype.open=ReadStream$open;var fs$WriteStream=fs.WriteStream;WriteStream.prototype=Object.create(fs$WriteStream.prototype),WriteStream.prototype.open=WriteStream$open,fs.ReadStream=ReadStream,fs.WriteStream=WriteStream;var fs$open=fs.open;return fs.open=open,fs}function enqueue(elem){debug("ENQUEUE",elem[0].name,elem[1]),queue.push(elem)}function retry(){var elem=queue.shift();elem&&(debug("RETRY",elem[0].name,elem[1]),elem[0].apply(null,elem[1]))}var fs=__webpack_require__(5),polyfills=__webpack_require__(183),legacy=__webpack_require__(182),queue=[],util=__webpack_require__(7),debug=noop;util.debuglog?debug=util.debuglog("gfs4"):/\bgfs4\b/i.test(process.env.NODE_DEBUG||"")&&(debug=function(){var m=util.format.apply(util,arguments);m="GFS4: "+m.split(/\n/).join("\nGFS4: "),console.error(m)}),/\bgfs4\b/i.test(process.env.NODE_DEBUG||"")&&process.on("exit",function(){debug(queue),__webpack_require__(30).equal(queue.length,0)}),module.exports=patch(__webpack_require__(67)),process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH&&(module.exports=patch(fs)),fs.close=function(fs$close){return function(fd,cb){return fs$close.call(fs,fd,function(err){err||retry(),"function"==typeof cb&&cb.apply(this,arguments)})}}(fs.close),fs.closeSync=function(fs$closeSync){return function(fd){var rval=fs$closeSync.apply(fs,arguments);return retry(),rval}}(fs.closeSync)}).call(exports,__webpack_require__(1))},function(module,exports){var core=module.exports={version:"1.2.6"};"number"==typeof __e&&(__e=core)},function(module,exports){function EventEmitter(){this._events=this._events||{},this._maxListeners=this._maxListeners||void 0}function isFunction(arg){return"function"==typeof arg}function isNumber(arg){return"number"==typeof arg}function isObject(arg){return"object"==typeof arg&&null!==arg}function isUndefined(arg){return void 0===arg}module.exports=EventEmitter,EventEmitter.EventEmitter=EventEmitter,EventEmitter.prototype._events=void 0,EventEmitter.prototype._maxListeners=void 0,EventEmitter.defaultMaxListeners=10,EventEmitter.prototype.setMaxListeners=function(n){if(!isNumber(n)||0>n||isNaN(n))throw TypeError("n must be a positive number");return this._maxListeners=n,this},EventEmitter.prototype.emit=function(type){var er,handler,len,args,i,listeners;if(this._events||(this._events={}),"error"===type&&(!this._events.error||isObject(this._events.error)&&!this._events.error.length)){if(er=arguments[1],er instanceof Error)throw er;throw TypeError('Uncaught, unspecified "error" event.')}if(handler=this._events[type],isUndefined(handler))return!1;if(isFunction(handler))switch(arguments.length){case 1:handler.call(this);break;case 2:handler.call(this,arguments[1]);break;case 3:handler.call(this,arguments[1],arguments[2]);break;default:args=Array.prototype.slice.call(arguments,1),handler.apply(this,args)}else if(isObject(handler))for(args=Array.prototype.slice.call(arguments,1),listeners=handler.slice(),len=listeners.length,i=0;len>i;i++)listeners[i].apply(this,args);return!0},EventEmitter.prototype.addListener=function(type,listener){var m;if(!isFunction(listener))throw TypeError("listener must be a function");return this._events||(this._events={}),this._events.newListener&&this.emit("newListener",type,isFunction(listener.listener)?listener.listener:listener),this._events[type]?isObject(this._events[type])?this._events[type].push(listener):this._events[type]=[this._events[type],listener]:this._events[type]=listener,isObject(this._events[type])&&!this._events[type].warned&&(m=isUndefined(this._maxListeners)?EventEmitter.defaultMaxListeners:this._maxListeners,m&&m>0&&this._events[type].length>m&&(this._events[type].warned=!0,console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.",this._events[type].length),"function"==typeof console.trace&&console.trace())),this},EventEmitter.prototype.on=EventEmitter.prototype.addListener,EventEmitter.prototype.once=function(type,listener){function g(){this.removeListener(type,g),fired||(fired=!0,listener.apply(this,arguments))}if(!isFunction(listener))throw TypeError("listener must be a function");var fired=!1;return g.listener=listener,this.on(type,g),this},EventEmitter.prototype.removeListener=function(type,listener){var list,position,length,i;if(!isFunction(listener))throw TypeError("listener must be a function");if(!this._events||!this._events[type])return this;if(list=this._events[type],length=list.length,position=-1,list===listener||isFunction(list.listener)&&list.listener===listener)delete this._events[type],this._events.removeListener&&this.emit("removeListener",type,listener);else if(isObject(list)){for(i=length;i-- >0;)if(list[i]===listener||list[i].listener&&list[i].listener===listener){position=i;break}if(0>position)return this;1===list.length?(list.length=0,delete this._events[type]):list.splice(position,1),this._events.removeListener&&this.emit("removeListener",type,listener)}return this},EventEmitter.prototype.removeAllListeners=function(type){var key,listeners;if(!this._events)return this;if(!this._events.removeListener)return 0===arguments.length?this._events={}:this._events[type]&&delete this._events[type],this;if(0===arguments.length){for(key in this._events)"removeListener"!==key&&this.removeAllListeners(key);return this.removeAllListeners("removeListener"),this._events={},this}if(listeners=this._events[type],isFunction(listeners))this.removeListener(type,listeners);else if(listeners)for(;listeners.length;)this.removeListener(type,listeners[listeners.length-1]);return delete this._events[type],this},EventEmitter.prototype.listeners=function(type){var ret;return ret=this._events&&this._events[type]?isFunction(this._events[type])?[this._events[type]]:this._events[type].slice():[]},EventEmitter.prototype.listenerCount=function(type){if(this._events){var evlistener=this._events[type];if(isFunction(evlistener))return 1;if(evlistener)return evlistener.length}return 0},EventEmitter.listenerCount=function(emitter,type){return emitter.listenerCount(type)}},function(module,exports,__webpack_require__){(function(process){function Duplex(options){return this instanceof Duplex?(Readable.call(this,options),Writable.call(this,options),options&&options.readable===!1&&(this.readable=!1),options&&options.writable===!1&&(this.writable=!1),this.allowHalfOpen=!0,options&&options.allowHalfOpen===!1&&(this.allowHalfOpen=!1),void this.once("end",onend)):new Duplex(options)}function onend(){this.allowHalfOpen||this._writableState.ended||process.nextTick(this.end.bind(this))}function forEach(xs,f){for(var i=0,l=xs.length;l>i;i++)f(xs[i],i)}module.exports=Duplex;var objectKeys=Object.keys||function(obj){var keys=[];for(var key in obj)keys.push(key);return keys},util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Readable=__webpack_require__(82),Writable=__webpack_require__(43);util.inherits(Duplex,Readable),forEach(objectKeys(Writable.prototype),function(method){Duplex.prototype[method]||(Duplex.prototype[method]=Writable.prototype[method])})}).call(exports,__webpack_require__(1))},function(module,exports){function extend(){for(var target={},i=0;i<arguments.length;i++){var source=arguments[i];for(var key in source)hasOwnProperty.call(source,key)&&(target[key]=source[key])}return target}module.exports=extend;var hasOwnProperty=Object.prototype.hasOwnProperty},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(147),__esModule:!0}},function(module,exports,__webpack_require__){"use strict";function Duplex(options){return this instanceof Duplex?(Readable.call(this,options),Writable.call(this,options),options&&options.readable===!1&&(this.readable=!1),options&&options.writable===!1&&(this.writable=!1),this.allowHalfOpen=!0,options&&options.allowHalfOpen===!1&&(this.allowHalfOpen=!1),void this.once("end",onend)):new Duplex(options)}function onend(){this.allowHalfOpen||this._writableState.ended||processNextTick(onEndNT,this)}function onEndNT(self){self.end()}var objectKeys=Object.keys||function(obj){var keys=[];for(var key in obj)keys.push(key);return keys};module.exports=Duplex;var processNextTick=__webpack_require__(39),util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Readable=__webpack_require__(78),Writable=__webpack_require__(79);util.inherits(Duplex,Readable);for(var keys=objectKeys(Writable.prototype),v=0;v<keys.length;v++){var method=keys[v];Duplex.prototype[method]||(Duplex.prototype[method]=Writable.prototype[method])}},function(module,exports,__webpack_require__){function assertEncoding(encoding){if(encoding&&!isBufferEncoding(encoding))throw new Error("Unknown encoding: "+encoding)}function passThroughWrite(buffer){return buffer.toString(this.encoding)}function utf16DetectIncompleteChar(buffer){this.charReceived=buffer.length%2,this.charLength=this.charReceived?2:0}function base64DetectIncompleteChar(buffer){this.charReceived=buffer.length%3,this.charLength=this.charReceived?3:0}var Buffer=__webpack_require__(2).Buffer,isBufferEncoding=Buffer.isEncoding||function(encoding){switch(encoding&&encoding.toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":case"raw":return!0;default:return!1}},StringDecoder=exports.StringDecoder=function(encoding){switch(this.encoding=(encoding||"utf8").toLowerCase().replace(/[-_]/,""),assertEncoding(encoding),this.encoding){case"utf8":this.surrogateSize=3;break;case"ucs2":case"utf16le":this.surrogateSize=2,this.detectIncompleteChar=utf16DetectIncompleteChar;break;case"base64":this.surrogateSize=3,this.detectIncompleteChar=base64DetectIncompleteChar;break;default:return void(this.write=passThroughWrite)}this.charBuffer=new Buffer(6),this.charReceived=0,this.charLength=0};StringDecoder.prototype.write=function(buffer){for(var charStr="";this.charLength;){var available=buffer.length>=this.charLength-this.charReceived?this.charLength-this.charReceived:buffer.length;if(buffer.copy(this.charBuffer,this.charReceived,0,available),this.charReceived+=available,this.charReceived<this.charLength)return"";buffer=buffer.slice(available,buffer.length),charStr=this.charBuffer.slice(0,this.charLength).toString(this.encoding);var charCode=charStr.charCodeAt(charStr.length-1);if(!(charCode>=55296&&56319>=charCode)){if(this.charReceived=this.charLength=0,0===buffer.length)return charStr;break}this.charLength+=this.surrogateSize,charStr=""}this.detectIncompleteChar(buffer);var end=buffer.length;this.charLength&&(buffer.copy(this.charBuffer,0,buffer.length-this.charReceived,end),end-=this.charReceived),charStr+=buffer.toString(this.encoding,0,end);var end=charStr.length-1,charCode=charStr.charCodeAt(end);if(charCode>=55296&&56319>=charCode){var size=this.surrogateSize;return this.charLength+=size,this.charReceived+=size,this.charBuffer.copy(this.charBuffer,size,0,size),buffer.copy(this.charBuffer,0,0,size),charStr.substring(0,end)}return charStr},StringDecoder.prototype.detectIncompleteChar=function(buffer){for(var i=buffer.length>=3?3:buffer.length;i>0;i--){var c=buffer[buffer.length-i];if(1==i&&c>>5==6){this.charLength=2;break}if(2>=i&&c>>4==14){this.charLength=3;break}if(3>=i&&c>>3==30){this.charLength=4;break}}this.charReceived=i},StringDecoder.prototype.end=function(buffer){var res="";if(buffer&&buffer.length&&(res=this.write(buffer)),this.charReceived){var cr=this.charReceived,buf=this.charBuffer,enc=this.encoding;res+=buf.slice(0,cr).toString(enc)}return res}},function(module,exports,__webpack_require__){(function(Buffer,process){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}var _stringify=__webpack_require__(122),_stringify2=_interopRequireDefault(_stringify),_keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),_defineProperty=__webpack_require__(124),_defineProperty2=_interopRequireDefault(_defineProperty),_getOwnPropertyDescriptor=__webpack_require__(125),_getOwnPropertyDescriptor2=_interopRequireDefault(_getOwnPropertyDescriptor),_getOwnPropertyNames=__webpack_require__(126),_getOwnPropertyNames2=_interopRequireDefault(_getOwnPropertyNames),_create=__webpack_require__(31),_create2=_interopRequireDefault(_create),_getPrototypeOf=__webpack_require__(127),_getPrototypeOf2=_interopRequireDefault(_getPrototypeOf),_typeof2=__webpack_require__(22),_typeof3=_interopRequireDefault(_typeof2),Crypto=__webpack_require__(170),Path=__webpack_require__(6),Util=__webpack_require__(7),Escape=__webpack_require__(93),internals={};exports.clone=function(obj,seen){if("object"!==("undefined"==typeof obj?"undefined":(0,_typeof3["default"])(obj))||null===obj)return obj;seen=seen||{orig:[],copy:[]};var lookup=seen.orig.indexOf(obj);if(-1!==lookup)return seen.copy[lookup];var newObj=void 0,cloneDeep=!1;if(Array.isArray(obj))newObj=[],cloneDeep=!0;else if(Buffer.isBuffer(obj))newObj=new Buffer(obj);else if(obj instanceof Date)newObj=new Date(obj.getTime());else if(obj instanceof RegExp)newObj=new RegExp(obj);else{var proto=(0,_getPrototypeOf2["default"])(obj);proto&&proto.isImmutable?newObj=obj:(newObj=(0,_create2["default"])(proto),cloneDeep=!0)}if(seen.orig.push(obj),seen.copy.push(newObj),cloneDeep)for(var keys=(0,_getOwnPropertyNames2["default"])(obj),i=0;i<keys.length;++i){var key=keys[i],descriptor=(0,_getOwnPropertyDescriptor2["default"])(obj,key);descriptor&&(descriptor.get||descriptor.set)?(0,_defineProperty2["default"])(newObj,key,descriptor):newObj[key]=exports.clone(obj[key],seen)}return newObj},exports.merge=function(target,source,isNullOverride,isMergeArrays){if(exports.assert(target&&"object"===("undefined"==typeof target?"undefined":(0,_typeof3["default"])(target)),"Invalid target value: must be an object"),exports.assert(null===source||void 0===source||"object"===("undefined"==typeof source?"undefined":(0,_typeof3["default"])(source)),"Invalid source value: must be null, undefined, or an object"),!source)return target;if(Array.isArray(source)){exports.assert(Array.isArray(target),"Cannot merge array onto an object"),isMergeArrays===!1&&(target.length=0);for(var i=0;i<source.length;++i)target.push(exports.clone(source[i]));return target}for(var keys=(0,_keys2["default"])(source),i=0;i<keys.length;++i){var key=keys[i],value=source[key];value&&"object"===("undefined"==typeof value?"undefined":(0,_typeof3["default"])(value))?!target[key]||"object"!==(0,_typeof3["default"])(target[key])||Array.isArray(target[key])^Array.isArray(value)||value instanceof Date||Buffer.isBuffer(value)||value instanceof RegExp?target[key]=exports.clone(value):exports.merge(target[key],value,isNullOverride,isMergeArrays):null!==value&&void 0!==value?target[key]=value:isNullOverride!==!1&&(target[key]=value)}return target},exports.applyToDefaults=function(defaults,options,isNullOverride){if(exports.assert(defaults&&"object"===("undefined"==typeof defaults?"undefined":(0,_typeof3["default"])(defaults)),"Invalid defaults value: must be an object"),exports.assert(!options||options===!0||"object"===("undefined"==typeof options?"undefined":(0,_typeof3["default"])(options)),"Invalid options value: must be true, falsy or an object"),!options)return null;var copy=exports.clone(defaults);return options===!0?copy:exports.merge(copy,options,isNullOverride===!0,!1)},exports.cloneWithShallow=function(source,keys){if(!source||"object"!==("undefined"==typeof source?"undefined":(0,_typeof3["default"])(source)))return source;var storage=internals.store(source,keys),copy=exports.clone(source);return internals.restore(copy,source,storage),copy},internals.store=function(source,keys){for(var storage={},i=0;i<keys.length;++i){var key=keys[i],value=exports.reach(source,key);void 0!==value&&(storage[key]=value,internals.reachSet(source,key,void 0))}return storage},internals.restore=function(copy,source,storage){for(var keys=(0,_keys2["default"])(storage),i=0;i<keys.length;++i){var key=keys[i];internals.reachSet(copy,key,storage[key]),internals.reachSet(source,key,storage[key])}},internals.reachSet=function(obj,key,value){for(var path=key.split("."),ref=obj,i=0;i<path.length;++i){var segment=path[i];i+1===path.length&&(ref[segment]=value),ref=ref[segment]}},exports.applyToDefaultsWithShallow=function(defaults,options,keys){if(exports.assert(defaults&&"object"===("undefined"==typeof defaults?"undefined":(0,_typeof3["default"])(defaults)),"Invalid defaults value: must be an object"),exports.assert(!options||options===!0||"object"===("undefined"==typeof options?"undefined":(0,_typeof3["default"])(options)),"Invalid options value: must be true, falsy or an object"),
exports.assert(keys&&Array.isArray(keys),"Invalid keys"),!options)return null;var copy=exports.cloneWithShallow(defaults,keys);if(options===!0)return copy;var storage=internals.store(options,keys);return exports.merge(copy,options,!1,!1),internals.restore(copy,options,storage),copy},exports.deepEqual=function(obj,ref,options,seen){options=options||{prototype:!0};var type="undefined"==typeof obj?"undefined":(0,_typeof3["default"])(obj);if(type!==("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref)))return!1;if("object"!==type||null===obj||null===ref)return obj===ref?0!==obj||1/obj===1/ref:obj!==obj&&ref!==ref;if(seen=seen||[],-1!==seen.indexOf(obj))return!0;if(seen.push(obj),Array.isArray(obj)){if(!Array.isArray(ref))return!1;if(!options.part&&obj.length!==ref.length)return!1;for(var i=0;i<obj.length;++i){if(options.part){for(var found=!1,j=0;j<ref.length;++j)if(exports.deepEqual(obj[i],ref[j],options)){found=!0;break}return found}if(!exports.deepEqual(obj[i],ref[i],options))return!1}return!0}if(Buffer.isBuffer(obj)){if(!Buffer.isBuffer(ref))return!1;if(obj.length!==ref.length)return!1;for(var i=0;i<obj.length;++i)if(obj[i]!==ref[i])return!1;return!0}if(obj instanceof Date)return ref instanceof Date&&obj.getTime()===ref.getTime();if(obj instanceof RegExp)return ref instanceof RegExp&&obj.toString()===ref.toString();if(options.prototype&&(0,_getPrototypeOf2["default"])(obj)!==(0,_getPrototypeOf2["default"])(ref))return!1;var keys=(0,_getOwnPropertyNames2["default"])(obj);if(!options.part&&keys.length!==(0,_getOwnPropertyNames2["default"])(ref).length)return!1;for(var i=0;i<keys.length;++i){var key=keys[i],descriptor=(0,_getOwnPropertyDescriptor2["default"])(obj,key);if(descriptor.get){if(!exports.deepEqual(descriptor,(0,_getOwnPropertyDescriptor2["default"])(ref,key),options,seen))return!1}else if(!exports.deepEqual(obj[key],ref[key],options,seen))return!1}return!0},exports.unique=function(array,key){for(var index={},result=[],i=0;i<array.length;++i){var id=key?array[i][key]:array[i];index[id]!==!0&&(result.push(array[i]),index[id]=!0)}return result},exports.mapToObject=function(array,key){if(!array)return null;for(var obj={},i=0;i<array.length;++i)key?array[i][key]&&(obj[array[i][key]]=!0):obj[array[i]]=!0;return obj},exports.intersect=function(array1,array2,justFirst){if(!array1||!array2)return[];for(var common=[],hash=Array.isArray(array1)?exports.mapToObject(array1):array1,found={},i=0;i<array2.length;++i)if(hash[array2[i]]&&!found[array2[i]]){if(justFirst)return array2[i];common.push(array2[i]),found[array2[i]]=!0}return justFirst?null:common},exports.contain=function(ref,values,options){var valuePairs=null;"object"!==("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref))||"object"!==("undefined"==typeof values?"undefined":(0,_typeof3["default"])(values))||Array.isArray(ref)||Array.isArray(values)?values=[].concat(values):(valuePairs=values,values=(0,_keys2["default"])(values)),options=options||{},exports.assert(arguments.length>=2,"Insufficient arguments"),exports.assert("string"==typeof ref||"object"===("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref)),"Reference must be string or an object"),exports.assert(values.length,"Values array cannot be empty");var compare=void 0,compareFlags=void 0;if(options.deep){compare=exports.deepEqual;var hasOnly=options.hasOwnProperty("only"),hasPart=options.hasOwnProperty("part");compareFlags={prototype:hasOnly?options.only:hasPart?!options.part:!1,part:hasOnly?!options.only:hasPart?options.part:!0}}else compare=function(a,b){return a===b};for(var misses=!1,matches=new Array(values.length),i=0;i<matches.length;++i)matches[i]=0;if("string"==typeof ref){for(var pattern="(",i=0;i<values.length;++i){var value=values[i];exports.assert("string"==typeof value,"Cannot compare string reference to non-string value"),pattern+=(i?"|":"")+exports.escapeRegex(value)}var regex=new RegExp(pattern+")","g"),leftovers=ref.replace(regex,function($0,$1){var index=values.indexOf($1);return++matches[index],""});misses=!!leftovers}else if(Array.isArray(ref))for(var i=0;i<ref.length;++i){for(var matched=!1,j=0;j<values.length&&matched===!1;++j)matched=compare(values[j],ref[i],compareFlags)&&j;matched!==!1?++matches[matched]:misses=!0}else for(var keys=(0,_keys2["default"])(ref),i=0;i<keys.length;++i){var key=keys[i],pos=values.indexOf(key);if(-1!==pos){if(valuePairs&&!compare(valuePairs[key],ref[key],compareFlags))return!1;++matches[pos]}else misses=!0}for(var result=!1,i=0;i<matches.length;++i)if(result=result||!!matches[i],options.once&&matches[i]>1||!options.part&&!matches[i])return!1;return options.only&&misses?!1:result},exports.flatten=function(array,target){for(var result=target||[],i=0;i<array.length;++i)Array.isArray(array[i])?exports.flatten(array[i],result):result.push(array[i]);return result},exports.reach=function(obj,chain,options){if(chain===!1||null===chain||"undefined"==typeof chain)return obj;options=options||{},"string"==typeof options&&(options={separator:options});for(var path=chain.split(options.separator||"."),ref=obj,i=0;i<path.length;++i){var key=path[i];if("-"===key[0]&&Array.isArray(ref)&&(key=key.slice(1,key.length),key=ref.length-key),!ref||"object"!==("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref))&&"function"!=typeof ref||!(key in ref)||"object"!==("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref))&&options.functions===!1){exports.assert(!options.strict||i+1===path.length,"Missing segment",key,"in reach path ",chain),exports.assert("object"===("undefined"==typeof ref?"undefined":(0,_typeof3["default"])(ref))||options.functions===!0||"function"!=typeof ref,"Invalid segment",key,"in reach path ",chain),ref=options["default"];break}ref=ref[key]}return ref},exports.reachTemplate=function(obj,template,options){return template.replace(/{([^}]+)}/g,function($0,chain){var value=exports.reach(obj,chain,options);return void 0===value||null===value?"":value})},exports.formatStack=function(stack){for(var trace=[],i=0;i<stack.length;++i){var item=stack[i];trace.push([item.getFileName(),item.getLineNumber(),item.getColumnNumber(),item.getFunctionName(),item.isConstructor()])}return trace},exports.formatTrace=function(trace){for(var display=[],i=0;i<trace.length;++i){var row=trace[i];display.push((row[4]?"new ":"")+row[3]+" ("+row[0]+":"+row[1]+":"+row[2]+")")}return display},exports.callStack=function(slice){var v8=Error.prepareStackTrace;Error.prepareStackTrace=function(err,stack){return stack};var capture={};Error.captureStackTrace(capture,this);var stack=capture.stack;Error.prepareStackTrace=v8;var trace=exports.formatStack(stack);return trace.slice(1+slice)},exports.displayStack=function(slice){var trace=exports.callStack(void 0===slice?1:slice+1);return exports.formatTrace(trace)},exports.abortThrow=!1,exports.abort=function(message,hideStack){if("test"===process.env.NODE_ENV||exports.abortThrow===!0)throw new Error(message||"Unknown error");var stack="";hideStack||(stack=exports.displayStack(1).join("\n ")),console.log("ABORT: "+message+"\n "+stack),process.exit(1)},exports.assert=function(condition){if(!condition){if(2===arguments.length&&arguments[1]instanceof Error)throw arguments[1];for(var msgs=[],i=1;i<arguments.length;++i)""!==arguments[i]&&msgs.push(arguments[i]);throw msgs=msgs.map(function(msg){return"string"==typeof msg?msg:msg instanceof Error?msg.message:exports.stringify(msg)}),new Error(msgs.join(" ")||"Unknown error")}},exports.Timer=function(){this.ts=0,this.reset()},exports.Timer.prototype.reset=function(){this.ts=Date.now()},exports.Timer.prototype.elapsed=function(){return Date.now()-this.ts},exports.Bench=function(){this.ts=0,this.reset()},exports.Bench.prototype.reset=function(){this.ts=exports.Bench.now()},exports.Bench.prototype.elapsed=function(){return exports.Bench.now()-this.ts},exports.Bench.now=function(){var ts=process.hrtime();return 1e3*ts[0]+ts[1]/1e6},exports.escapeRegex=function(string){return string.replace(/[\^\$\.\*\+\-\?\=\!\:\|\\\/\(\)\[\]\{\}\,]/g,"\\$&")},exports.base64urlEncode=function(value,encoding){var buf=Buffer.isBuffer(value)?value:new Buffer(value,encoding||"binary");return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/\=/g,"")},exports.base64urlDecode=function(value,encoding){if(value&&!/^[\w\-]*$/.test(value))return new Error("Invalid character");try{var buf=new Buffer(value,"base64");return"buffer"===encoding?buf:buf.toString(encoding||"binary")}catch(err){return err}},exports.escapeHeaderAttribute=function(attribute){return exports.assert(/^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~\"\\]*$/.test(attribute),"Bad attribute value ("+attribute+")"),attribute.replace(/\\/g,"\\\\").replace(/\"/g,'\\"')},exports.escapeHtml=function(string){return Escape.escapeHtml(string)},exports.escapeJavaScript=function(string){return Escape.escapeJavaScript(string)},exports.nextTick=function(callback){return function(){var args=arguments;process.nextTick(function(){callback.apply(null,args)})}},exports.once=function(method){if(method._hoekOnce)return method;var once=!1,wrapped=function(){once||(once=!0,method.apply(null,arguments))};return wrapped._hoekOnce=!0,wrapped},exports.isAbsolutePath=function(path,platform){return path?Path.isAbsolute?Path.isAbsolute(path):(platform=platform||process.platform,"win32"!==platform?"/"===path[0]:!!/^(?:[a-zA-Z]:[\\\/])|(?:[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/])/.test(path)):!1},exports.isInteger=function(value){return"number"==typeof value&&parseFloat(value)===parseInt(value,10)&&!isNaN(value)},exports.ignore=function(){},exports.inherits=Util.inherits,exports.format=Util.format,exports.transform=function(source,transform,options){if(exports.assert(null===source||void 0===source||"object"===("undefined"==typeof source?"undefined":(0,_typeof3["default"])(source))||Array.isArray(source),"Invalid source object: must be null, undefined, an object, or an array"),Array.isArray(source)){for(var results=[],i=0;i<source.length;++i)results.push(exports.transform(source[i],transform,options));return results}for(var result={},keys=(0,_keys2["default"])(transform),i=0;i<keys.length;++i){var key=keys[i],path=key.split("."),sourcePath=transform[key];exports.assert("string"==typeof sourcePath,'All mappings must be "." delineated strings');for(var segment=void 0,res=result;path.length>1;)segment=path.shift(),res[segment]||(res[segment]={}),res=res[segment];segment=path.shift(),res[segment]=exports.reach(source,sourcePath,options)}return result},exports.uniqueFilename=function(path,extension){extension=extension?"."!==extension[0]?"."+extension:extension:"",path=Path.resolve(path);var name=[Date.now(),process.pid,Crypto.randomBytes(8).toString("hex")].join("-")+extension;return Path.join(path,name)},exports.stringify=function(){try{return _stringify2["default"].apply(null,arguments)}catch(err){return"[Cannot display object: "+err.message+"]"}},exports.shallow=function(source){for(var target={},keys=(0,_keys2["default"])(source),i=0;i<keys.length;++i){var key=keys[i];target[key]=source[key]}return target}}).call(exports,__webpack_require__(2).Buffer,__webpack_require__(1))},function(module,exports){function isObjectLike(value){return!!value&&"object"==typeof value}function getNative(object,key){var value=null==object?void 0:object[key];return isNative(value)?value:void 0}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function isFunction(value){return isObject(value)&&objToString.call(value)==funcTag}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}function isNative(value){return null==value?!1:isFunction(value)?reIsNative.test(fnToString.call(value)):isObjectLike(value)&&reIsHostCtor.test(value)}var arrayTag="[object Array]",funcTag="[object Function]",reIsHostCtor=/^\[object .+?Constructor\]$/,objectProto=Object.prototype,fnToString=Function.prototype.toString,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString,reIsNative=RegExp("^"+fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),nativeIsArray=getNative(Array,"isArray"),MAX_SAFE_INTEGER=9007199254740991,isArray=nativeIsArray||function(value){return isObjectLike(value)&&isLength(value.length)&&objToString.call(value)==arrayTag};module.exports=isArray},function(module,exports,__webpack_require__){(function(process){function DestroyableTransform(opts){Transform.call(this,opts),this._destroyed=!1}function noop(chunk,enc,callback){callback(null,chunk)}function through2(construct){return function(options,transform,flush){return"function"==typeof options&&(flush=transform,transform=options,options={}),"function"!=typeof transform&&(transform=noop),"function"!=typeof flush&&(flush=null),construct(options,transform,flush)}}var Transform=__webpack_require__(41),inherits=__webpack_require__(7).inherits,xtend=__webpack_require__(15);inherits(DestroyableTransform,Transform),DestroyableTransform.prototype.destroy=function(err){if(!this._destroyed){this._destroyed=!0;var self=this;process.nextTick(function(){err&&self.emit("error",err),self.emit("close")})}},module.exports=through2(function(options,transform,flush){var t2=new DestroyableTransform(options);return t2._transform=transform,flush&&(t2._flush=flush),t2}),module.exports.ctor=through2(function(options,transform,flush){function Through2(override){return this instanceof Through2?(this.options=xtend(options,override),void DestroyableTransform.call(this,this.options)):new Through2(override)}return inherits(Through2,DestroyableTransform),Through2.prototype._transform=transform,flush&&(Through2.prototype._flush=flush),Through2}),module.exports.obj=through2(function(options,transform,flush){var t2=new DestroyableTransform(xtend({objectMode:!0,highWaterMark:16},options));return t2._transform=transform,flush&&(t2._flush=flush),t2})}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";var _Symbol=__webpack_require__(129)["default"];exports["default"]=function(obj){return obj&&obj.constructor===_Symbol?"symbol":typeof obj},exports.__esModule=!0},function(module,exports,__webpack_require__){var global=__webpack_require__(25),core=__webpack_require__(12),ctx=__webpack_require__(53),PROTOTYPE="prototype",$export=function(type,name,source){var key,own,out,IS_FORCED=type&$export.F,IS_GLOBAL=type&$export.G,IS_STATIC=type&$export.S,IS_PROTO=type&$export.P,IS_BIND=type&$export.B,IS_WRAP=type&$export.W,exports=IS_GLOBAL?core:core[name]||(core[name]={}),target=IS_GLOBAL?global:IS_STATIC?global[name]:(global[name]||{})[PROTOTYPE];IS_GLOBAL&&(source=name);for(key in source)own=!IS_FORCED&&target&&key in target,own&&key in exports||(out=own?target[key]:source[key],exports[key]=IS_GLOBAL&&"function"!=typeof target[key]?source[key]:IS_BIND&&own?ctx(out,global):IS_WRAP&&target[key]==out?function(C){var F=function(param){return this instanceof C?new C(param):C(param)};return F[PROTOTYPE]=C[PROTOTYPE],F}(out):IS_PROTO&&"function"==typeof out?ctx(Function.call,out):out,IS_PROTO&&((exports[PROTOTYPE]||(exports[PROTOTYPE]={}))[key]=out))};$export.F=1,$export.G=2,$export.S=4,$export.P=8,$export.B=16,$export.W=32,module.exports=$export},function(module,exports){module.exports=function(exec){try{return!!exec()}catch(e){return!0}}},function(module,exports){var global=module.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=global)},function(module,exports,__webpack_require__){var $export=__webpack_require__(23),core=__webpack_require__(12),fails=__webpack_require__(24);module.exports=function(KEY,exec){var fn=(core.Object||{})[KEY]||Object[KEY],exp={};exp[KEY]=exec(fn),$export($export.S+$export.F*fails(function(){fn(1)}),"Object",exp)}},function(module,exports,__webpack_require__){var IObject=__webpack_require__(58),defined=__webpack_require__(54);module.exports=function(it){return IObject(defined(it))}},function(module,exports,__webpack_require__){(function(Buffer,process){var stream=__webpack_require__(80),eos=__webpack_require__(174),util=__webpack_require__(7),SIGNAL_FLUSH=new Buffer([0]),onuncork=function(self,fn){self._corked?self.once("uncork",fn):fn()},destroyer=function(self,end){return function(err){err?self.destroy("premature close"===err.message?null:err):end&&!self._ended&&self.end()}},end=function(ws,fn){return ws?ws._writableState&&ws._writableState.finished?fn():ws._writableState?ws.end(fn):(ws.end(),void fn()):fn()},toStreams2=function(rs){return new stream.Readable({objectMode:!0,highWaterMark:16}).wrap(rs)},Duplexify=function(writable,readable,opts){return this instanceof Duplexify?(stream.Duplex.call(this,opts),this._writable=null,this._readable=null,this._readable2=null,this._forwardDestroy=!opts||opts.destroy!==!1,this._forwardEnd=!opts||opts.end!==!1,this._corked=1,this._ondrain=null,this._drained=!1,this._forwarding=!1,this._unwrite=null,this._unread=null,this._ended=!1,this.destroyed=!1,writable&&this.setWritable(writable),void(readable&&this.setReadable(readable))):new Duplexify(writable,readable,opts)};util.inherits(Duplexify,stream.Duplex),Duplexify.obj=function(writable,readable,opts){return opts||(opts={}),opts.objectMode=!0,opts.highWaterMark=16,new Duplexify(writable,readable,opts)},Duplexify.prototype.cork=function(){1===++this._corked&&this.emit("cork")},Duplexify.prototype.uncork=function(){this._corked&&0===--this._corked&&this.emit("uncork")},Duplexify.prototype.setWritable=function(writable){if(this._unwrite&&this._unwrite(),this.destroyed)return void(writable&&writable.destroy&&writable.destroy());if(null===writable||writable===!1)return void this.end();var self=this,unend=eos(writable,{writable:!0,readable:!1},destroyer(this,this._forwardEnd)),ondrain=function(){var ondrain=self._ondrain;self._ondrain=null,ondrain&&ondrain()},clear=function(){self._writable.removeListener("drain",ondrain),unend()};this._unwrite&&process.nextTick(ondrain),this._writable=writable,this._writable.on("drain",ondrain),this._unwrite=clear,this.uncork()},Duplexify.prototype.setReadable=function(readable){if(this._unread&&this._unread(),this.destroyed)return void(readable&&readable.destroy&&readable.destroy());if(null===readable||readable===!1)return this.push(null),void this.resume();var self=this,unend=eos(readable,{writable:!1,readable:!0},destroyer(this)),onreadable=function(){self._forward()},onend=function(){self.push(null)},clear=function(){self._readable2.removeListener("readable",onreadable),self._readable2.removeListener("end",onend),unend()};this._drained=!0,this._readable=readable,this._readable2=readable._readableState?readable:toStreams2(readable),this._readable2.on("readable",onreadable),this._readable2.on("end",onend),this._unread=clear,this._forward()},Duplexify.prototype._read=function(){this._drained=!0,this._forward()},Duplexify.prototype._forward=function(){if(!this._forwarding&&this._readable2&&this._drained){this._forwarding=!0;for(var data,state=this._readable2._readableState;null!==(data=this._readable2.read(state.buffer.length?state.buffer[0].length:state.length));)this._drained=this.push(data);this._forwarding=!1}},Duplexify.prototype.destroy=function(err){if(!this.destroyed){this.destroyed=!0;var self=this;process.nextTick(function(){self._destroy(err)})}},Duplexify.prototype._destroy=function(err){if(err){var ondrain=this._ondrain;this._ondrain=null,ondrain?ondrain(err):this.emit("error",err)}this._forwardDestroy&&(this._readable&&this._readable.destroy&&this._readable.destroy(),this._writable&&this._writable.destroy&&this._writable.destroy()),this.emit("close")},Duplexify.prototype._write=function(data,enc,cb){return this.destroyed?cb():this._corked?onuncork(this,this._write.bind(this,data,enc,cb)):data===SIGNAL_FLUSH?this._finish(cb):this._writable?void(this._writable.write(data)===!1?this._ondrain=cb:cb()):cb()},Duplexify.prototype._finish=function(cb){var self=this;this.emit("preend"),onuncork(this,function(){end(self._forwardEnd&&self._writable,function(){self._writableState.prefinished===!1&&(self._writableState.prefinished=!0),self.emit("prefinish"),onuncork(self,cb)})})},Duplexify.prototype.end=function(data,enc,cb){return"function"==typeof data?this.end(null,null,data):"function"==typeof enc?this.end(data,null,enc):(this._ended=!0,data&&this.write(data),this._writableState.ending||this.write(SIGNAL_FLUSH),stream.Writable.prototype.end.call(this,cb))},module.exports=Duplexify}).call(exports,__webpack_require__(2).Buffer,__webpack_require__(1))},function(module,exports,__webpack_require__){function charSet(s){return s.split("").reduce(function(set,c){return set[c]=!0,set},{})}function filter(pattern,options){return options=options||{},function(p,i,list){return minimatch(p,pattern,options)}}function ext(a,b){a=a||{},b=b||{};var t={};return Object.keys(b).forEach(function(k){t[k]=b[k]}),Object.keys(a).forEach(function(k){t[k]=a[k]}),t}function minimatch(p,pattern,options){if("string"!=typeof pattern)throw new TypeError("glob pattern string required");return options||(options={}),options.nocomment||"#"!==pattern.charAt(0)?""===pattern.trim()?""===p:new Minimatch(pattern,options).match(p):!1}function Minimatch(pattern,options){if(!(this instanceof Minimatch))return new Minimatch(pattern,options);if("string"!=typeof pattern)throw new TypeError("glob pattern string required");options||(options={}),pattern=pattern.trim(),"/"!==path.sep&&(pattern=pattern.split(path.sep).join("/")),this.options=options,this.set=[],this.pattern=pattern,this.regexp=null,this.negate=!1,this.comment=!1,this.empty=!1,this.make()}function make(){if(!this._made){var pattern=this.pattern,options=this.options;if(!options.nocomment&&"#"===pattern.charAt(0))return void(this.comment=!0);if(!pattern)return void(this.empty=!0);this.parseNegate();var set=this.globSet=this.braceExpand();options.debug&&(this.debug=console.error),this.debug(this.pattern,set),set=this.globParts=set.map(function(s){return s.split(slashSplit)}),this.debug(this.pattern,set),set=set.map(function(s,si,set){return s.map(this.parse,this)},this),this.debug(this.pattern,set),set=set.filter(function(s){return-1===s.indexOf(!1)}),this.debug(this.pattern,set),this.set=set}}function parseNegate(){var pattern=this.pattern,negate=!1,options=this.options,negateOffset=0;if(!options.nonegate){for(var i=0,l=pattern.length;l>i&&"!"===pattern.charAt(i);i++)negate=!negate,negateOffset++;negateOffset&&(this.pattern=pattern.substr(negateOffset)),this.negate=negate}}function braceExpand(pattern,options){if(options||(options=this instanceof Minimatch?this.options:{}),pattern="undefined"==typeof pattern?this.pattern:pattern,"undefined"==typeof pattern)throw new Error("undefined pattern");return options.nobrace||!pattern.match(/\{.*\}/)?[pattern]:expand(pattern)}function parse(pattern,isSub){function clearStateChar(){if(stateChar){switch(stateChar){case"*":re+=star,hasMagic=!0;break;case"?":re+=qmark,hasMagic=!0;break;default:re+="\\"+stateChar}self.debug("clearStateChar %j %j",stateChar,re),stateChar=!1}}var options=this.options;if(!options.noglobstar&&"**"===pattern)return GLOBSTAR;if(""===pattern)return"";for(var plType,stateChar,c,re="",hasMagic=!!options.nocase,escaping=!1,patternListStack=[],negativeLists=[],inClass=!1,reClassStart=-1,classStart=-1,patternStart="."===pattern.charAt(0)?"":options.dot?"(?!(?:^|\\/)\\.{1,2}(?:$|\\/))":"(?!\\.)",self=this,i=0,len=pattern.length;len>i&&(c=pattern.charAt(i));i++)if(this.debug("%s  %s %s %j",pattern,i,re,c),escaping&&reSpecials[c])re+="\\"+c,escaping=!1;else switch(c){case"/":return!1;case"\\":clearStateChar(),escaping=!0;continue;case"?":case"*":case"+":case"@":case"!":if(this.debug("%s %s %s %j <-- stateChar",pattern,i,re,c),inClass){this.debug("  in class"),"!"===c&&i===classStart+1&&(c="^"),re+=c;continue}self.debug("call clearStateChar %j",stateChar),clearStateChar(),stateChar=c,options.noext&&clearStateChar();continue;case"(":if(inClass){re+="(";continue}if(!stateChar){re+="\\(";continue}plType=stateChar,patternListStack.push({type:plType,start:i-1,reStart:re.length}),re+="!"===stateChar?"(?:(?!(?:":"(?:",this.debug("plType %j %j",stateChar,re),stateChar=!1;continue;case")":if(inClass||!patternListStack.length){re+="\\)";continue}clearStateChar(),hasMagic=!0,re+=")";var pl=patternListStack.pop();switch(plType=pl.type){case"!":negativeLists.push(pl),re+=")[^/]*?)",pl.reEnd=re.length;break;case"?":case"+":case"*":re+=plType;break;case"@":}continue;case"|":if(inClass||!patternListStack.length||escaping){re+="\\|",escaping=!1;continue}clearStateChar(),re+="|";continue;case"[":if(clearStateChar(),inClass){re+="\\"+c;continue}inClass=!0,classStart=i,reClassStart=re.length,re+=c;continue;case"]":if(i===classStart+1||!inClass){re+="\\"+c,escaping=!1;continue}if(inClass){var cs=pattern.substring(classStart+1,i);try{RegExp("["+cs+"]")}catch(er){var sp=this.parse(cs,SUBPARSE);re=re.substr(0,reClassStart)+"\\["+sp[0]+"\\]",hasMagic=hasMagic||sp[1],inClass=!1;continue}}hasMagic=!0,inClass=!1,re+=c;continue;default:clearStateChar(),escaping?escaping=!1:!reSpecials[c]||"^"===c&&inClass||(re+="\\"),re+=c}for(inClass&&(cs=pattern.substr(classStart+1),sp=this.parse(cs,SUBPARSE),re=re.substr(0,reClassStart)+"\\["+sp[0],hasMagic=hasMagic||sp[1]),pl=patternListStack.pop();pl;pl=patternListStack.pop()){var tail=re.slice(pl.reStart+3);tail=tail.replace(/((?:\\{2})*)(\\?)\|/g,function(_,$1,$2){return $2||($2="\\"),$1+$1+$2+"|"}),this.debug("tail=%j\n   %s",tail,tail);var t="*"===pl.type?star:"?"===pl.type?qmark:"\\"+pl.type;hasMagic=!0,re=re.slice(0,pl.reStart)+t+"\\("+tail}clearStateChar(),escaping&&(re+="\\\\");var addPatternStart=!1;switch(re.charAt(0)){case".":case"[":case"(":addPatternStart=!0}for(var n=negativeLists.length-1;n>-1;n--){var nl=negativeLists[n],nlBefore=re.slice(0,nl.reStart),nlFirst=re.slice(nl.reStart,nl.reEnd-8),nlLast=re.slice(nl.reEnd-8,nl.reEnd),nlAfter=re.slice(nl.reEnd);nlLast+=nlAfter;var openParensBefore=nlBefore.split("(").length-1,cleanAfter=nlAfter;for(i=0;openParensBefore>i;i++)cleanAfter=cleanAfter.replace(/\)[+*?]?/,"");nlAfter=cleanAfter;var dollar="";""===nlAfter&&isSub!==SUBPARSE&&(dollar="$");var newRe=nlBefore+nlFirst+nlAfter+dollar+nlLast;re=newRe}if(""!==re&&hasMagic&&(re="(?=.)"+re),addPatternStart&&(re=patternStart+re),isSub===SUBPARSE)return[re,hasMagic];if(!hasMagic)return globUnescape(pattern);var flags=options.nocase?"i":"",regExp=new RegExp("^"+re+"$",flags);return regExp._glob=pattern,regExp._src=re,regExp}function makeRe(){if(this.regexp||this.regexp===!1)return this.regexp;var set=this.set;if(!set.length)return this.regexp=!1,this.regexp;var options=this.options,twoStar=options.noglobstar?star:options.dot?twoStarDot:twoStarNoDot,flags=options.nocase?"i":"",re=set.map(function(pattern){return pattern.map(function(p){return p===GLOBSTAR?twoStar:"string"==typeof p?regExpEscape(p):p._src}).join("\\/")}).join("|");re="^(?:"+re+")$",this.negate&&(re="^(?!"+re+").*$");try{this.regexp=new RegExp(re,flags)}catch(ex){this.regexp=!1}return this.regexp}function match(f,partial){if(this.debug("match",f,this.pattern),this.comment)return!1;if(this.empty)return""===f;if("/"===f&&partial)return!0;var options=this.options;"/"!==path.sep&&(f=f.split(path.sep).join("/")),f=f.split(slashSplit),this.debug(this.pattern,"split",f);var set=this.set;this.debug(this.pattern,"set",set);var filename,i;for(i=f.length-1;i>=0&&!(filename=f[i]);i--);for(i=0;i<set.length;i++){var pattern=set[i],file=f;options.matchBase&&1===pattern.length&&(file=[filename]);var hit=this.matchOne(file,pattern,partial);if(hit)return options.flipNegate?!0:!this.negate}return options.flipNegate?!1:this.negate}function globUnescape(s){return s.replace(/\\(.)/g,"$1")}function regExpEscape(s){return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&")}module.exports=minimatch,minimatch.Minimatch=Minimatch;var path={sep:"/"};try{path=__webpack_require__(6)}catch(er){}var GLOBSTAR=minimatch.GLOBSTAR=Minimatch.GLOBSTAR={},expand=__webpack_require__(132),qmark="[^/]",star=qmark+"*?",twoStarDot="(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?",twoStarNoDot="(?:(?!(?:\\/|^)\\.).)*?",reSpecials=charSet("().*{}+?[]^$\\!"),slashSplit=/\/+/;minimatch.filter=filter,minimatch.defaults=function(def){if(!def||!Object.keys(def).length)return minimatch;var orig=minimatch,m=function(p,pattern,options){return orig.minimatch(p,pattern,ext(def,options))};return m.Minimatch=function(pattern,options){return new orig.Minimatch(pattern,ext(def,options))},m},Minimatch.defaults=function(def){return def&&Object.keys(def).length?minimatch.defaults(def).Minimatch:Minimatch},Minimatch.prototype.debug=function(){},Minimatch.prototype.make=make,Minimatch.prototype.parseNegate=parseNegate,minimatch.braceExpand=function(pattern,options){return braceExpand(pattern,options)},Minimatch.prototype.braceExpand=braceExpand,Minimatch.prototype.parse=parse;var SUBPARSE={};minimatch.makeRe=function(pattern,options){return new Minimatch(pattern,options||{}).makeRe()},Minimatch.prototype.makeRe=makeRe,minimatch.match=function(list,pattern,options){options=options||{};var mm=new Minimatch(pattern,options);return list=list.filter(function(f){return mm.match(f)}),mm.options.nonull&&!list.length&&list.push(pattern),list},Minimatch.prototype.match=match,Minimatch.prototype.matchOne=function(file,pattern,partial){var options=this.options;this.debug("matchOne",{"this":this,file:file,pattern:pattern}),this.debug("matchOne",file.length,pattern.length);for(var fi=0,pi=0,fl=file.length,pl=pattern.length;fl>fi&&pl>pi;fi++,pi++){this.debug("matchOne loop");var p=pattern[pi],f=file[fi];if(this.debug(pattern,p,f),p===!1)return!1;if(p===GLOBSTAR){this.debug("GLOBSTAR",[pattern,p,f]);var fr=fi,pr=pi+1;if(pr===pl){for(this.debug("** at the end");fl>fi;fi++)if("."===file[fi]||".."===file[fi]||!options.dot&&"."===file[fi].charAt(0))return!1;return!0}for(;fl>fr;){var swallowee=file[fr];if(this.debug("\nglobstar while",file,fr,pattern,pr,swallowee),this.matchOne(file.slice(fr),pattern.slice(pr),partial))return this.debug("globstar found match!",fr,fl,swallowee),!0;if("."===swallowee||".."===swallowee||!options.dot&&"."===swallowee.charAt(0)){this.debug("dot detected!",file,fr,pattern,pr);break}this.debug("globstar swallow a segment, and continue"),fr++}return partial&&(this.debug("\n>>> no match, partial?",file,fr,pattern,pr),fr===fl)?!0:!1}var hit;if("string"==typeof p?(hit=options.nocase?f.toLowerCase()===p.toLowerCase():f===p,this.debug("string match",p,f,hit)):(hit=f.match(p),this.debug("pattern match",p,f,hit)),!hit)return!1}if(fi===fl&&pi===pl)return!0;if(fi===fl)return partial;if(pi===pl){var emptyFileEnd=fi===fl-1&&""===file[fi];return emptyFileEnd}throw new Error("wtf?")}},function(module,exports,__webpack_require__){function replacer(key,value){return util.isUndefined(value)?""+value:util.isNumber(value)&&!isFinite(value)?value.toString():util.isFunction(value)||util.isRegExp(value)?value.toString():value}function truncate(s,n){return util.isString(s)?s.length<n?s:s.slice(0,n):s}function getMessage(self){return truncate(JSON.stringify(self.actual,replacer),128)+" "+self.operator+" "+truncate(JSON.stringify(self.expected,replacer),128)}function fail(actual,expected,message,operator,stackStartFunction){throw new assert.AssertionError({message:message,actual:actual,expected:expected,operator:operator,stackStartFunction:stackStartFunction})}function ok(value,message){value||fail(value,!0,message,"==",assert.ok)}function _deepEqual(actual,expected){if(actual===expected)return!0;if(util.isBuffer(actual)&&util.isBuffer(expected)){if(actual.length!=expected.length)return!1;for(var i=0;i<actual.length;i++)if(actual[i]!==expected[i])return!1;return!0}return util.isDate(actual)&&util.isDate(expected)?actual.getTime()===expected.getTime():util.isRegExp(actual)&&util.isRegExp(expected)?actual.source===expected.source&&actual.global===expected.global&&actual.multiline===expected.multiline&&actual.lastIndex===expected.lastIndex&&actual.ignoreCase===expected.ignoreCase:util.isObject(actual)||util.isObject(expected)?objEquiv(actual,expected):actual==expected;
}function isArguments(object){return"[object Arguments]"==Object.prototype.toString.call(object)}function objEquiv(a,b){if(util.isNullOrUndefined(a)||util.isNullOrUndefined(b))return!1;if(a.prototype!==b.prototype)return!1;if(util.isPrimitive(a)||util.isPrimitive(b))return a===b;var aIsArgs=isArguments(a),bIsArgs=isArguments(b);if(aIsArgs&&!bIsArgs||!aIsArgs&&bIsArgs)return!1;if(aIsArgs)return a=pSlice.call(a),b=pSlice.call(b),_deepEqual(a,b);var key,i,ka=objectKeys(a),kb=objectKeys(b);if(ka.length!=kb.length)return!1;for(ka.sort(),kb.sort(),i=ka.length-1;i>=0;i--)if(ka[i]!=kb[i])return!1;for(i=ka.length-1;i>=0;i--)if(key=ka[i],!_deepEqual(a[key],b[key]))return!1;return!0}function expectedException(actual,expected){return actual&&expected?"[object RegExp]"==Object.prototype.toString.call(expected)?expected.test(actual):actual instanceof expected?!0:expected.call({},actual)===!0?!0:!1:!1}function _throws(shouldThrow,block,expected,message){var actual;util.isString(expected)&&(message=expected,expected=null);try{block()}catch(e){actual=e}if(message=(expected&&expected.name?" ("+expected.name+").":".")+(message?" "+message:"."),shouldThrow&&!actual&&fail(actual,expected,"Missing expected exception"+message),!shouldThrow&&expectedException(actual,expected)&&fail(actual,expected,"Got unwanted exception"+message),shouldThrow&&actual&&expected&&!expectedException(actual,expected)||!shouldThrow&&actual)throw actual}var util=__webpack_require__(7),pSlice=Array.prototype.slice,hasOwn=Object.prototype.hasOwnProperty,assert=module.exports=ok;assert.AssertionError=function(options){this.name="AssertionError",this.actual=options.actual,this.expected=options.expected,this.operator=options.operator,options.message?(this.message=options.message,this.generatedMessage=!1):(this.message=getMessage(this),this.generatedMessage=!0);var stackStartFunction=options.stackStartFunction||fail;if(Error.captureStackTrace)Error.captureStackTrace(this,stackStartFunction);else{var err=new Error;if(err.stack){var out=err.stack,fn_name=stackStartFunction.name,idx=out.indexOf("\n"+fn_name);if(idx>=0){var next_line=out.indexOf("\n",idx+1);out=out.substring(next_line+1)}this.stack=out}}},util.inherits(assert.AssertionError,Error),assert.fail=fail,assert.ok=ok,assert.equal=function(actual,expected,message){actual!=expected&&fail(actual,expected,message,"==",assert.equal)},assert.notEqual=function(actual,expected,message){actual==expected&&fail(actual,expected,message,"!=",assert.notEqual)},assert.deepEqual=function(actual,expected,message){_deepEqual(actual,expected)||fail(actual,expected,message,"deepEqual",assert.deepEqual)},assert.notDeepEqual=function(actual,expected,message){_deepEqual(actual,expected)&&fail(actual,expected,message,"notDeepEqual",assert.notDeepEqual)},assert.strictEqual=function(actual,expected,message){actual!==expected&&fail(actual,expected,message,"===",assert.strictEqual)},assert.notStrictEqual=function(actual,expected,message){actual===expected&&fail(actual,expected,message,"!==",assert.notStrictEqual)},assert["throws"]=function(block,error,message){_throws.apply(this,[!0].concat(pSlice.call(arguments)))},assert.doesNotThrow=function(block,message){_throws.apply(this,[!1].concat(pSlice.call(arguments)))},assert.ifError=function(err){if(err)throw err};var objectKeys=Object.keys||function(obj){var keys=[];for(var key in obj)hasOwn.call(obj,key)&&keys.push(key);return keys}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(142),__esModule:!0}},function(module,exports,__webpack_require__){var defined=__webpack_require__(54);module.exports=function(it){return Object(defined(it))}},function(module,exports){module.exports=Array.isArray||function(arr){return"[object Array]"==Object.prototype.toString.call(arr)}},function(module,exports,__webpack_require__){function baseProperty(key){return function(object){return null==object?void 0:object[key]}}function isArrayLike(value){return null!=value&&isLength(getLength(value))}function isIndex(value,length){return value="number"==typeof value||reIsUint.test(value)?+value:-1,length=null==length?MAX_SAFE_INTEGER:length,value>-1&&value%1==0&&length>value}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function shimKeys(object){for(var props=keysIn(object),propsLength=props.length,length=propsLength&&object.length,allowIndexes=!!length&&isLength(length)&&(isArray(object)||isArguments(object)),index=-1,result=[];++index<propsLength;){var key=props[index];(allowIndexes&&isIndex(key,length)||hasOwnProperty.call(object,key))&&result.push(key)}return result}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}function keysIn(object){if(null==object)return[];isObject(object)||(object=Object(object));var length=object.length;length=length&&isLength(length)&&(isArray(object)||isArguments(object))&&length||0;for(var Ctor=object.constructor,index=-1,isProto="function"==typeof Ctor&&Ctor.prototype===object,result=Array(length),skipIndexes=length>0;++index<length;)result[index]=index+"";for(var key in object)skipIndexes&&isIndex(key,length)||"constructor"==key&&(isProto||!hasOwnProperty.call(object,key))||result.push(key);return result}var getNative=__webpack_require__(200),isArguments=__webpack_require__(202),isArray=__webpack_require__(20),reIsUint=/^\d+$/,objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,nativeKeys=getNative(Object,"keys"),MAX_SAFE_INTEGER=9007199254740991,getLength=baseProperty("length"),keys=nativeKeys?function(object){var Ctor=null==object?void 0:object.constructor;return"function"==typeof Ctor&&Ctor.prototype===object||"function"!=typeof object&&isArrayLike(object)?shimKeys(object):isObject(object)?nativeKeys(object):[]}:shimKeys;module.exports=keys},function(module,exports,__webpack_require__){function baseMap(collection,iteratee){var index=-1,result=isArrayLike(collection)?Array(collection.length):[];return baseEach(collection,function(value,key,collection){result[++index]=iteratee(value,key,collection)}),result}function baseProperty(key){return function(object){return null==object?void 0:object[key]}}function isArrayLike(value){return null!=value&&isLength(getLength(value))}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function map(collection,iteratee,thisArg){var func=isArray(collection)?arrayMap:baseMap;return iteratee=baseCallback(iteratee,thisArg,3),func(collection,iteratee)}var arrayMap=__webpack_require__(196),baseCallback=__webpack_require__(69),baseEach=__webpack_require__(70),isArray=__webpack_require__(20),MAX_SAFE_INTEGER=9007199254740991,getLength=baseProperty("length");module.exports=map},function(module,exports,__webpack_require__){function Protocols(proto){if("number"==typeof proto){if(Protocols.codes[proto])return Protocols.codes[proto];throw new Error("no protocol with code: "+proto)}if("string"==typeof proto||proto instanceof String){if(Protocols.names[proto])return Protocols.names[proto];throw new Error("no protocol with name: "+proto)}throw new Error("invalid protocol id type: "+proto)}function p(code,size,name){return{code:code,size:size,name:name}}var map=__webpack_require__(35);module.exports=Protocols,Protocols.table=[[4,32,"ip4"],[6,16,"tcp"],[17,16,"udp"],[33,16,"dccp"],[41,128,"ip6"],[132,16,"sctp"]],Protocols.names={},Protocols.codes={},map(Protocols.table,function(e){var proto=p.apply(this,e);Protocols.codes[proto.code]=proto,Protocols.names[proto.name]=proto}),Protocols.object=p},function(module,exports,__webpack_require__){function once(fn){var f=function(){return f.called?f.value:(f.called=!0,f.value=fn.apply(this,arguments))};return f.called=!1,f}var wrappy=__webpack_require__(92);module.exports=wrappy(once),once.proto=once(function(){Object.defineProperty(Function.prototype,"once",{value:function(){return once(this)},configurable:!0})})},function(module,exports,__webpack_require__){(function(process){"use strict";function posix(path){return"/"===path.charAt(0)}function win32(path){var splitDeviceRe=/^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/,result=splitDeviceRe.exec(path),device=result[1]||"",isUnc=!!device&&":"!==device.charAt(1);return!!result[2]||isUnc}module.exports="win32"===process.platform?win32:posix,module.exports.posix=posix,module.exports.win32=win32}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function nextTick(fn){for(var args=new Array(arguments.length-1),i=0;i<args.length;)args[i++]=arguments[i];process.nextTick(function(){fn.apply(null,args)})}!process.version||0===process.version.indexOf("v0.")||0===process.version.indexOf("v1.")&&0!==process.version.indexOf("v1.8.")?module.exports=nextTick:module.exports=process.nextTick}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function TransformState(stream){this.afterTransform=function(er,data){return afterTransform(stream,er,data)},this.needTransform=!1,this.transforming=!1,this.writecb=null,this.writechunk=null}function afterTransform(stream,er,data){var ts=stream._transformState;ts.transforming=!1;var cb=ts.writecb;if(!cb)return stream.emit("error",new Error("no writecb in Transform class"));ts.writechunk=null,ts.writecb=null,null!==data&&void 0!==data&&stream.push(data),cb&&cb(er);var rs=stream._readableState;rs.reading=!1,(rs.needReadable||rs.length<rs.highWaterMark)&&stream._read(rs.highWaterMark)}function Transform(options){if(!(this instanceof Transform))return new Transform(options);Duplex.call(this,options),this._transformState=new TransformState(this);var stream=this;this._readableState.needReadable=!0,this._readableState.sync=!1,options&&("function"==typeof options.transform&&(this._transform=options.transform),"function"==typeof options.flush&&(this._flush=options.flush)),this.once("prefinish",function(){"function"==typeof this._flush?this._flush(function(er){done(stream,er)}):done(stream)})}function done(stream,er){if(er)return stream.emit("error",er);var ws=stream._writableState,ts=stream._transformState;if(ws.length)throw new Error("calling transform done when ws.length != 0");if(ts.transforming)throw new Error("calling transform done when still transforming");return stream.push(null)}module.exports=Transform;var Duplex=__webpack_require__(17),util=__webpack_require__(8);util.inherits=__webpack_require__(4),util.inherits(Transform,Duplex),Transform.prototype.push=function(chunk,encoding){return this._transformState.needTransform=!1,Duplex.prototype.push.call(this,chunk,encoding)},Transform.prototype._transform=function(chunk,encoding,cb){throw new Error("not implemented")},Transform.prototype._write=function(chunk,encoding,cb){var ts=this._transformState;if(ts.writecb=cb,ts.writechunk=chunk,ts.writeencoding=encoding,!ts.transforming){var rs=this._readableState;(ts.needTransform||rs.needReadable||rs.length<rs.highWaterMark)&&this._read(rs.highWaterMark)}},Transform.prototype._read=function(n){var ts=this._transformState;null!==ts.writechunk&&ts.writecb&&!ts.transforming?(ts.transforming=!0,this._transform(ts.writechunk,ts.writeencoding,ts.afterTransform)):ts.needTransform=!0}},function(module,exports,__webpack_require__){module.exports=__webpack_require__(40)},function(module,exports,__webpack_require__){function TransformState(options,stream){this.afterTransform=function(er,data){return afterTransform(stream,er,data)},this.needTransform=!1,this.transforming=!1,this.writecb=null,this.writechunk=null}function afterTransform(stream,er,data){var ts=stream._transformState;ts.transforming=!1;var cb=ts.writecb;if(!cb)return stream.emit("error",new Error("no writecb in Transform class"));ts.writechunk=null,ts.writecb=null,util.isNullOrUndefined(data)||stream.push(data),cb&&cb(er);var rs=stream._readableState;rs.reading=!1,(rs.needReadable||rs.length<rs.highWaterMark)&&stream._read(rs.highWaterMark)}function Transform(options){if(!(this instanceof Transform))return new Transform(options);Duplex.call(this,options),this._transformState=new TransformState(options,this);var stream=this;this._readableState.needReadable=!0,this._readableState.sync=!1,this.once("prefinish",function(){util.isFunction(this._flush)?this._flush(function(er){done(stream,er)}):done(stream)})}function done(stream,er){if(er)return stream.emit("error",er);var ws=stream._writableState,ts=stream._transformState;if(ws.length)throw new Error("calling transform done when ws.length != 0");if(ts.transforming)throw new Error("calling transform done when still transforming");return stream.push(null)}module.exports=Transform;var Duplex=__webpack_require__(14),util=__webpack_require__(8);util.inherits=__webpack_require__(4),util.inherits(Transform,Duplex),Transform.prototype.push=function(chunk,encoding){return this._transformState.needTransform=!1,Duplex.prototype.push.call(this,chunk,encoding)},Transform.prototype._transform=function(chunk,encoding,cb){throw new Error("not implemented")},Transform.prototype._write=function(chunk,encoding,cb){var ts=this._transformState;if(ts.writecb=cb,ts.writechunk=chunk,ts.writeencoding=encoding,!ts.transforming){var rs=this._readableState;(ts.needTransform||rs.needReadable||rs.length<rs.highWaterMark)&&this._read(rs.highWaterMark)}},Transform.prototype._read=function(n){var ts=this._transformState;util.isNull(ts.writechunk)||!ts.writecb||ts.transforming?ts.needTransform=!0:(ts.transforming=!0,this._transform(ts.writechunk,ts.writeencoding,ts.afterTransform))}},function(module,exports,__webpack_require__){(function(process){function WriteReq(chunk,encoding,cb){this.chunk=chunk,this.encoding=encoding,this.callback=cb}function WritableState(options,stream){var Duplex=__webpack_require__(14);options=options||{};var hwm=options.highWaterMark,defaultHwm=options.objectMode?16:16384;this.highWaterMark=hwm||0===hwm?hwm:defaultHwm,this.objectMode=!!options.objectMode,stream instanceof Duplex&&(this.objectMode=this.objectMode||!!options.writableObjectMode),this.highWaterMark=~~this.highWaterMark,this.needDrain=!1,this.ending=!1,this.ended=!1,this.finished=!1;var noDecode=options.decodeStrings===!1;this.decodeStrings=!noDecode,this.defaultEncoding=options.defaultEncoding||"utf8",this.length=0,this.writing=!1,this.corked=0,this.sync=!0,this.bufferProcessing=!1,this.onwrite=function(er){onwrite(stream,er)},this.writecb=null,this.writelen=0,this.buffer=[],this.pendingcb=0,this.prefinished=!1,this.errorEmitted=!1}function Writable(options){var Duplex=__webpack_require__(14);return this instanceof Writable||this instanceof Duplex?(this._writableState=new WritableState(options,this),this.writable=!0,void Stream.call(this)):new Writable(options)}function writeAfterEnd(stream,state,cb){var er=new Error("write after end");stream.emit("error",er),process.nextTick(function(){cb(er)})}function validChunk(stream,state,chunk,cb){var valid=!0;if(!(util.isBuffer(chunk)||util.isString(chunk)||util.isNullOrUndefined(chunk)||state.objectMode)){var er=new TypeError("Invalid non-string/buffer chunk");stream.emit("error",er),process.nextTick(function(){cb(er)}),valid=!1}return valid}function decodeChunk(state,chunk,encoding){return!state.objectMode&&state.decodeStrings!==!1&&util.isString(chunk)&&(chunk=new Buffer(chunk,encoding)),chunk}function writeOrBuffer(stream,state,chunk,encoding,cb){chunk=decodeChunk(state,chunk,encoding),util.isBuffer(chunk)&&(encoding="buffer");var len=state.objectMode?1:chunk.length;state.length+=len;var ret=state.length<state.highWaterMark;return ret||(state.needDrain=!0),state.writing||state.corked?state.buffer.push(new WriteReq(chunk,encoding,cb)):doWrite(stream,state,!1,len,chunk,encoding,cb),ret}function doWrite(stream,state,writev,len,chunk,encoding,cb){state.writelen=len,state.writecb=cb,state.writing=!0,state.sync=!0,writev?stream._writev(chunk,state.onwrite):stream._write(chunk,encoding,state.onwrite),state.sync=!1}function onwriteError(stream,state,sync,er,cb){sync?process.nextTick(function(){state.pendingcb--,cb(er)}):(state.pendingcb--,cb(er)),stream._writableState.errorEmitted=!0,stream.emit("error",er)}function onwriteStateUpdate(state){state.writing=!1,state.writecb=null,state.length-=state.writelen,state.writelen=0}function onwrite(stream,er){var state=stream._writableState,sync=state.sync,cb=state.writecb;if(onwriteStateUpdate(state),er)onwriteError(stream,state,sync,er,cb);else{var finished=needFinish(stream,state);finished||state.corked||state.bufferProcessing||!state.buffer.length||clearBuffer(stream,state),sync?process.nextTick(function(){afterWrite(stream,state,finished,cb)}):afterWrite(stream,state,finished,cb)}}function afterWrite(stream,state,finished,cb){finished||onwriteDrain(stream,state),state.pendingcb--,cb(),finishMaybe(stream,state)}function onwriteDrain(stream,state){0===state.length&&state.needDrain&&(state.needDrain=!1,stream.emit("drain"))}function clearBuffer(stream,state){if(state.bufferProcessing=!0,stream._writev&&state.buffer.length>1){for(var cbs=[],c=0;c<state.buffer.length;c++)cbs.push(state.buffer[c].callback);state.pendingcb++,doWrite(stream,state,!0,state.length,state.buffer,"",function(err){for(var i=0;i<cbs.length;i++)state.pendingcb--,cbs[i](err)}),state.buffer=[]}else{for(var c=0;c<state.buffer.length;c++){var entry=state.buffer[c],chunk=entry.chunk,encoding=entry.encoding,cb=entry.callback,len=state.objectMode?1:chunk.length;if(doWrite(stream,state,!1,len,chunk,encoding,cb),state.writing){c++;break}}c<state.buffer.length?state.buffer=state.buffer.slice(c):state.buffer.length=0}state.bufferProcessing=!1}function needFinish(stream,state){return state.ending&&0===state.length&&!state.finished&&!state.writing}function prefinish(stream,state){state.prefinished||(state.prefinished=!0,stream.emit("prefinish"))}function finishMaybe(stream,state){var need=needFinish(stream,state);return need&&(0===state.pendingcb?(prefinish(stream,state),state.finished=!0,stream.emit("finish")):prefinish(stream,state)),need}function endWritable(stream,state,cb){state.ending=!0,finishMaybe(stream,state),cb&&(state.finished?process.nextTick(cb):stream.once("finish",cb)),state.ended=!0}module.exports=Writable;var Buffer=__webpack_require__(2).Buffer;Writable.WritableState=WritableState;var util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Stream=__webpack_require__(3);util.inherits(Writable,Stream),Writable.prototype.pipe=function(){this.emit("error",new Error("Cannot pipe. Not readable."))},Writable.prototype.write=function(chunk,encoding,cb){var state=this._writableState,ret=!1;return util.isFunction(encoding)&&(cb=encoding,encoding=null),util.isBuffer(chunk)?encoding="buffer":encoding||(encoding=state.defaultEncoding),util.isFunction(cb)||(cb=function(){}),state.ended?writeAfterEnd(this,state,cb):validChunk(this,state,chunk,cb)&&(state.pendingcb++,ret=writeOrBuffer(this,state,chunk,encoding,cb)),ret},Writable.prototype.cork=function(){var state=this._writableState;state.corked++},Writable.prototype.uncork=function(){var state=this._writableState;state.corked&&(state.corked--,state.writing||state.corked||state.finished||state.bufferProcessing||!state.buffer.length||clearBuffer(this,state))},Writable.prototype._write=function(chunk,encoding,cb){cb(new Error("not implemented"))},Writable.prototype._writev=null,Writable.prototype.end=function(chunk,encoding,cb){var state=this._writableState;util.isFunction(chunk)?(cb=chunk,chunk=null,encoding=null):util.isFunction(encoding)&&(cb=encoding,encoding=null),util.isNullOrUndefined(chunk)||this.write(chunk,encoding),state.corked&&(state.corked=1,this.uncork()),state.ending||state.finished||endWritable(this,state,cb)}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(Buffer){"use strict";var isUtf8=__webpack_require__(191);module.exports=function(x){return"string"==typeof x&&65279===x.charCodeAt(0)?x.slice(1):Buffer.isBuffer(x)&&isUtf8(x)&&239===x[0]&&187===x[1]&&191===x[2]?x.slice(3):x}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(process){function DestroyableTransform(opts){Transform.call(this,opts),this._destroyed=!1}function noop(chunk,enc,callback){callback(null,chunk)}function through2(construct){return function(options,transform,flush){return"function"==typeof options&&(flush=transform,transform=options,options={}),"function"!=typeof transform&&(transform=noop),"function"!=typeof flush&&(flush=null),construct(options,transform,flush)}}var Transform=__webpack_require__(235),inherits=__webpack_require__(7).inherits,xtend=__webpack_require__(15);inherits(DestroyableTransform,Transform),DestroyableTransform.prototype.destroy=function(err){if(!this._destroyed){this._destroyed=!0;var self=this;process.nextTick(function(){err&&self.emit("error",err),self.emit("close")})}},module.exports=through2(function(options,transform,flush){var t2=new DestroyableTransform(options);return t2._transform=transform,flush&&(t2._flush=flush),t2}),module.exports.ctor=through2(function(options,transform,flush){function Through2(override){return this instanceof Through2?(this.options=xtend(options,override),void DestroyableTransform.call(this,this.options)):new Through2(override)}return inherits(Through2,DestroyableTransform),Through2.prototype._transform=transform,flush&&(Through2.prototype._flush=flush),Through2}),module.exports.obj=through2(function(options,transform,flush){var t2=new DestroyableTransform(xtend({objectMode:!0,highWaterMark:16},options));return t2._transform=transform,flush&&(t2._flush=flush),t2})}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function File(file){file||(file={});var history=file.path?[file.path]:file.history;this.history=history||[],this.cwd=file.cwd||process.cwd(),this.base=file.base||this.cwd,this.stat=file.stat||null,this.contents=file.contents||null,this._isVinyl=!0}var path=__webpack_require__(6),clone=__webpack_require__(137),cloneStats=__webpack_require__(136),cloneBuffer=__webpack_require__(260),isBuffer=__webpack_require__(262),isStream=__webpack_require__(91),isNull=__webpack_require__(263),inspectStream=__webpack_require__(261),Stream=__webpack_require__(3),replaceExt=__webpack_require__(214);File.prototype.isBuffer=function(){return isBuffer(this.contents)},File.prototype.isStream=function(){return isStream(this.contents)},File.prototype.isNull=function(){return isNull(this.contents)},File.prototype.isDirectory=function(){return this.isNull()&&this.stat&&this.stat.isDirectory()},File.prototype.clone=function(opt){"boolean"==typeof opt?opt={deep:opt,contents:!0}:opt?(opt.deep=opt.deep===!0,opt.contents=opt.contents!==!1):opt={deep:!0,contents:!0};var contents;this.isStream()?(contents=this.contents.pipe(new Stream.PassThrough),this.contents=this.contents.pipe(new Stream.PassThrough)):this.isBuffer()&&(contents=opt.contents?cloneBuffer(this.contents):this.contents);var file=new File({cwd:this.cwd,base:this.base,stat:this.stat?cloneStats(this.stat):null,history:this.history.slice(),contents:contents});return Object.keys(this).forEach(function(key){"_contents"!==key&&"stat"!==key&&"history"!==key&&"path"!==key&&"base"!==key&&"cwd"!==key&&(file[key]=opt.deep?clone(this[key],!0):this[key])},this),file},File.prototype.pipe=function(stream,opt){return opt||(opt={}),"undefined"==typeof opt.end&&(opt.end=!0),this.isStream()?this.contents.pipe(stream,opt):this.isBuffer()?(opt.end?stream.end(this.contents):stream.write(this.contents),stream):(opt.end&&stream.end(),stream)},File.prototype.inspect=function(){var inspect=[],filePath=this.base&&this.path?this.relative:this.path;return filePath&&inspect.push('"'+filePath+'"'),this.isBuffer()&&inspect.push(this.contents.inspect()),this.isStream()&&inspect.push(inspectStream(this.contents)),"<File "+inspect.join(" ")+">"},File.isVinyl=function(file){return file&&file._isVinyl===!0},Object.defineProperty(File.prototype,"contents",{get:function(){return this._contents},set:function(val){if(!isBuffer(val)&&!isStream(val)&&!isNull(val))throw new Error("File.contents can only be a Buffer, a Stream, or null.");this._contents=val}}),Object.defineProperty(File.prototype,"relative",{get:function(){if(!this.base)throw new Error("No base specified! Can not get relative.");if(!this.path)throw new Error("No path specified! Can not get relative.");return path.relative(this.base,this.path)},set:function(){throw new Error("File.relative is generated from the base and path attributes. Do not modify it.")}}),Object.defineProperty(File.prototype,"dirname",{get:function(){if(!this.path)throw new Error("No path specified! Can not get dirname.");return path.dirname(this.path)},set:function(dirname){if(!this.path)throw new Error("No path specified! Can not set dirname.");this.path=path.join(dirname,path.basename(this.path))}}),Object.defineProperty(File.prototype,"basename",{get:function(){if(!this.path)throw new Error("No path specified! Can not get basename.");return path.basename(this.path)},set:function(basename){if(!this.path)throw new Error("No path specified! Can not set basename.");this.path=path.join(path.dirname(this.path),basename)}}),Object.defineProperty(File.prototype,"stem",{get:function(){if(!this.path)throw new Error("No path specified! Can not get stem.");return path.basename(this.path,this.extname)},set:function(stem){if(!this.path)throw new Error("No PassThrough specified! Can not set stem.");this.path=path.join(path.dirname(this.path),stem+this.extname)}}),Object.defineProperty(File.prototype,"extname",{get:function(){if(!this.path)throw new Error("No path specified! Can not get extname.");return path.extname(this.path)},set:function(extname){if(!this.path)throw new Error("No path specified! Can not set extname.");this.path=replaceExt(this.path,extname)}}),Object.defineProperty(File.prototype,"path",{get:function(){return this.history[this.history.length-1]},set:function(path){if("string"!=typeof path)throw new Error("path should be string");path&&path!==this.path&&this.history.push(path)}}),module.exports=File}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}var _keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),_setPrototypeOf=__webpack_require__(128),_setPrototypeOf2=_interopRequireDefault(_setPrototypeOf),Hoek=__webpack_require__(19),internals={STATUS_CODES:(0,_setPrototypeOf2["default"])({100:"Continue",101:"Switching Protocols",102:"Processing",200:"OK",201:"Created",202:"Accepted",203:"Non-Authoritative Information",204:"No Content",205:"Reset Content",206:"Partial Content",207:"Multi-Status",300:"Multiple Choices",301:"Moved Permanently",302:"Moved Temporarily",303:"See Other",304:"Not Modified",305:"Use Proxy",307:"Temporary Redirect",400:"Bad Request",401:"Unauthorized",402:"Payment Required",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",406:"Not Acceptable",407:"Proxy Authentication Required",408:"Request Time-out",409:"Conflict",410:"Gone",411:"Length Required",412:"Precondition Failed",413:"Request Entity Too Large",414:"Request-URI Too Large",415:"Unsupported Media Type",416:"Requested Range Not Satisfiable",417:"Expectation Failed",418:"I'm a teapot",422:"Unprocessable Entity",423:"Locked",424:"Failed Dependency",425:"Unordered Collection",426:"Upgrade Required",428:"Precondition Required",429:"Too Many Requests",431:"Request Header Fields Too Large",451:"Unavailable For Legal Reasons",500:"Internal Server Error",501:"Not Implemented",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Time-out",505:"HTTP Version Not Supported",506:"Variant Also Negotiates",507:"Insufficient Storage",509:"Bandwidth Limit Exceeded",510:"Not Extended",511:"Network Authentication Required"},null)};exports.wrap=function(error,statusCode,message){return Hoek.assert(error instanceof Error,"Cannot wrap non-Error object"),error.isBoom?error:internals.initialize(error,statusCode||500,message)},exports.create=function(statusCode,message,data){return internals.create(statusCode,message,data,exports.create)},internals.create=function(statusCode,message,data,ctor){var error=new Error(message?message:void 0);return Error.captureStackTrace(error,ctor),error.data=data||null,internals.initialize(error,statusCode),error},internals.initialize=function(error,statusCode,message){var numberCode=parseInt(statusCode,10);return Hoek.assert(!isNaN(numberCode)&&numberCode>=400,"First argument must be a number (400+):",statusCode),error.isBoom=!0,error.isServer=numberCode>=500,error.hasOwnProperty("data")||(error.data=null),error.output={statusCode:numberCode,payload:{},headers:{}},error.reformat=internals.reformat,error.reformat(),message||error.message||(message=error.output.payload.error),message&&(error.message=message+(error.message?": "+error.message:"")),error},internals.reformat=function(){this.output.payload.statusCode=this.output.statusCode,this.output.payload.error=internals.STATUS_CODES[this.output.statusCode]||"Unknown",500===this.output.statusCode?this.output.payload.message="An internal server error occurred":this.message&&(this.output.payload.message=this.message)},exports.badRequest=function(message,data){return internals.create(400,message,data,exports.badRequest)},exports.unauthorized=function(message,scheme,attributes){var err=internals.create(401,message,void 0,exports.unauthorized);if(!scheme)return err;var wwwAuthenticate="";if("string"==typeof scheme){if(wwwAuthenticate=scheme,(attributes||message)&&(err.output.payload.attributes={}),attributes)for(var names=(0,_keys2["default"])(attributes),i=0;i<names.length;++i){var name=names[i];i&&(wwwAuthenticate+=",");var value=attributes[name];(null===value||void 0===value)&&(value=""),wwwAuthenticate=wwwAuthenticate+" "+name+'="'+Hoek.escapeHeaderAttribute(value.toString())+'"',err.output.payload.attributes[name]=value}message?(attributes&&(wwwAuthenticate+=","),wwwAuthenticate=wwwAuthenticate+' error="'+Hoek.escapeHeaderAttribute(message)+'"',err.output.payload.attributes.error=message):err.isMissing=!0}else for(var wwwArray=scheme,i=0;i<wwwArray.length;++i)i&&(wwwAuthenticate+=", "),wwwAuthenticate+=wwwArray[i];return err.output.headers["WWW-Authenticate"]=wwwAuthenticate,err},exports.forbidden=function(message,data){return internals.create(403,message,data,exports.forbidden)},exports.notFound=function(message,data){return internals.create(404,message,data,exports.notFound)},exports.methodNotAllowed=function(message,data){return internals.create(405,message,data,exports.methodNotAllowed)},exports.notAcceptable=function(message,data){return internals.create(406,message,data,exports.notAcceptable)},exports.proxyAuthRequired=function(message,data){return internals.create(407,message,data,exports.proxyAuthRequired)},exports.clientTimeout=function(message,data){return internals.create(408,message,data,exports.clientTimeout)},exports.conflict=function(message,data){return internals.create(409,message,data,exports.conflict)},exports.resourceGone=function(message,data){return internals.create(410,message,data,exports.resourceGone)},exports.lengthRequired=function(message,data){return internals.create(411,message,data,exports.lengthRequired)},exports.preconditionFailed=function(message,data){return internals.create(412,message,data,exports.preconditionFailed)},exports.entityTooLarge=function(message,data){return internals.create(413,message,data,exports.entityTooLarge)},exports.uriTooLong=function(message,data){return internals.create(414,message,data,exports.uriTooLong)},exports.unsupportedMediaType=function(message,data){return internals.create(415,message,data,exports.unsupportedMediaType)},exports.rangeNotSatisfiable=function(message,data){return internals.create(416,message,data,exports.rangeNotSatisfiable)},exports.expectationFailed=function(message,data){
return internals.create(417,message,data,exports.expectationFailed)},exports.badData=function(message,data){return internals.create(422,message,data,exports.badData)},exports.preconditionRequired=function(message,data){return internals.create(428,message,data,exports.preconditionRequired)},exports.tooManyRequests=function(message,data){return internals.create(429,message,data,exports.tooManyRequests)},exports.illegal=function(message,data){return internals.create(451,message,data,exports.illegal)},exports.internal=function(message,data,statusCode){return internals.serverError(message,data,statusCode,exports.internal)},internals.serverError=function(message,data,statusCode,ctor){var error=void 0;return data instanceof Error?error=exports.wrap(data,statusCode,message):(error=internals.create(statusCode||500,message,void 0,ctor),error.data=data),error},exports.notImplemented=function(message,data){return internals.serverError(message,data,501,exports.notImplemented)},exports.badGateway=function(message,data){return internals.serverError(message,data,502,exports.badGateway)},exports.serverTimeout=function(message,data){return internals.serverError(message,data,503,exports.serverTimeout)},exports.gatewayTimeout=function(message,data){return internals.serverError(message,data,504,exports.gatewayTimeout)},exports.badImplementation=function(message,data){var err=internals.serverError(message,data,500,exports.badImplementation);return err.isDeveloperError=!0,err}},function(module,exports,__webpack_require__){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}var _keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),_typeof2=__webpack_require__(22),_typeof3=_interopRequireDefault(_typeof2),_create=__webpack_require__(31),_create2=_interopRequireDefault(_create),internals={};internals.hexTable=function(){for(var array=new Array(256),i=0;256>i;++i)array[i]="%"+((16>i?"0":"")+i.toString(16)).toUpperCase();return array}(),exports.arrayToObject=function(source,options){for(var obj=options.plainObjects?(0,_create2["default"])(null):{},i=0;i<source.length;++i)"undefined"!=typeof source[i]&&(obj[i]=source[i]);return obj},exports.merge=function(target,source,options){if(!source)return target;if("object"!==("undefined"==typeof source?"undefined":(0,_typeof3["default"])(source)))return Array.isArray(target)?target.push(source):"object"===("undefined"==typeof target?"undefined":(0,_typeof3["default"])(target))?target[source]=!0:target=[target,source],target;if("object"!==("undefined"==typeof target?"undefined":(0,_typeof3["default"])(target)))return target=[target].concat(source);Array.isArray(target)&&!Array.isArray(source)&&(target=exports.arrayToObject(target,options));for(var keys=(0,_keys2["default"])(source),i=0;i<keys.length;++i){var key=keys[i],value=source[key];Object.prototype.hasOwnProperty.call(target,key)?target[key]=exports.merge(target[key],value,options):target[key]=value}return target},exports.decode=function(str){try{return decodeURIComponent(str.replace(/\+/g," "))}catch(e){return str}},exports.encode=function(str){if(0===str.length)return str;"string"!=typeof str&&(str=""+str);for(var out="",i=0;i<str.length;++i){var c=str.charCodeAt(i);45===c||46===c||95===c||126===c||c>=48&&57>=c||c>=65&&90>=c||c>=97&&122>=c?out+=str[i]:128>c?out+=internals.hexTable[c]:2048>c?out+=internals.hexTable[192|c>>6]+internals.hexTable[128|63&c]:55296>c||c>=57344?out+=internals.hexTable[224|c>>12]+internals.hexTable[128|c>>6&63]+internals.hexTable[128|63&c]:(++i,c=65536+((1023&c)<<10|1023&str.charCodeAt(i)),out+=internals.hexTable[240|c>>18]+internals.hexTable[128|c>>12&63]+internals.hexTable[128|c>>6&63]+internals.hexTable[128|63&c])}return out},exports.compact=function(obj,refs){if("object"!==("undefined"==typeof obj?"undefined":(0,_typeof3["default"])(obj))||null===obj)return obj;refs=refs||[];var lookup=refs.indexOf(obj);if(-1!==lookup)return refs[lookup];if(refs.push(obj),Array.isArray(obj)){for(var compacted=[],i=0;i<obj.length;++i)"undefined"!=typeof obj[i]&&compacted.push(obj[i]);return compacted}for(var keys=(0,_keys2["default"])(obj),i=0;i<keys.length;++i){var key=keys[i];obj[key]=exports.compact(obj[key],refs)}return obj},exports.isRegExp=function(obj){return"[object RegExp]"===Object.prototype.toString.call(obj)},exports.isBuffer=function(obj){return null===obj||"undefined"==typeof obj?!1:!!(obj.constructor&&obj.constructor.isBuffer&&obj.constructor.isBuffer(obj))}},function(module,exports,__webpack_require__){(function(Buffer,process){"use strict";var Events=__webpack_require__(13),Url=__webpack_require__(87),Http=__webpack_require__(83),Https=__webpack_require__(185),Stream=__webpack_require__(3),Hoek=__webpack_require__(19),Boom=__webpack_require__(47),Payload=__webpack_require__(50),Recorder=__webpack_require__(97),Tap=__webpack_require__(98),internals={jsonRegex:/^application\/[a-z.+-]*json$/,shallowOptions:["agent","payload","downstreamRes","beforeRedirect","redirected"]};internals.Client=function(defaults){Events.EventEmitter.call(this),this.agents={https:new Https.Agent({maxSockets:1/0}),http:new Http.Agent({maxSockets:1/0}),httpsAllowUnauthorized:new Https.Agent({maxSockets:1/0,rejectUnauthorized:!1})},this._defaults=defaults||{}},Hoek.inherits(internals.Client,Events.EventEmitter),internals.Client.prototype.defaults=function(options){return options=Hoek.applyToDefaultsWithShallow(options,this._defaults,internals.shallowOptions),new internals.Client(options)},internals.resolveUrl=function(baseUrl,path){if(!path)return baseUrl;var parsedBase=Url.parse(baseUrl),parsedPath=Url.parse(path);return parsedBase.pathname=parsedBase.pathname+parsedPath.pathname,parsedBase.pathname=parsedBase.pathname.replace(/[\/]{2,}/g,"/"),parsedBase.search=parsedPath.search,Url.format(parsedBase)},internals.Client.prototype.request=function(method,url,options,callback,_trace){var _this=this;options=Hoek.applyToDefaultsWithShallow(options||{},this._defaults,internals.shallowOptions),Hoek.assert(null===options.payload||void 0===options.payload||"string"==typeof options.payload||options.payload instanceof Stream||Buffer.isBuffer(options.payload),"options.payload must be a string, a Buffer, or a Stream"),Hoek.assert(void 0===options.agent||null===options.agent||"boolean"!=typeof options.rejectUnauthorized,"options.agent cannot be set to an Agent at the same time as options.rejectUnauthorized is set"),Hoek.assert(void 0===options.beforeRedirect||null===options.beforeRedirect||"function"==typeof options.beforeRedirect,"options.beforeRedirect must be a function"),Hoek.assert(void 0===options.redirected||null===options.redirected||"function"==typeof options.redirected,"options.redirected must be a function"),options.baseUrl&&(url=internals.resolveUrl(options.baseUrl,url),delete options.baseUrl);var uri=Url.parse(url);uri.method=method.toUpperCase(),uri.headers=options.headers;var payloadSupported="GET"!==uri.method&&"HEAD"!==uri.method&&null!==options.payload&&void 0!==options.payload;payloadSupported&&("string"==typeof options.payload||Buffer.isBuffer(options.payload))&&(uri.headers=Hoek.clone(uri.headers)||{},uri.headers["Content-Length"]=Buffer.isBuffer(options.payload)?options.payload.length:Buffer.byteLength(options.payload));var redirects=options.hasOwnProperty("redirects")?options.redirects:!1;_trace=_trace||[],_trace.push({method:uri.method,url:url});var client="https:"===uri.protocol?Https:Http;void 0!==options.rejectUnauthorized&&"https:"===uri.protocol?uri.agent=options.rejectUnauthorized?this.agents.https:this.agents.httpsAllowUnauthorized:options.agent||options.agent===!1?uri.agent=options.agent:uri.agent="https:"===uri.protocol?this.agents.https:this.agents.http,void 0!==options.secureProtocol&&(uri.secureProtocol=options.secureProtocol);var start=Date.now(),req=client.request(uri),shadow=null,onResponse=void 0,onError=void 0,timeoutId=void 0,finish=function(err,res){return(!callback||err)&&req.abort(),req.removeListener("response",onResponse),req.removeListener("error",onError),req.on("error",Hoek.ignore),clearTimeout(timeoutId),_this.emit("response",err,req,res,start,uri),callback?callback(err,res):void 0},finishOnce=Hoek.once(finish);if(onError=function(err){return err.trace=_trace,finishOnce(Boom.badGateway("Client request error",err))},req.once("error",onError),onResponse=function(res){var statusCode=res.statusCode;if(redirects===!1||-1===[301,302,307,308].indexOf(statusCode))return finishOnce(null,res);var redirectMethod=301===statusCode||302===statusCode?"GET":uri.method,location=res.headers.location;if(res.destroy(),0===redirects)return finishOnce(Boom.badGateway("Maximum redirections reached",_trace));if(!location)return finishOnce(Boom.badGateway("Received redirection without location",_trace));/^https?:/i.test(location)||(location=Url.resolve(uri.href,location));var redirectOptions=Hoek.cloneWithShallow(options,internals.shallowOptions);redirectOptions.payload=shadow||options.payload,redirectOptions.redirects=--redirects,options.beforeRedirect&&options.beforeRedirect(redirectMethod,statusCode,location,redirectOptions);var redirectReq=_this.request(redirectMethod,location,redirectOptions,finishOnce,_trace);options.redirected&&options.redirected(statusCode,location,redirectReq)},req.once("response",onResponse),options.timeout&&(timeoutId=setTimeout(function(){return finishOnce(Boom.gatewayTimeout("Client request timeout"))},options.timeout),delete options.timeout),payloadSupported){if(options.payload instanceof Stream){var stream=options.payload;return redirects&&!function(){var collector=new Tap;collector.once("finish",function(){shadow=collector.collect()}),stream=options.payload.pipe(collector)}(),void stream.pipe(req)}req.write(options.payload)}var _abort=req.abort,aborted=!1;return req.abort=function(){return aborted||req.res||req.socket||process.nextTick(function(){var error=new Error("socket hang up");error.code="ECONNRESET",finishOnce(error)}),aborted=!0,_abort.call(req)},req.end(),req},internals.Client.prototype.read=function(res,options,callback){options=Hoek.applyToDefaultsWithShallow(options||{},this._defaults,internals.shallowOptions);var clientTimeout=options.timeout,clientTimeoutId=null,finish=function(err,buffer){if(clearTimeout(clientTimeoutId),reader.removeListener("error",onReaderError),reader.removeListener("finish",onReaderFinish),res.removeListener("error",onResError),res.removeListener("close",onResClose),res.on("error",Hoek.ignore),err||!options.json)return callback(err,buffer);var result=void 0;if(0===buffer.length)return callback(null,null);if("force"===options.json)return result=internals.tryParseBuffer(buffer),callback(result.err,result.json);var contentType=res.headers&&res.headers["content-type"]||"",mime=contentType.split(";")[0].trim().toLowerCase();return internals.jsonRegex.test(mime)?(result=internals.tryParseBuffer(buffer),callback(result.err,result.json)):callback(null,buffer)},finishOnce=Hoek.once(finish);clientTimeout&&clientTimeout>0&&(clientTimeoutId=setTimeout(function(){finishOnce(Boom.clientTimeout())},clientTimeout));var onResError=function(err){return finishOnce(Boom.internal("Payload stream error",err))},onResClose=function(){return finishOnce(Boom.internal("Payload stream closed prematurely"))};res.once("error",onResError),res.once("close",onResClose);var reader=new Recorder({maxBytes:options.maxBytes}),onReaderError=function(err){return res.destroy&&res.destroy(),finishOnce(err)};reader.once("error",onReaderError);var onReaderFinish=function(){return finishOnce(null,reader.collect())};reader.once("finish",onReaderFinish),res.pipe(reader)},internals.Client.prototype.toReadableStream=function(payload,encoding){return new Payload(payload,encoding)},internals.Client.prototype.parseCacheControl=function(field){var regex=/(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g,header={},error=field.replace(regex,function($0,$1,$2,$3){var value=$2||$3;return header[$1]=value?value.toLowerCase():!0,""});if(header["max-age"])try{var maxAge=parseInt(header["max-age"],10);if(isNaN(maxAge))return null;header["max-age"]=maxAge}catch(err){}return error?null:header},internals.Client.prototype.get=function(uri,options,callback){return this._shortcutWrap("GET",uri,options,callback)},internals.Client.prototype.post=function(uri,options,callback){return this._shortcutWrap("POST",uri,options,callback)},internals.Client.prototype.patch=function(uri,options,callback){return this._shortcutWrap("PATCH",uri,options,callback)},internals.Client.prototype.put=function(uri,options,callback){return this._shortcutWrap("PUT",uri,options,callback)},internals.Client.prototype["delete"]=function(uri,options,callback){return this._shortcutWrap("DELETE",uri,options,callback)},internals.Client.prototype._shortcutWrap=function(method,uri){var options="function"==typeof arguments[2]?{}:arguments[2],callback="function"==typeof arguments[2]?arguments[2]:arguments[3];return this._shortcut(method,uri,options,callback)},internals.Client.prototype._shortcut=function(method,uri,options,callback){var _this2=this;return this.request(method,uri,options,function(err,res){return err?callback(err):void _this2.read(res,options,function(err,payload){return callback(err,res,payload)})})},internals.tryParseBuffer=function(buffer){var result={json:null,err:null};try{var json=JSON.parse(buffer.toString());result.json=json}catch(err){result.err=err}return result},module.exports=new internals.Client}).call(exports,__webpack_require__(2).Buffer,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(Buffer){"use strict";var Hoek=__webpack_require__(19),Stream=__webpack_require__(3),internals={};module.exports=internals.Payload=function(payload,encoding){Stream.Readable.call(this);for(var data=[].concat(payload||""),size=0,i=0;i<data.length;++i){var chunk=data[i];size+=chunk.length,data[i]=Buffer.isBuffer(chunk)?chunk:new Buffer(chunk)}this._data=Buffer.concat(data,size),this._position=0,this._encoding=encoding||"utf8"},Hoek.inherits(internals.Payload,Stream.Readable),internals.Payload.prototype._read=function(size){var chunk=this._data.slice(this._position,this._position+size);this.push(chunk,this._encoding),this._position=this._position+chunk.length,this._position>=this._data.length&&this.push(null)}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){var isObject=__webpack_require__(59);module.exports=function(it){if(!isObject(it))throw TypeError(it+" is not an object!");return it}},function(module,exports){var toString={}.toString;module.exports=function(it){return toString.call(it).slice(8,-1)}},function(module,exports,__webpack_require__){var aFunction=__webpack_require__(150);module.exports=function(fn,that,length){if(aFunction(fn),void 0===that)return fn;switch(length){case 1:return function(a){return fn.call(that,a)};case 2:return function(a,b){return fn.call(that,a,b)};case 3:return function(a,b,c){return fn.call(that,a,b,c)}}return function(){return fn.apply(that,arguments)}}},function(module,exports){module.exports=function(it){if(void 0==it)throw TypeError("Can't call method on  "+it);return it}},function(module,exports,__webpack_require__){module.exports=!__webpack_require__(24)(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a})},function(module,exports,__webpack_require__){var toIObject=__webpack_require__(27),getNames=__webpack_require__(10).getNames,toString={}.toString,windowNames="object"==typeof window&&Object.getOwnPropertyNames?Object.getOwnPropertyNames(window):[],getWindowNames=function(it){try{return getNames(it)}catch(e){return windowNames.slice()}};module.exports.get=function(it){return windowNames&&"[object Window]"==toString.call(it)?getWindowNames(it):getNames(toIObject(it))}},function(module,exports){var hasOwnProperty={}.hasOwnProperty;module.exports=function(it,key){return hasOwnProperty.call(it,key)}},function(module,exports,__webpack_require__){var cof=__webpack_require__(52);module.exports=Object("z").propertyIsEnumerable(0)?Object:function(it){return"String"==cof(it)?it.split(""):Object(it)}},function(module,exports){module.exports=function(it){return"object"==typeof it?null!==it:"function"==typeof it}},function(module,exports){module.exports=function(bitmap,value){return{enumerable:!(1&bitmap),configurable:!(2&bitmap),writable:!(4&bitmap),value:value}}},function(module,exports,__webpack_require__){var global=__webpack_require__(25),SHARED="__core-js_shared__",store=global[SHARED]||(global[SHARED]={});module.exports=function(key){return store[key]||(store[key]={})}},function(module,exports){var id=0,px=Math.random();module.exports=function(key){return"Symbol(".concat(void 0===key?"":key,")_",(++id+px).toString(36))}},function(module,exports,__webpack_require__){var store=__webpack_require__(61)("wks"),uid=__webpack_require__(62),Symbol=__webpack_require__(25).Symbol;module.exports=function(name){return store[name]||(store[name]=Symbol&&Symbol[name]||(Symbol||uid)("Symbol."+name))}},function(module,exports,__webpack_require__){(function(Buffer){function toConstructor(fn){return function(){var buffers=[],m={update:function(data,enc){return Buffer.isBuffer(data)||(data=new Buffer(data,enc)),buffers.push(data),this},digest:function(enc){var buf=Buffer.concat(buffers),r=fn(buf);return buffers=null,enc?r.toString(enc):r}};return m}}var createHash=__webpack_require__(218),md5=toConstructor(__webpack_require__(171)),rmd160=toConstructor(__webpack_require__(215));module.exports=function(alg){return"md5"===alg?new md5:"rmd160"===alg?new rmd160:createHash(alg)}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(process){function ownProp(obj,field){return Object.prototype.hasOwnProperty.call(obj,field)}function alphasorti(a,b){return a.toLowerCase().localeCompare(b.toLowerCase())}function alphasort(a,b){return a.localeCompare(b)}function setupIgnores(self,options){self.ignore=options.ignore||[],Array.isArray(self.ignore)||(self.ignore=[self.ignore]),self.ignore.length&&(self.ignore=self.ignore.map(ignoreMap))}function ignoreMap(pattern){var gmatcher=null;if("/**"===pattern.slice(-3)){var gpattern=pattern.replace(/(\/\*\*)+$/,"");gmatcher=new Minimatch(gpattern)}return{matcher:new Minimatch(pattern),gmatcher:gmatcher}}function setopts(self,pattern,options){if(options||(options={}),options.matchBase&&-1===pattern.indexOf("/")){if(options.noglobstar)throw new Error("base matching requires globstar");pattern="**/"+pattern}self.silent=!!options.silent,self.pattern=pattern,self.strict=options.strict!==!1,self.realpath=!!options.realpath,self.realpathCache=options.realpathCache||Object.create(null),self.follow=!!options.follow,self.dot=!!options.dot,self.mark=!!options.mark,self.nodir=!!options.nodir,self.nodir&&(self.mark=!0),self.sync=!!options.sync,self.nounique=!!options.nounique,self.nonull=!!options.nonull,self.nosort=!!options.nosort,self.nocase=!!options.nocase,self.stat=!!options.stat,self.noprocess=!!options.noprocess,self.maxLength=options.maxLength||1/0,self.cache=options.cache||Object.create(null),self.statCache=options.statCache||Object.create(null),self.symlinks=options.symlinks||Object.create(null),setupIgnores(self,options),self.changedCwd=!1;var cwd=process.cwd();ownProp(options,"cwd")?(self.cwd=options.cwd,self.changedCwd=path.resolve(options.cwd)!==cwd):self.cwd=cwd,self.root=options.root||path.resolve(self.cwd,"/"),self.root=path.resolve(self.root),"win32"===process.platform&&(self.root=self.root.replace(/\\/g,"/")),self.nomount=!!options.nomount,options.nonegate=options.nonegate===!1?!1:!0,options.nocomment=options.nocomment===!1?!1:!0,deprecationWarning(options),self.minimatch=new Minimatch(pattern,options),self.options=self.minimatch.options}function deprecationWarning(options){if(!(options.nonegate&&options.nocomment||process.noDeprecation===!0||exports.deprecationWarned)){var msg="glob WARNING: comments and negation will be disabled in v6";if(process.throwDeprecation)throw new Error(msg);process.traceDeprecation?console.trace(msg):console.error(msg),exports.deprecationWarned=!0}}function finish(self){for(var nou=self.nounique,all=nou?[]:Object.create(null),i=0,l=self.matches.length;l>i;i++){var matches=self.matches[i];if(matches&&0!==Object.keys(matches).length){var m=Object.keys(matches);nou?all.push.apply(all,m):m.forEach(function(m){all[m]=!0})}else if(self.nonull){var literal=self.minimatch.globSet[i];nou?all.push(literal):all[literal]=!0}}if(nou||(all=Object.keys(all)),self.nosort||(all=all.sort(self.nocase?alphasorti:alphasort)),self.mark){for(var i=0;i<all.length;i++)all[i]=self._mark(all[i]);self.nodir&&(all=all.filter(function(e){return!/\/$/.test(e)}))}self.ignore.length&&(all=all.filter(function(m){return!isIgnored(self,m)})),self.found=all}function mark(self,p){var abs=makeAbs(self,p),c=self.cache[abs],m=p;if(c){var isDir="DIR"===c||Array.isArray(c),slash="/"===p.slice(-1);if(isDir&&!slash?m+="/":!isDir&&slash&&(m=m.slice(0,-1)),m!==p){var mabs=makeAbs(self,m);self.statCache[mabs]=self.statCache[abs],self.cache[mabs]=self.cache[abs]}}return m}function makeAbs(self,f){var abs=f;return abs="/"===f.charAt(0)?path.join(self.root,f):isAbsolute(f)||""===f?f:self.changedCwd?path.resolve(self.cwd,f):path.resolve(f)}function isIgnored(self,path){return self.ignore.length?self.ignore.some(function(item){return item.matcher.match(path)||!(!item.gmatcher||!item.gmatcher.match(path))}):!1}function childrenIgnored(self,path){return self.ignore.length?self.ignore.some(function(item){return!(!item.gmatcher||!item.gmatcher.match(path))}):!1}exports.alphasort=alphasort,exports.alphasorti=alphasorti,exports.setopts=setopts,exports.ownProp=ownProp,exports.makeAbs=makeAbs,exports.finish=finish,exports.mark=mark,exports.isIgnored=isIgnored,exports.childrenIgnored=childrenIgnored;var path=__webpack_require__(6),minimatch=__webpack_require__(29),isAbsolute=__webpack_require__(38),Minimatch=minimatch.Minimatch;exports.deprecationWarned}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function glob(pattern,options,cb){if("function"==typeof options&&(cb=options,options={}),options||(options={}),options.sync){if(cb)throw new TypeError("callback provided to sync glob");return globSync(pattern,options)}return new Glob(pattern,options,cb)}function Glob(pattern,options,cb){function done(){--self._processing,self._processing<=0&&self._finish()}if("function"==typeof options&&(cb=options,options=null),options&&options.sync){if(cb)throw new TypeError("callback provided to sync glob");return new GlobSync(pattern,options)}if(!(this instanceof Glob))return new Glob(pattern,options,cb);setopts(this,pattern,options),this._didRealPath=!1;var n=this.minimatch.set.length;this.matches=new Array(n),"function"==typeof cb&&(cb=once(cb),this.on("error",cb),this.on("end",function(matches){cb(null,matches)}));var self=this,n=this.minimatch.set.length;if(this._processing=0,this.matches=new Array(n),this._emitQueue=[],this._processQueue=[],this.paused=!1,this.noprocess)return this;if(0===n)return done();for(var i=0;n>i;i++)this._process(this.minimatch.set[i],i,!1,done)}function readdirCb(self,abs,cb){return function(er,entries){er?self._readdirError(abs,er,cb):self._readdirEntries(abs,entries,cb)}}module.exports=glob;var fs=__webpack_require__(5),minimatch=__webpack_require__(29),inherits=(minimatch.Minimatch,__webpack_require__(4)),EE=__webpack_require__(13).EventEmitter,path=__webpack_require__(6),assert=__webpack_require__(30),isAbsolute=__webpack_require__(38),globSync=__webpack_require__(180),common=__webpack_require__(65),setopts=(common.alphasort,common.alphasorti,common.setopts),ownProp=common.ownProp,inflight=__webpack_require__(187),util=__webpack_require__(7),childrenIgnored=common.childrenIgnored,isIgnored=common.isIgnored,once=__webpack_require__(37);glob.sync=globSync;var GlobSync=glob.GlobSync=globSync.GlobSync;glob.glob=glob,glob.hasMagic=function(pattern,options_){var options=util._extend({},options_);options.noprocess=!0;var g=new Glob(pattern,options),set=g.minimatch.set;if(set.length>1)return!0;for(var j=0;j<set[0].length;j++)if("string"!=typeof set[0][j])return!0;return!1},glob.Glob=Glob,inherits(Glob,EE),Glob.prototype._finish=function(){if(assert(this instanceof Glob),!this.aborted){if(this.realpath&&!this._didRealpath)return this._realpath();common.finish(this),this.emit("end",this.found)}},Glob.prototype._realpath=function(){function next(){0===--n&&self._finish()}if(!this._didRealpath){this._didRealpath=!0;var n=this.matches.length;if(0===n)return this._finish();for(var self=this,i=0;i<this.matches.length;i++)this._realpathSet(i,next)}},Glob.prototype._realpathSet=function(index,cb){var matchset=this.matches[index];if(!matchset)return cb();var found=Object.keys(matchset),self=this,n=found.length;if(0===n)return cb();var set=this.matches[index]=Object.create(null);found.forEach(function(p,i){p=self._makeAbs(p),fs.realpath(p,self.realpathCache,function(er,real){er?"stat"===er.syscall?set[p]=!0:self.emit("error",er):set[real]=!0,0===--n&&(self.matches[index]=set,cb())})})},Glob.prototype._mark=function(p){return common.mark(this,p)},Glob.prototype._makeAbs=function(f){return common.makeAbs(this,f)},Glob.prototype.abort=function(){this.aborted=!0,this.emit("abort")},Glob.prototype.pause=function(){this.paused||(this.paused=!0,this.emit("pause"))},Glob.prototype.resume=function(){if(this.paused){if(this.emit("resume"),this.paused=!1,this._emitQueue.length){var eq=this._emitQueue.slice(0);this._emitQueue.length=0;for(var i=0;i<eq.length;i++){var e=eq[i];this._emitMatch(e[0],e[1])}}if(this._processQueue.length){var pq=this._processQueue.slice(0);this._processQueue.length=0;for(var i=0;i<pq.length;i++){var p=pq[i];this._processing--,this._process(p[0],p[1],p[2],p[3])}}}},Glob.prototype._process=function(pattern,index,inGlobStar,cb){if(assert(this instanceof Glob),assert("function"==typeof cb),!this.aborted){if(this._processing++,this.paused)return void this._processQueue.push([pattern,index,inGlobStar,cb]);for(var n=0;"string"==typeof pattern[n];)n++;var prefix;switch(n){case pattern.length:return void this._processSimple(pattern.join("/"),index,cb);case 0:prefix=null;break;default:prefix=pattern.slice(0,n).join("/")}var read,remain=pattern.slice(n);null===prefix?read=".":isAbsolute(prefix)||isAbsolute(pattern.join("/"))?(prefix&&isAbsolute(prefix)||(prefix="/"+prefix),read=prefix):read=prefix;var abs=this._makeAbs(read);if(childrenIgnored(this,read))return cb();var isGlobStar=remain[0]===minimatch.GLOBSTAR;isGlobStar?this._processGlobStar(prefix,read,abs,remain,index,inGlobStar,cb):this._processReaddir(prefix,read,abs,remain,index,inGlobStar,cb)}},Glob.prototype._processReaddir=function(prefix,read,abs,remain,index,inGlobStar,cb){var self=this;this._readdir(abs,inGlobStar,function(er,entries){return self._processReaddir2(prefix,read,abs,remain,index,inGlobStar,entries,cb)})},Glob.prototype._processReaddir2=function(prefix,read,abs,remain,index,inGlobStar,entries,cb){if(!entries)return cb();for(var pn=remain[0],negate=!!this.minimatch.negate,rawGlob=pn._glob,dotOk=this.dot||"."===rawGlob.charAt(0),matchedEntries=[],i=0;i<entries.length;i++){var e=entries[i];if("."!==e.charAt(0)||dotOk){var m;m=negate&&!prefix?!e.match(pn):e.match(pn),m&&matchedEntries.push(e)}}var len=matchedEntries.length;if(0===len)return cb();if(1===remain.length&&!this.mark&&!this.stat){this.matches[index]||(this.matches[index]=Object.create(null));for(var i=0;len>i;i++){var e=matchedEntries[i];prefix&&(e="/"!==prefix?prefix+"/"+e:prefix+e),"/"!==e.charAt(0)||this.nomount||(e=path.join(this.root,e)),this._emitMatch(index,e)}return cb()}remain.shift();for(var i=0;len>i;i++){var e=matchedEntries[i];prefix&&(e="/"!==prefix?prefix+"/"+e:prefix+e),this._process([e].concat(remain),index,inGlobStar,cb)}cb()},Glob.prototype._emitMatch=function(index,e){if(!this.aborted&&!this.matches[index][e]&&!isIgnored(this,e)){if(this.paused)return void this._emitQueue.push([index,e]);var abs=this._makeAbs(e);if(this.nodir){var c=this.cache[abs];if("DIR"===c||Array.isArray(c))return}this.mark&&(e=this._mark(e)),this.matches[index][e]=!0;var st=this.statCache[abs];st&&this.emit("stat",e,st),this.emit("match",e)}},Glob.prototype._readdirInGlobStar=function(abs,cb){function lstatcb_(er,lstat){if(er)return cb();var isSym=lstat.isSymbolicLink();self.symlinks[abs]=isSym,isSym||lstat.isDirectory()?self._readdir(abs,!1,cb):(self.cache[abs]="FILE",cb())}if(!this.aborted){if(this.follow)return this._readdir(abs,!1,cb);var lstatkey="lstat\x00"+abs,self=this,lstatcb=inflight(lstatkey,lstatcb_);lstatcb&&fs.lstat(abs,lstatcb)}},Glob.prototype._readdir=function(abs,inGlobStar,cb){if(!this.aborted&&(cb=inflight("readdir\x00"+abs+"\x00"+inGlobStar,cb))){if(inGlobStar&&!ownProp(this.symlinks,abs))return this._readdirInGlobStar(abs,cb);if(ownProp(this.cache,abs)){var c=this.cache[abs];if(!c||"FILE"===c)return cb();if(Array.isArray(c))return cb(null,c)}fs.readdir(abs,readdirCb(this,abs,cb))}},Glob.prototype._readdirEntries=function(abs,entries,cb){if(!this.aborted){if(!this.mark&&!this.stat)for(var i=0;i<entries.length;i++){var e=entries[i];e="/"===abs?abs+e:abs+"/"+e,this.cache[e]=!0}return this.cache[abs]=entries,cb(null,entries)}},Glob.prototype._readdirError=function(f,er,cb){if(!this.aborted){switch(er.code){case"ENOTSUP":case"ENOTDIR":this.cache[this._makeAbs(f)]="FILE";break;case"ENOENT":case"ELOOP":case"ENAMETOOLONG":case"UNKNOWN":this.cache[this._makeAbs(f)]=!1;break;default:this.cache[this._makeAbs(f)]=!1,this.strict&&(this.emit("error",er),this.abort()),this.silent||console.error("glob error",er)}return cb()}},Glob.prototype._processGlobStar=function(prefix,read,abs,remain,index,inGlobStar,cb){var self=this;this._readdir(abs,inGlobStar,function(er,entries){self._processGlobStar2(prefix,read,abs,remain,index,inGlobStar,entries,cb)})},Glob.prototype._processGlobStar2=function(prefix,read,abs,remain,index,inGlobStar,entries,cb){if(!entries)return cb();var remainWithoutGlobStar=remain.slice(1),gspref=prefix?[prefix]:[],noGlobStar=gspref.concat(remainWithoutGlobStar);this._process(noGlobStar,index,!1,cb);var isSym=this.symlinks[abs],len=entries.length;if(isSym&&inGlobStar)return cb();for(var i=0;len>i;i++){var e=entries[i];if("."!==e.charAt(0)||this.dot){var instead=gspref.concat(entries[i],remainWithoutGlobStar);this._process(instead,index,!0,cb);var below=gspref.concat(entries[i],remain);this._process(below,index,!0,cb)}}cb()},Glob.prototype._processSimple=function(prefix,index,cb){var self=this;this._stat(prefix,function(er,exists){self._processSimple2(prefix,index,er,exists,cb)})},Glob.prototype._processSimple2=function(prefix,index,er,exists,cb){if(this.matches[index]||(this.matches[index]=Object.create(null)),!exists)return cb();if(prefix&&isAbsolute(prefix)&&!this.nomount){var trail=/[\/\\]$/.test(prefix);"/"===prefix.charAt(0)?prefix=path.join(this.root,prefix):(prefix=path.resolve(this.root,prefix),trail&&(prefix+="/"))}"win32"===process.platform&&(prefix=prefix.replace(/\\/g,"/")),this._emitMatch(index,prefix),cb()},Glob.prototype._stat=function(f,cb){function lstatcb_(er,lstat){return lstat&&lstat.isSymbolicLink()?fs.stat(abs,function(er,stat){er?self._stat2(f,abs,null,lstat,cb):self._stat2(f,abs,er,stat,cb)}):void self._stat2(f,abs,er,lstat,cb)}var abs=this._makeAbs(f),needDir="/"===f.slice(-1);if(f.length>this.maxLength)return cb();if(!this.stat&&ownProp(this.cache,abs)){var c=this.cache[abs];if(Array.isArray(c)&&(c="DIR"),!needDir||"DIR"===c)return cb(null,c);if(needDir&&"FILE"===c)return cb()}var stat=this.statCache[abs];if(void 0!==stat){if(stat===!1)return cb(null,stat);var type=stat.isDirectory()?"DIR":"FILE";return needDir&&"FILE"===type?cb():cb(null,type,stat)}var self=this,statcb=inflight("stat\x00"+abs,lstatcb_);
statcb&&fs.lstat(abs,statcb)},Glob.prototype._stat2=function(f,abs,er,stat,cb){if(er)return this.statCache[abs]=!1,cb();var needDir="/"===f.slice(-1);if(this.statCache[abs]=stat,"/"===abs.slice(-1)&&!stat.isDirectory())return cb(null,!1,stat);var c=stat.isDirectory()?"DIR":"FILE";return this.cache[abs]=this.cache[abs]||c,needDir&&"DIR"!==c?cb():cb(null,c,stat)}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function clone(obj){if(null===obj||"object"!=typeof obj)return obj;if(obj instanceof Object)var copy={__proto__:obj.__proto__};else var copy=Object.create(null);return Object.getOwnPropertyNames(obj).forEach(function(key){Object.defineProperty(copy,key,Object.getOwnPropertyDescriptor(obj,key))}),copy}var fs=__webpack_require__(5);module.exports=clone(fs)},function(module,exports,__webpack_require__){(function(Buffer){"use strict";function unixStylePath(filePath){return filePath.split(path.sep).join("/")}var through=__webpack_require__(184),fs=__webpack_require__(11),path=__webpack_require__(6),File=__webpack_require__(46),convert=__webpack_require__(139),stripBom=__webpack_require__(44),PLUGIN_NAME="gulp-sourcemap",urlRegex=/^(https?|webpack(-[^:]+)?):\/\//;module.exports.init=function(options){function sourceMapInit(file,encoding,callback){if(file.isNull()||file.sourceMap)return this.push(file),callback();if(file.isStream())return callback(new Error(PLUGIN_NAME+"-init: Streaming not supported"));var sourceMap,fileContent=file.contents.toString();if(options&&options.loadMaps){var sourcePath="";if(sourceMap=convert.fromSource(fileContent))sourceMap=sourceMap.toObject(),sourcePath=path.dirname(file.path),fileContent=convert.removeComments(fileContent);else{var mapFile,mapComment=convert.mapFileCommentRegex.exec(fileContent);mapComment?(mapFile=path.resolve(path.dirname(file.path),mapComment[1]||mapComment[2]),fileContent=convert.removeMapFileComments(fileContent)):mapFile=file.path+".map",sourcePath=path.dirname(mapFile);try{sourceMap=JSON.parse(stripBom(fs.readFileSync(mapFile,"utf8")))}catch(e){}}sourceMap&&(sourceMap.sourcesContent=sourceMap.sourcesContent||[],sourceMap.sources.forEach(function(source,i){if(source.match(urlRegex))return void(sourceMap.sourcesContent[i]=sourceMap.sourcesContent[i]||null);var absPath=path.resolve(sourcePath,source);if(sourceMap.sources[i]=unixStylePath(path.relative(file.base,absPath)),!sourceMap.sourcesContent[i]){var sourceContent=null;if(sourceMap.sourceRoot){if(sourceMap.sourceRoot.match(urlRegex))return void(sourceMap.sourcesContent[i]=null);absPath=path.resolve(sourcePath,sourceMap.sourceRoot,source)}if(absPath===file.path)sourceContent=fileContent;else try{options.debug&&console.log(PLUGIN_NAME+'-init: No source content for "'+source+'". Loading from file.'),sourceContent=stripBom(fs.readFileSync(absPath,"utf8"))}catch(e){options.debug&&console.warn(PLUGIN_NAME+"-init: source file not found: "+absPath)}sourceMap.sourcesContent[i]=sourceContent}}),file.contents=new Buffer(fileContent,"utf8"))}sourceMap||(sourceMap={version:3,names:[],mappings:"",sources:[unixStylePath(file.relative)],sourcesContent:[fileContent]}),sourceMap.file=unixStylePath(file.relative),file.sourceMap=sourceMap,this.push(file),callback()}return through.obj(sourceMapInit)},module.exports.write=function(destPath,options){function sourceMapWrite(file,encoding,callback){if(file.isNull()||!file.sourceMap)return this.push(file),callback();if(file.isStream())return callback(new Error(PLUGIN_NAME+"-write: Streaming not supported"));var sourceMap=file.sourceMap;if(sourceMap.file=unixStylePath(file.relative),sourceMap.sources=sourceMap.sources.map(function(filePath){return unixStylePath(filePath)}),"function"==typeof options.sourceRoot?sourceMap.sourceRoot=options.sourceRoot(file):sourceMap.sourceRoot=options.sourceRoot,options.includeContent){sourceMap.sourcesContent=sourceMap.sourcesContent||[];for(var i=0;i<file.sourceMap.sources.length;i++)if(!sourceMap.sourcesContent[i]){var sourcePath=path.resolve(sourceMap.sourceRoot||file.base,sourceMap.sources[i]);try{options.debug&&console.log(PLUGIN_NAME+'-write: No source content for "'+sourceMap.sources[i]+'". Loading from file.'),sourceMap.sourcesContent[i]=stripBom(fs.readFileSync(sourcePath,"utf8"))}catch(e){options.debug&&console.warn(PLUGIN_NAME+"-write: source file not found: "+sourcePath)}}void 0===sourceMap.sourceRoot?sourceMap.sourceRoot="/source/":null===sourceMap.sourceRoot&&(sourceMap.sourceRoot=void 0)}else delete sourceMap.sourcesContent;var commentFormatter,extension=file.relative.split(".").pop();switch(extension){case"css":commentFormatter=function(url){return"\n/*# sourceMappingURL="+url+" */\n"};break;case"js":commentFormatter=function(url){return"\n//# sourceMappingURL="+url+"\n"};break;default:commentFormatter=function(url){return""}}var comment;if(destPath){var sourceMapPath=path.join(file.base,destPath,file.relative)+".map",sourceMapFile=new File({cwd:file.cwd,base:file.base,path:sourceMapPath,contents:new Buffer(JSON.stringify(sourceMap)),stat:{isFile:function(){return!0},isDirectory:function(){return!1},isBlockDevice:function(){return!1},isCharacterDevice:function(){return!1},isSymbolicLink:function(){return!1},isFIFO:function(){return!1},isSocket:function(){return!1}}});this.push(sourceMapFile);var sourceMapPathRelative=path.relative(path.dirname(file.path),sourceMapPath);if(options.sourceMappingURLPrefix){var prefix="";prefix="function"==typeof options.sourceMappingURLPrefix?options.sourceMappingURLPrefix(file):options.sourceMappingURLPrefix,sourceMapPathRelative=prefix+path.join("/",sourceMapPathRelative)}comment=commentFormatter(unixStylePath(sourceMapPathRelative)),options.sourceMappingURL&&"function"==typeof options.sourceMappingURL&&(comment=commentFormatter(options.sourceMappingURL(file)))}else{var base64Map=new Buffer(JSON.stringify(sourceMap)).toString("base64");comment=commentFormatter("data:application/json;base64,"+base64Map)}options.addComment&&(file.contents=Buffer.concat([file.contents,new Buffer(comment)])),this.push(file),callback()}return void 0===options&&"[object Object]"===Object.prototype.toString.call(destPath)&&(options=destPath,destPath=void 0),options=options||{},void 0===options.includeContent&&(options.includeContent=!0),void 0===options.addComment&&(options.addComment=!0),through.obj(sourceMapWrite)}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){function baseToString(value){return null==value?"":value+""}function baseCallback(func,thisArg,argCount){var type=typeof func;return"function"==type?void 0===thisArg?func:bindCallback(func,thisArg,argCount):null==func?identity:"object"==type?baseMatches(func):void 0===thisArg?property(func):baseMatchesProperty(func,thisArg)}function baseGet(object,path,pathKey){if(null!=object){void 0!==pathKey&&pathKey in toObject(object)&&(path=[pathKey]);for(var index=0,length=path.length;null!=object&&length>index;)object=object[path[index++]];return index&&index==length?object:void 0}}function baseIsMatch(object,matchData,customizer){var index=matchData.length,length=index,noCustomizer=!customizer;if(null==object)return!length;for(object=toObject(object);index--;){var data=matchData[index];if(noCustomizer&&data[2]?data[1]!==object[data[0]]:!(data[0]in object))return!1}for(;++index<length;){data=matchData[index];var key=data[0],objValue=object[key],srcValue=data[1];if(noCustomizer&&data[2]){if(void 0===objValue&&!(key in object))return!1}else{var result=customizer?customizer(objValue,srcValue,key):void 0;if(!(void 0===result?baseIsEqual(srcValue,objValue,customizer,!0):result))return!1}}return!0}function baseMatches(source){var matchData=getMatchData(source);if(1==matchData.length&&matchData[0][2]){var key=matchData[0][0],value=matchData[0][1];return function(object){return null==object?!1:object[key]===value&&(void 0!==value||key in toObject(object))}}return function(object){return baseIsMatch(object,matchData)}}function baseMatchesProperty(path,srcValue){var isArr=isArray(path),isCommon=isKey(path)&&isStrictComparable(srcValue),pathKey=path+"";return path=toPath(path),function(object){if(null==object)return!1;var key=pathKey;if(object=toObject(object),(isArr||!isCommon)&&!(key in object)){if(object=1==path.length?object:baseGet(object,baseSlice(path,0,-1)),null==object)return!1;key=last(path),object=toObject(object)}return object[key]===srcValue?void 0!==srcValue||key in object:baseIsEqual(srcValue,object[key],void 0,!0)}}function baseProperty(key){return function(object){return null==object?void 0:object[key]}}function basePropertyDeep(path){var pathKey=path+"";return path=toPath(path),function(object){return baseGet(object,path,pathKey)}}function baseSlice(array,start,end){var index=-1,length=array.length;start=null==start?0:+start||0,0>start&&(start=-start>length?0:length+start),end=void 0===end||end>length?length:+end||0,0>end&&(end+=length),length=start>end?0:end-start>>>0,start>>>=0;for(var result=Array(length);++index<length;)result[index]=array[index+start];return result}function getMatchData(object){for(var result=pairs(object),length=result.length;length--;)result[length][2]=isStrictComparable(result[length][1]);return result}function isKey(value,object){var type=typeof value;if("string"==type&&reIsPlainProp.test(value)||"number"==type)return!0;if(isArray(value))return!1;var result=!reIsDeepProp.test(value);return result||null!=object&&value in toObject(object)}function isStrictComparable(value){return value===value&&!isObject(value)}function toObject(value){return isObject(value)?value:Object(value)}function toPath(value){if(isArray(value))return value;var result=[];return baseToString(value).replace(rePropName,function(match,number,quote,string){result.push(quote?string.replace(reEscapeChar,"$1"):number||match)}),result}function last(array){var length=array?array.length:0;return length?array[length-1]:void 0}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}function identity(value){return value}function property(path){return isKey(path)?baseProperty(path):basePropertyDeep(path)}var baseIsEqual=__webpack_require__(198),bindCallback=__webpack_require__(199),isArray=__webpack_require__(20),pairs=__webpack_require__(204),reIsDeepProp=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,reIsPlainProp=/^\w*$/,rePropName=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g,reEscapeChar=/\\(\\)?/g;module.exports=baseCallback},function(module,exports,__webpack_require__){function baseForOwn(object,iteratee){return baseFor(object,iteratee,keys)}function baseProperty(key){return function(object){return null==object?void 0:object[key]}}function createBaseEach(eachFunc,fromRight){return function(collection,iteratee){var length=collection?getLength(collection):0;if(!isLength(length))return eachFunc(collection,iteratee);for(var index=fromRight?length:-1,iterable=toObject(collection);(fromRight?index--:++index<length)&&iteratee(iterable[index],index,iterable)!==!1;);return collection}}function createBaseFor(fromRight){return function(object,iteratee,keysFunc){for(var iterable=toObject(object),props=keysFunc(object),length=props.length,index=fromRight?length:-1;fromRight?index--:++index<length;){var key=props[index];if(iteratee(iterable[key],key,iterable)===!1)break}return object}}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function toObject(value){return isObject(value)?value:Object(value)}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}var keys=__webpack_require__(34),MAX_SAFE_INTEGER=9007199254740991,baseEach=createBaseEach(baseForOwn),baseFor=createBaseFor(),getLength=baseProperty("length");module.exports=baseEach},function(module,exports,__webpack_require__){"use strict";var PassThrough=__webpack_require__(213);module.exports=function(){function add(source){return Array.isArray(source)?(source.forEach(add),this):(sources.push(source),source.once("end",remove.bind(null,source)),source.pipe(output,{end:!1}),this)}function isEmpty(){return 0==sources.length}function remove(source){sources=sources.filter(function(it){return it!==source}),!sources.length&&output.readable&&output.end()}var sources=[],output=new PassThrough({objectMode:!0});return output.setMaxListeners(0),output.add=add,output.isEmpty=isEmpty,output.on("unpipe",remove),Array.prototype.slice.call(arguments).forEach(add),output}},function(module,exports,__webpack_require__){(function(process){function mkdirP(p,opts,f,made){"function"==typeof opts?(f=opts,opts={}):opts&&"object"==typeof opts||(opts={mode:opts});var mode=opts.mode,xfs=opts.fs||fs;void 0===mode&&(mode=_0777&~process.umask()),made||(made=null);var cb=f||function(){};p=path.resolve(p),xfs.mkdir(p,mode,function(er){if(!er)return made=made||p,cb(null,made);switch(er.code){case"ENOENT":mkdirP(path.dirname(p),opts,function(er,made){er?cb(er,made):mkdirP(p,opts,cb,made)});break;default:xfs.stat(p,function(er2,stat){er2||!stat.isDirectory()?cb(er,made):cb(null,made)})}})}var path=__webpack_require__(6),fs=__webpack_require__(5),_0777=parseInt("0777",8);module.exports=mkdirP.mkdirp=mkdirP.mkdirP=mkdirP,mkdirP.sync=function sync(p,opts,made){opts&&"object"==typeof opts||(opts={mode:opts});var mode=opts.mode,xfs=opts.fs||fs;void 0===mode&&(mode=_0777&~process.umask()),made||(made=null),p=path.resolve(p);try{xfs.mkdirSync(p,mode),made=made||p}catch(err0){switch(err0.code){case"ENOENT":made=sync(path.dirname(p),opts,made),sync(p,opts,made);break;default:var stat;try{stat=xfs.statSync(p)}catch(err1){throw err0}if(!stat.isDirectory())throw err0}}return made}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){function Multipart(boundary){return!this instanceof Multipart?new Multipart(boundary):(this.boundary=boundary||Math.random().toString(36).slice(2),Sandwich.call(this,{head:"--"+this.boundary+CRNL,tail:CRNL+"--"+this.boundary+"--",separator:CRNL+"--"+this.boundary+CRNL}),this._add=this.add,void(this.add=this.addPart))}var Sandwich=__webpack_require__(216).SandwichStream,stream=__webpack_require__(3),inherits=__webpack_require__(4),CRNL="\r\n";module.exports=Multipart,inherits(Multipart,Sandwich),Multipart.prototype.addPart=function(part){part=part||{};var partStream=new stream.PassThrough;if(part.headers)for(var key in part.headers){var header=part.headers[key];partStream.write(key+": "+header+CRNL)}partStream.write(CRNL),part.body instanceof stream.Stream?part.body.pipe(partStream):partStream.end(part.body),this._add(partStream)}},function(module,exports,__webpack_require__){function parse(opts){function parseRow(row){try{if(row)return JSON.parse(row)}catch(e){opts.strict&&this.emit("error",new Error("Could not parse row "+row.slice(0,50)+"..."))}}return opts=opts||{},opts.strict=opts.strict!==!1,split(parseRow)}function serialize(opts){return through.obj(opts,function(obj,enc,cb){cb(null,JSON.stringify(obj)+EOL)})}var through=__webpack_require__(45),split=__webpack_require__(222),EOL=__webpack_require__(76).EOL;module.exports=parse,module.exports.serialize=module.exports.stringify=serialize,module.exports.parse=parse},function(module,exports){"use strict";function toObject(val){if(null===val||void 0===val)throw new TypeError("Object.assign cannot be called with null or undefined");return Object(val)}var hasOwnProperty=Object.prototype.hasOwnProperty,propIsEnumerable=Object.prototype.propertyIsEnumerable;module.exports=Object.assign||function(target,source){for(var from,symbols,to=toObject(target),s=1;s<arguments.length;s++){from=Object(arguments[s]);for(var key in from)hasOwnProperty.call(from,key)&&(to[key]=from[key]);if(Object.getOwnPropertySymbols){symbols=Object.getOwnPropertySymbols(from);for(var i=0;i<symbols.length;i++)propIsEnumerable.call(from,symbols[i])&&(to[symbols[i]]=from[symbols[i]])}}return to}},function(module,exports){exports.endianness=function(){return"LE"},exports.hostname=function(){return"undefined"!=typeof location?location.hostname:""},exports.loadavg=function(){return[]},exports.uptime=function(){return 0},exports.freemem=function(){return Number.MAX_VALUE},exports.totalmem=function(){return Number.MAX_VALUE},exports.cpus=function(){return[]},exports.type=function(){return"Browser"},exports.release=function(){return"undefined"!=typeof navigator?navigator.appVersion:""},exports.networkInterfaces=exports.getNetworkInterfaces=function(){return{}},exports.arch=function(){return"javascript"},exports.platform=function(){return"browser"},exports.tmpdir=exports.tmpDir=function(){return"/tmp"},exports.EOL="\n"},function(module,exports,__webpack_require__){"use strict";function PassThrough(options){return this instanceof PassThrough?void Transform.call(this,options):new PassThrough(options)}module.exports=PassThrough;var Transform=__webpack_require__(40),util=__webpack_require__(8);util.inherits=__webpack_require__(4),util.inherits(PassThrough,Transform),PassThrough.prototype._transform=function(chunk,encoding,cb){cb(null,chunk)}},function(module,exports,__webpack_require__){(function(process){"use strict";function ReadableState(options,stream){Duplex=Duplex||__webpack_require__(17),options=options||{},this.objectMode=!!options.objectMode,stream instanceof Duplex&&(this.objectMode=this.objectMode||!!options.readableObjectMode);var hwm=options.highWaterMark,defaultHwm=this.objectMode?16:16384;this.highWaterMark=hwm||0===hwm?hwm:defaultHwm,this.highWaterMark=~~this.highWaterMark,this.buffer=[],this.length=0,this.pipes=null,this.pipesCount=0,this.flowing=null,this.ended=!1,this.endEmitted=!1,this.reading=!1,this.sync=!0,this.needReadable=!1,this.emittedReadable=!1,this.readableListening=!1,this.defaultEncoding=options.defaultEncoding||"utf8",this.ranOut=!1,this.awaitDrain=0,this.readingMore=!1,this.decoder=null,this.encoding=null,options.encoding&&(StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this.decoder=new StringDecoder(options.encoding),this.encoding=options.encoding)}function Readable(options){return Duplex=Duplex||__webpack_require__(17),this instanceof Readable?(this._readableState=new ReadableState(options,this),this.readable=!0,options&&"function"==typeof options.read&&(this._read=options.read),void Stream.call(this)):new Readable(options)}function readableAddChunk(stream,state,chunk,encoding,addToFront){var er=chunkInvalid(state,chunk);if(er)stream.emit("error",er);else if(null===chunk)state.reading=!1,onEofChunk(stream,state);else if(state.objectMode||chunk&&chunk.length>0)if(state.ended&&!addToFront){var e=new Error("stream.push() after EOF");stream.emit("error",e)}else if(state.endEmitted&&addToFront){var e=new Error("stream.unshift() after end event");stream.emit("error",e)}else!state.decoder||addToFront||encoding||(chunk=state.decoder.write(chunk)),addToFront||(state.reading=!1),state.flowing&&0===state.length&&!state.sync?(stream.emit("data",chunk),stream.read(0)):(state.length+=state.objectMode?1:chunk.length,addToFront?state.buffer.unshift(chunk):state.buffer.push(chunk),state.needReadable&&emitReadable(stream)),maybeReadMore(stream,state);else addToFront||(state.reading=!1);return needMoreData(state)}function needMoreData(state){return!state.ended&&(state.needReadable||state.length<state.highWaterMark||0===state.length)}function computeNewHighWaterMark(n){return n>=MAX_HWM?n=MAX_HWM:(n--,n|=n>>>1,n|=n>>>2,n|=n>>>4,n|=n>>>8,n|=n>>>16,n++),n}function howMuchToRead(n,state){return 0===state.length&&state.ended?0:state.objectMode?0===n?0:1:null===n||isNaN(n)?state.flowing&&state.buffer.length?state.buffer[0].length:state.length:0>=n?0:(n>state.highWaterMark&&(state.highWaterMark=computeNewHighWaterMark(n)),n>state.length?state.ended?state.length:(state.needReadable=!0,0):n)}function chunkInvalid(state,chunk){var er=null;return Buffer.isBuffer(chunk)||"string"==typeof chunk||null===chunk||void 0===chunk||state.objectMode||(er=new TypeError("Invalid non-string/buffer chunk")),er}function onEofChunk(stream,state){if(!state.ended){if(state.decoder){var chunk=state.decoder.end();chunk&&chunk.length&&(state.buffer.push(chunk),state.length+=state.objectMode?1:chunk.length)}state.ended=!0,emitReadable(stream)}}function emitReadable(stream){var state=stream._readableState;state.needReadable=!1,state.emittedReadable||(debug("emitReadable",state.flowing),state.emittedReadable=!0,state.sync?processNextTick(emitReadable_,stream):emitReadable_(stream))}function emitReadable_(stream){debug("emit readable"),stream.emit("readable"),flow(stream)}function maybeReadMore(stream,state){state.readingMore||(state.readingMore=!0,processNextTick(maybeReadMore_,stream,state))}function maybeReadMore_(stream,state){for(var len=state.length;!state.reading&&!state.flowing&&!state.ended&&state.length<state.highWaterMark&&(debug("maybeReadMore read 0"),stream.read(0),len!==state.length);)len=state.length;state.readingMore=!1}function pipeOnDrain(src){return function(){var state=src._readableState;debug("pipeOnDrain",state.awaitDrain),state.awaitDrain&&state.awaitDrain--,0===state.awaitDrain&&EElistenerCount(src,"data")&&(state.flowing=!0,flow(src))}}function nReadingNextTick(self){debug("readable nexttick read 0"),self.read(0)}function resume(stream,state){state.resumeScheduled||(state.resumeScheduled=!0,processNextTick(resume_,stream,state))}function resume_(stream,state){state.reading||(debug("resume read 0"),stream.read(0)),state.resumeScheduled=!1,stream.emit("resume"),flow(stream),state.flowing&&!state.reading&&stream.read(0)}function flow(stream){var state=stream._readableState;if(debug("flow",state.flowing),state.flowing)do var chunk=stream.read();while(null!==chunk&&state.flowing)}function fromList(n,state){var ret,list=state.buffer,length=state.length,stringMode=!!state.decoder,objectMode=!!state.objectMode;if(0===list.length)return null;if(0===length)ret=null;else if(objectMode)ret=list.shift();else if(!n||n>=length)ret=stringMode?list.join(""):1===list.length?list[0]:Buffer.concat(list,length),list.length=0;else if(n<list[0].length){var buf=list[0];ret=buf.slice(0,n),list[0]=buf.slice(n)}else if(n===list[0].length)ret=list.shift();else{ret=stringMode?"":new Buffer(n);for(var c=0,i=0,l=list.length;l>i&&n>c;i++){var buf=list[0],cpy=Math.min(n-c,buf.length);stringMode?ret+=buf.slice(0,cpy):buf.copy(ret,c,0,cpy),cpy<buf.length?list[0]=buf.slice(cpy):list.shift(),c+=cpy}}return ret}function endReadable(stream){var state=stream._readableState;if(state.length>0)throw new Error("endReadable called on non-empty stream");state.endEmitted||(state.ended=!0,processNextTick(endReadableNT,state,stream))}function endReadableNT(state,stream){state.endEmitted||0!==state.length||(state.endEmitted=!0,stream.readable=!1,stream.emit("end"))}function forEach(xs,f){for(var i=0,l=xs.length;l>i;i++)f(xs[i],i)}function indexOf(xs,x){for(var i=0,l=xs.length;l>i;i++)if(xs[i]===x)return i;return-1}module.exports=Readable;var processNextTick=__webpack_require__(39),isArray=__webpack_require__(33),Buffer=__webpack_require__(2).Buffer;Readable.ReadableState=ReadableState;var Stream,EElistenerCount=(__webpack_require__(13),function(emitter,type){return emitter.listeners(type).length});!function(){try{Stream=__webpack_require__(3)}catch(_){}finally{Stream||(Stream=__webpack_require__(13).EventEmitter)}}();var Buffer=__webpack_require__(2).Buffer,util=__webpack_require__(8);util.inherits=__webpack_require__(4);var debug,debugUtil=__webpack_require__(266);debug=debugUtil&&debugUtil.debuglog?debugUtil.debuglog("stream"):function(){};var StringDecoder;util.inherits(Readable,Stream);var Duplex,Duplex;Readable.prototype.push=function(chunk,encoding){var state=this._readableState;return state.objectMode||"string"!=typeof chunk||(encoding=encoding||state.defaultEncoding,encoding!==state.encoding&&(chunk=new Buffer(chunk,encoding),encoding="")),readableAddChunk(this,state,chunk,encoding,!1)},Readable.prototype.unshift=function(chunk){var state=this._readableState;return readableAddChunk(this,state,chunk,"",!0)},Readable.prototype.isPaused=function(){return this._readableState.flowing===!1},Readable.prototype.setEncoding=function(enc){return StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this._readableState.decoder=new StringDecoder(enc),this._readableState.encoding=enc,this};var MAX_HWM=8388608;Readable.prototype.read=function(n){debug("read",n);var state=this._readableState,nOrig=n;if(("number"!=typeof n||n>0)&&(state.emittedReadable=!1),0===n&&state.needReadable&&(state.length>=state.highWaterMark||state.ended))return debug("read: emitReadable",state.length,state.ended),0===state.length&&state.ended?endReadable(this):emitReadable(this),null;if(n=howMuchToRead(n,state),0===n&&state.ended)return 0===state.length&&endReadable(this),null;var doRead=state.needReadable;debug("need readable",doRead),(0===state.length||state.length-n<state.highWaterMark)&&(doRead=!0,debug("length less than watermark",doRead)),(state.ended||state.reading)&&(doRead=!1,debug("reading or ended",doRead)),doRead&&(debug("do read"),state.reading=!0,state.sync=!0,0===state.length&&(state.needReadable=!0),this._read(state.highWaterMark),state.sync=!1),doRead&&!state.reading&&(n=howMuchToRead(nOrig,state));var ret;return ret=n>0?fromList(n,state):null,null===ret&&(state.needReadable=!0,n=0),state.length-=n,0!==state.length||state.ended||(state.needReadable=!0),nOrig!==n&&state.ended&&0===state.length&&endReadable(this),null!==ret&&this.emit("data",ret),ret},Readable.prototype._read=function(n){this.emit("error",new Error("not implemented"))},Readable.prototype.pipe=function(dest,pipeOpts){function onunpipe(readable){debug("onunpipe"),readable===src&&cleanup()}function onend(){debug("onend"),dest.end()}function cleanup(){debug("cleanup"),dest.removeListener("close",onclose),dest.removeListener("finish",onfinish),dest.removeListener("drain",ondrain),dest.removeListener("error",onerror),dest.removeListener("unpipe",onunpipe),src.removeListener("end",onend),src.removeListener("end",cleanup),src.removeListener("data",ondata),cleanedUp=!0,!state.awaitDrain||dest._writableState&&!dest._writableState.needDrain||ondrain()}function ondata(chunk){debug("ondata");var ret=dest.write(chunk);!1===ret&&(1!==state.pipesCount||state.pipes[0]!==dest||1!==src.listenerCount("data")||cleanedUp||(debug("false write response, pause",src._readableState.awaitDrain),src._readableState.awaitDrain++),src.pause())}function onerror(er){debug("onerror",er),unpipe(),dest.removeListener("error",onerror),0===EElistenerCount(dest,"error")&&dest.emit("error",er)}function onclose(){dest.removeListener("finish",onfinish),unpipe()}function onfinish(){debug("onfinish"),dest.removeListener("close",onclose),unpipe()}function unpipe(){debug("unpipe"),src.unpipe(dest)}var src=this,state=this._readableState;switch(state.pipesCount){case 0:state.pipes=dest;break;case 1:state.pipes=[state.pipes,dest];break;default:state.pipes.push(dest)}state.pipesCount+=1,debug("pipe count=%d opts=%j",state.pipesCount,pipeOpts);var doEnd=(!pipeOpts||pipeOpts.end!==!1)&&dest!==process.stdout&&dest!==process.stderr,endFn=doEnd?onend:cleanup;state.endEmitted?processNextTick(endFn):src.once("end",endFn),dest.on("unpipe",onunpipe);var ondrain=pipeOnDrain(src);dest.on("drain",ondrain);var cleanedUp=!1;return src.on("data",ondata),dest._events&&dest._events.error?isArray(dest._events.error)?dest._events.error.unshift(onerror):dest._events.error=[onerror,dest._events.error]:dest.on("error",onerror),dest.once("close",onclose),dest.once("finish",onfinish),dest.emit("pipe",src),state.flowing||(debug("pipe resume"),src.resume()),dest},Readable.prototype.unpipe=function(dest){var state=this._readableState;if(0===state.pipesCount)return this;if(1===state.pipesCount)return dest&&dest!==state.pipes?this:(dest||(dest=state.pipes),state.pipes=null,state.pipesCount=0,state.flowing=!1,dest&&dest.emit("unpipe",this),this);if(!dest){var dests=state.pipes,len=state.pipesCount;state.pipes=null,state.pipesCount=0,state.flowing=!1;for(var i=0;len>i;i++)dests[i].emit("unpipe",this);return this}var i=indexOf(state.pipes,dest);return-1===i?this:(state.pipes.splice(i,1),state.pipesCount-=1,1===state.pipesCount&&(state.pipes=state.pipes[0]),dest.emit("unpipe",this),this)},Readable.prototype.on=function(ev,fn){var res=Stream.prototype.on.call(this,ev,fn);if("data"===ev&&!1!==this._readableState.flowing&&this.resume(),"readable"===ev&&this.readable){var state=this._readableState;state.readableListening||(state.readableListening=!0,state.emittedReadable=!1,state.needReadable=!0,state.reading?state.length&&emitReadable(this,state):processNextTick(nReadingNextTick,this))}return res},Readable.prototype.addListener=Readable.prototype.on,Readable.prototype.resume=function(){var state=this._readableState;return state.flowing||(debug("resume"),state.flowing=!0,resume(this,state)),this},Readable.prototype.pause=function(){return debug("call pause flowing=%j",this._readableState.flowing),!1!==this._readableState.flowing&&(debug("pause"),this._readableState.flowing=!1,this.emit("pause")),this},Readable.prototype.wrap=function(stream){var state=this._readableState,paused=!1,self=this;stream.on("end",function(){if(debug("wrapped end"),state.decoder&&!state.ended){var chunk=state.decoder.end();chunk&&chunk.length&&self.push(chunk)}self.push(null)}),stream.on("data",function(chunk){if(debug("wrapped data"),state.decoder&&(chunk=state.decoder.write(chunk)),(!state.objectMode||null!==chunk&&void 0!==chunk)&&(state.objectMode||chunk&&chunk.length)){var ret=self.push(chunk);ret||(paused=!0,stream.pause())}});for(var i in stream)void 0===this[i]&&"function"==typeof stream[i]&&(this[i]=function(method){return function(){return stream[method].apply(stream,arguments)}}(i));var events=["error","close","destroy","pause","resume"];return forEach(events,function(ev){stream.on(ev,self.emit.bind(self,ev))}),self._read=function(n){debug("wrapped _read",n),paused&&(paused=!1,stream.resume())},self},Readable._fromList=fromList}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function nop(){}function WriteReq(chunk,encoding,cb){this.chunk=chunk,this.encoding=encoding,this.callback=cb,this.next=null}function WritableState(options,stream){Duplex=Duplex||__webpack_require__(17),options=options||{},this.objectMode=!!options.objectMode,stream instanceof Duplex&&(this.objectMode=this.objectMode||!!options.writableObjectMode);var hwm=options.highWaterMark,defaultHwm=this.objectMode?16:16384;this.highWaterMark=hwm||0===hwm?hwm:defaultHwm,this.highWaterMark=~~this.highWaterMark,this.needDrain=!1,this.ending=!1,this.ended=!1,this.finished=!1;var noDecode=options.decodeStrings===!1;this.decodeStrings=!noDecode,this.defaultEncoding=options.defaultEncoding||"utf8",this.length=0,this.writing=!1,this.corked=0,this.sync=!0,this.bufferProcessing=!1,this.onwrite=function(er){onwrite(stream,er)},this.writecb=null,this.writelen=0,this.bufferedRequest=null,this.lastBufferedRequest=null,this.pendingcb=0,this.prefinished=!1,this.errorEmitted=!1}function Writable(options){return Duplex=Duplex||__webpack_require__(17),this instanceof Writable||this instanceof Duplex?(this._writableState=new WritableState(options,this),this.writable=!0,options&&("function"==typeof options.write&&(this._write=options.write),"function"==typeof options.writev&&(this._writev=options.writev)),void Stream.call(this)):new Writable(options)}function writeAfterEnd(stream,cb){var er=new Error("write after end");stream.emit("error",er),processNextTick(cb,er)}function validChunk(stream,state,chunk,cb){var valid=!0;if(!Buffer.isBuffer(chunk)&&"string"!=typeof chunk&&null!==chunk&&void 0!==chunk&&!state.objectMode){var er=new TypeError("Invalid non-string/buffer chunk");stream.emit("error",er),processNextTick(cb,er),valid=!1}return valid}function decodeChunk(state,chunk,encoding){return state.objectMode||state.decodeStrings===!1||"string"!=typeof chunk||(chunk=new Buffer(chunk,encoding)),
chunk}function writeOrBuffer(stream,state,chunk,encoding,cb){chunk=decodeChunk(state,chunk,encoding),Buffer.isBuffer(chunk)&&(encoding="buffer");var len=state.objectMode?1:chunk.length;state.length+=len;var ret=state.length<state.highWaterMark;if(ret||(state.needDrain=!0),state.writing||state.corked){var last=state.lastBufferedRequest;state.lastBufferedRequest=new WriteReq(chunk,encoding,cb),last?last.next=state.lastBufferedRequest:state.bufferedRequest=state.lastBufferedRequest}else doWrite(stream,state,!1,len,chunk,encoding,cb);return ret}function doWrite(stream,state,writev,len,chunk,encoding,cb){state.writelen=len,state.writecb=cb,state.writing=!0,state.sync=!0,writev?stream._writev(chunk,state.onwrite):stream._write(chunk,encoding,state.onwrite),state.sync=!1}function onwriteError(stream,state,sync,er,cb){--state.pendingcb,sync?processNextTick(cb,er):cb(er),stream._writableState.errorEmitted=!0,stream.emit("error",er)}function onwriteStateUpdate(state){state.writing=!1,state.writecb=null,state.length-=state.writelen,state.writelen=0}function onwrite(stream,er){var state=stream._writableState,sync=state.sync,cb=state.writecb;if(onwriteStateUpdate(state),er)onwriteError(stream,state,sync,er,cb);else{var finished=needFinish(state);finished||state.corked||state.bufferProcessing||!state.bufferedRequest||clearBuffer(stream,state),sync?processNextTick(afterWrite,stream,state,finished,cb):afterWrite(stream,state,finished,cb)}}function afterWrite(stream,state,finished,cb){finished||onwriteDrain(stream,state),state.pendingcb--,cb(),finishMaybe(stream,state)}function onwriteDrain(stream,state){0===state.length&&state.needDrain&&(state.needDrain=!1,stream.emit("drain"))}function clearBuffer(stream,state){state.bufferProcessing=!0;var entry=state.bufferedRequest;if(stream._writev&&entry&&entry.next){for(var buffer=[],cbs=[];entry;)cbs.push(entry.callback),buffer.push(entry),entry=entry.next;state.pendingcb++,state.lastBufferedRequest=null,doWrite(stream,state,!0,state.length,buffer,"",function(err){for(var i=0;i<cbs.length;i++)state.pendingcb--,cbs[i](err)})}else{for(;entry;){var chunk=entry.chunk,encoding=entry.encoding,cb=entry.callback,len=state.objectMode?1:chunk.length;if(doWrite(stream,state,!1,len,chunk,encoding,cb),entry=entry.next,state.writing)break}null===entry&&(state.lastBufferedRequest=null)}state.bufferedRequest=entry,state.bufferProcessing=!1}function needFinish(state){return state.ending&&0===state.length&&null===state.bufferedRequest&&!state.finished&&!state.writing}function prefinish(stream,state){state.prefinished||(state.prefinished=!0,stream.emit("prefinish"))}function finishMaybe(stream,state){var need=needFinish(state);return need&&(0===state.pendingcb?(prefinish(stream,state),state.finished=!0,stream.emit("finish")):prefinish(stream,state)),need}function endWritable(stream,state,cb){state.ending=!0,finishMaybe(stream,state),cb&&(state.finished?processNextTick(cb):stream.once("finish",cb)),state.ended=!0}module.exports=Writable;var processNextTick=__webpack_require__(39),Buffer=__webpack_require__(2).Buffer;Writable.WritableState=WritableState;var util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Stream,internalUtil={deprecate:__webpack_require__(239)};!function(){try{Stream=__webpack_require__(3)}catch(_){}finally{Stream||(Stream=__webpack_require__(13).EventEmitter)}}();var Buffer=__webpack_require__(2).Buffer;util.inherits(Writable,Stream);var Duplex;WritableState.prototype.getBuffer=function(){for(var current=this.bufferedRequest,out=[];current;)out.push(current),current=current.next;return out},function(){try{Object.defineProperty(WritableState.prototype,"buffer",{get:internalUtil.deprecate(function(){return this.getBuffer()},"_writableState.buffer is deprecated. Use _writableState.getBuffer instead.")})}catch(_){}}();var Duplex;Writable.prototype.pipe=function(){this.emit("error",new Error("Cannot pipe. Not readable."))},Writable.prototype.write=function(chunk,encoding,cb){var state=this._writableState,ret=!1;return"function"==typeof encoding&&(cb=encoding,encoding=null),Buffer.isBuffer(chunk)?encoding="buffer":encoding||(encoding=state.defaultEncoding),"function"!=typeof cb&&(cb=nop),state.ended?writeAfterEnd(this,cb):validChunk(this,state,chunk,cb)&&(state.pendingcb++,ret=writeOrBuffer(this,state,chunk,encoding,cb)),ret},Writable.prototype.cork=function(){var state=this._writableState;state.corked++},Writable.prototype.uncork=function(){var state=this._writableState;state.corked&&(state.corked--,state.writing||state.corked||state.finished||state.bufferProcessing||!state.bufferedRequest||clearBuffer(this,state))},Writable.prototype.setDefaultEncoding=function(encoding){if("string"==typeof encoding&&(encoding=encoding.toLowerCase()),!(["hex","utf8","utf-8","ascii","binary","base64","ucs2","ucs-2","utf16le","utf-16le","raw"].indexOf((encoding+"").toLowerCase())>-1))throw new TypeError("Unknown encoding: "+encoding);this._writableState.defaultEncoding=encoding},Writable.prototype._write=function(chunk,encoding,cb){cb(new Error("not implemented"))},Writable.prototype._writev=null,Writable.prototype.end=function(chunk,encoding,cb){var state=this._writableState;"function"==typeof chunk?(cb=chunk,chunk=null,encoding=null):"function"==typeof encoding&&(cb=encoding,encoding=null),null!==chunk&&void 0!==chunk&&this.write(chunk,encoding),state.corked&&(state.corked=1,this.uncork()),state.ending||state.finished||endWritable(this,state,cb)}},function(module,exports,__webpack_require__){var Stream=function(){try{return __webpack_require__(3)}catch(_){}}();exports=module.exports=__webpack_require__(78),exports.Stream=Stream||exports,exports.Readable=exports,exports.Writable=__webpack_require__(79),exports.Duplex=__webpack_require__(17),exports.Transform=__webpack_require__(40),exports.PassThrough=__webpack_require__(77)},function(module,exports,__webpack_require__){function PassThrough(options){return this instanceof PassThrough?void Transform.call(this,options):new PassThrough(options)}module.exports=PassThrough;var Transform=__webpack_require__(42),util=__webpack_require__(8);util.inherits=__webpack_require__(4),util.inherits(PassThrough,Transform),PassThrough.prototype._transform=function(chunk,encoding,cb){cb(null,chunk)}},function(module,exports,__webpack_require__){(function(process){function ReadableState(options,stream){var Duplex=__webpack_require__(14);options=options||{};var hwm=options.highWaterMark,defaultHwm=options.objectMode?16:16384;this.highWaterMark=hwm||0===hwm?hwm:defaultHwm,this.highWaterMark=~~this.highWaterMark,this.buffer=[],this.length=0,this.pipes=null,this.pipesCount=0,this.flowing=null,this.ended=!1,this.endEmitted=!1,this.reading=!1,this.sync=!0,this.needReadable=!1,this.emittedReadable=!1,this.readableListening=!1,this.objectMode=!!options.objectMode,stream instanceof Duplex&&(this.objectMode=this.objectMode||!!options.readableObjectMode),this.defaultEncoding=options.defaultEncoding||"utf8",this.ranOut=!1,this.awaitDrain=0,this.readingMore=!1,this.decoder=null,this.encoding=null,options.encoding&&(StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this.decoder=new StringDecoder(options.encoding),this.encoding=options.encoding)}function Readable(options){__webpack_require__(14);return this instanceof Readable?(this._readableState=new ReadableState(options,this),this.readable=!0,void Stream.call(this)):new Readable(options)}function readableAddChunk(stream,state,chunk,encoding,addToFront){var er=chunkInvalid(state,chunk);if(er)stream.emit("error",er);else if(util.isNullOrUndefined(chunk))state.reading=!1,state.ended||onEofChunk(stream,state);else if(state.objectMode||chunk&&chunk.length>0)if(state.ended&&!addToFront){var e=new Error("stream.push() after EOF");stream.emit("error",e)}else if(state.endEmitted&&addToFront){var e=new Error("stream.unshift() after end event");stream.emit("error",e)}else!state.decoder||addToFront||encoding||(chunk=state.decoder.write(chunk)),addToFront||(state.reading=!1),state.flowing&&0===state.length&&!state.sync?(stream.emit("data",chunk),stream.read(0)):(state.length+=state.objectMode?1:chunk.length,addToFront?state.buffer.unshift(chunk):state.buffer.push(chunk),state.needReadable&&emitReadable(stream)),maybeReadMore(stream,state);else addToFront||(state.reading=!1);return needMoreData(state)}function needMoreData(state){return!state.ended&&(state.needReadable||state.length<state.highWaterMark||0===state.length)}function roundUpToNextPowerOf2(n){if(n>=MAX_HWM)n=MAX_HWM;else{n--;for(var p=1;32>p;p<<=1)n|=n>>p;n++}return n}function howMuchToRead(n,state){return 0===state.length&&state.ended?0:state.objectMode?0===n?0:1:isNaN(n)||util.isNull(n)?state.flowing&&state.buffer.length?state.buffer[0].length:state.length:0>=n?0:(n>state.highWaterMark&&(state.highWaterMark=roundUpToNextPowerOf2(n)),n>state.length?state.ended?state.length:(state.needReadable=!0,0):n)}function chunkInvalid(state,chunk){var er=null;return util.isBuffer(chunk)||util.isString(chunk)||util.isNullOrUndefined(chunk)||state.objectMode||(er=new TypeError("Invalid non-string/buffer chunk")),er}function onEofChunk(stream,state){if(state.decoder&&!state.ended){var chunk=state.decoder.end();chunk&&chunk.length&&(state.buffer.push(chunk),state.length+=state.objectMode?1:chunk.length)}state.ended=!0,emitReadable(stream)}function emitReadable(stream){var state=stream._readableState;state.needReadable=!1,state.emittedReadable||(debug("emitReadable",state.flowing),state.emittedReadable=!0,state.sync?process.nextTick(function(){emitReadable_(stream)}):emitReadable_(stream))}function emitReadable_(stream){debug("emit readable"),stream.emit("readable"),flow(stream)}function maybeReadMore(stream,state){state.readingMore||(state.readingMore=!0,process.nextTick(function(){maybeReadMore_(stream,state)}))}function maybeReadMore_(stream,state){for(var len=state.length;!state.reading&&!state.flowing&&!state.ended&&state.length<state.highWaterMark&&(debug("maybeReadMore read 0"),stream.read(0),len!==state.length);)len=state.length;state.readingMore=!1}function pipeOnDrain(src){return function(){var state=src._readableState;debug("pipeOnDrain",state.awaitDrain),state.awaitDrain&&state.awaitDrain--,0===state.awaitDrain&&EE.listenerCount(src,"data")&&(state.flowing=!0,flow(src))}}function resume(stream,state){state.resumeScheduled||(state.resumeScheduled=!0,process.nextTick(function(){resume_(stream,state)}))}function resume_(stream,state){state.resumeScheduled=!1,stream.emit("resume"),flow(stream),state.flowing&&!state.reading&&stream.read(0)}function flow(stream){var state=stream._readableState;if(debug("flow",state.flowing),state.flowing)do var chunk=stream.read();while(null!==chunk&&state.flowing)}function fromList(n,state){var ret,list=state.buffer,length=state.length,stringMode=!!state.decoder,objectMode=!!state.objectMode;if(0===list.length)return null;if(0===length)ret=null;else if(objectMode)ret=list.shift();else if(!n||n>=length)ret=stringMode?list.join(""):Buffer.concat(list,length),list.length=0;else if(n<list[0].length){var buf=list[0];ret=buf.slice(0,n),list[0]=buf.slice(n)}else if(n===list[0].length)ret=list.shift();else{ret=stringMode?"":new Buffer(n);for(var c=0,i=0,l=list.length;l>i&&n>c;i++){var buf=list[0],cpy=Math.min(n-c,buf.length);stringMode?ret+=buf.slice(0,cpy):buf.copy(ret,c,0,cpy),cpy<buf.length?list[0]=buf.slice(cpy):list.shift(),c+=cpy}}return ret}function endReadable(stream){var state=stream._readableState;if(state.length>0)throw new Error("endReadable called on non-empty stream");state.endEmitted||(state.ended=!0,process.nextTick(function(){state.endEmitted||0!==state.length||(state.endEmitted=!0,stream.readable=!1,stream.emit("end"))}))}function forEach(xs,f){for(var i=0,l=xs.length;l>i;i++)f(xs[i],i)}function indexOf(xs,x){for(var i=0,l=xs.length;l>i;i++)if(xs[i]===x)return i;return-1}module.exports=Readable;var isArray=__webpack_require__(33),Buffer=__webpack_require__(2).Buffer;Readable.ReadableState=ReadableState;var EE=__webpack_require__(13).EventEmitter;EE.listenerCount||(EE.listenerCount=function(emitter,type){return emitter.listeners(type).length});var Stream=__webpack_require__(3),util=__webpack_require__(8);util.inherits=__webpack_require__(4);var StringDecoder,debug=__webpack_require__(267);debug=debug&&debug.debuglog?debug.debuglog("stream"):function(){},util.inherits(Readable,Stream),Readable.prototype.push=function(chunk,encoding){var state=this._readableState;return util.isString(chunk)&&!state.objectMode&&(encoding=encoding||state.defaultEncoding,encoding!==state.encoding&&(chunk=new Buffer(chunk,encoding),encoding="")),readableAddChunk(this,state,chunk,encoding,!1)},Readable.prototype.unshift=function(chunk){var state=this._readableState;return readableAddChunk(this,state,chunk,"",!0)},Readable.prototype.setEncoding=function(enc){return StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this._readableState.decoder=new StringDecoder(enc),this._readableState.encoding=enc,this};var MAX_HWM=8388608;Readable.prototype.read=function(n){debug("read",n);var state=this._readableState,nOrig=n;if((!util.isNumber(n)||n>0)&&(state.emittedReadable=!1),0===n&&state.needReadable&&(state.length>=state.highWaterMark||state.ended))return debug("read: emitReadable",state.length,state.ended),0===state.length&&state.ended?endReadable(this):emitReadable(this),null;if(n=howMuchToRead(n,state),0===n&&state.ended)return 0===state.length&&endReadable(this),null;var doRead=state.needReadable;debug("need readable",doRead),(0===state.length||state.length-n<state.highWaterMark)&&(doRead=!0,debug("length less than watermark",doRead)),(state.ended||state.reading)&&(doRead=!1,debug("reading or ended",doRead)),doRead&&(debug("do read"),state.reading=!0,state.sync=!0,0===state.length&&(state.needReadable=!0),this._read(state.highWaterMark),state.sync=!1),doRead&&!state.reading&&(n=howMuchToRead(nOrig,state));var ret;return ret=n>0?fromList(n,state):null,util.isNull(ret)&&(state.needReadable=!0,n=0),state.length-=n,0!==state.length||state.ended||(state.needReadable=!0),nOrig!==n&&state.ended&&0===state.length&&endReadable(this),util.isNull(ret)||this.emit("data",ret),ret},Readable.prototype._read=function(n){this.emit("error",new Error("not implemented"))},Readable.prototype.pipe=function(dest,pipeOpts){function onunpipe(readable){debug("onunpipe"),readable===src&&cleanup()}function onend(){debug("onend"),dest.end()}function cleanup(){debug("cleanup"),dest.removeListener("close",onclose),dest.removeListener("finish",onfinish),dest.removeListener("drain",ondrain),dest.removeListener("error",onerror),dest.removeListener("unpipe",onunpipe),src.removeListener("end",onend),src.removeListener("end",cleanup),src.removeListener("data",ondata),!state.awaitDrain||dest._writableState&&!dest._writableState.needDrain||ondrain()}function ondata(chunk){debug("ondata");var ret=dest.write(chunk);!1===ret&&(debug("false write response, pause",src._readableState.awaitDrain),src._readableState.awaitDrain++,src.pause())}function onerror(er){debug("onerror",er),unpipe(),dest.removeListener("error",onerror),0===EE.listenerCount(dest,"error")&&dest.emit("error",er)}function onclose(){dest.removeListener("finish",onfinish),unpipe()}function onfinish(){debug("onfinish"),dest.removeListener("close",onclose),unpipe()}function unpipe(){debug("unpipe"),src.unpipe(dest)}var src=this,state=this._readableState;switch(state.pipesCount){case 0:state.pipes=dest;break;case 1:state.pipes=[state.pipes,dest];break;default:state.pipes.push(dest)}state.pipesCount+=1,debug("pipe count=%d opts=%j",state.pipesCount,pipeOpts);var doEnd=(!pipeOpts||pipeOpts.end!==!1)&&dest!==process.stdout&&dest!==process.stderr,endFn=doEnd?onend:cleanup;state.endEmitted?process.nextTick(endFn):src.once("end",endFn),dest.on("unpipe",onunpipe);var ondrain=pipeOnDrain(src);return dest.on("drain",ondrain),src.on("data",ondata),dest._events&&dest._events.error?isArray(dest._events.error)?dest._events.error.unshift(onerror):dest._events.error=[onerror,dest._events.error]:dest.on("error",onerror),dest.once("close",onclose),dest.once("finish",onfinish),dest.emit("pipe",src),state.flowing||(debug("pipe resume"),src.resume()),dest},Readable.prototype.unpipe=function(dest){var state=this._readableState;if(0===state.pipesCount)return this;if(1===state.pipesCount)return dest&&dest!==state.pipes?this:(dest||(dest=state.pipes),state.pipes=null,state.pipesCount=0,state.flowing=!1,dest&&dest.emit("unpipe",this),this);if(!dest){var dests=state.pipes,len=state.pipesCount;state.pipes=null,state.pipesCount=0,state.flowing=!1;for(var i=0;len>i;i++)dests[i].emit("unpipe",this);return this}var i=indexOf(state.pipes,dest);return-1===i?this:(state.pipes.splice(i,1),state.pipesCount-=1,1===state.pipesCount&&(state.pipes=state.pipes[0]),dest.emit("unpipe",this),this)},Readable.prototype.on=function(ev,fn){var res=Stream.prototype.on.call(this,ev,fn);if("data"===ev&&!1!==this._readableState.flowing&&this.resume(),"readable"===ev&&this.readable){var state=this._readableState;if(!state.readableListening)if(state.readableListening=!0,state.emittedReadable=!1,state.needReadable=!0,state.reading)state.length&&emitReadable(this,state);else{var self=this;process.nextTick(function(){debug("readable nexttick read 0"),self.read(0)})}}return res},Readable.prototype.addListener=Readable.prototype.on,Readable.prototype.resume=function(){var state=this._readableState;return state.flowing||(debug("resume"),state.flowing=!0,state.reading||(debug("resume read 0"),this.read(0)),resume(this,state)),this},Readable.prototype.pause=function(){return debug("call pause flowing=%j",this._readableState.flowing),!1!==this._readableState.flowing&&(debug("pause"),this._readableState.flowing=!1,this.emit("pause")),this},Readable.prototype.wrap=function(stream){var state=this._readableState,paused=!1,self=this;stream.on("end",function(){if(debug("wrapped end"),state.decoder&&!state.ended){var chunk=state.decoder.end();chunk&&chunk.length&&self.push(chunk)}self.push(null)}),stream.on("data",function(chunk){if(debug("wrapped data"),state.decoder&&(chunk=state.decoder.write(chunk)),chunk&&(state.objectMode||chunk.length)){var ret=self.push(chunk);ret||(paused=!0,stream.pause())}});for(var i in stream)util.isFunction(stream[i])&&util.isUndefined(this[i])&&(this[i]=function(method){return function(){return stream[method].apply(stream,arguments)}}(i));var events=["error","close","destroy","pause","resume"];return forEach(events,function(ev){stream.on(ev,self.emit.bind(self,ev))}),self._read=function(n){debug("wrapped _read",n),paused&&(paused=!1,stream.resume())},self},Readable._fromList=fromList}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(global){var ClientRequest=__webpack_require__(228),extend=__webpack_require__(15),statusCodes=__webpack_require__(135),url=__webpack_require__(87),http=exports;http.request=function(opts,cb){opts="string"==typeof opts?url.parse(opts):extend(opts);var defaultProtocol=-1===global.location.protocol.search(/^https?:$/)?"http:":"",protocol=opts.protocol||defaultProtocol,host=opts.hostname||opts.host,port=opts.port,path=opts.path||"/";host&&-1!==host.indexOf(":")&&(host="["+host+"]"),opts.url=(host?protocol+"//"+host:"")+(port?":"+port:"")+path,opts.method=(opts.method||"GET").toUpperCase(),opts.headers=opts.headers||{};var req=new ClientRequest(opts);return cb&&req.on("response",cb),req},http.get=function(opts,cb){var req=http.request(opts,cb);return req.end(),req},http.Agent=function(){},http.Agent.defaultMaxSockets=4,http.STATUS_CODES=statusCodes,http.METHODS=["CHECKOUT","CONNECT","COPY","DELETE","GET","HEAD","LOCK","M-SEARCH","MERGE","MKACTIVITY","MKCOL","MOVE","NOTIFY","OPTIONS","PATCH","POST","PROPFIND","PROPPATCH","PURGE","PUT","REPORT","SEARCH","SUBSCRIBE","TRACE","UNLOCK","UNSUBSCRIBE"]}).call(exports,function(){return this}())},function(module,exports){(function(global){function checkTypeSupport(type){try{return xhr.responseType=type,xhr.responseType===type}catch(e){}return!1}function isFunction(value){return"function"==typeof value}exports.fetch=isFunction(global.fetch)&&isFunction(global.ReadableByteStream),exports.blobConstructor=!1;try{new Blob([new ArrayBuffer(1)]),exports.blobConstructor=!0}catch(e){}var xhr=new global.XMLHttpRequest;xhr.open("GET",global.location.host?"/":"https://example.com");var haveArrayBuffer="undefined"!=typeof global.ArrayBuffer,haveSlice=haveArrayBuffer&&isFunction(global.ArrayBuffer.prototype.slice);exports.arraybuffer=haveArrayBuffer&&checkTypeSupport("arraybuffer"),exports.msstream=!exports.fetch&&haveSlice&&checkTypeSupport("ms-stream"),exports.mozchunkedarraybuffer=!exports.fetch&&haveArrayBuffer&&checkTypeSupport("moz-chunked-arraybuffer"),exports.overrideMimeType=isFunction(xhr.overrideMimeType),exports.vbArray=isFunction(global.VBArray),xhr=null}).call(exports,function(){return this}())},function(module,exports,__webpack_require__){"use strict";function ctor(options,fn){"function"==typeof options&&(fn=options,options={});var Filter=through2.ctor(options,function(chunk,encoding,callback){return this.options.wantStrings&&(chunk=chunk.toString()),fn.call(this,chunk,this._index++)&&this.push(chunk),callback()});return Filter.prototype._index=0,Filter}function objCtor(options,fn){return"function"==typeof options&&(fn=options,options={}),options=xtend({objectMode:!0,highWaterMark:16},options),ctor(options,fn)}function make(options,fn){return ctor(options,fn)()}function obj(options,fn){return"function"==typeof options&&(fn=options,options={}),options=xtend({objectMode:!0,highWaterMark:16},options),make(options,fn)}module.exports=make,module.exports.ctor=ctor,module.exports.objCtor=objCtor,module.exports.obj=obj;var through2=__webpack_require__(231),xtend=__webpack_require__(15)},function(module,exports,__webpack_require__){(function(process){function Duplex(options){return this instanceof Duplex?(Readable.call(this,options),Writable.call(this,options),options&&options.readable===!1&&(this.readable=!1),options&&options.writable===!1&&(this.writable=!1),this.allowHalfOpen=!0,options&&options.allowHalfOpen===!1&&(this.allowHalfOpen=!1),void this.once("end",onend)):new Duplex(options)}function onend(){this.allowHalfOpen||this._writableState.ended||process.nextTick(this.end.bind(this))}function forEach(xs,f){for(var i=0,l=xs.length;l>i;i++)f(xs[i],i)}module.exports=Duplex;var objectKeys=Object.keys||function(obj){var keys=[];for(var key in obj)keys.push(key);return keys},util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Readable=__webpack_require__(232),Writable=__webpack_require__(234);util.inherits(Duplex,Readable),forEach(objectKeys(Writable.prototype),function(method){Duplex.prototype[method]||(Duplex.prototype[method]=Writable.prototype[method])})}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){function Url(){this.protocol=null,this.slashes=null,this.auth=null,this.host=null,this.port=null,this.hostname=null,this.hash=null,this.search=null,this.query=null,this.pathname=null,this.path=null,this.href=null}function urlParse(url,parseQueryString,slashesDenoteHost){if(url&&isObject(url)&&url instanceof Url)return url;var u=new Url;return u.parse(url,parseQueryString,slashesDenoteHost),u}function urlFormat(obj){return isString(obj)&&(obj=urlParse(obj)),obj instanceof Url?obj.format():Url.prototype.format.call(obj)}function urlResolve(source,relative){return urlParse(source,!1,!0).resolve(relative)}function urlResolveObject(source,relative){return source?urlParse(source,!1,!0).resolveObject(relative):relative}function isString(arg){return"string"==typeof arg}function isObject(arg){return"object"==typeof arg&&null!==arg}function isNull(arg){return null===arg}function isNullOrUndefined(arg){return null==arg}var punycode=__webpack_require__(238);exports.parse=urlParse,exports.resolve=urlResolve,exports.resolveObject=urlResolveObject,exports.format=urlFormat,exports.Url=Url;var protocolPattern=/^([a-z0-9.+-]+:)/i,portPattern=/:[0-9]*$/,delims=["<",">",'"',"`"," ","\r","\n","  "],unwise=["{","}","|","\\","^","`"].concat(delims),autoEscape=["'"].concat(unwise),nonHostChars=["%","/","?",";","#"].concat(autoEscape),hostEndingChars=["/","?","#"],hostnameMaxLen=255,hostnamePartPattern=/^[a-z0-9A-Z_-]{0,63}$/,hostnamePartStart=/^([a-z0-9A-Z_-]{0,63})(.*)$/,unsafeProtocol={javascript:!0,"javascript:":!0},hostlessProtocol={javascript:!0,"javascript:":!0},slashedProtocol={http:!0,https:!0,ftp:!0,gopher:!0,file:!0,"http:":!0,"https:":!0,"ftp:":!0,"gopher:":!0,"file:":!0},querystring=__webpack_require__(212);Url.prototype.parse=function(url,parseQueryString,slashesDenoteHost){if(!isString(url))throw new TypeError("Parameter 'url' must be a string, not "+typeof url);var rest=url;rest=rest.trim();var proto=protocolPattern.exec(rest);if(proto){proto=proto[0];var lowerProto=proto.toLowerCase();this.protocol=lowerProto,rest=rest.substr(proto.length)}if(slashesDenoteHost||proto||rest.match(/^\/\/[^@\/]+@[^@\/]+/)){var slashes="//"===rest.substr(0,2);!slashes||proto&&hostlessProtocol[proto]||(rest=rest.substr(2),this.slashes=!0)}if(!hostlessProtocol[proto]&&(slashes||proto&&!slashedProtocol[proto])){for(var hostEnd=-1,i=0;i<hostEndingChars.length;i++){var hec=rest.indexOf(hostEndingChars[i]);-1!==hec&&(-1===hostEnd||hostEnd>hec)&&(hostEnd=hec)}var auth,atSign;atSign=-1===hostEnd?rest.lastIndexOf("@"):rest.lastIndexOf("@",hostEnd),-1!==atSign&&(auth=rest.slice(0,atSign),rest=rest.slice(atSign+1),this.auth=decodeURIComponent(auth)),hostEnd=-1;for(var i=0;i<nonHostChars.length;i++){var hec=rest.indexOf(nonHostChars[i]);-1!==hec&&(-1===hostEnd||hostEnd>hec)&&(hostEnd=hec)}-1===hostEnd&&(hostEnd=rest.length),this.host=rest.slice(0,hostEnd),rest=rest.slice(hostEnd),this.parseHost(),this.hostname=this.hostname||"";var ipv6Hostname="["===this.hostname[0]&&"]"===this.hostname[this.hostname.length-1];if(!ipv6Hostname)for(var hostparts=this.hostname.split(/\./),i=0,l=hostparts.length;l>i;i++){var part=hostparts[i];if(part&&!part.match(hostnamePartPattern)){for(var newpart="",j=0,k=part.length;k>j;j++)newpart+=part.charCodeAt(j)>127?"x":part[j];if(!newpart.match(hostnamePartPattern)){var validParts=hostparts.slice(0,i),notHost=hostparts.slice(i+1),bit=part.match(hostnamePartStart);bit&&(validParts.push(bit[1]),notHost.unshift(bit[2])),notHost.length&&(rest="/"+notHost.join(".")+rest),this.hostname=validParts.join(".");break}}}if(this.hostname.length>hostnameMaxLen?this.hostname="":this.hostname=this.hostname.toLowerCase(),!ipv6Hostname){for(var domainArray=this.hostname.split("."),newOut=[],i=0;i<domainArray.length;++i){var s=domainArray[i];newOut.push(s.match(/[^A-Za-z0-9_-]/)?"xn--"+punycode.encode(s):s)}this.hostname=newOut.join(".")}var p=this.port?":"+this.port:"",h=this.hostname||"";this.host=h+p,this.href+=this.host,ipv6Hostname&&(this.hostname=this.hostname.substr(1,this.hostname.length-2),"/"!==rest[0]&&(rest="/"+rest))}if(!unsafeProtocol[lowerProto])for(var i=0,l=autoEscape.length;l>i;i++){var ae=autoEscape[i],esc=encodeURIComponent(ae);esc===ae&&(esc=escape(ae)),rest=rest.split(ae).join(esc)}var hash=rest.indexOf("#");-1!==hash&&(this.hash=rest.substr(hash),rest=rest.slice(0,hash));var qm=rest.indexOf("?");if(-1!==qm?(this.search=rest.substr(qm),this.query=rest.substr(qm+1),parseQueryString&&(this.query=querystring.parse(this.query)),rest=rest.slice(0,qm)):parseQueryString&&(this.search="",this.query={}),rest&&(this.pathname=rest),slashedProtocol[lowerProto]&&this.hostname&&!this.pathname&&(this.pathname="/"),this.pathname||this.search){var p=this.pathname||"",s=this.search||"";this.path=p+s}return this.href=this.format(),this},Url.prototype.format=function(){var auth=this.auth||"";auth&&(auth=encodeURIComponent(auth),auth=auth.replace(/%3A/i,":"),auth+="@");var protocol=this.protocol||"",pathname=this.pathname||"",hash=this.hash||"",host=!1,query="";this.host?host=auth+this.host:this.hostname&&(host=auth+(-1===this.hostname.indexOf(":")?this.hostname:"["+this.hostname+"]"),this.port&&(host+=":"+this.port)),this.query&&isObject(this.query)&&Object.keys(this.query).length&&(query=querystring.stringify(this.query));var search=this.search||query&&"?"+query||"";return protocol&&":"!==protocol.substr(-1)&&(protocol+=":"),this.slashes||(!protocol||slashedProtocol[protocol])&&host!==!1?(host="//"+(host||""),pathname&&"/"!==pathname.charAt(0)&&(pathname="/"+pathname)):host||(host=""),hash&&"#"!==hash.charAt(0)&&(hash="#"+hash),search&&"?"!==search.charAt(0)&&(search="?"+search),pathname=pathname.replace(/[?#]/g,function(match){return encodeURIComponent(match)}),search=search.replace("#","%23"),protocol+host+pathname+search+hash},Url.prototype.resolve=function(relative){return this.resolveObject(urlParse(relative,!1,!0)).format()},Url.prototype.resolveObject=function(relative){if(isString(relative)){var rel=new Url;rel.parse(relative,!1,!0),relative=rel}var result=new Url;if(Object.keys(this).forEach(function(k){result[k]=this[k]},this),result.hash=relative.hash,""===relative.href)return result.href=result.format(),result;if(relative.slashes&&!relative.protocol)return Object.keys(relative).forEach(function(k){"protocol"!==k&&(result[k]=relative[k])}),slashedProtocol[result.protocol]&&result.hostname&&!result.pathname&&(result.path=result.pathname="/"),result.href=result.format(),result;if(relative.protocol&&relative.protocol!==result.protocol){if(!slashedProtocol[relative.protocol])return Object.keys(relative).forEach(function(k){result[k]=relative[k]}),result.href=result.format(),result;if(result.protocol=relative.protocol,relative.host||hostlessProtocol[relative.protocol])result.pathname=relative.pathname;else{for(var relPath=(relative.pathname||"").split("/");relPath.length&&!(relative.host=relPath.shift()););relative.host||(relative.host=""),relative.hostname||(relative.hostname=""),""!==relPath[0]&&relPath.unshift(""),relPath.length<2&&relPath.unshift(""),result.pathname=relPath.join("/")}if(result.search=relative.search,result.query=relative.query,result.host=relative.host||"",result.auth=relative.auth,result.hostname=relative.hostname||relative.host,result.port=relative.port,result.pathname||result.search){var p=result.pathname||"",s=result.search||"";result.path=p+s}return result.slashes=result.slashes||relative.slashes,result.href=result.format(),result}var isSourceAbs=result.pathname&&"/"===result.pathname.charAt(0),isRelAbs=relative.host||relative.pathname&&"/"===relative.pathname.charAt(0),mustEndAbs=isRelAbs||isSourceAbs||result.host&&relative.pathname,removeAllDots=mustEndAbs,srcPath=result.pathname&&result.pathname.split("/")||[],relPath=relative.pathname&&relative.pathname.split("/")||[],psychotic=result.protocol&&!slashedProtocol[result.protocol];if(psychotic&&(result.hostname="",result.port=null,result.host&&(""===srcPath[0]?srcPath[0]=result.host:srcPath.unshift(result.host)),result.host="",relative.protocol&&(relative.hostname=null,relative.port=null,relative.host&&(""===relPath[0]?relPath[0]=relative.host:relPath.unshift(relative.host)),relative.host=null),mustEndAbs=mustEndAbs&&(""===relPath[0]||""===srcPath[0])),isRelAbs)result.host=relative.host||""===relative.host?relative.host:result.host,result.hostname=relative.hostname||""===relative.hostname?relative.hostname:result.hostname,result.search=relative.search,result.query=relative.query,srcPath=relPath;else if(relPath.length)srcPath||(srcPath=[]),srcPath.pop(),srcPath=srcPath.concat(relPath),result.search=relative.search,result.query=relative.query;else if(!isNullOrUndefined(relative.search)){if(psychotic){result.hostname=result.host=srcPath.shift();var authInHost=result.host&&result.host.indexOf("@")>0?result.host.split("@"):!1;authInHost&&(result.auth=authInHost.shift(),result.host=result.hostname=authInHost.shift())}return result.search=relative.search,result.query=relative.query,isNull(result.pathname)&&isNull(result.search)||(result.path=(result.pathname?result.pathname:"")+(result.search?result.search:"")),
result.href=result.format(),result}if(!srcPath.length)return result.pathname=null,result.search?result.path="/"+result.search:result.path=null,result.href=result.format(),result;for(var last=srcPath.slice(-1)[0],hasTrailingSlash=(result.host||relative.host)&&("."===last||".."===last)||""===last,up=0,i=srcPath.length;i>=0;i--)last=srcPath[i],"."==last?srcPath.splice(i,1):".."===last?(srcPath.splice(i,1),up++):up&&(srcPath.splice(i,1),up--);if(!mustEndAbs&&!removeAllDots)for(;up--;up)srcPath.unshift("..");!mustEndAbs||""===srcPath[0]||srcPath[0]&&"/"===srcPath[0].charAt(0)||srcPath.unshift(""),hasTrailingSlash&&"/"!==srcPath.join("/").substr(-1)&&srcPath.push("");var isAbsolute=""===srcPath[0]||srcPath[0]&&"/"===srcPath[0].charAt(0);if(psychotic){result.hostname=result.host=isAbsolute?"":srcPath.length?srcPath.shift():"";var authInHost=result.host&&result.host.indexOf("@")>0?result.host.split("@"):!1;authInHost&&(result.auth=authInHost.shift(),result.host=result.hostname=authInHost.shift())}return mustEndAbs=mustEndAbs||result.host&&srcPath.length,mustEndAbs&&!isAbsolute&&srcPath.unshift(""),srcPath.length?result.pathname=srcPath.join("/"):(result.pathname=null,result.path=null),isNull(result.pathname)&&isNull(result.search)||(result.path=(result.pathname?result.pathname:"")+(result.search?result.search:"")),result.auth=relative.auth||result.auth,result.slashes=result.slashes||relative.slashes,result.href=result.format(),result},Url.prototype.parseHost=function(){var host=this.host,port=portPattern.exec(host);port&&(port=port[0],":"!==port&&(this.port=port.substr(1)),host=host.substr(0,host.length-port.length)),host&&(this.hostname=host)}},function(module,exports,__webpack_require__){(function(process){"use strict";function booleanOrFunc(v,file){return"boolean"!=typeof v&&"function"!=typeof v?null:"boolean"==typeof v?v:v(file)}function stringOrFunc(v,file){return"string"!=typeof v&&"function"!=typeof v?null:"string"==typeof v?v:v(file)}function prepareWrite(outFolder,file,opt,cb){var options=assign({cwd:process.cwd(),mode:file.stat?file.stat.mode:null,dirMode:null,overwrite:!0},opt),overwrite=booleanOrFunc(options.overwrite,file);options.flag=overwrite?"w":"wx";var cwd=path.resolve(options.cwd),outFolderPath=stringOrFunc(outFolder,file);if(!outFolderPath)throw new Error("Invalid output folder");var basePath=options.base?stringOrFunc(options.base,file):path.resolve(cwd,outFolderPath);if(!basePath)throw new Error("Invalid base option");var writePath=path.resolve(basePath,file.relative),writeFolder=path.dirname(writePath);file.stat=file.stat||new fs.Stats,file.stat.mode=options.mode,file.flag=options.flag,file.cwd=cwd,file.base=basePath,file.path=writePath,mkdirp(writeFolder,options.dirMode,function(err){return err?cb(err):void cb(null,writePath)})}var assign=__webpack_require__(75),path=__webpack_require__(6),mkdirp=__webpack_require__(72),fs=__webpack_require__(process.browser?5:11);module.exports=prepareWrite}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function streamFile(file,opt,cb){file.contents=fs.createReadStream(file.path),opt.stripBOM&&(file.contents=file.contents.pipe(stripBom())),cb(null,file)}var fs=__webpack_require__(process.browser?5:11),stripBom=__webpack_require__(230);module.exports=streamFile}).call(exports,__webpack_require__(1))},function(module,exports){function randomString(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}function cleanPath(path,base){return path?base?("/"!=base[base.length-1]&&(base+="/"),path=path.replace(base,""),path=path.replace(/[\/]+/g,"/")):path:""}var x=module.exports={};x.randomString=randomString,x.cleanPath=cleanPath},function(module,exports,__webpack_require__){var Stream=__webpack_require__(3).Stream;module.exports=function(o){return!!o&&o instanceof Stream}},function(module,exports){function wrappy(fn,cb){function wrapper(){for(var args=new Array(arguments.length),i=0;i<args.length;i++)args[i]=arguments[i];var ret=fn.apply(this,args),cb=args[args.length-1];return"function"==typeof ret&&ret!==cb&&Object.keys(cb).forEach(function(k){ret[k]=cb[k]}),ret}if(fn&&cb)return wrappy(fn)(cb);if("function"!=typeof fn)throw new TypeError("need wrapper function");return Object.keys(fn).forEach(function(k){wrapper[k]=fn[k]}),wrapper}module.exports=wrappy},function(module,exports,__webpack_require__){(function(Buffer){"use strict";var internals={};exports.escapeJavaScript=function(input){if(!input)return"";for(var escaped="",i=0;i<input.length;++i){var charCode=input.charCodeAt(i);escaped+=internals.isSafe(charCode)?input[i]:internals.escapeJavaScriptChar(charCode)}return escaped},exports.escapeHtml=function(input){if(!input)return"";for(var escaped="",i=0;i<input.length;++i){var charCode=input.charCodeAt(i);escaped+=internals.isSafe(charCode)?input[i]:internals.escapeHtmlChar(charCode)}return escaped},internals.escapeJavaScriptChar=function(charCode){if(charCode>=256)return"\\u"+internals.padLeft(""+charCode,4);var hexValue=new Buffer(String.fromCharCode(charCode),"ascii").toString("hex");return"\\x"+internals.padLeft(hexValue,2)},internals.escapeHtmlChar=function(charCode){var namedEscape=internals.namedHtml[charCode];if("undefined"!=typeof namedEscape)return namedEscape;if(charCode>=256)return"&#"+charCode+";";var hexValue=new Buffer(String.fromCharCode(charCode),"ascii").toString("hex");return"&#x"+internals.padLeft(hexValue,2)+";"},internals.padLeft=function(str,len){for(;str.length<len;)str="0"+str;return str},internals.isSafe=function(charCode){return"undefined"!=typeof internals.safeCharCodes[charCode]},internals.namedHtml={38:"&amp;",60:"&lt;",62:"&gt;",34:"&quot;",160:"&nbsp;",162:"&cent;",163:"&pound;",164:"&curren;",169:"&copy;",174:"&reg;"},internals.safeCharCodes=function(){for(var safe={},i=32;123>i;++i)(i>=97||i>=65&&90>=i||i>=48&&57>=i||32===i||46===i||44===i||45===i||58===i||95===i)&&(safe[i]=null);return safe}()}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){"use strict";var Stringify=__webpack_require__(96),Parse=__webpack_require__(95);exports.stringify=Stringify,exports.parse=Parse},function(module,exports,__webpack_require__){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}var _keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),_create=__webpack_require__(31),_create2=_interopRequireDefault(_create),Utils=__webpack_require__(48),internals={delimiter:"&",depth:5,arrayLimit:20,parameterLimit:1e3,strictNullHandling:!1,plainObjects:!1,allowPrototypes:!1,allowDots:!1};internals.parseValues=function(str,options){for(var obj={},parts=str.split(options.delimiter,options.parameterLimit===1/0?void 0:options.parameterLimit),i=0;i<parts.length;++i){var part=parts[i],pos=-1===part.indexOf("]=")?part.indexOf("="):part.indexOf("]=")+1;if(-1===pos)obj[Utils.decode(part)]="",options.strictNullHandling&&(obj[Utils.decode(part)]=null);else{var key=Utils.decode(part.slice(0,pos)),val=Utils.decode(part.slice(pos+1));Object.prototype.hasOwnProperty.call(obj,key)?obj[key]=[].concat(obj[key]).concat(val):obj[key]=val}}return obj},internals.parseObject=function(chain,val,options){if(!chain.length)return val;var root=chain.shift(),obj=void 0;if("[]"===root)obj=[],obj=obj.concat(internals.parseObject(chain,val,options));else{obj=options.plainObjects?(0,_create2["default"])(null):{};var cleanRoot="["===root[0]&&"]"===root[root.length-1]?root.slice(1,root.length-1):root,index=parseInt(cleanRoot,10),indexString=""+index;!isNaN(index)&&root!==cleanRoot&&indexString===cleanRoot&&index>=0&&options.parseArrays&&index<=options.arrayLimit?(obj=[],obj[index]=internals.parseObject(chain,val,options)):obj[cleanRoot]=internals.parseObject(chain,val,options)}return obj},internals.parseKeys=function(key,val,options){if(key){options.allowDots&&(key=key.replace(/\.([^\.\[]+)/g,"[$1]"));var parent=/^([^\[\]]*)/,child=/(\[[^\[\]]*\])/g,segment=parent.exec(key),keys=[];if(segment[1]){if(!options.plainObjects&&Object.prototype.hasOwnProperty(segment[1])&&!options.allowPrototypes)return;keys.push(segment[1])}for(var i=0;null!==(segment=child.exec(key))&&i<options.depth;)++i,(options.plainObjects||!Object.prototype.hasOwnProperty(segment[1].replace(/\[|\]/g,""))||options.allowPrototypes)&&keys.push(segment[1]);return segment&&keys.push("["+key.slice(segment.index)+"]"),internals.parseObject(keys,val,options)}},module.exports=function(str,options){if(options=options||{},options.delimiter="string"==typeof options.delimiter||Utils.isRegExp(options.delimiter)?options.delimiter:internals.delimiter,options.depth="number"==typeof options.depth?options.depth:internals.depth,options.arrayLimit="number"==typeof options.arrayLimit?options.arrayLimit:internals.arrayLimit,options.parseArrays=options.parseArrays!==!1,options.allowDots="boolean"==typeof options.allowDots?options.allowDots:internals.allowDots,options.plainObjects="boolean"==typeof options.plainObjects?options.plainObjects:internals.plainObjects,options.allowPrototypes="boolean"==typeof options.allowPrototypes?options.allowPrototypes:internals.allowPrototypes,options.parameterLimit="number"==typeof options.parameterLimit?options.parameterLimit:internals.parameterLimit,options.strictNullHandling="boolean"==typeof options.strictNullHandling?options.strictNullHandling:internals.strictNullHandling,""===str||null===str||"undefined"==typeof str)return options.plainObjects?(0,_create2["default"])(null):{};for(var tempObj="string"==typeof str?internals.parseValues(str,options):str,obj=options.plainObjects?(0,_create2["default"])(null):{},keys=(0,_keys2["default"])(tempObj),i=0;i<keys.length;++i){var key=keys[i],newObj=internals.parseKeys(key,tempObj[key],options);obj=Utils.merge(obj,newObj,options)}return Utils.compact(obj)}},function(module,exports,__webpack_require__){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}var _typeof2=__webpack_require__(22),_typeof3=_interopRequireDefault(_typeof2),_keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),Utils=__webpack_require__(48),internals={delimiter:"&",arrayPrefixGenerators:{brackets:function(prefix,key){return prefix+"[]"},indices:function(prefix,key){return prefix+"["+key+"]"},repeat:function(prefix,key){return prefix}},strictNullHandling:!1,skipNulls:!1,encode:!0};internals.stringify=function(obj,prefix,generateArrayPrefix,strictNullHandling,skipNulls,encode,filter,sort){if("function"==typeof filter)obj=filter(prefix,obj);else if(Utils.isBuffer(obj))obj=obj.toString();else if(obj instanceof Date)obj=obj.toISOString();else if(null===obj){if(strictNullHandling)return encode?Utils.encode(prefix):prefix;obj=""}if("string"==typeof obj||"number"==typeof obj||"boolean"==typeof obj)return encode?[Utils.encode(prefix)+"="+Utils.encode(obj)]:[prefix+"="+obj];var values=[];if("undefined"==typeof obj)return values;var objKeys=void 0;if(Array.isArray(filter))objKeys=filter;else{var keys=(0,_keys2["default"])(obj);objKeys=sort?keys.sort(sort):keys}for(var i=0;i<objKeys.length;++i){var key=objKeys[i];skipNulls&&null===obj[key]||(values=Array.isArray(obj)?values.concat(internals.stringify(obj[key],generateArrayPrefix(prefix,key),generateArrayPrefix,strictNullHandling,skipNulls,encode,filter)):values.concat(internals.stringify(obj[key],prefix+"["+key+"]",generateArrayPrefix,strictNullHandling,skipNulls,encode,filter)))}return values},module.exports=function(obj,options){options=options||{};var delimiter="undefined"==typeof options.delimiter?internals.delimiter:options.delimiter,strictNullHandling="boolean"==typeof options.strictNullHandling?options.strictNullHandling:internals.strictNullHandling,skipNulls="boolean"==typeof options.skipNulls?options.skipNulls:internals.skipNulls,encode="boolean"==typeof options.encode?options.encode:internals.encode,sort="function"==typeof options.sort?options.sort:null,objKeys=void 0,filter=void 0;"function"==typeof options.filter?(filter=options.filter,obj=filter("",obj)):Array.isArray(options.filter)&&(objKeys=filter=options.filter);var keys=[];if("object"!==("undefined"==typeof obj?"undefined":(0,_typeof3["default"])(obj))||null===obj)return"";var arrayFormat=void 0;arrayFormat=options.arrayFormat in internals.arrayPrefixGenerators?options.arrayFormat:"indices"in options?options.indices?"indices":"repeat":"indices";var generateArrayPrefix=internals.arrayPrefixGenerators[arrayFormat];objKeys||(objKeys=(0,_keys2["default"])(obj)),sort&&objKeys.sort(sort);for(var i=0;i<objKeys.length;++i){var key=objKeys[i];skipNulls&&null===obj[key]||(keys=keys.concat(internals.stringify(obj[key],key,generateArrayPrefix,strictNullHandling,skipNulls,encode,filter,sort)))}return keys.join(delimiter)}},function(module,exports,__webpack_require__){(function(Buffer){"use strict";var Boom=__webpack_require__(47),Hoek=__webpack_require__(19),Stream=__webpack_require__(3),internals={};module.exports=internals.Recorder=function(options){Stream.Writable.call(this),this.settings=options,this.buffers=[],this.length=0},Hoek.inherits(internals.Recorder,Stream.Writable),internals.Recorder.prototype._write=function(chunk,encoding,next){return this.settings.maxBytes&&this.length+chunk.length>this.settings.maxBytes?this.emit("error",Boom.badRequest("Payload content length greater than maximum allowed: "+this.settings.maxBytes)):(this.length=this.length+chunk.length,this.buffers.push(chunk),void next())},internals.Recorder.prototype.collect=function(){var buffer=0===this.buffers.length?new Buffer(0):1===this.buffers.length?this.buffers[0]:Buffer.concat(this.buffers,this.length);return buffer}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){"use strict";var Hoek=__webpack_require__(19),Stream=__webpack_require__(3),Payload=__webpack_require__(50),internals={};module.exports=internals.Tap=function(){Stream.Transform.call(this),this.buffers=[]},Hoek.inherits(internals.Tap,Stream.Transform),internals.Tap.prototype._transform=function(chunk,encoding,next){this.buffers.push(chunk),next(null,chunk)},internals.Tap.prototype.collect=function(){return new Payload(this.buffers)}},function(module,exports,__webpack_require__){"use strict";var Wreck=__webpack_require__(49);module.exports=function(send){return function(files,opts,cb){return"function"==typeof opts&&void 0===cb&&(cb=opts,opts={}),"string"==typeof files&&files.startsWith("http")?Wreck.request("GET",files,null,function(err,res){return err?cb(err):void send("add",null,opts,res,cb)}):send("add",null,opts,files,cb)}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return{get:argCommand(send,"block/get"),stat:argCommand(send,"block/stat"),put:function(file,cb){return Array.isArray(file)?cb(null,new Error("block.put() only accepts 1 file")):send("block/put",null,null,file,cb)}}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return argCommand(send,"cat")}},function(module,exports,__webpack_require__){"use strict";var command=__webpack_require__(9).command;module.exports=function(send){return command(send,"commands")}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return{get:argCommand(send,"config"),set:function(key,value,opts,cb){return"function"==typeof opts&&(cb=opts,opts={}),send("config",[key,value],opts,null,cb)},show:function(cb){return send("config/show",null,null,null,!0,cb)},replace:function(file,cb){return send("config/replace",null,null,file,cb)}}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return{findprovs:argCommand(send,"dht/findprovs"),get:function(key,opts,cb){return"function"!=typeof opts||cb||(cb=opts,opts=null),send("dht/get",key,opts,null,function(err,res){if(err)return cb(err);if(!res)return cb(new Error("empty response"));if(0===res.length)return cb(new Error("no value returned for key"));if(Array.isArray(res)&&(res=res[0]),5===res.Type)cb(null,res.Extra);else{var error=new Error("key was not found (type 6)");cb(error)}})},put:function(key,value,opts,cb){return"function"!=typeof opts||cb||(cb=opts,opts=null),send("dht/put",[key,value],opts,null,cb)}}}},function(module,exports,__webpack_require__){"use strict";var command=__webpack_require__(9).command;module.exports=function(send){return{net:command(send,"diag/net"),sys:command(send,"diag/sys")}}},function(module,exports){"use strict";module.exports=function(send){return function id(id,cb){return"function"==typeof id&&(cb=id,id=null),send("id",id,null,null,cb)}}},function(module,exports,__webpack_require__){"use strict";var ndjson=__webpack_require__(74);module.exports=function(send){return{tail:function(cb){return send("log/tail",null,{},null,!1,function(err,res){return err?cb(err):void cb(null,res.pipe(ndjson.parse()))})}}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return argCommand(send,"ls")}},function(module,exports){"use strict";module.exports=function(send){return function(ipfs,ipns,cb){"function"==typeof ipfs?(cb=ipfs,ipfs=null):"function"==typeof ipns&&(cb=ipns,ipns=null);var opts={};return ipfs&&(opts.f=ipfs),ipns&&(opts.n=ipns),send("mount",null,opts,null,cb)}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return{publish:argCommand(send,"name/publish"),resolve:argCommand(send,"name/resolve")}}},function(module,exports,__webpack_require__){"use strict";var argCommand=__webpack_require__(9).argCommand;module.exports=function(send){return{get:argCommand(send,"object/get"),put:function(file,encoding,cb){return"function"==typeof encoding?cb(null,new Error("Must specify an object encoding ('json' or 'protobuf')")):send("object/put",encoding,null,file,cb)},data:argCommand(send,"object/data"),links:argCommand(send,"object/links"),stat:argCommand(send,"object/stat"),"new":argCommand(send,"object/new"),patch:function(file,opts,cb){return send("object/patch",[file].concat(opts),null,null,cb)}}}},function(module,exports){"use strict";module.exports=function(send){return{add:function(hash,opts,cb){return"function"==typeof opts&&(cb=opts,opts=null),send("pin/add",hash,opts,null,cb)},remove:function(hash,opts,cb){return"function"==typeof opts&&(cb=opts,opts=null),send("pin/rm",hash,opts,null,cb)},list:function(type,cb){"function"==typeof type&&(cb=type,type=null);var opts=null;return type&&(opts={type:type}),send("pin/ls",null,opts,null,cb)}}}},function(module,exports){"use strict";module.exports=function(send){return function(id,cb){return send("ping",id,{n:1},null,function(err,res){return err?cb(err,null):void cb(null,res[1])})}}},function(module,exports,__webpack_require__){"use strict";var cmds=__webpack_require__(9);module.exports=function(send){var refs=cmds.argCommand(send,"refs");return refs.local=cmds.command(send,"refs/local"),refs}},function(module,exports,__webpack_require__){"use strict";var cmds=__webpack_require__(9);module.exports=function(send){return{peers:cmds.command(send,"swarm/peers"),connect:cmds.argCommand(send,"swarm/connect")}}},function(module,exports,__webpack_require__){"use strict";var command=__webpack_require__(9).command;module.exports=function(send){return{apply:command(send,"update"),check:command(send,"update/check"),log:command(send,"update/log")}}},function(module,exports,__webpack_require__){"use strict";var command=__webpack_require__(9).command;module.exports=function(send){return command(send,"version")}},function(module,exports,__webpack_require__){"use strict";var pkg=__webpack_require__(194);exports=module.exports=function(){return{"api-path":"/api/v0/","user-agent":"/node-"+pkg.name+"/"+pkg.version+"/",host:"localhost",port:"5001",protocol:"http"}}},function(module,exports,__webpack_require__){(function(Buffer){"use strict";function getFilesStream(files,opts){if(!files)return null;var adder=new Merge,single=new stream.PassThrough({objectMode:!0});adder.add(single);for(var i=0;i<files.length;i++){var file=files[i];if("string"==typeof file){var srcOpts={buffer:!1,stripBOM:!1,followSymlinks:null!=opts.followSymlinks?opts.followSymlinks:!0};adder.add(vinylfs.src(file,srcOpts)),opts.recursive&&adder.add(vinylfs.src(file+"/**/*",srcOpts))}else single.push(vinylFile(file))}return single.end(),adder.pipe(vmps())}function vinylFile(file){if(file instanceof File)return file;var f={cwd:"/",base:"/",path:""};return file.contents&&file.path?(f.path=file.path,f.cwd=file.cwd||f.cwd,f.base=file.base||f.base,f.contents=file.contents):f.contents=file,f.contents=vinylContentsSafe(f.contents),new File(f)}function vinylContentsSafe(c){if(Buffer.isBuffer(c))return c;if("string"==typeof c)return c;if(c instanceof stream.Stream)return c;if("function"==typeof c.pipe){var s=new stream.PassThrough;return c.pipe(s)}throw new Error("vinyl will not accept: "+c)}var File=__webpack_require__(46),vinylfs=__webpack_require__(241),vmps=__webpack_require__(257),stream=__webpack_require__(3),Merge=__webpack_require__(71);exports=module.exports=getFilesStream}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(global){"use strict";function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{"default":obj}}function requireCommands(){return isNode?__webpack_require__(5)("./api"):{add:__webpack_require__(99),block:__webpack_require__(100),cat:__webpack_require__(101),commands:__webpack_require__(102),config:__webpack_require__(103),dht:__webpack_require__(104),diag:__webpack_require__(105),id:__webpack_require__(106),log:__webpack_require__(107),ls:__webpack_require__(108),mount:__webpack_require__(109),name:__webpack_require__(110),object:__webpack_require__(111),pin:__webpack_require__(112),ping:__webpack_require__(113),refs:__webpack_require__(114),swarm:__webpack_require__(115),update:__webpack_require__(116),version:__webpack_require__(117)}}function loadCommands(send){var files=requireCommands(),cmds={};return(0,_keys2["default"])(files).forEach(function(file){cmds[file]=files[file](send)}),cmds}var _keys=__webpack_require__(16),_keys2=_interopRequireDefault(_keys),isNode=!global.window;module.exports=loadCommands}).call(exports,function(){return this}())},function(module,exports,__webpack_require__){(function(global){"use strict";function parseChunkedJson(res,cb){var parsed=[];res.pipe(ndjson.parse()).on("data",parsed.push.bind(parsed)).on("end",function(){return cb(null,parsed)})}function onRes(buffer,cb){return function(err,res){if(err)return cb(err);var stream=!!res.headers["x-stream-output"],chunkedObjects=!!res.headers["x-chunked-output"],isJson="application/json"===res.headers["content-type"];return(res.statusCode>=400||!res.statusCode)&&!function(){var error=new Error("Server responded with "+res.statusCode);Wreck.read(res,{json:!0},function(err,payload){return err?cb(err):(payload&&(error.code=payload.Code,error.message=payload.Message),void cb(error))})}(),stream&&!buffer?cb(null,res):chunkedObjects?isJson?parseChunkedJson(res,cb):Wreck.read(res,null,cb):void Wreck.read(res,{json:isJson},cb)}}function requestAPI(config,path,args,qs,files,buffer,cb){if(qs=qs||{},Array.isArray(path)&&(path=path.join("/")),args&&!Array.isArray(args)&&(args=[args]),args&&(qs.arg=args),files&&!Array.isArray(files)&&(files=[files]),"function"==typeof buffer&&(cb=buffer,buffer=!1),qs.r&&(qs.recursive=qs.r,delete qs.r),!isNode&&qs.recursive&&"add"===path)return cb(new Error("Recursive uploads are not supported in the browser"));qs["stream-channels"]=!0;var stream=void 0;files&&(stream=getFilesStream(files,qs)),delete qs.followSymlinks;var port=config.port?":"+config.port:"",opts={method:files?"POST":"GET",uri:config.protocol+"://"+config.host+port+config["api-path"]+path+"?"+Qs.stringify(qs,{arrayFormat:"repeat"}),headers:{}};if(isNode&&(opts.headers["User-Agent"]=config["user-agent"]),files){if(!stream.boundary)return cb(new Error("No boundary in multipart stream"));opts.headers["Content-Type"]="multipart/form-data; boundary="+stream.boundary,opts.downstreamRes=stream,opts.payload=stream}return Wreck.request(opts.method,opts.uri,opts,onRes(buffer,cb))}var Wreck=__webpack_require__(49),Qs=__webpack_require__(94),ndjson=__webpack_require__(74),getFilesStream=__webpack_require__(119),isNode=!global.window;exports=module.exports=function(config){return requestAPI.bind(null,config)}}).call(exports,function(){return this}())},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(140),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(141),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(143),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(144),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(145),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(146),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(148),__esModule:!0}},function(module,exports,__webpack_require__){module.exports={"default":__webpack_require__(149),__esModule:!0}},function(module,exports){function balanced(a,b,str){var r=range(a,b,str);return r&&{start:r[0],end:r[1],pre:str.slice(0,r[0]),body:str.slice(r[0]+a.length,r[1]),post:str.slice(r[1]+b.length)}}function range(a,b,str){var begs,beg,left,right,result,ai=str.indexOf(a),bi=str.indexOf(b,ai+1),i=ai;if(ai>=0&&bi>0){for(begs=[],left=str.length;i<str.length&&i>=0&&!result;)i==ai?(begs.push(i),ai=str.indexOf(a,i+1)):1==begs.length?result=[begs.pop(),bi]:(beg=begs.pop(),left>beg&&(left=beg,right=bi),bi=str.indexOf(b,i+1)),i=bi>ai&&ai>=0?ai:bi;begs.length&&(result=[left,right])}return result}module.exports=balanced,balanced.range=range},function(module,exports,__webpack_require__){var lookup="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";!function(exports){"use strict";function decode(elt){var code=elt.charCodeAt(0);return code===PLUS||code===PLUS_URL_SAFE?62:code===SLASH||code===SLASH_URL_SAFE?63:NUMBER>code?-1:NUMBER+10>code?code-NUMBER+26+26:UPPER+26>code?code-UPPER:LOWER+26>code?code-LOWER+26:void 0}function b64ToByteArray(b64){function push(v){arr[L++]=v}var i,j,l,tmp,placeHolders,arr;if(b64.length%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var len=b64.length;placeHolders="="===b64.charAt(len-2)?2:"="===b64.charAt(len-1)?1:0,arr=new Arr(3*b64.length/4-placeHolders),l=placeHolders>0?b64.length-4:b64.length;var L=0;for(i=0,j=0;l>i;i+=4,j+=3)tmp=decode(b64.charAt(i))<<18|decode(b64.charAt(i+1))<<12|decode(b64.charAt(i+2))<<6|decode(b64.charAt(i+3)),push((16711680&tmp)>>16),push((65280&tmp)>>8),push(255&tmp);return 2===placeHolders?(tmp=decode(b64.charAt(i))<<2|decode(b64.charAt(i+1))>>4,push(255&tmp)):1===placeHolders&&(tmp=decode(b64.charAt(i))<<10|decode(b64.charAt(i+1))<<4|decode(b64.charAt(i+2))>>2,push(tmp>>8&255),push(255&tmp)),arr}function uint8ToBase64(uint8){function encode(num){return lookup.charAt(num)}function tripletToBase64(num){return encode(num>>18&63)+encode(num>>12&63)+encode(num>>6&63)+encode(63&num)}var i,temp,length,extraBytes=uint8.length%3,output="";for(i=0,length=uint8.length-extraBytes;length>i;i+=3)temp=(uint8[i]<<16)+(uint8[i+1]<<8)+uint8[i+2],output+=tripletToBase64(temp);switch(extraBytes){case 1:temp=uint8[uint8.length-1],output+=encode(temp>>2),output+=encode(temp<<4&63),output+="==";break;case 2:temp=(uint8[uint8.length-2]<<8)+uint8[uint8.length-1],output+=encode(temp>>10),output+=encode(temp>>4&63),output+=encode(temp<<2&63),output+="="}return output}var Arr="undefined"!=typeof Uint8Array?Uint8Array:Array,PLUS="+".charCodeAt(0),SLASH="/".charCodeAt(0),NUMBER="0".charCodeAt(0),LOWER="a".charCodeAt(0),UPPER="A".charCodeAt(0),PLUS_URL_SAFE="-".charCodeAt(0),SLASH_URL_SAFE="_".charCodeAt(0);exports.toByteArray=b64ToByteArray,exports.fromByteArray=uint8ToBase64}(exports)},function(module,exports,__webpack_require__){function numeric(str){return parseInt(str,10)==str?parseInt(str,10):str.charCodeAt(0)}function escapeBraces(str){return str.split("\\\\").join(escSlash).split("\\{").join(escOpen).split("\\}").join(escClose).split("\\,").join(escComma).split("\\.").join(escPeriod)}function unescapeBraces(str){return str.split(escSlash).join("\\").split(escOpen).join("{").split(escClose).join("}").split(escComma).join(",").split(escPeriod).join(".")}function parseCommaParts(str){if(!str)return[""];var parts=[],m=balanced("{","}",str);if(!m)return str.split(",");var pre=m.pre,body=m.body,post=m.post,p=pre.split(",");p[p.length-1]+="{"+body+"}";var postParts=parseCommaParts(post);return post.length&&(p[p.length-1]+=postParts.shift(),p.push.apply(p,postParts)),parts.push.apply(parts,p),parts}function expandTop(str){return str?expand(escapeBraces(str),!0).map(unescapeBraces):[]}function embrace(str){return"{"+str+"}"}function isPadded(el){return/^-?0\d/.test(el)}function lte(i,y){return y>=i}function gte(i,y){return i>=y}function expand(str,isTop){var expansions=[],m=balanced("{","}",str);if(!m||/\$$/.test(m.pre))return[str];var isNumericSequence=/^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body),isAlphaSequence=/^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body),isSequence=isNumericSequence||isAlphaSequence,isOptions=/^(.*,)+(.+)?$/.test(m.body);if(!isSequence&&!isOptions)return m.post.match(/,.*}/)?(str=m.pre+"{"+m.body+escClose+m.post,expand(str)):[str];var n;if(isSequence)n=m.body.split(/\.\./);else if(n=parseCommaParts(m.body),1===n.length&&(n=expand(n[0],!1).map(embrace),1===n.length)){var post=m.post.length?expand(m.post,!1):[""];return post.map(function(p){return m.pre+n[0]+p})}var N,pre=m.pre,post=m.post.length?expand(m.post,!1):[""];if(isSequence){var x=numeric(n[0]),y=numeric(n[1]),width=Math.max(n[0].length,n[1].length),incr=3==n.length?Math.abs(numeric(n[2])):1,test=lte,reverse=x>y;reverse&&(incr*=-1,test=gte);var pad=n.some(isPadded);N=[];for(var i=x;test(i,y);i+=incr){var c;if(isAlphaSequence)c=String.fromCharCode(i),"\\"===c&&(c="");else if(c=String(i),pad){var need=width-c.length;if(need>0){var z=new Array(need+1).join("0");c=0>i?"-"+z+c.slice(1):z+c}}N.push(c)}}else N=concatMap(n,function(el){return expand(el,!1)});for(var j=0;j<N.length;j++)for(var k=0;k<post.length;k++){var expansion=pre+N[j]+post[k];(!isTop||isSequence||expansion)&&expansions.push(expansion)}return expansions}var concatMap=__webpack_require__(138),balanced=__webpack_require__(130);module.exports=expandTop;var escSlash="\x00SLASH"+Math.random()+"\x00",escOpen="\x00OPEN"+Math.random()+"\x00",escClose="\x00CLOSE"+Math.random()+"\x00",escComma="\x00COMMA"+Math.random()+"\x00",escPeriod="\x00PERIOD"+Math.random()+"\x00"},function(module,exports,__webpack_require__){var Buffer=__webpack_require__(2).Buffer;module.exports=function(a,b){if(Buffer.isBuffer(a)&&Buffer.isBuffer(b)){if("function"==typeof a.equals)return a.equals(b);if(a.length!==b.length)return!1;for(var i=0;i<a.length;i++)if(a[i]!==b[i])return!1;return!0}}},function(module,exports){var toString={}.toString;module.exports=Array.isArray||function(arr){return"[object Array]"==toString.call(arr)}},function(module,exports){module.exports={100:"Continue",101:"Switching Protocols",102:"Processing",200:"OK",201:"Created",202:"Accepted",203:"Non-Authoritative Information",204:"No Content",205:"Reset Content",206:"Partial Content",
207:"Multi-Status",300:"Multiple Choices",301:"Moved Permanently",302:"Moved Temporarily",303:"See Other",304:"Not Modified",305:"Use Proxy",307:"Temporary Redirect",308:"Permanent Redirect",400:"Bad Request",401:"Unauthorized",402:"Payment Required",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",406:"Not Acceptable",407:"Proxy Authentication Required",408:"Request Time-out",409:"Conflict",410:"Gone",411:"Length Required",412:"Precondition Failed",413:"Request Entity Too Large",414:"Request-URI Too Large",415:"Unsupported Media Type",416:"Requested Range Not Satisfiable",417:"Expectation Failed",418:"I'm a teapot",422:"Unprocessable Entity",423:"Locked",424:"Failed Dependency",425:"Unordered Collection",426:"Upgrade Required",428:"Precondition Required",429:"Too Many Requests",431:"Request Header Fields Too Large",500:"Internal Server Error",501:"Not Implemented",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Time-out",505:"HTTP Version Not Supported",506:"Variant Also Negotiates",507:"Insufficient Storage",509:"Bandwidth Limit Exceeded",510:"Not Extended",511:"Network Authentication Required"}},function(module,exports,__webpack_require__){function cloneStats(stats){var replacement=new Stat;return Object.keys(stats).forEach(function(key){replacement[key]=stats[key]}),replacement}var Stat=__webpack_require__(5).Stats;module.exports=cloneStats},function(module,exports,__webpack_require__){(function(Buffer){var clone=function(){"use strict";function clone(parent,circular,depth,prototype){function _clone(parent,depth){if(null===parent)return null;if(0==depth)return parent;var child,proto;if("object"!=typeof parent)return parent;if(clone.__isArray(parent))child=[];else if(clone.__isRegExp(parent))child=new RegExp(parent.source,__getRegExpFlags(parent)),parent.lastIndex&&(child.lastIndex=parent.lastIndex);else if(clone.__isDate(parent))child=new Date(parent.getTime());else{if(useBuffer&&Buffer.isBuffer(parent))return child=new Buffer(parent.length),parent.copy(child),child;"undefined"==typeof prototype?(proto=Object.getPrototypeOf(parent),child=Object.create(proto)):(child=Object.create(prototype),proto=prototype)}if(circular){var index=allParents.indexOf(parent);if(-1!=index)return allChildren[index];allParents.push(parent),allChildren.push(child)}for(var i in parent){var attrs;proto&&(attrs=Object.getOwnPropertyDescriptor(proto,i)),attrs&&null==attrs.set||(child[i]=_clone(parent[i],depth-1))}return child}var filter;"object"==typeof circular&&(depth=circular.depth,prototype=circular.prototype,filter=circular.filter,circular=circular.circular);var allParents=[],allChildren=[],useBuffer="undefined"!=typeof Buffer;return"undefined"==typeof circular&&(circular=!0),"undefined"==typeof depth&&(depth=1/0),_clone(parent,depth)}function __objToStr(o){return Object.prototype.toString.call(o)}function __isDate(o){return"object"==typeof o&&"[object Date]"===__objToStr(o)}function __isArray(o){return"object"==typeof o&&"[object Array]"===__objToStr(o)}function __isRegExp(o){return"object"==typeof o&&"[object RegExp]"===__objToStr(o)}function __getRegExpFlags(re){var flags="";return re.global&&(flags+="g"),re.ignoreCase&&(flags+="i"),re.multiline&&(flags+="m"),flags}return clone.clonePrototype=function(parent){if(null===parent)return null;var c=function(){};return c.prototype=parent,new c},clone.__objToStr=__objToStr,clone.__isDate=__isDate,clone.__isArray=__isArray,clone.__isRegExp=__isRegExp,clone.__getRegExpFlags=__getRegExpFlags,clone}();"object"==typeof module&&module.exports&&(module.exports=clone)}).call(exports,__webpack_require__(2).Buffer)},function(module,exports){module.exports=function(xs,fn){for(var res=[],i=0;i<xs.length;i++){var x=fn(xs[i],i);isArray(x)?res.push.apply(res,x):res.push(x)}return res};var isArray=Array.isArray||function(xs){return"[object Array]"===Object.prototype.toString.call(xs)}},function(module,exports,__webpack_require__){(function(Buffer){"use strict";function decodeBase64(base64){return new Buffer(base64,"base64").toString()}function stripComment(sm){return sm.split(",").pop()}function readFromFileMap(sm,dir){var r=mapFileCommentRx.exec(sm);mapFileCommentRx.lastIndex=0;var filename=r[1]||r[2],filepath=path.join(dir,filename);try{return fs.readFileSync(filepath,"utf8")}catch(e){throw new Error("An error occurred while trying to read the map file at "+filepath+"\n"+e)}}function Converter(sm,opts){opts=opts||{},opts.isFileComment&&(sm=readFromFileMap(sm,opts.commentFileDir)),opts.hasComment&&(sm=stripComment(sm)),opts.isEncoded&&(sm=decodeBase64(sm)),(opts.isJSON||opts.isEncoded)&&(sm=JSON.parse(sm)),this.sourcemap=sm}function convertFromLargeSource(content){for(var line,lines=content.split("\n"),i=lines.length-1;i>0;i--)if(line=lines[i],~line.indexOf("sourceMappingURL=data:"))return exports.fromComment(line)}var fs=__webpack_require__(5),path=__webpack_require__(6),commentRx=/^\s*\/(?:\/|\*)[@#]\s+sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+;)?base64,(.*)$/gm,mapFileCommentRx=/(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/){1}[ \t]*$)/gm;Converter.prototype.toJSON=function(space){return JSON.stringify(this.sourcemap,null,space)},Converter.prototype.toBase64=function(){var json=this.toJSON();return new Buffer(json).toString("base64")},Converter.prototype.toComment=function(options){var base64=this.toBase64(),data="sourceMappingURL=data:application/json;base64,"+base64;return options&&options.multiline?"/*# "+data+" */":"//# "+data},Converter.prototype.toObject=function(){return JSON.parse(this.toJSON())},Converter.prototype.addProperty=function(key,value){if(this.sourcemap.hasOwnProperty(key))throw new Error("property %s already exists on the sourcemap, use set property instead");return this.setProperty(key,value)},Converter.prototype.setProperty=function(key,value){return this.sourcemap[key]=value,this},Converter.prototype.getProperty=function(key){return this.sourcemap[key]},exports.fromObject=function(obj){return new Converter(obj)},exports.fromJSON=function(json){return new Converter(json,{isJSON:!0})},exports.fromBase64=function(base64){return new Converter(base64,{isEncoded:!0})},exports.fromComment=function(comment){return comment=comment.replace(/^\/\*/g,"//").replace(/\*\/$/g,""),new Converter(comment,{isEncoded:!0,hasComment:!0})},exports.fromMapFileComment=function(comment,dir){return new Converter(comment,{commentFileDir:dir,isFileComment:!0,isJSON:!0})},exports.fromSource=function(content,largeSource){if(largeSource){var res=convertFromLargeSource(content);return res?res:null}var m=content.match(commentRx);return commentRx.lastIndex=0,m?exports.fromComment(m.pop()):null},exports.fromMapFileSource=function(content,dir){var m=content.match(mapFileCommentRx);return mapFileCommentRx.lastIndex=0,m?exports.fromMapFileComment(m.pop(),dir):null},exports.removeComments=function(src){return commentRx.lastIndex=0,src.replace(commentRx,"")},exports.removeMapFileComments=function(src){return mapFileCommentRx.lastIndex=0,src.replace(mapFileCommentRx,"")},Object.defineProperty(exports,"commentRegex",{get:function(){return commentRx.lastIndex=0,commentRx}}),Object.defineProperty(exports,"mapFileCommentRegex",{get:function(){return mapFileCommentRx.lastIndex=0,mapFileCommentRx}})}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){var core=__webpack_require__(12);module.exports=function(it){return(core.JSON&&core.JSON.stringify||JSON.stringify).apply(JSON,arguments)}},function(module,exports,__webpack_require__){__webpack_require__(160),module.exports=__webpack_require__(12).Object.assign},function(module,exports,__webpack_require__){var $=__webpack_require__(10);module.exports=function(P,D){return $.create(P,D)}},function(module,exports,__webpack_require__){var $=__webpack_require__(10);module.exports=function(it,key,desc){return $.setDesc(it,key,desc)}},function(module,exports,__webpack_require__){var $=__webpack_require__(10);__webpack_require__(161),module.exports=function(it,key){return $.getDesc(it,key)}},function(module,exports,__webpack_require__){var $=__webpack_require__(10);__webpack_require__(162),module.exports=function(it){return $.getNames(it)}},function(module,exports,__webpack_require__){__webpack_require__(163),module.exports=__webpack_require__(12).Object.getPrototypeOf},function(module,exports,__webpack_require__){__webpack_require__(164),module.exports=__webpack_require__(12).Object.keys},function(module,exports,__webpack_require__){__webpack_require__(165),module.exports=__webpack_require__(12).Object.setPrototypeOf},function(module,exports,__webpack_require__){__webpack_require__(167),__webpack_require__(166),module.exports=__webpack_require__(12).Symbol},function(module,exports){module.exports=function(it){if("function"!=typeof it)throw TypeError(it+" is not a function!");return it}},function(module,exports,__webpack_require__){var $=__webpack_require__(10);module.exports=function(it){var keys=$.getKeys(it),getSymbols=$.getSymbols;if(getSymbols)for(var key,symbols=getSymbols(it),isEnum=$.isEnum,i=0;symbols.length>i;)isEnum.call(it,key=symbols[i++])&&keys.push(key);return keys}},function(module,exports,__webpack_require__){var $=__webpack_require__(10),createDesc=__webpack_require__(60);module.exports=__webpack_require__(55)?function(object,key,value){return $.setDesc(object,key,createDesc(1,value))}:function(object,key,value){return object[key]=value,object}},function(module,exports,__webpack_require__){var cof=__webpack_require__(52);module.exports=Array.isArray||function(arg){return"Array"==cof(arg)}},function(module,exports,__webpack_require__){var $=__webpack_require__(10),toIObject=__webpack_require__(27);module.exports=function(object,el){for(var key,O=toIObject(object),keys=$.getKeys(O),length=keys.length,index=0;length>index;)if(O[key=keys[index++]]===el)return key}},function(module,exports){module.exports=!0},function(module,exports,__webpack_require__){var $=__webpack_require__(10),toObject=__webpack_require__(32),IObject=__webpack_require__(58);module.exports=__webpack_require__(24)(function(){var a=Object.assign,A={},B={},S=Symbol(),K="abcdefghijklmnopqrst";return A[S]=7,K.split("").forEach(function(k){B[k]=k}),7!=a({},A)[S]||Object.keys(a({},B)).join("")!=K})?function(target,source){for(var T=toObject(target),$$=arguments,$$len=$$.length,index=1,getKeys=$.getKeys,getSymbols=$.getSymbols,isEnum=$.isEnum;$$len>index;)for(var key,S=IObject($$[index++]),keys=getSymbols?getKeys(S).concat(getSymbols(S)):getKeys(S),length=keys.length,j=0;length>j;)isEnum.call(S,key=keys[j++])&&(T[key]=S[key]);return T}:Object.assign},function(module,exports,__webpack_require__){module.exports=__webpack_require__(152)},function(module,exports,__webpack_require__){var getDesc=__webpack_require__(10).getDesc,isObject=__webpack_require__(59),anObject=__webpack_require__(51),check=function(O,proto){if(anObject(O),!isObject(proto)&&null!==proto)throw TypeError(proto+": can't set as prototype!")};module.exports={set:Object.setPrototypeOf||("__proto__"in{}?function(test,buggy,set){try{set=__webpack_require__(53)(Function.call,getDesc(Object.prototype,"__proto__").set,2),set(test,[]),buggy=!(test instanceof Array)}catch(e){buggy=!0}return function(O,proto){return check(O,proto),buggy?O.__proto__=proto:set(O,proto),O}}({},!1):void 0),check:check}},function(module,exports,__webpack_require__){var def=__webpack_require__(10).setDesc,has=__webpack_require__(57),TAG=__webpack_require__(63)("toStringTag");module.exports=function(it,tag,stat){it&&!has(it=stat?it:it.prototype,TAG)&&def(it,TAG,{configurable:!0,value:tag})}},function(module,exports,__webpack_require__){var $export=__webpack_require__(23);$export($export.S+$export.F,"Object",{assign:__webpack_require__(156)})},function(module,exports,__webpack_require__){var toIObject=__webpack_require__(27);__webpack_require__(26)("getOwnPropertyDescriptor",function($getOwnPropertyDescriptor){return function(it,key){return $getOwnPropertyDescriptor(toIObject(it),key)}})},function(module,exports,__webpack_require__){__webpack_require__(26)("getOwnPropertyNames",function(){return __webpack_require__(56).get})},function(module,exports,__webpack_require__){var toObject=__webpack_require__(32);__webpack_require__(26)("getPrototypeOf",function($getPrototypeOf){return function(it){return $getPrototypeOf(toObject(it))}})},function(module,exports,__webpack_require__){var toObject=__webpack_require__(32);__webpack_require__(26)("keys",function($keys){return function(it){return $keys(toObject(it))}})},function(module,exports,__webpack_require__){var $export=__webpack_require__(23);$export($export.S,"Object",{setPrototypeOf:__webpack_require__(158).set})},function(module,exports){},function(module,exports,__webpack_require__){"use strict";var $=__webpack_require__(10),global=__webpack_require__(25),has=__webpack_require__(57),DESCRIPTORS=__webpack_require__(55),$export=__webpack_require__(23),redefine=__webpack_require__(157),$fails=__webpack_require__(24),shared=__webpack_require__(61),setToStringTag=__webpack_require__(159),uid=__webpack_require__(62),wks=__webpack_require__(63),keyOf=__webpack_require__(154),$names=__webpack_require__(56),enumKeys=__webpack_require__(151),isArray=__webpack_require__(153),anObject=__webpack_require__(51),toIObject=__webpack_require__(27),createDesc=__webpack_require__(60),getDesc=$.getDesc,setDesc=$.setDesc,_create=$.create,getNames=$names.get,$Symbol=global.Symbol,$JSON=global.JSON,_stringify=$JSON&&$JSON.stringify,setter=!1,HIDDEN=wks("_hidden"),isEnum=$.isEnum,SymbolRegistry=shared("symbol-registry"),AllSymbols=shared("symbols"),useNative="function"==typeof $Symbol,ObjectProto=Object.prototype,setSymbolDesc=DESCRIPTORS&&$fails(function(){return 7!=_create(setDesc({},"a",{get:function(){return setDesc(this,"a",{value:7}).a}})).a})?function(it,key,D){var protoDesc=getDesc(ObjectProto,key);protoDesc&&delete ObjectProto[key],setDesc(it,key,D),protoDesc&&it!==ObjectProto&&setDesc(ObjectProto,key,protoDesc)}:setDesc,wrap=function(tag){var sym=AllSymbols[tag]=_create($Symbol.prototype);return sym._k=tag,DESCRIPTORS&&setter&&setSymbolDesc(ObjectProto,tag,{configurable:!0,set:function(value){has(this,HIDDEN)&&has(this[HIDDEN],tag)&&(this[HIDDEN][tag]=!1),setSymbolDesc(this,tag,createDesc(1,value))}}),sym},isSymbol=function(it){return"symbol"==typeof it},$defineProperty=function(it,key,D){return D&&has(AllSymbols,key)?(D.enumerable?(has(it,HIDDEN)&&it[HIDDEN][key]&&(it[HIDDEN][key]=!1),D=_create(D,{enumerable:createDesc(0,!1)})):(has(it,HIDDEN)||setDesc(it,HIDDEN,createDesc(1,{})),it[HIDDEN][key]=!0),setSymbolDesc(it,key,D)):setDesc(it,key,D)},$defineProperties=function(it,P){anObject(it);for(var key,keys=enumKeys(P=toIObject(P)),i=0,l=keys.length;l>i;)$defineProperty(it,key=keys[i++],P[key]);return it},$create=function(it,P){return void 0===P?_create(it):$defineProperties(_create(it),P)},$propertyIsEnumerable=function(key){var E=isEnum.call(this,key);return E||!has(this,key)||!has(AllSymbols,key)||has(this,HIDDEN)&&this[HIDDEN][key]?E:!0},$getOwnPropertyDescriptor=function(it,key){var D=getDesc(it=toIObject(it),key);return!D||!has(AllSymbols,key)||has(it,HIDDEN)&&it[HIDDEN][key]||(D.enumerable=!0),D},$getOwnPropertyNames=function(it){for(var key,names=getNames(toIObject(it)),result=[],i=0;names.length>i;)has(AllSymbols,key=names[i++])||key==HIDDEN||result.push(key);return result},$getOwnPropertySymbols=function(it){for(var key,names=getNames(toIObject(it)),result=[],i=0;names.length>i;)has(AllSymbols,key=names[i++])&&result.push(AllSymbols[key]);return result},$stringify=function(it){if(void 0!==it&&!isSymbol(it)){for(var replacer,$replacer,args=[it],i=1,$$=arguments;$$.length>i;)args.push($$[i++]);return replacer=args[1],"function"==typeof replacer&&($replacer=replacer),($replacer||!isArray(replacer))&&(replacer=function(key,value){return $replacer&&(value=$replacer.call(this,key,value)),isSymbol(value)?void 0:value}),args[1]=replacer,_stringify.apply($JSON,args)}},buggyJSON=$fails(function(){var S=$Symbol();return"[null]"!=_stringify([S])||"{}"!=_stringify({a:S})||"{}"!=_stringify(Object(S))});useNative||($Symbol=function(){if(isSymbol(this))throw TypeError("Symbol is not a constructor");return wrap(uid(arguments.length>0?arguments[0]:void 0))},redefine($Symbol.prototype,"toString",function(){return this._k}),isSymbol=function(it){return it instanceof $Symbol},$.create=$create,$.isEnum=$propertyIsEnumerable,$.getDesc=$getOwnPropertyDescriptor,$.setDesc=$defineProperty,$.setDescs=$defineProperties,$.getNames=$names.get=$getOwnPropertyNames,$.getSymbols=$getOwnPropertySymbols,DESCRIPTORS&&!__webpack_require__(155)&&redefine(ObjectProto,"propertyIsEnumerable",$propertyIsEnumerable,!0));var symbolStatics={"for":function(key){return has(SymbolRegistry,key+="")?SymbolRegistry[key]:SymbolRegistry[key]=$Symbol(key)},keyFor:function(key){return keyOf(SymbolRegistry,key)},useSetter:function(){setter=!0},useSimple:function(){setter=!1}};$.each.call("hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables".split(","),function(it){var sym=wks(it);symbolStatics[it]=useNative?sym:wrap(sym)}),setter=!0,$export($export.G+$export.W,{Symbol:$Symbol}),$export($export.S,"Symbol",symbolStatics),$export($export.S+$export.F*!useNative,"Object",{create:$create,defineProperty:$defineProperty,defineProperties:$defineProperties,getOwnPropertyDescriptor:$getOwnPropertyDescriptor,getOwnPropertyNames:$getOwnPropertyNames,getOwnPropertySymbols:$getOwnPropertySymbols}),$JSON&&$export($export.S+$export.F*(!useNative||buggyJSON),"JSON",{stringify:$stringify}),setToStringTag($Symbol,"Symbol"),setToStringTag(Math,"Math",!0),setToStringTag(global.JSON,"JSON",!0)},function(module,exports,__webpack_require__){(function(Buffer){function Hmac(alg,key){if(!(this instanceof Hmac))return new Hmac(alg,key);this._opad=opad,this._alg=alg;var blocksize="sha512"===alg?128:64;key=this._key=Buffer.isBuffer(key)?key:new Buffer(key),key.length>blocksize?key=createHash(alg).update(key).digest():key.length<blocksize&&(key=Buffer.concat([key,zeroBuffer],blocksize));for(var ipad=this._ipad=new Buffer(blocksize),opad=this._opad=new Buffer(blocksize),i=0;blocksize>i;i++)ipad[i]=54^key[i],opad[i]=92^key[i];this._hash=createHash(alg).update(ipad)}var createHash=__webpack_require__(64),zeroBuffer=new Buffer(128);zeroBuffer.fill(0),module.exports=Hmac,Hmac.prototype.update=function(data,enc){return this._hash.update(data,enc),this},Hmac.prototype.digest=function(enc){var h=this._hash.digest();return createHash(this._alg).update(this._opad).update(h).digest(enc)}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(Buffer){function toArray(buf,bigEndian){if(buf.length%intSize!==0){var len=buf.length+(intSize-buf.length%intSize);buf=Buffer.concat([buf,zeroBuffer],len)}for(var arr=[],fn=bigEndian?buf.readInt32BE:buf.readInt32LE,i=0;i<buf.length;i+=intSize)arr.push(fn.call(buf,i));return arr}function toBuffer(arr,size,bigEndian){for(var buf=new Buffer(size),fn=bigEndian?buf.writeInt32BE:buf.writeInt32LE,i=0;i<arr.length;i++)fn.call(buf,arr[i],4*i,!0);return buf}function hash(buf,fn,hashSize,bigEndian){Buffer.isBuffer(buf)||(buf=new Buffer(buf));var arr=fn(toArray(buf,bigEndian),buf.length*chrsz);return toBuffer(arr,hashSize,bigEndian)}var intSize=4,zeroBuffer=new Buffer(intSize);zeroBuffer.fill(0);var chrsz=8;module.exports={hash:hash}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(Buffer){function error(){var m=[].slice.call(arguments).join(" ");throw new Error([m,"we accept pull requests","http://github.com/dominictarr/crypto-browserify"].join("\n"))}function each(a,f){for(var i in a)f(a[i],i)}var rng=__webpack_require__(173);exports.createHash=__webpack_require__(64),exports.createHmac=__webpack_require__(168),exports.randomBytes=function(size,callback){if(!callback||!callback.call)return new Buffer(rng(size));try{callback.call(this,void 0,new Buffer(rng(size)))}catch(err){callback(err)}},exports.getHashes=function(){return["sha1","sha256","sha512","md5","rmd160"]};var p=__webpack_require__(172)(exports);exports.pbkdf2=p.pbkdf2,exports.pbkdf2Sync=p.pbkdf2Sync,each(["createCredentials","createCipher","createCipheriv","createDecipher","createDecipheriv","createSign","createVerify","createDiffieHellman"],function(name){exports[name]=function(){error("sorry,",name,"is not implemented yet")}})}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){function core_md5(x,len){x[len>>5]|=128<<len%32,x[(len+64>>>9<<4)+14]=len;for(var a=1732584193,b=-271733879,c=-1732584194,d=271733878,i=0;i<x.length;i+=16){var olda=a,oldb=b,oldc=c,oldd=d;a=md5_ff(a,b,c,d,x[i+0],7,-680876936),d=md5_ff(d,a,b,c,x[i+1],12,-389564586),c=md5_ff(c,d,a,b,x[i+2],17,606105819),b=md5_ff(b,c,d,a,x[i+3],22,-1044525330),a=md5_ff(a,b,c,d,x[i+4],7,-176418897),d=md5_ff(d,a,b,c,x[i+5],12,1200080426),c=md5_ff(c,d,a,b,x[i+6],17,-1473231341),b=md5_ff(b,c,d,a,x[i+7],22,-45705983),a=md5_ff(a,b,c,d,x[i+8],7,1770035416),d=md5_ff(d,a,b,c,x[i+9],12,-1958414417),c=md5_ff(c,d,a,b,x[i+10],17,-42063),b=md5_ff(b,c,d,a,x[i+11],22,-1990404162),a=md5_ff(a,b,c,d,x[i+12],7,1804603682),d=md5_ff(d,a,b,c,x[i+13],12,-40341101),c=md5_ff(c,d,a,b,x[i+14],17,-1502002290),b=md5_ff(b,c,d,a,x[i+15],22,1236535329),a=md5_gg(a,b,c,d,x[i+1],5,-165796510),d=md5_gg(d,a,b,c,x[i+6],9,-1069501632),c=md5_gg(c,d,a,b,x[i+11],14,643717713),b=md5_gg(b,c,d,a,x[i+0],20,-373897302),a=md5_gg(a,b,c,d,x[i+5],5,-701558691),d=md5_gg(d,a,b,c,x[i+10],9,38016083),c=md5_gg(c,d,a,b,x[i+15],14,-660478335),b=md5_gg(b,c,d,a,x[i+4],20,-405537848),a=md5_gg(a,b,c,d,x[i+9],5,568446438),d=md5_gg(d,a,b,c,x[i+14],9,-1019803690),c=md5_gg(c,d,a,b,x[i+3],14,-187363961),b=md5_gg(b,c,d,a,x[i+8],20,1163531501),a=md5_gg(a,b,c,d,x[i+13],5,-1444681467),d=md5_gg(d,a,b,c,x[i+2],9,-51403784),c=md5_gg(c,d,a,b,x[i+7],14,1735328473),b=md5_gg(b,c,d,a,x[i+12],20,-1926607734),a=md5_hh(a,b,c,d,x[i+5],4,-378558),d=md5_hh(d,a,b,c,x[i+8],11,-2022574463),c=md5_hh(c,d,a,b,x[i+11],16,1839030562),b=md5_hh(b,c,d,a,x[i+14],23,-35309556),a=md5_hh(a,b,c,d,x[i+1],4,-1530992060),d=md5_hh(d,a,b,c,x[i+4],11,1272893353),c=md5_hh(c,d,a,b,x[i+7],16,-155497632),b=md5_hh(b,c,d,a,x[i+10],23,-1094730640),a=md5_hh(a,b,c,d,x[i+13],4,681279174),d=md5_hh(d,a,b,c,x[i+0],11,-358537222),c=md5_hh(c,d,a,b,x[i+3],16,-722521979),b=md5_hh(b,c,d,a,x[i+6],23,76029189),a=md5_hh(a,b,c,d,x[i+9],4,-640364487),d=md5_hh(d,a,b,c,x[i+12],11,-421815835),c=md5_hh(c,d,a,b,x[i+15],16,530742520),b=md5_hh(b,c,d,a,x[i+2],23,-995338651),a=md5_ii(a,b,c,d,x[i+0],6,-198630844),d=md5_ii(d,a,b,c,x[i+7],10,1126891415),c=md5_ii(c,d,a,b,x[i+14],15,-1416354905),b=md5_ii(b,c,d,a,x[i+5],21,-57434055),a=md5_ii(a,b,c,d,x[i+12],6,1700485571),d=md5_ii(d,a,b,c,x[i+3],10,-1894986606),c=md5_ii(c,d,a,b,x[i+10],15,-1051523),b=md5_ii(b,c,d,a,x[i+1],21,-2054922799),a=md5_ii(a,b,c,d,x[i+8],6,1873313359),d=md5_ii(d,a,b,c,x[i+15],10,-30611744),c=md5_ii(c,d,a,b,x[i+6],15,-1560198380),b=md5_ii(b,c,d,a,x[i+13],21,1309151649),a=md5_ii(a,b,c,d,x[i+4],6,-145523070),d=md5_ii(d,a,b,c,x[i+11],10,-1120210379),c=md5_ii(c,d,a,b,x[i+2],15,718787259),b=md5_ii(b,c,d,a,x[i+9],21,-343485551),a=safe_add(a,olda),b=safe_add(b,oldb),c=safe_add(c,oldc),d=safe_add(d,oldd)}return Array(a,b,c,d)}function md5_cmn(q,a,b,x,s,t){return safe_add(bit_rol(safe_add(safe_add(a,q),safe_add(x,t)),s),b)}function md5_ff(a,b,c,d,x,s,t){return md5_cmn(b&c|~b&d,a,b,x,s,t)}function md5_gg(a,b,c,d,x,s,t){return md5_cmn(b&d|c&~d,a,b,x,s,t)}function md5_hh(a,b,c,d,x,s,t){return md5_cmn(b^c^d,a,b,x,s,t)}function md5_ii(a,b,c,d,x,s,t){return md5_cmn(c^(b|~d),a,b,x,s,t)}function safe_add(x,y){var lsw=(65535&x)+(65535&y),msw=(x>>16)+(y>>16)+(lsw>>16);return msw<<16|65535&lsw}function bit_rol(num,cnt){return num<<cnt|num>>>32-cnt}var helpers=__webpack_require__(169);module.exports=function(buf){return helpers.hash(buf,core_md5,16)}},function(module,exports,__webpack_require__){var pbkdf2Export=__webpack_require__(209);module.exports=function(crypto,exports){exports=exports||{};var exported=pbkdf2Export(crypto);return exports.pbkdf2=exported.pbkdf2,exports.pbkdf2Sync=exported.pbkdf2Sync,exports}},function(module,exports,__webpack_require__){(function(global,Buffer){!function(){var g=("undefined"==typeof window?global:window)||{};_crypto=g.crypto||g.msCrypto||__webpack_require__(265),module.exports=function(size){if(_crypto.getRandomValues){var bytes=new Buffer(size);return _crypto.getRandomValues(bytes),bytes}if(_crypto.randomBytes)return _crypto.randomBytes(size);throw new Error("secure random number generation not supported by this browser\nuse chrome, FireFox or Internet Explorer 11")}}()}).call(exports,function(){return this}(),__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){var once=__webpack_require__(37),noop=function(){},isRequest=function(stream){return stream.setHeader&&"function"==typeof stream.abort},eos=function(stream,opts,callback){if("function"==typeof opts)return eos(stream,null,opts);opts||(opts={}),callback=once(callback||noop);var ws=stream._writableState,rs=stream._readableState,readable=opts.readable||opts.readable!==!1&&stream.readable,writable=opts.writable||opts.writable!==!1&&stream.writable,onlegacyfinish=function(){stream.writable||onfinish()},onfinish=function(){writable=!1,readable||callback()},onend=function(){readable=!1,writable||callback()},onclose=function(){return(!readable||rs&&rs.ended)&&(!writable||ws&&ws.ended)?void 0:callback(new Error("premature close"))},onrequest=function(){stream.req.on("finish",onfinish)};return isRequest(stream)?(stream.on("complete",onfinish),stream.on("abort",onclose),stream.req?onrequest():stream.on("request",onrequest)):writable&&!ws&&(stream.on("end",onlegacyfinish),stream.on("close",onlegacyfinish)),stream.on("end",onend),stream.on("finish",onfinish),opts.error!==!1&&stream.on("error",callback),stream.on("close",onclose),function(){stream.removeListener("complete",onfinish),stream.removeListener("abort",onclose),stream.removeListener("request",onrequest),stream.req&&stream.req.removeListener("finish",onfinish),stream.removeListener("end",onlegacyfinish),stream.removeListener("close",onlegacyfinish),stream.removeListener("finish",onfinish),stream.removeListener("end",onend),stream.removeListener("error",callback),stream.removeListener("close",onclose)}};module.exports=eos},function(module,exports,__webpack_require__){"use strict";function assign(a,b){for(var key in b)hasOwn(b,key)&&(a[key]=b[key])}function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj,key)}var isObject=__webpack_require__(189);module.exports=function(o){isObject(o)||(o={});for(var len=arguments.length,i=1;len>i;i++){var obj=arguments[i];isObject(obj)&&assign(o,obj)}return o}},function(module,exports){"use strict";var hasOwn=Object.prototype.hasOwnProperty,toStr=Object.prototype.toString,isArray=function(arr){return"function"==typeof Array.isArray?Array.isArray(arr):"[object Array]"===toStr.call(arr)},isPlainObject=function(obj){if(!obj||"[object Object]"!==toStr.call(obj))return!1;var hasOwnConstructor=hasOwn.call(obj,"constructor"),hasIsPrototypeOf=obj.constructor&&obj.constructor.prototype&&hasOwn.call(obj.constructor.prototype,"isPrototypeOf");if(obj.constructor&&!hasOwnConstructor&&!hasIsPrototypeOf)return!1;var key;for(key in obj);return"undefined"==typeof key||hasOwn.call(obj,key)};module.exports=function extend(){var options,name,src,copy,copyIsArray,clone,target=arguments[0],i=1,length=arguments.length,deep=!1;for("boolean"==typeof target?(deep=target,target=arguments[1]||{},i=2):("object"!=typeof target&&"function"!=typeof target||null==target)&&(target={});length>i;++i)if(options=arguments[i],null!=options)for(name in options)src=target[name],copy=options[name],target!==copy&&(deep&&copy&&(isPlainObject(copy)||(copyIsArray=isArray(copy)))?(copyIsArray?(copyIsArray=!1,clone=src&&isArray(src)?src:[]):clone=src&&isPlainObject(src)?src:{},target[name]=extend(deep,clone,copy)):"undefined"!=typeof copy&&(target[name]=copy));return target}},function(module,exports){function findIndex(array,predicate,self){var i,len=array.length;if(0===len)return-1;if("function"!=typeof predicate)throw new TypeError(predicate+" must be a function");if(self){for(i=0;len>i;i++)if(predicate.call(self,array[i],i,array))return i}else for(i=0;len>i;i++)if(predicate(array[i],i,array))return i;return-1}module.exports=findIndex},function(module,exports,__webpack_require__){(function(Buffer){"use strict";function ctor(options,transform){function FirstChunk(options2){return this instanceof FirstChunk?(Transform.call(this,options2),this._firstChunk=!0,this._transformCalled=!1,void(this._minSize=options.minSize)):new FirstChunk(options2)}if(util.inherits(FirstChunk,Transform),"function"==typeof options&&(transform=options,options={}),"function"!=typeof transform)throw new Error("transform function required");return FirstChunk.prototype._transform=function(chunk,enc,cb){return this._enc=enc,this._firstChunk?(this._firstChunk=!1,null==this._minSize?(transform.call(this,chunk,enc,cb),void(this._transformCalled=!0)):(this._buffer=chunk,void cb())):null==this._minSize?(this.push(chunk),void cb()):this._buffer.length<this._minSize?(this._buffer=Buffer.concat([this._buffer,chunk]),void cb()):this._buffer.length>=this._minSize?(transform.call(this,this._buffer.slice(),enc,function(){this.push(chunk),cb()}.bind(this)),this._transformCalled=!0,void(this._buffer=!1)):(this.push(chunk),void cb())},FirstChunk.prototype._flush=function(cb){return this._buffer?void(this._transformCalled?(this.push(this._buffer),cb()):transform.call(this,this._buffer.slice(),this._enc,cb)):void cb()},FirstChunk}var util=__webpack_require__(7),Transform=__webpack_require__(3).Transform;module.exports=function(){return ctor.apply(ctor,arguments)()},module.exports.ctor=ctor}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(process){"use strict";function isMatch(file,matcher){return matcher instanceof Minimatch?matcher.match(file.path):matcher instanceof RegExp?matcher.test(file.path):void 0}function isNegative(pattern){return"string"==typeof pattern?"!"===pattern[0]:pattern instanceof RegExp?!0:void 0}function indexGreaterThan(index){return function(obj){return obj.index>index}}function toGlob(obj){return obj.glob}function globIsSingular(glob){var globSet=glob.minimatch.set;return 1!==globSet.length?!1:globSet[0].every(function(value){return"string"==typeof value})}var through2=__webpack_require__(45),Combine=__webpack_require__(208),unique=__webpack_require__(237),glob=__webpack_require__(66),Minimatch=__webpack_require__(29).Minimatch,resolveGlob=__webpack_require__(236),glob2base=__webpack_require__(181),extend=(__webpack_require__(6),__webpack_require__(176)),gs={createStream:function(ourGlob,negatives,opt){function filterNegatives(filename,enc,cb){var matcha=isMatch.bind(null,filename);negatives.every(matcha)?cb(null,filename):cb()}ourGlob=resolveGlob(ourGlob,opt);var ourOpt=extend({},opt);delete ourOpt.root;var globber=new glob.Glob(ourGlob,ourOpt),basePath=opt.base||glob2base(globber),stream=through2.obj(opt,negatives.length?filterNegatives:void 0),found=!1;return globber.on("error",stream.emit.bind(stream,"error")),globber.once("end",function(){opt.allowEmpty!==!0&&!found&&globIsSingular(globber)&&stream.emit("error",new Error("File not found with singular glob: "+ourGlob)),stream.end()}),globber.on("match",function(filename){found=!0,stream.write({cwd:opt.cwd,base:basePath,path:filename})}),stream},create:function(globs,opt){function streamFromPositive(positive){var negativeGlobs=negatives.filter(indexGreaterThan(positive.index)).map(toGlob);return gs.createStream(positive.glob,negativeGlobs,opt)}opt||(opt={}),
"string"!=typeof opt.cwd&&(opt.cwd=process.cwd()),"boolean"!=typeof opt.dot&&(opt.dot=!1),"boolean"!=typeof opt.silent&&(opt.silent=!0),"boolean"!=typeof opt.nonull&&(opt.nonull=!1),"boolean"!=typeof opt.cwdbase&&(opt.cwdbase=!1),opt.cwdbase&&(opt.base=opt.cwd),Array.isArray(globs)||(globs=[globs]);var positives=[],negatives=[],ourOpt=extend({},opt);if(delete ourOpt.root,globs.forEach(function(glob,index){if("string"!=typeof glob&&!(glob instanceof RegExp))throw new Error("Invalid glob at index "+index);var globArray=isNegative(glob)?negatives:positives;if(globArray===negatives&&"string"==typeof glob){var ourGlob=resolveGlob(glob,opt);glob=new Minimatch(ourGlob,ourOpt)}globArray.push({index:index,glob:glob})}),0===positives.length)throw new Error("Missing positive glob");if(1===positives.length)return streamFromPositive(positives[0]);var streams=positives.map(streamFromPositive),aggregate=new Combine(streams),uniqueStream=unique("path"),returnStream=aggregate.pipe(uniqueStream);return aggregate.on("error",function(err){returnStream.emit("error",err)}),returnStream}};module.exports=gs}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function globSync(pattern,options){if("function"==typeof options||3===arguments.length)throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");return new GlobSync(pattern,options).found}function GlobSync(pattern,options){if(!pattern)throw new Error("must provide pattern");if("function"==typeof options||3===arguments.length)throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");if(!(this instanceof GlobSync))return new GlobSync(pattern,options);if(setopts(this,pattern,options),this.noprocess)return this;var n=this.minimatch.set.length;this.matches=new Array(n);for(var i=0;n>i;i++)this._process(this.minimatch.set[i],i,!1);this._finish()}module.exports=globSync,globSync.GlobSync=GlobSync;var fs=__webpack_require__(5),minimatch=__webpack_require__(29),path=(minimatch.Minimatch,__webpack_require__(66).Glob,__webpack_require__(7),__webpack_require__(6)),assert=__webpack_require__(30),isAbsolute=__webpack_require__(38),common=__webpack_require__(65),setopts=(common.alphasort,common.alphasorti,common.setopts),ownProp=common.ownProp,childrenIgnored=common.childrenIgnored;GlobSync.prototype._finish=function(){if(assert(this instanceof GlobSync),this.realpath){var self=this;this.matches.forEach(function(matchset,index){var set=self.matches[index]=Object.create(null);for(var p in matchset)try{p=self._makeAbs(p);var real=fs.realpathSync(p,self.realpathCache);set[real]=!0}catch(er){if("stat"!==er.syscall)throw er;set[self._makeAbs(p)]=!0}})}common.finish(this)},GlobSync.prototype._process=function(pattern,index,inGlobStar){assert(this instanceof GlobSync);for(var n=0;"string"==typeof pattern[n];)n++;var prefix;switch(n){case pattern.length:return void this._processSimple(pattern.join("/"),index);case 0:prefix=null;break;default:prefix=pattern.slice(0,n).join("/")}var read,remain=pattern.slice(n);null===prefix?read=".":isAbsolute(prefix)||isAbsolute(pattern.join("/"))?(prefix&&isAbsolute(prefix)||(prefix="/"+prefix),read=prefix):read=prefix;var abs=this._makeAbs(read);if(!childrenIgnored(this,read)){var isGlobStar=remain[0]===minimatch.GLOBSTAR;isGlobStar?this._processGlobStar(prefix,read,abs,remain,index,inGlobStar):this._processReaddir(prefix,read,abs,remain,index,inGlobStar)}},GlobSync.prototype._processReaddir=function(prefix,read,abs,remain,index,inGlobStar){var entries=this._readdir(abs,inGlobStar);if(entries){for(var pn=remain[0],negate=!!this.minimatch.negate,rawGlob=pn._glob,dotOk=this.dot||"."===rawGlob.charAt(0),matchedEntries=[],i=0;i<entries.length;i++){var e=entries[i];if("."!==e.charAt(0)||dotOk){var m;m=negate&&!prefix?!e.match(pn):e.match(pn),m&&matchedEntries.push(e)}}var len=matchedEntries.length;if(0!==len)if(1!==remain.length||this.mark||this.stat){remain.shift();for(var i=0;len>i;i++){var newPattern,e=matchedEntries[i];newPattern=prefix?[prefix,e]:[e],this._process(newPattern.concat(remain),index,inGlobStar)}}else{this.matches[index]||(this.matches[index]=Object.create(null));for(var i=0;len>i;i++){var e=matchedEntries[i];prefix&&(e="/"!==prefix.slice(-1)?prefix+"/"+e:prefix+e),"/"!==e.charAt(0)||this.nomount||(e=path.join(this.root,e)),this.matches[index][e]=!0}}}},GlobSync.prototype._emitMatch=function(index,e){this._makeAbs(e);if(this.mark&&(e=this._mark(e)),!this.matches[index][e]){if(this.nodir){var c=this.cache[this._makeAbs(e)];if("DIR"===c||Array.isArray(c))return}this.matches[index][e]=!0,this.stat&&this._stat(e)}},GlobSync.prototype._readdirInGlobStar=function(abs){if(this.follow)return this._readdir(abs,!1);var entries,lstat;try{lstat=fs.lstatSync(abs)}catch(er){return null}var isSym=lstat.isSymbolicLink();return this.symlinks[abs]=isSym,isSym||lstat.isDirectory()?entries=this._readdir(abs,!1):this.cache[abs]="FILE",entries},GlobSync.prototype._readdir=function(abs,inGlobStar){if(inGlobStar&&!ownProp(this.symlinks,abs))return this._readdirInGlobStar(abs);if(ownProp(this.cache,abs)){var c=this.cache[abs];if(!c||"FILE"===c)return null;if(Array.isArray(c))return c}try{return this._readdirEntries(abs,fs.readdirSync(abs))}catch(er){return this._readdirError(abs,er),null}},GlobSync.prototype._readdirEntries=function(abs,entries){if(!this.mark&&!this.stat)for(var i=0;i<entries.length;i++){var e=entries[i];e="/"===abs?abs+e:abs+"/"+e,this.cache[e]=!0}return this.cache[abs]=entries,entries},GlobSync.prototype._readdirError=function(f,er){switch(er.code){case"ENOTSUP":case"ENOTDIR":this.cache[this._makeAbs(f)]="FILE";break;case"ENOENT":case"ELOOP":case"ENAMETOOLONG":case"UNKNOWN":this.cache[this._makeAbs(f)]=!1;break;default:if(this.cache[this._makeAbs(f)]=!1,this.strict)throw er;this.silent||console.error("glob error",er)}},GlobSync.prototype._processGlobStar=function(prefix,read,abs,remain,index,inGlobStar){var entries=this._readdir(abs,inGlobStar);if(entries){var remainWithoutGlobStar=remain.slice(1),gspref=prefix?[prefix]:[],noGlobStar=gspref.concat(remainWithoutGlobStar);this._process(noGlobStar,index,!1);var len=entries.length,isSym=this.symlinks[abs];if(!isSym||!inGlobStar)for(var i=0;len>i;i++){var e=entries[i];if("."!==e.charAt(0)||this.dot){var instead=gspref.concat(entries[i],remainWithoutGlobStar);this._process(instead,index,!0);var below=gspref.concat(entries[i],remain);this._process(below,index,!0)}}}},GlobSync.prototype._processSimple=function(prefix,index){var exists=this._stat(prefix);if(this.matches[index]||(this.matches[index]=Object.create(null)),exists){if(prefix&&isAbsolute(prefix)&&!this.nomount){var trail=/[\/\\]$/.test(prefix);"/"===prefix.charAt(0)?prefix=path.join(this.root,prefix):(prefix=path.resolve(this.root,prefix),trail&&(prefix+="/"))}"win32"===process.platform&&(prefix=prefix.replace(/\\/g,"/")),this.matches[index][prefix]=!0}},GlobSync.prototype._stat=function(f){var abs=this._makeAbs(f),needDir="/"===f.slice(-1);if(f.length>this.maxLength)return!1;if(!this.stat&&ownProp(this.cache,abs)){var c=this.cache[abs];if(Array.isArray(c)&&(c="DIR"),!needDir||"DIR"===c)return c;if(needDir&&"FILE"===c)return!1}var stat=this.statCache[abs];if(!stat){var lstat;try{lstat=fs.lstatSync(abs)}catch(er){return!1}if(lstat.isSymbolicLink())try{stat=fs.statSync(abs)}catch(er){stat=lstat}else stat=lstat}this.statCache[abs]=stat;var c=stat.isDirectory()?"DIR":"FILE";return this.cache[abs]=this.cache[abs]||c,needDir&&"DIR"!==c?!1:c},GlobSync.prototype._mark=function(p){return common.mark(this,p)},GlobSync.prototype._makeAbs=function(f){return common.makeAbs(this,f)}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";var path=__webpack_require__(6),findIndex=__webpack_require__(177),flattenGlob=function(arr){for(var out=[],flat=!0,i=0;i<arr.length;i++){if("string"!=typeof arr[i]){flat=!1;break}out.push(arr[i])}return flat&&out.pop(),out},flattenExpansion=function(set){var first=set[0],toCompare=set.slice(1),idx=findIndex(first,function(v,idx){if("string"!=typeof v)return!0;var matched=toCompare.every(function(arr){return v===arr[idx]});return!matched});return first.slice(0,idx)},setToBase=function(set){return set.length<=1?flattenGlob(set[0]):flattenExpansion(set)};module.exports=function(glob){var set=glob.minimatch.set,baseParts=setToBase(set),basePath=path.normalize(baseParts.join(path.sep))+path.sep;return basePath}},function(module,exports,__webpack_require__){(function(process){function legacy(fs){function ReadStream(path,options){if(!(this instanceof ReadStream))return new ReadStream(path,options);Stream.call(this);var self=this;this.path=path,this.fd=null,this.readable=!0,this.paused=!1,this.flags="r",this.mode=438,this.bufferSize=65536,options=options||{};for(var keys=Object.keys(options),index=0,length=keys.length;length>index;index++){var key=keys[index];this[key]=options[key]}if(this.encoding&&this.setEncoding(this.encoding),void 0!==this.start){if("number"!=typeof this.start)throw TypeError("start must be a Number");if(void 0===this.end)this.end=1/0;else if("number"!=typeof this.end)throw TypeError("end must be a Number");if(this.start>this.end)throw new Error("start must be <= end");this.pos=this.start}return null!==this.fd?void process.nextTick(function(){self._read()}):void fs.open(this.path,this.flags,this.mode,function(err,fd){return err?(self.emit("error",err),void(self.readable=!1)):(self.fd=fd,self.emit("open",fd),void self._read())})}function WriteStream(path,options){if(!(this instanceof WriteStream))return new WriteStream(path,options);Stream.call(this),this.path=path,this.fd=null,this.writable=!0,this.flags="w",this.encoding="binary",this.mode=438,this.bytesWritten=0,options=options||{};for(var keys=Object.keys(options),index=0,length=keys.length;length>index;index++){var key=keys[index];this[key]=options[key]}if(void 0!==this.start){if("number"!=typeof this.start)throw TypeError("start must be a Number");if(this.start<0)throw new Error("start must be >= zero");this.pos=this.start}this.busy=!1,this._queue=[],null===this.fd&&(this._open=fs.open,this._queue.push([this._open,this.path,this.flags,this.mode,void 0]),this.flush())}return{ReadStream:ReadStream,WriteStream:WriteStream}}var Stream=__webpack_require__(3).Stream;module.exports=legacy}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function patch(fs){constants.hasOwnProperty("O_SYMLINK")&&process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)&&patchLchmod(fs),fs.lutimes||patchLutimes(fs),fs.chown=chownFix(fs.chown),fs.fchown=chownFix(fs.fchown),fs.lchown=chownFix(fs.lchown),fs.chmod=chownFix(fs.chmod),fs.fchmod=chownFix(fs.fchmod),fs.lchmod=chownFix(fs.lchmod),fs.chownSync=chownFixSync(fs.chownSync),fs.fchownSync=chownFixSync(fs.fchownSync),fs.lchownSync=chownFixSync(fs.lchownSync),fs.chmodSync=chownFix(fs.chmodSync),fs.fchmodSync=chownFix(fs.fchmodSync),fs.lchmodSync=chownFix(fs.lchmodSync),fs.lchmod||(fs.lchmod=function(path,mode,cb){process.nextTick(cb)},fs.lchmodSync=function(){}),fs.lchown||(fs.lchown=function(path,uid,gid,cb){process.nextTick(cb)},fs.lchownSync=function(){}),"win32"===process.platform&&(fs.rename=function(fs$rename){return function(from,to,cb){var start=Date.now();fs$rename(from,to,function CB(er){return er&&("EACCES"===er.code||"EPERM"===er.code)&&Date.now()-start<1e3?fs$rename(from,to,CB):void(cb&&cb(er))})}}(fs.rename)),fs.read=function(fs$read){return function(fd,buffer,offset,length,position,callback_){var callback;if(callback_&&"function"==typeof callback_){var eagCounter=0;callback=function(er,_,__){return er&&"EAGAIN"===er.code&&10>eagCounter?(eagCounter++,fs$read.call(fs,fd,buffer,offset,length,position,callback)):void callback_.apply(this,arguments)}}return fs$read.call(fs,fd,buffer,offset,length,position,callback)}}(fs.read),fs.readSync=function(fs$readSync){return function(fd,buffer,offset,length,position){for(var eagCounter=0;;)try{return fs$readSync.call(fs,fd,buffer,offset,length,position)}catch(er){if("EAGAIN"===er.code&&10>eagCounter){eagCounter++;continue}throw er}}}(fs.readSync)}function patchLchmod(fs){fs.lchmod=function(path,mode,callback){callback=callback||noop,fs.open(path,constants.O_WRONLY|constants.O_SYMLINK,mode,function(err,fd){return err?void callback(err):void fs.fchmod(fd,mode,function(err){fs.close(fd,function(err2){callback(err||err2)})})})},fs.lchmodSync=function(path,mode){var ret,fd=fs.openSync(path,constants.O_WRONLY|constants.O_SYMLINK,mode),threw=!0;try{ret=fs.fchmodSync(fd,mode),threw=!1}finally{if(threw)try{fs.closeSync(fd)}catch(er){}else fs.closeSync(fd)}return ret}}function patchLutimes(fs){constants.hasOwnProperty("O_SYMLINK")?(fs.lutimes=function(path,at,mt,cb){fs.open(path,constants.O_SYMLINK,function(er,fd){return cb=cb||noop,er?cb(er):void fs.futimes(fd,at,mt,function(er){fs.close(fd,function(er2){return cb(er||er2)})})})},fs.lutimesSync=function(path,at,mt){var ret,fd=fs.openSync(path,constants.O_SYMLINK),threw=!0;try{ret=fs.futimesSync(fd,at,mt),threw=!1}finally{if(threw)try{fs.closeSync(fd)}catch(er){}else fs.closeSync(fd)}return ret}):(fs.lutimes=function(_a,_b,_c,cb){process.nextTick(cb)},fs.lutimesSync=function(){})}function chownFix(orig){return orig?function(target,uid,gid,cb){return orig.call(fs,target,uid,gid,function(er,res){chownErOk(er)&&(er=null),cb(er,res)})}:orig}function chownFixSync(orig){return orig?function(target,uid,gid){try{return orig.call(fs,target,uid,gid)}catch(er){if(!chownErOk(er))throw er}}:orig}function chownErOk(er){if(!er)return!0;if("ENOSYS"===er.code)return!0;var nonroot=!process.getuid||0!==process.getuid();return!nonroot||"EINVAL"!==er.code&&"EPERM"!==er.code?!1:!0}var fs=__webpack_require__(67),constants=__webpack_require__(193),origCwd=process.cwd,cwd=null;process.cwd=function(){return cwd||(cwd=origCwd.call(process)),cwd};try{process.cwd()}catch(er){}var chdir=process.chdir;process.chdir=function(d){cwd=null,chdir.call(process,d)},module.exports=patch}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function DestroyableTransform(opts){Transform.call(this,opts),this._destroyed=!1}function noop(chunk,enc,callback){callback(null,chunk)}function through2(construct){return function(options,transform,flush){return"function"==typeof options&&(flush=transform,transform=options,options={}),"function"!=typeof transform&&(transform=noop),"function"!=typeof flush&&(flush=null),construct(options,transform,flush)}}var Transform=__webpack_require__(41),inherits=__webpack_require__(7).inherits,xtend=__webpack_require__(15);inherits(DestroyableTransform,Transform),DestroyableTransform.prototype.destroy=function(err){if(!this._destroyed){this._destroyed=!0;var self=this;process.nextTick(function(){err&&self.emit("error",err),self.emit("close")})}},module.exports=through2(function(options,transform,flush){var t2=new DestroyableTransform(options);return t2._transform=transform,flush&&(t2._flush=flush),t2}),module.exports.ctor=through2(function(options,transform,flush){function Through2(override){return this instanceof Through2?(this.options=xtend(options,override),void DestroyableTransform.call(this,this.options)):new Through2(override)}return inherits(Through2,DestroyableTransform),Through2.prototype._transform=transform,flush&&(Through2.prototype._flush=flush),Through2}),module.exports.obj=through2(function(options,transform,flush){var t2=new DestroyableTransform(xtend({objectMode:!0,highWaterMark:16},options));return t2._transform=transform,flush&&(t2._flush=flush),t2})}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){var http=__webpack_require__(83),https=module.exports;for(var key in http)http.hasOwnProperty(key)&&(https[key]=http[key]);https.request=function(params,cb){return params||(params={}),params.scheme="https",params.protocol="https:",http.request.call(this,params,cb)}},function(module,exports){exports.read=function(buffer,offset,isLE,mLen,nBytes){var e,m,eLen=8*nBytes-mLen-1,eMax=(1<<eLen)-1,eBias=eMax>>1,nBits=-7,i=isLE?nBytes-1:0,d=isLE?-1:1,s=buffer[offset+i];for(i+=d,e=s&(1<<-nBits)-1,s>>=-nBits,nBits+=eLen;nBits>0;e=256*e+buffer[offset+i],i+=d,nBits-=8);for(m=e&(1<<-nBits)-1,e>>=-nBits,nBits+=mLen;nBits>0;m=256*m+buffer[offset+i],i+=d,nBits-=8);if(0===e)e=1-eBias;else{if(e===eMax)return m?NaN:(s?-1:1)*(1/0);m+=Math.pow(2,mLen),e-=eBias}return(s?-1:1)*m*Math.pow(2,e-mLen)},exports.write=function(buffer,value,offset,isLE,mLen,nBytes){var e,m,c,eLen=8*nBytes-mLen-1,eMax=(1<<eLen)-1,eBias=eMax>>1,rt=23===mLen?Math.pow(2,-24)-Math.pow(2,-77):0,i=isLE?0:nBytes-1,d=isLE?1:-1,s=0>value||0===value&&0>1/value?1:0;for(value=Math.abs(value),isNaN(value)||value===1/0?(m=isNaN(value)?1:0,e=eMax):(e=Math.floor(Math.log(value)/Math.LN2),value*(c=Math.pow(2,-e))<1&&(e--,c*=2),value+=e+eBias>=1?rt/c:rt*Math.pow(2,1-eBias),value*c>=2&&(e++,c/=2),e+eBias>=eMax?(m=0,e=eMax):e+eBias>=1?(m=(value*c-1)*Math.pow(2,mLen),e+=eBias):(m=value*Math.pow(2,eBias-1)*Math.pow(2,mLen),e=0));mLen>=8;buffer[offset+i]=255&m,i+=d,m/=256,mLen-=8);for(e=e<<mLen|m,eLen+=mLen;eLen>0;buffer[offset+i]=255&e,i+=d,e/=256,eLen-=8);buffer[offset+i-d]|=128*s}},function(module,exports,__webpack_require__){(function(process){function inflight(key,cb){return reqs[key]?(reqs[key].push(cb),null):(reqs[key]=[cb],makeres(key))}function makeres(key){return once(function RES(){for(var cbs=reqs[key],len=cbs.length,args=slice(arguments),i=0;len>i;i++)cbs[i].apply(null,args);cbs.length>len?(cbs.splice(0,len),process.nextTick(function(){RES.apply(null,args)})):delete reqs[key]})}function slice(args){for(var length=args.length,array=[],i=0;length>i;i++)array[i]=args[i];return array}var wrappy=__webpack_require__(92),reqs=Object.create(null),once=__webpack_require__(37);module.exports=wrappy(inflight)}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function _normalizeFamily(family){return family?family.toLowerCase():"ipv4"}var ip=exports,Buffer=__webpack_require__(2).Buffer,os=__webpack_require__(76);ip.toBuffer=function(ip,buff,offset){offset=~~offset;var result;if(this.isV4Format(ip))result=buff||new Buffer(offset+4),ip.split(/\./g).map(function(byte){result[offset++]=255&parseInt(byte,10)});else if(this.isV6Format(ip)){var i,sections=ip.split(":",8);for(i=0;i<sections.length;i++){var v4Buffer,isv4=this.isV4Format(sections[i]);isv4&&(v4Buffer=this.toBuffer(sections[i]),sections[i]=v4Buffer.slice(0,2).toString("hex")),v4Buffer&&++i<8&&sections.splice(i,0,v4Buffer.slice(2,4).toString("hex"))}if(""===sections[0])for(;sections.length<8;)sections.unshift("0");else if(""===sections[sections.length-1])for(;sections.length<8;)sections.push("0");else if(sections.length<8){for(i=0;i<sections.length&&""!==sections[i];i++);var argv=[i,1];for(i=9-sections.length;i>0;i--)argv.push("0");sections.splice.apply(sections,argv)}for(result=buff||new Buffer(offset+16),i=0;i<sections.length;i++){var word=parseInt(sections[i],16);result[offset++]=word>>8&255,result[offset++]=255&word}}if(!result)throw Error("Invalid ip address: "+ip);return result},ip.toString=function(buff,offset,length){offset=~~offset,length=length||buff.length-offset;var result=[];if(4===length){for(var i=0;length>i;i++)result.push(buff[offset+i]);result=result.join(".")}else if(16===length){for(var i=0;length>i;i+=2)result.push(buff.readUInt16BE(offset+i).toString(16));result=result.join(":"),result=result.replace(/(^|:)0(:0)*:0(:|$)/,"$1::$3"),result=result.replace(/:{3,4}/,"::")}return result};var ipv4Regex=/^(\d{1,3}\.){3,3}\d{1,3}$/,ipv6Regex=/^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;ip.isV4Format=function(ip){return ipv4Regex.test(ip)},ip.isV6Format=function(ip){return ipv6Regex.test(ip)},ip.fromPrefixLen=function(prefixlen,family){family=prefixlen>32?"ipv6":_normalizeFamily(family);var len=4;"ipv6"===family&&(len=16);for(var buff=new Buffer(len),i=0,n=buff.length;n>i;++i){var bits=8;8>prefixlen&&(bits=prefixlen),prefixlen-=bits,buff[i]=~(255>>bits)}return ip.toString(buff)},ip.mask=function mask(addr,mask){addr=ip.toBuffer(addr),mask=ip.toBuffer(mask);var result=new Buffer(Math.max(addr.length,mask.length));if(addr.length===mask.length)for(var i=0;i<addr.length;i++)result[i]=addr[i]&mask[i];else if(4===mask.length)for(var i=0;i<mask.length;i++)result[i]=addr[addr.length-4+i]&mask[i];else{for(var i=0;i<result.length-6;i++)result[i]=0;result[10]=255,result[11]=255;for(var i=0;i<addr.length;i++)result[i+12]=addr[i]&mask[i+12]}return ip.toString(result)},ip.cidr=function(cidrString){var cidrParts=cidrString.split("/"),addr=cidrParts[0];if(2!==cidrParts.length)throw new Error("invalid CIDR subnet: "+addr);var mask=ip.fromPrefixLen(parseInt(cidrParts[1],10));return ip.mask(addr,mask)},ip.subnet=function(addr,mask){for(var networkAddress=ip.toLong(ip.mask(addr,mask)),maskBuffer=ip.toBuffer(mask),maskLength=0,i=0;i<maskBuffer.length;i++)if(255===maskBuffer[i])maskLength+=8;else for(var octet=255&maskBuffer[i];octet;)octet=octet<<1&255,maskLength++;var numberOfAddresses=Math.pow(2,32-maskLength);return{networkAddress:ip.fromLong(networkAddress),firstAddress:2>=numberOfAddresses?ip.fromLong(networkAddress):ip.fromLong(networkAddress+1),lastAddress:2>=numberOfAddresses?ip.fromLong(networkAddress+numberOfAddresses-1):ip.fromLong(networkAddress+numberOfAddresses-2),broadcastAddress:ip.fromLong(networkAddress+numberOfAddresses-1),subnetMask:mask,subnetMaskLength:maskLength,numHosts:2>=numberOfAddresses?numberOfAddresses:numberOfAddresses-2,length:numberOfAddresses,contains:function(other){return networkAddress===ip.toLong(ip.mask(other,mask))}}},ip.cidrSubnet=function(cidrString){var cidrParts=cidrString.split("/"),addr=cidrParts[0];if(2!==cidrParts.length)throw new Error("invalid CIDR subnet: "+addr);var mask=ip.fromPrefixLen(parseInt(cidrParts[1],10));return ip.subnet(addr,mask)},ip.not=function(addr){for(var buff=ip.toBuffer(addr),i=0;i<buff.length;i++)buff[i]=255^buff[i];return ip.toString(buff)},ip.or=function(a,b){if(a=ip.toBuffer(a),b=ip.toBuffer(b),a.length===b.length){for(var i=0;i<a.length;++i)a[i]|=b[i];return ip.toString(a)}var buff=a,other=b;b.length>a.length&&(buff=b,other=a);for(var offset=buff.length-other.length,i=offset;i<buff.length;++i)buff[i]|=other[i-offset];return ip.toString(buff)},ip.isEqual=function(a,b){if(a=ip.toBuffer(a),b=ip.toBuffer(b),a.length===b.length){for(var i=0;i<a.length;i++)if(a[i]!==b[i])return!1;return!0}if(4===b.length){var t=b;b=a,a=t}for(var i=0;10>i;i++)if(0!==b[i])return!1;var word=b.readUInt16BE(10);if(0!==word&&65535!==word)return!1;for(var i=0;4>i;i++)if(a[i]!==b[i+12])return!1;return!0},ip.isPrivate=function(addr){return/^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.test(addr)||/^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/.test(addr)||/^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/.test(addr)||/^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.test(addr)||/^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/.test(addr)||/^fc00:/i.test(addr)||/^fe80:/i.test(addr)||/^::1$/.test(addr)||/^::$/.test(addr)},ip.isPublic=function(addr){return!ip.isPrivate(addr)},ip.isLoopback=function(addr){return/^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr)||/^fe80::1$/.test(addr)||/^::1$/.test(addr)||/^::$/.test(addr)},ip.loopback=function(family){if(family=_normalizeFamily(family),"ipv4"!==family&&"ipv6"!==family)throw new Error("family must be ipv4 or ipv6");return"ipv4"===family?"127.0.0.1":"fe80::1"},ip.address=function(name,family){var all,interfaces=os.networkInterfaces();if(family=_normalizeFamily(family),name&&"private"!==name&&"public"!==name){var res=interfaces[name].filter(function(details){var itemFamily=details.family.toLowerCase();return itemFamily===family});if(0===res.length)return;return res[0].address}var all=Object.keys(interfaces).map(function(nic){var addresses=interfaces[nic].filter(function(details){return details.family=details.family.toLowerCase(),details.family!==family||ip.isLoopback(details.address)?!1:name?"public"===name?!ip.isPrivate(details.address):ip.isPrivate(details.address):!0});return addresses.length?addresses[0].address:void 0}).filter(Boolean);return all.length?all[0]:ip.loopback(family)},ip.toLong=function(ip){var ipl=0;return ip.split(".").forEach(function(octet){ipl<<=8,ipl+=parseInt(octet)}),ipl>>>0},ip.fromLong=function(ipl){return(ipl>>>24)+"."+(ipl>>16&255)+"."+(ipl>>8&255)+"."+(255&ipl)}},function(module,exports){/*!
   * is-extendable <https://github.com/jonschlinkert/is-extendable>
   *
   * Copyright (c) 2015, Jon Schlinkert.
   * Licensed under the MIT License.
   */
"use strict";module.exports=function(val){return"undefined"!=typeof val&&null!==val&&("object"==typeof val||"function"==typeof val)}},function(module,exports){"use strict";var isStream=module.exports=function(stream){return null!==stream&&"object"==typeof stream&&"function"==typeof stream.pipe};isStream.writable=function(stream){return isStream(stream)&&stream.writable!==!1&&"function"==typeof stream._write&&"object"==typeof stream._writableState},isStream.readable=function(stream){return isStream(stream)&&stream.readable!==!1&&"function"==typeof stream._read&&"object"==typeof stream._readableState},isStream.duplex=function(stream){return isStream.writable(stream)&&isStream.readable(stream)}},function(module,exports){exports=module.exports=function(bytes){for(var i=0;i<bytes.length;)if(9==bytes[i]||10==bytes[i]||13==bytes[i]||32<=bytes[i]&&bytes[i]<=126)i+=1;else if(194<=bytes[i]&&bytes[i]<=223&&128<=bytes[i+1]&&bytes[i+1]<=191)i+=2;else if(224==bytes[i]&&160<=bytes[i+1]&&bytes[i+1]<=191&&128<=bytes[i+2]&&bytes[i+2]<=191||(225<=bytes[i]&&bytes[i]<=236||238==bytes[i]||239==bytes[i])&&128<=bytes[i+1]&&bytes[i+1]<=191&&128<=bytes[i+2]&&bytes[i+2]<=191||237==bytes[i]&&128<=bytes[i+1]&&bytes[i+1]<=159&&128<=bytes[i+2]&&bytes[i+2]<=191)i+=3;else{if(!(240==bytes[i]&&144<=bytes[i+1]&&bytes[i+1]<=191&&128<=bytes[i+2]&&bytes[i+2]<=191&&128<=bytes[i+3]&&bytes[i+3]<=191||241<=bytes[i]&&bytes[i]<=243&&128<=bytes[i+1]&&bytes[i+1]<=191&&128<=bytes[i+2]&&bytes[i+2]<=191&&128<=bytes[i+3]&&bytes[i+3]<=191||244==bytes[i]&&128<=bytes[i+1]&&bytes[i+1]<=143&&128<=bytes[i+2]&&bytes[i+2]<=191&&128<=bytes[i+3]&&bytes[i+3]<=191))return!1;i+=4}return!0}},function(module,exports){"use strict";function every(arr){for(var len=arr.length;len--;)if("string"!=typeof arr[len]||arr[len].length<=0)return!1;return!0}module.exports=function(glob){return"string"==typeof glob&&glob.length>0?!0:Array.isArray(glob)?0!==glob.length&&every(glob):!1}},function(module,exports){module.exports={O_RDONLY:0,O_WRONLY:1,O_RDWR:2,S_IFMT:61440,S_IFREG:32768,S_IFDIR:16384,S_IFCHR:8192,S_IFBLK:24576,S_IFIFO:4096,S_IFLNK:40960,S_IFSOCK:49152,O_CREAT:512,O_EXCL:2048,O_NOCTTY:131072,O_TRUNC:1024,O_APPEND:8,O_DIRECTORY:1048576,O_NOFOLLOW:256,O_SYNC:128,O_SYMLINK:2097152,S_IRWXU:448,S_IRUSR:256,S_IWUSR:128,S_IXUSR:64,S_IRWXG:56,S_IRGRP:32,S_IWGRP:16,S_IXGRP:8,S_IRWXO:7,S_IROTH:4,S_IWOTH:2,S_IXOTH:1,E2BIG:7,EACCES:13,EADDRINUSE:48,EADDRNOTAVAIL:49,EAFNOSUPPORT:47,EAGAIN:35,EALREADY:37,EBADF:9,EBADMSG:94,EBUSY:16,ECANCELED:89,ECHILD:10,ECONNABORTED:53,ECONNREFUSED:61,ECONNRESET:54,EDEADLK:11,EDESTADDRREQ:39,EDOM:33,EDQUOT:69,EEXIST:17,EFAULT:14,EFBIG:27,EHOSTUNREACH:65,EIDRM:90,EILSEQ:92,EINPROGRESS:36,EINTR:4,EINVAL:22,EIO:5,EISCONN:56,EISDIR:21,ELOOP:62,EMFILE:24,EMLINK:31,EMSGSIZE:40,EMULTIHOP:95,ENAMETOOLONG:63,ENETDOWN:50,ENETRESET:52,ENETUNREACH:51,ENFILE:23,ENOBUFS:55,ENODATA:96,ENODEV:19,ENOENT:2,ENOEXEC:8,ENOLCK:77,ENOLINK:97,ENOMEM:12,ENOMSG:91,ENOPROTOOPT:42,ENOSPC:28,ENOSR:98,ENOSTR:99,ENOSYS:78,ENOTCONN:57,ENOTDIR:20,ENOTEMPTY:66,ENOTSOCK:38,ENOTSUP:45,ENOTTY:25,ENXIO:6,EOPNOTSUPP:102,EOVERFLOW:84,EPERM:1,EPIPE:32,EPROTO:100,EPROTONOSUPPORT:43,EPROTOTYPE:41,ERANGE:34,EROFS:30,ESPIPE:29,ESRCH:3,ESTALE:70,ETIME:101,ETIMEDOUT:60,ETXTBSY:26,EWOULDBLOCK:35,EXDEV:18,SIGHUP:1,SIGINT:2,SIGQUIT:3,SIGILL:4,SIGTRAP:5,SIGABRT:6,SIGIOT:6,SIGBUS:10,SIGFPE:8,SIGKILL:9,SIGUSR1:30,SIGSEGV:11,SIGUSR2:31,SIGPIPE:13,SIGALRM:14,SIGTERM:15,SIGCHLD:20,SIGCONT:19,SIGSTOP:17,SIGTSTP:18,SIGTTIN:21,SIGTTOU:22,SIGURG:16,SIGXCPU:24,SIGXFSZ:25,SIGVTALRM:26,SIGPROF:27,SIGWINCH:28,SIGIO:23,SIGSYS:12,SSL_OP_ALL:2147486719,SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION:262144,SSL_OP_CIPHER_SERVER_PREFERENCE:4194304,SSL_OP_CISCO_ANYCONNECT:32768,SSL_OP_COOKIE_EXCHANGE:8192,SSL_OP_CRYPTOPRO_TLSEXT_BUG:2147483648,SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS:2048,SSL_OP_EPHEMERAL_RSA:2097152,SSL_OP_LEGACY_SERVER_CONNECT:4,SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER:32,SSL_OP_MICROSOFT_SESS_ID_BUG:1,SSL_OP_MSIE_SSLV2_RSA_PADDING:64,SSL_OP_NETSCAPE_CA_DN_BUG:536870912,SSL_OP_NETSCAPE_CHALLENGE_BUG:2,SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG:1073741824,SSL_OP_NETSCAPE_REUSE_CIPHER_CHANGE_BUG:8,SSL_OP_NO_COMPRESSION:131072,SSL_OP_NO_QUERY_MTU:4096,SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION:65536,SSL_OP_NO_SSLv2:16777216,SSL_OP_NO_SSLv3:33554432,SSL_OP_NO_TICKET:16384,SSL_OP_NO_TLSv1:67108864,SSL_OP_NO_TLSv1_1:268435456,SSL_OP_NO_TLSv1_2:134217728,SSL_OP_PKCS1_CHECK_1:0,SSL_OP_PKCS1_CHECK_2:0,SSL_OP_SINGLE_DH_USE:1048576,SSL_OP_SINGLE_ECDH_USE:524288,SSL_OP_SSLEAY_080_CLIENT_DH_BUG:128,SSL_OP_SSLREF2_REUSE_CERT_TYPE_BUG:16,SSL_OP_TLS_BLOCK_PADDING_BUG:512,SSL_OP_TLS_D5_BUG:256,SSL_OP_TLS_ROLLBACK_BUG:8388608,NPN_ENABLED:1}},function(module,exports){module.exports={name:"ipfs-api",version:"2.10.1",description:"A client library for the IPFS API",main:"src/index.js",dependencies:{"merge-stream":"^1.0.0",multiaddr:"^1.0.0","multipart-stream":"^2.0.0",ndjson:"^1.4.3",qs:"^6.0.0","require-dir":"^0.3.0",vinyl:"^1.1.0","vinyl-fs-browser":"^2.1.1-1","vinyl-multipart-stream":"^1.2.6",wreck:"^7.0.0"},engines:{node:">=4.2.2"},repository:{type:"git",url:"https://github.com/ipfs/js-ipfs-api"},devDependencies:{"babel-core":"^6.1.21","babel-eslint":"^4.1.6","babel-loader":"^6.2.0","babel-plugin-transform-runtime":"^6.1.18","babel-preset-es2015":"^6.0.15","babel-runtime":"^5.8.34",chai:"^3.4.1",concurrently:"^1.0.0","eslint-config-standard":"^4.4.0","eslint-plugin-standard":"^1.3.1","glob-stream":"5.3.1",gulp:"^3.9.0","gulp-bump":"^1.0.0","gulp-eslint":"^1.0.0","gulp-filter":"^3.0.1","gulp-git":"^1.6.0","gulp-load-plugins":"^1.0.0","gulp-mocha":"^2.1.3","gulp-size":"^2.0.0","gulp-tag-version":"^1.3.0","gulp-util":"^3.0.7","https-browserify":"0.0.1","ipfsd-ctl":"^0.7.1","json-loader":"^0.5.3",karma:"^0.13.11","karma-chrome-launcher":"^0.2.1","karma-firefox-launcher":"^0.1.7","karma-mocha":"^0.2.0","karma-mocha-reporter":"^1.1.1","karma-sauce-launcher":"^0.3.0","karma-webpack":"^1.7.0",mocha:"^2.3.3","pre-commit":"^1.0.6","raw-loader":"^0.5.1",rimraf:"^2.4.5","run-sequence":"^1.1.4",semver:"^5.1.0","stream-equal":"^0.1.7","stream-http":"^2.1.0","uglify-js":"^2.4.24","vinyl-buffer":"^1.0.0","vinyl-source-stream":"^1.1.0","webpack-stream":"^3.1.0"},scripts:{test:"gulp test","test:node":"gulp test:node","test:browser":"gulp test:browser",lint:"gulp lint",build:"gulp build"},"pre-commit":["lint","test"],keywords:["ipfs"],author:"Matt Bell <mappum@gmail.com>",contributors:["Travis Person <travis.person@gmail.com>","Jeromy Jonson <why@ipfs.io>","David Dias <daviddias@ipfs.io>","Juan Benet <juanbenet@ipfs.io>","Friedel Ziegelmayer <dignifiedquire@gmail.com>"],license:"MIT",bugs:{url:"https://github.com/ipfs/js-ipfs-api/issues"},homepage:"https://github.com/ipfs/js-ipfs-api"}},function(module,exports){function arrayFilter(array,predicate){for(var index=-1,length=array.length,resIndex=-1,result=[];++index<length;){var value=array[index];predicate(value,index,array)&&(result[++resIndex]=value)}return result}module.exports=arrayFilter},function(module,exports){function arrayMap(array,iteratee){for(var index=-1,length=array.length,result=Array(length);++index<length;)result[index]=iteratee(array[index],index,array);return result}module.exports=arrayMap},function(module,exports,__webpack_require__){function baseFilter(collection,predicate){var result=[];return baseEach(collection,function(value,index,collection){predicate(value,index,collection)&&result.push(value)}),result}var baseEach=__webpack_require__(70);module.exports=baseFilter},function(module,exports,__webpack_require__){function isObjectLike(value){return!!value&&"object"==typeof value}function arraySome(array,predicate){for(var index=-1,length=array.length;++index<length;)if(predicate(array[index],index,array))return!0;return!1}function baseIsEqual(value,other,customizer,isLoose,stackA,stackB){return value===other?!0:null==value||null==other||!isObject(value)&&!isObjectLike(other)?value!==value&&other!==other:baseIsEqualDeep(value,other,baseIsEqual,customizer,isLoose,stackA,stackB)}function baseIsEqualDeep(object,other,equalFunc,customizer,isLoose,stackA,stackB){var objIsArr=isArray(object),othIsArr=isArray(other),objTag=arrayTag,othTag=arrayTag;objIsArr||(objTag=objToString.call(object),objTag==argsTag?objTag=objectTag:objTag!=objectTag&&(objIsArr=isTypedArray(object))),othIsArr||(othTag=objToString.call(other),othTag==argsTag?othTag=objectTag:othTag!=objectTag&&(othIsArr=isTypedArray(other)));var objIsObj=objTag==objectTag,othIsObj=othTag==objectTag,isSameTag=objTag==othTag;if(isSameTag&&!objIsArr&&!objIsObj)return equalByTag(object,other,objTag);if(!isLoose){var objIsWrapped=objIsObj&&hasOwnProperty.call(object,"__wrapped__"),othIsWrapped=othIsObj&&hasOwnProperty.call(other,"__wrapped__");if(objIsWrapped||othIsWrapped)return equalFunc(objIsWrapped?object.value():object,othIsWrapped?other.value():other,customizer,isLoose,stackA,stackB)}if(!isSameTag)return!1;stackA||(stackA=[]),stackB||(stackB=[]);for(var length=stackA.length;length--;)if(stackA[length]==object)return stackB[length]==other;stackA.push(object),stackB.push(other);var result=(objIsArr?equalArrays:equalObjects)(object,other,equalFunc,customizer,isLoose,stackA,stackB);return stackA.pop(),stackB.pop(),result}function equalArrays(array,other,equalFunc,customizer,isLoose,stackA,stackB){var index=-1,arrLength=array.length,othLength=other.length;if(arrLength!=othLength&&!(isLoose&&othLength>arrLength))return!1;for(;++index<arrLength;){var arrValue=array[index],othValue=other[index],result=customizer?customizer(isLoose?othValue:arrValue,isLoose?arrValue:othValue,index):void 0;if(void 0!==result){if(result)continue;return!1}if(isLoose){if(!arraySome(other,function(othValue){return arrValue===othValue||equalFunc(arrValue,othValue,customizer,isLoose,stackA,stackB)}))return!1}else if(arrValue!==othValue&&!equalFunc(arrValue,othValue,customizer,isLoose,stackA,stackB))return!1}return!0}function equalByTag(object,other,tag){switch(tag){case boolTag:case dateTag:return+object==+other;case errorTag:return object.name==other.name&&object.message==other.message;case numberTag:return object!=+object?other!=+other:object==+other;case regexpTag:case stringTag:return object==other+""}return!1}function equalObjects(object,other,equalFunc,customizer,isLoose,stackA,stackB){var objProps=keys(object),objLength=objProps.length,othProps=keys(other),othLength=othProps.length;if(objLength!=othLength&&!isLoose)return!1;for(var index=objLength;index--;){var key=objProps[index];if(!(isLoose?key in other:hasOwnProperty.call(other,key)))return!1}for(var skipCtor=isLoose;++index<objLength;){key=objProps[index];var objValue=object[key],othValue=other[key],result=customizer?customizer(isLoose?othValue:objValue,isLoose?objValue:othValue,key):void 0;if(!(void 0===result?equalFunc(objValue,othValue,customizer,isLoose,stackA,stackB):result))return!1;skipCtor||(skipCtor="constructor"==key)}if(!skipCtor){var objCtor=object.constructor,othCtor=other.constructor;if(objCtor!=othCtor&&"constructor"in object&&"constructor"in other&&!("function"==typeof objCtor&&objCtor instanceof objCtor&&"function"==typeof othCtor&&othCtor instanceof othCtor))return!1}return!0}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}var isArray=__webpack_require__(20),isTypedArray=__webpack_require__(203),keys=__webpack_require__(34),argsTag="[object Arguments]",arrayTag="[object Array]",boolTag="[object Boolean]",dateTag="[object Date]",errorTag="[object Error]",numberTag="[object Number]",objectTag="[object Object]",regexpTag="[object RegExp]",stringTag="[object String]",objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString;module.exports=baseIsEqual},function(module,exports){function bindCallback(func,thisArg,argCount){if("function"!=typeof func)return identity;if(void 0===thisArg)return func;switch(argCount){case 1:return function(value){return func.call(thisArg,value)};case 3:return function(value,index,collection){return func.call(thisArg,value,index,collection)};case 4:return function(accumulator,value,index,collection){return func.call(thisArg,accumulator,value,index,collection)};case 5:return function(value,other,key,object,source){return func.call(thisArg,value,other,key,object,source)}}return function(){return func.apply(thisArg,arguments)}}function identity(value){return value}module.exports=bindCallback},function(module,exports){function isObjectLike(value){return!!value&&"object"==typeof value}function getNative(object,key){var value=null==object?void 0:object[key];return isNative(value)?value:void 0}function isFunction(value){return isObject(value)&&objToString.call(value)==funcTag}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}function isNative(value){return null==value?!1:isFunction(value)?reIsNative.test(fnToString.call(value)):isObjectLike(value)&&reIsHostCtor.test(value)}var funcTag="[object Function]",reIsHostCtor=/^\[object .+?Constructor\]$/,objectProto=Object.prototype,fnToString=Function.prototype.toString,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString,reIsNative=RegExp("^"+fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");module.exports=getNative},function(module,exports,__webpack_require__){function filter(collection,predicate,thisArg){var func=isArray(collection)?arrayFilter:baseFilter;return predicate=baseCallback(predicate,thisArg,3),func(collection,predicate)}var arrayFilter=__webpack_require__(195),baseCallback=__webpack_require__(69),baseFilter=__webpack_require__(197),isArray=__webpack_require__(20);module.exports=filter},function(module,exports){function isObjectLike(value){return!!value&&"object"==typeof value}function baseProperty(key){return function(object){return null==object?void 0:object[key]}}function isArrayLike(value){return null!=value&&isLength(getLength(value))}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function isArguments(value){return isObjectLike(value)&&isArrayLike(value)&&hasOwnProperty.call(value,"callee")&&!propertyIsEnumerable.call(value,"callee")}var objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,propertyIsEnumerable=objectProto.propertyIsEnumerable,MAX_SAFE_INTEGER=9007199254740991,getLength=baseProperty("length");module.exports=isArguments},function(module,exports){function isObjectLike(value){return!!value&&"object"==typeof value}function isLength(value){return"number"==typeof value&&value>-1&&value%1==0&&MAX_SAFE_INTEGER>=value}function isTypedArray(value){return isObjectLike(value)&&isLength(value.length)&&!!typedArrayTags[objToString.call(value)]}var argsTag="[object Arguments]",arrayTag="[object Array]",boolTag="[object Boolean]",dateTag="[object Date]",errorTag="[object Error]",funcTag="[object Function]",mapTag="[object Map]",numberTag="[object Number]",objectTag="[object Object]",regexpTag="[object RegExp]",setTag="[object Set]",stringTag="[object String]",weakMapTag="[object WeakMap]",arrayBufferTag="[object ArrayBuffer]",float32Tag="[object Float32Array]",float64Tag="[object Float64Array]",int8Tag="[object Int8Array]",int16Tag="[object Int16Array]",int32Tag="[object Int32Array]",uint8Tag="[object Uint8Array]",uint8ClampedTag="[object Uint8ClampedArray]",uint16Tag="[object Uint16Array]",uint32Tag="[object Uint32Array]",typedArrayTags={};typedArrayTags[float32Tag]=typedArrayTags[float64Tag]=typedArrayTags[int8Tag]=typedArrayTags[int16Tag]=typedArrayTags[int32Tag]=typedArrayTags[uint8Tag]=typedArrayTags[uint8ClampedTag]=typedArrayTags[uint16Tag]=typedArrayTags[uint32Tag]=!0,typedArrayTags[argsTag]=typedArrayTags[arrayTag]=typedArrayTags[arrayBufferTag]=typedArrayTags[boolTag]=typedArrayTags[dateTag]=typedArrayTags[errorTag]=typedArrayTags[funcTag]=typedArrayTags[mapTag]=typedArrayTags[numberTag]=typedArrayTags[objectTag]=typedArrayTags[regexpTag]=typedArrayTags[setTag]=typedArrayTags[stringTag]=typedArrayTags[weakMapTag]=!1;var objectProto=Object.prototype,objToString=objectProto.toString,MAX_SAFE_INTEGER=9007199254740991;module.exports=isTypedArray},function(module,exports,__webpack_require__){function toObject(value){return isObject(value)?value:Object(value)}function isObject(value){var type=typeof value;return!!value&&("object"==type||"function"==type)}function pairs(object){object=toObject(object);for(var index=-1,props=keys(object),length=props.length,result=Array(length);++index<length;){var key=props[index];result[index]=[key,object[key]]}return result}var keys=__webpack_require__(34);module.exports=pairs},function(module,exports,__webpack_require__){(function(Buffer){function stringToStringTuples(str){var tuples=[],parts=str.split("/").slice(1);if(1===parts.length&&""===parts[0])return[];for(var p=0;p<parts.length;p++){var part=parts[p],proto=protocols(part);if(0===proto.size)return[part];if(p++,p>=parts.length)throw ParseError("invalid address: "+str);tuples.push([part,parts[p]])}return tuples}function stringTuplesToString(tuples){var parts=[];return map(tuples,function(tup){var proto=protoFromTuple(tup);parts.push(proto.name),tup.length>1&&parts.push(tup[1])}),"/"+parts.join("/")}function stringTuplesToTuples(tuples){return map(tuples,function(tup){var proto=protoFromTuple(tup);return tup.length>1?[proto.code,convert.toBuffer(proto.code,tup[1])]:[proto.code]})}function tuplesToStringTuples(tuples){return map(tuples,function(tup){var proto=protoFromTuple(tup);return tup.length>1?[proto.code,convert.toString(proto.code,tup[1])]:[proto.code]})}function tuplesToBuffer(tuples){return fromBuffer(Buffer.concat(map(tuples,function(tup){var proto=protoFromTuple(tup),buf=new Buffer([proto.code]);return tup.length>1&&(buf=Buffer.concat([buf,tup[1]])),buf})))}function bufferToTuples(buf){for(var tuples=[],i=0;i<buf.length;){var code=buf[i],proto=protocols(code);if(!proto)throw ParseError("Invalid protocol code: "+code);var size=proto.size/8;code=0+buf[i];var addr=buf.slice(i+1,i+1+size);if(i+=1+size,i>buf.length)throw ParseError("Invalid address buffer: "+buf.toString("hex"));tuples.push([code,addr])}return tuples}function bufferToString(buf){var a=bufferToTuples(buf),b=tuplesToStringTuples(a);return stringTuplesToString(b)}function stringToBuffer(str){str=cleanPath(str);var a=stringToStringTuples(str),b=stringTuplesToTuples(a);return tuplesToBuffer(b)}function fromString(str){return stringToBuffer(str)}function fromBuffer(buf){var err=validateBuffer(buf);if(err)throw err;return new Buffer(buf)}function validateBuffer(buf){bufferToTuples(buf)}function isValidBuffer(buf){try{return validateBuffer(buf),!0}catch(e){return!1}}function cleanPath(str){return"/"+filter(str.trim().split("/")).join("/")}function ParseError(str){return new Error("Error parsing address: "+str)}function protoFromTuple(tup){var proto=protocols(tup[0]);if(tup.length>1&&0===proto.size)throw ParseError("tuple has address but protocol size is 0");return proto}var map=__webpack_require__(35),filter=__webpack_require__(201),convert=__webpack_require__(206),protocols=__webpack_require__(36);module.exports={stringToStringTuples:stringToStringTuples,stringTuplesToString:stringTuplesToString,tuplesToStringTuples:tuplesToStringTuples,stringTuplesToTuples:stringTuplesToTuples,bufferToTuples:bufferToTuples,tuplesToBuffer:tuplesToBuffer,bufferToString:bufferToString,stringToBuffer:stringToBuffer,fromString:fromString,fromBuffer:fromBuffer,validateBuffer:validateBuffer,isValidBuffer:isValidBuffer,cleanPath:cleanPath,ParseError:ParseError,protoFromTuple:protoFromTuple}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(Buffer){function Convert(proto,a){return a instanceof Buffer?Convert.toString(proto,a):Convert.toBuffer(proto,a)}function port2buf(port){var buf=new Buffer(2);return buf.writeUInt16BE(port,0),buf}function buf2port(buf){return buf.readUInt16BE(0)}var ip=__webpack_require__(188),protocols=__webpack_require__(36);module.exports=Convert,Convert.toString=function(proto,buf){switch(proto=protocols(proto),proto.code){case 4:case 41:return ip.toString(buf);case 6:case 17:case 33:case 132:return buf2port(buf)}return buf.toString("hex")},Convert.toBuffer=function(proto,str){switch(proto=protocols(proto),proto.code){case 4:case 41:return ip.toBuffer(str);case 6:case 17:case 33:case 132:return port2buf(parseInt(str,10))}return new Buffer(str,"hex")}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){(function(Buffer){function Multiaddr(addr){if(!(this instanceof Multiaddr))return new Multiaddr(addr);if(addr||(addr=""),addr instanceof Buffer)this.buffer=codec.fromBuffer(addr);else if("string"==typeof addr||addr instanceof String)this.buffer=codec.fromString(addr);else{if(!(addr.buffer&&addr.protos&&addr.protoCodes))throw new Error("addr must be a string, Buffer, or Multiaddr");this.buffer=codec.fromBuffer(addr.buffer)}}var map=__webpack_require__(35),extend=__webpack_require__(15),codec=__webpack_require__(205),bufeq=__webpack_require__(133),protocols=__webpack_require__(36),NotImplemented=new Error("Sorry, Not Implemented Yet.");exports=module.exports=Multiaddr,exports.Buffer=Buffer,Multiaddr.prototype.toString=function(){return codec.bufferToString(this.buffer)},Multiaddr.prototype.toOptions=function(){var opts={},parsed=this.toString().split("/");return opts.family="ip4"===parsed[1]?"ipv4":"ipv6",opts.host=parsed[2],opts.port=parsed[4],opts},Multiaddr.prototype.inspect=function(){return"<Mutliaddr "+this.buffer.toString("hex")+" - "+codec.bufferToString(this.buffer)+">"},Multiaddr.prototype.protos=function(){return map(this.protoCodes(),function(code){return extend(protocols(code))})},Multiaddr.prototype.protos=function(){return map(this.protoCodes(),function(code){return extend(protocols(code))})},Multiaddr.prototype.protoCodes=function(){for(var codes=[],i=0;i<this.buffer.length;i++){var code=0+this.buffer[i],size=protocols(code).size/8;i+=size,codes.push(code)}return codes},Multiaddr.prototype.protoNames=function(){return map(this.protos(),function(proto){return proto.name})},Multiaddr.prototype.tuples=function(){return codec.bufferToTuples(this.buffer)},Multiaddr.prototype.stringTuples=function(){var t=codec.bufferToTuples(this.buffer);return codec.tuplesToStringTuples(t)},Multiaddr.prototype.encapsulate=function(addr){return addr=Multiaddr(addr),Multiaddr(this.toString()+addr.toString())},Multiaddr.prototype.decapsulate=function(addr){addr=addr.toString();var s=this.toString(),i=s.lastIndexOf(addr);if(0>i)throw new Error("Address "+this+" does not contain subaddress: "+addr);return Multiaddr(s.slice(0,i))},Multiaddr.prototype.equals=function(addr){return bufeq(this.buffer,addr.buffer)},Multiaddr.prototype.nodeAddress=function(){if(!this.isThinWaistAddress())throw new Error('Multiaddr must be "thin waist" address for nodeAddress.');var codes=this.protoCodes(),parts=this.toString().split("/").slice(1);return{family:41===codes[0]?"IPv6":"IPv4",address:parts[1],port:parts[3]}},Multiaddr.fromNodeAddress=function(addr,transport){if(!addr)throw new Error("requires node address object");if(!transport)throw new Error("requires transport protocol");var ip="IPv6"===addr.family?"ip6":"ip4";return Multiaddr("/"+[ip,addr.address,transport,addr.port].join("/"))},Multiaddr.prototype.isThinWaistAddress=function(addr){var protos=(addr||this).protos();return 2!==protos.length?!1:4!==protos[0].code&&41!==protos[0].code?!1:6!==protos[1].code&&17!==protos[1].code?!1:!0},Multiaddr.prototype.fromStupidString=function(str){throw NotImplemented},Multiaddr.protocols=protocols}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){function addStream(streams,stream){if(!isReadable(stream))throw new Error("All input streams must be readable");var self=this;stream._buffer=[],stream.on("readable",function(){var chunk=stream.read();null!==chunk&&(this===streams[0]?self.push(chunk):this._buffer.push(chunk))}),stream.on("end",function(){for(var stream=streams[0];stream&&stream._readableState.ended;stream=streams[0]){for(;stream._buffer.length;)self.push(stream._buffer.shift());streams.shift()}streams.length||self.push(null)}),stream.on("error",this.emit.bind(this,"error")),streams.push(stream)}function OrderedStreams(streams,options){if(!(this instanceof OrderedStreams))return new OrderedStreams(streams,options);if(streams=streams||[],options=options||{},options.objectMode=!0,Readable.call(this,options),Array.isArray(streams)||(streams=[streams]),!streams.length)return this.push(null);var addStream_bind=addStream.bind(this,[]);streams.forEach(function(item){Array.isArray(item)?item.forEach(addStream_bind):addStream_bind(item)})}var Readable=__webpack_require__(80),isReadable=__webpack_require__(190).readable,util=__webpack_require__(7);util.inherits(OrderedStreams,Readable),OrderedStreams.prototype._read=function(){},module.exports=OrderedStreams},function(module,exports,__webpack_require__){(function(Buffer){module.exports=function(crypto){function pbkdf2(password,salt,iterations,keylen,digest,callback){if("function"==typeof digest&&(callback=digest,digest=void 0),"function"!=typeof callback)throw new Error("No callback provided to pbkdf2");setTimeout(function(){var result;try{result=pbkdf2Sync(password,salt,iterations,keylen,digest)}catch(e){return callback(e)}callback(void 0,result)})}function pbkdf2Sync(password,salt,iterations,keylen,digest){if("number"!=typeof iterations)throw new TypeError("Iterations not a number");if(0>iterations)throw new TypeError("Bad iterations");if("number"!=typeof keylen)throw new TypeError("Key length not a number");if(0>keylen)throw new TypeError("Bad key length");digest=digest||"sha1",Buffer.isBuffer(password)||(password=new Buffer(password)),Buffer.isBuffer(salt)||(salt=new Buffer(salt));var hLen,r,T,l=1,DK=new Buffer(keylen),block1=new Buffer(salt.length+4);salt.copy(block1,0,0,salt.length);for(var i=1;l>=i;i++){block1.writeUInt32BE(i,salt.length);var U=crypto.createHmac(digest,password).update(block1).digest();if(!hLen&&(hLen=U.length,T=new Buffer(hLen),l=Math.ceil(keylen/hLen),r=keylen-(l-1)*hLen,keylen>(Math.pow(2,32)-1)*hLen))throw new TypeError("keylen exceeds maximum length");U.copy(T,0,0,hLen);for(var j=1;iterations>j;j++){U=crypto.createHmac(digest,password).update(U).digest();for(var k=0;hLen>k;k++)T[k]^=U[k]}var destPos=(i-1)*hLen,len=i==l?r:hLen;T.copy(DK,destPos,0,len)}return DK}return{pbkdf2:pbkdf2,pbkdf2Sync:pbkdf2Sync}}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports){"use strict";function hasOwnProperty(obj,prop){return Object.prototype.hasOwnProperty.call(obj,prop)}module.exports=function(qs,sep,eq,options){sep=sep||"&",eq=eq||"=";var obj={};if("string"!=typeof qs||0===qs.length)return obj;var regexp=/\+/g;qs=qs.split(sep);var maxKeys=1e3;options&&"number"==typeof options.maxKeys&&(maxKeys=options.maxKeys);var len=qs.length;maxKeys>0&&len>maxKeys&&(len=maxKeys);for(var i=0;len>i;++i){var kstr,vstr,k,v,x=qs[i].replace(regexp,"%20"),idx=x.indexOf(eq);idx>=0?(kstr=x.substr(0,idx),vstr=x.substr(idx+1)):(kstr=x,vstr=""),k=decodeURIComponent(kstr),v=decodeURIComponent(vstr),hasOwnProperty(obj,k)?Array.isArray(obj[k])?obj[k].push(v):obj[k]=[obj[k],v]:obj[k]=v}return obj}},function(module,exports){"use strict";var stringifyPrimitive=function(v){switch(typeof v){case"string":return v;case"boolean":return v?"true":"false";case"number":return isFinite(v)?v:"";default:return""}};module.exports=function(obj,sep,eq,name){return sep=sep||"&",eq=eq||"=",null===obj&&(obj=void 0),"object"==typeof obj?Object.keys(obj).map(function(k){var ks=encodeURIComponent(stringifyPrimitive(k))+eq;return Array.isArray(obj[k])?obj[k].map(function(v){return ks+encodeURIComponent(stringifyPrimitive(v))}).join(sep):ks+encodeURIComponent(stringifyPrimitive(obj[k]))}).join(sep):name?encodeURIComponent(stringifyPrimitive(name))+eq+encodeURIComponent(stringifyPrimitive(obj)):""}},function(module,exports,__webpack_require__){"use strict";exports.decode=exports.parse=__webpack_require__(210),exports.encode=exports.stringify=__webpack_require__(211)},function(module,exports,__webpack_require__){module.exports=__webpack_require__(77)},function(module,exports,__webpack_require__){var path=__webpack_require__(6);module.exports=function(npath,ext){if("string"!=typeof npath)return npath;if(0===npath.length)return npath;var nFileName=path.basename(npath,path.extname(npath))+ext;return path.join(path.dirname(npath),nFileName)}},function(module,exports,__webpack_require__){(function(Buffer){function f1(x,y,z){return x^y^z}function f2(x,y,z){return x&y|~x&z}function f3(x,y,z){return(x|~y)^z}function f4(x,y,z){return x&z|y&~z}function f5(x,y,z){return x^(y|~z)}function rotl(x,n){return x<<n|x>>>32-n}function ripemd160(message){var H=[1732584193,4023233417,2562383102,271733878,3285377520];"string"==typeof message&&(message=new Buffer(message,"utf8"));var m=bytesToWords(message),nBitsLeft=8*message.length,nBitsTotal=8*message.length;m[nBitsLeft>>>5]|=128<<24-nBitsLeft%32,m[(nBitsLeft+64>>>9<<4)+14]=16711935&(nBitsTotal<<8|nBitsTotal>>>24)|4278255360&(nBitsTotal<<24|nBitsTotal>>>8);for(var i=0;i<m.length;i+=16)processBlock(H,m,i);for(var i=0;5>i;i++){var H_i=H[i];H[i]=16711935&(H_i<<8|H_i>>>24)|4278255360&(H_i<<24|H_i>>>8)}var digestbytes=wordsToBytes(H);return new Buffer(digestbytes)}module.exports=ripemd160;/** @preserve
  (c) 2012 by Cédric Mesnil. All rights reserved.
  
  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
  
      - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
      - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
  
  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
var zl=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13],zr=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11],sl=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6],sr=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11],hl=[0,1518500249,1859775393,2400959708,2840853838],hr=[1352829926,1548603684,1836072691,2053994217,0],bytesToWords=function(bytes){for(var words=[],i=0,b=0;i<bytes.length;i++,b+=8)words[b>>>5]|=bytes[i]<<24-b%32;return words},wordsToBytes=function(words){for(var bytes=[],b=0;b<32*words.length;b+=8)bytes.push(words[b>>>5]>>>24-b%32&255);return bytes},processBlock=function(H,M,offset){for(var i=0;16>i;i++){var offset_i=offset+i,M_offset_i=M[offset_i];M[offset_i]=16711935&(M_offset_i<<8|M_offset_i>>>24)|4278255360&(M_offset_i<<24|M_offset_i>>>8)}var al,bl,cl,dl,el,ar,br,cr,dr,er;ar=al=H[0],br=bl=H[1],cr=cl=H[2],dr=dl=H[3],er=el=H[4];for(var t,i=0;80>i;i+=1)t=al+M[offset+zl[i]]|0,t+=16>i?f1(bl,cl,dl)+hl[0]:32>i?f2(bl,cl,dl)+hl[1]:48>i?f3(bl,cl,dl)+hl[2]:64>i?f4(bl,cl,dl)+hl[3]:f5(bl,cl,dl)+hl[4],t=0|t,t=rotl(t,sl[i]),t=t+el|0,al=el,el=dl,dl=rotl(cl,10),cl=bl,bl=t,t=ar+M[offset+zr[i]]|0,t+=16>i?f5(br,cr,dr)+hr[0]:32>i?f4(br,cr,dr)+hr[1]:48>i?f3(br,cr,dr)+hr[2]:64>i?f2(br,cr,dr)+hr[3]:f1(br,cr,dr)+hr[4],t=0|t,t=rotl(t,sr[i]),t=t+er|0,ar=er,er=dr,dr=rotl(cr,10),cr=br,br=t;t=H[1]+cl+dr|0,H[1]=H[2]+dl+er|0,H[2]=H[3]+el+ar|0,H[3]=H[4]+al+br|0,H[4]=H[0]+bl+cr|0,H[0]=t}}).call(exports,__webpack_require__(2).Buffer)},function(module,exports,__webpack_require__){function SandwichStream(options){Readable.call(this,options),options=options||{},this._streamsActive=!1,this._streamsAdded=!1,this._streams=[],this._currentStream=void 0,this._errorsEmitted=!1,options.head&&(this._head=options.head),options.tail&&(this._tail=options.tail),options.separator&&(this._separator=options.separator)}function sandwichStream(options){var stream=new SandwichStream(options);return stream}var Readable=__webpack_require__(3).Readable;__webpack_require__(3).PassThrough;SandwichStream.prototype=Object.create(Readable.prototype,{constructor:SandwichStream}),SandwichStream.prototype._read=function(){this._streamsActive||(this._streamsActive=!0,this._pushHead(),this._streamNextStream())},SandwichStream.prototype.add=function(newStream){if(this._streamsActive)throw new Error("SandwichStream error adding new stream while streaming");this._streamsAdded=!0,this._streams.push(newStream),newStream.on("error",this._substreamOnError.bind(this))},SandwichStream.prototype._substreamOnError=function(error){this._errorsEmitted=!0,this.emit("error",error)},SandwichStream.prototype._pushHead=function(){this._head&&this.push(this._head)},SandwichStream.prototype._streamNextStream=function(){this._nextStream()?this._bindCurrentStreamEvents():(this._pushTail(),this.push(null))},SandwichStream.prototype._nextStream=function(){return this._currentStream=this._streams.shift(),void 0!==this._currentStream},SandwichStream.prototype._bindCurrentStreamEvents=function(){this._currentStream.on("readable",this._currentStreamOnReadable.bind(this)),this._currentStream.on("end",this._currentStreamOnEnd.bind(this))},SandwichStream.prototype._currentStreamOnReadable=function(){this.push(this._currentStream.read()||"")},SandwichStream.prototype._currentStreamOnEnd=function(){this._pushSeparator(),this._streamNextStream()},SandwichStream.prototype._pushSeparator=function(){this._streams.length>0&&this._separator&&this.push(this._separator)},SandwichStream.prototype._pushTail=function(){this._tail&&this.push(this._tail)},sandwichStream.SandwichStream=SandwichStream,module.exports=sandwichStream},function(module,exports){module.exports=function(Buffer){function Hash(blockSize,finalSize){this._block=new Buffer(blockSize),this._finalSize=finalSize,this._blockSize=blockSize,this._len=0,this._s=0}return Hash.prototype.init=function(){this._s=0,this._len=0},Hash.prototype.update=function(data,enc){"string"==typeof data&&(enc=enc||"utf8",data=new Buffer(data,enc));for(var l=this._len+=data.length,s=this._s=this._s||0,f=0,buffer=this._block;l>s;){for(var t=Math.min(data.length,f+this._blockSize-s%this._blockSize),ch=t-f,i=0;ch>i;i++)buffer[s%this._blockSize+i]=data[i+f];s+=ch,f+=ch,s%this._blockSize===0&&this._update(buffer)}return this._s=s,this},Hash.prototype.digest=function(enc){var l=8*this._len;this._block[this._len%this._blockSize]=128,this._block.fill(0,this._len%this._blockSize+1),l%(8*this._blockSize)>=8*this._finalSize&&(this._update(this._block),this._block.fill(0)),this._block.writeInt32BE(l,this._blockSize-4);var hash=this._update(this._block)||this._hash();return enc?hash.toString(enc):hash},Hash.prototype._update=function(){throw new Error("_update must be implemented by subclass")},Hash}},function(module,exports,__webpack_require__){var exports=module.exports=function(alg){var Alg=exports[alg];if(!Alg)throw new Error(alg+" is not supported (we accept pull requests)");return new Alg},Buffer=__webpack_require__(2).Buffer,Hash=__webpack_require__(217)(Buffer);exports.sha1=__webpack_require__(219)(Buffer,Hash),exports.sha256=__webpack_require__(220)(Buffer,Hash),exports.sha512=__webpack_require__(221)(Buffer,Hash)},function(module,exports,__webpack_require__){var inherits=__webpack_require__(7).inherits;module.exports=function(Buffer,Hash){function Sha1(){return POOL.length?POOL.pop().init():this instanceof Sha1?(this._w=W,Hash.call(this,64,56),this._h=null,void this.init()):new Sha1}function sha1_ft(t,b,c,d){return 20>t?b&c|~b&d:40>t?b^c^d:60>t?b&c|b&d|c&d:b^c^d}function sha1_kt(t){return 20>t?1518500249:40>t?1859775393:60>t?-1894007588:-899497514}function add(x,y){return x+y|0}function rol(num,cnt){return num<<cnt|num>>>32-cnt}var A=0,B=4,C=8,D=12,E=16,W=new("undefined"==typeof Int32Array?Array:Int32Array)(80),POOL=[];return inherits(Sha1,Hash),Sha1.prototype.init=function(){return this._a=1732584193,this._b=4023233417,this._c=2562383102,this._d=271733878,this._e=3285377520,Hash.prototype.init.call(this),this},Sha1.prototype._POOL=POOL,Sha1.prototype._update=function(X){var a,b,c,d,e,_a,_b,_c,_d,_e;a=_a=this._a,b=_b=this._b,c=_c=this._c,d=_d=this._d,e=_e=this._e;for(var w=this._w,j=0;80>j;j++){var W=w[j]=16>j?X.readInt32BE(4*j):rol(w[j-3]^w[j-8]^w[j-14]^w[j-16],1),t=add(add(rol(a,5),sha1_ft(j,b,c,d)),add(add(e,W),sha1_kt(j)));e=d,d=c,c=rol(b,30),b=a,a=t}this._a=add(a,_a),this._b=add(b,_b),this._c=add(c,_c),this._d=add(d,_d),this._e=add(e,_e)},Sha1.prototype._hash=function(){POOL.length<100&&POOL.push(this);var H=new Buffer(20);return H.writeInt32BE(0|this._a,A),H.writeInt32BE(0|this._b,B),H.writeInt32BE(0|this._c,C),H.writeInt32BE(0|this._d,D),H.writeInt32BE(0|this._e,E),H},Sha1}},function(module,exports,__webpack_require__){var inherits=__webpack_require__(7).inherits;module.exports=function(Buffer,Hash){function Sha256(){this.init(),this._w=W,Hash.call(this,64,56)}function S(X,n){return X>>>n|X<<32-n}function R(X,n){return X>>>n}function Ch(x,y,z){return x&y^~x&z}function Maj(x,y,z){return x&y^x&z^y&z}function Sigma0256(x){return S(x,2)^S(x,13)^S(x,22)}function Sigma1256(x){return S(x,6)^S(x,11)^S(x,25)}function Gamma0256(x){return S(x,7)^S(x,18)^R(x,3)}function Gamma1256(x){return S(x,17)^S(x,19)^R(x,10)}var K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],W=new Array(64);return inherits(Sha256,Hash),Sha256.prototype.init=function(){return this._a=1779033703,this._b=-1150833019,this._c=1013904242,this._d=-1521486534,this._e=1359893119,this._f=-1694144372,this._g=528734635,this._h=1541459225,this._len=this._s=0,this},Sha256.prototype._update=function(M){var a,b,c,d,e,f,g,h,T1,T2,W=this._w;a=0|this._a,b=0|this._b,c=0|this._c,d=0|this._d,e=0|this._e,f=0|this._f,g=0|this._g,h=0|this._h;for(var j=0;64>j;j++){var w=W[j]=16>j?M.readInt32BE(4*j):Gamma1256(W[j-2])+W[j-7]+Gamma0256(W[j-15])+W[j-16];T1=h+Sigma1256(e)+Ch(e,f,g)+K[j]+w,T2=Sigma0256(a)+Maj(a,b,c),h=g,g=f,f=e,e=d+T1,d=c,c=b,b=a,a=T1+T2}this._a=a+this._a|0,this._b=b+this._b|0,this._c=c+this._c|0,this._d=d+this._d|0,this._e=e+this._e|0,this._f=f+this._f|0,this._g=g+this._g|0,this._h=h+this._h|0},Sha256.prototype._hash=function(){var H=new Buffer(32);return H.writeInt32BE(this._a,0),H.writeInt32BE(this._b,4),H.writeInt32BE(this._c,8),H.writeInt32BE(this._d,12),H.writeInt32BE(this._e,16),H.writeInt32BE(this._f,20),H.writeInt32BE(this._g,24),H.writeInt32BE(this._h,28),H},Sha256}},function(module,exports,__webpack_require__){var inherits=__webpack_require__(7).inherits;module.exports=function(Buffer,Hash){function Sha512(){this.init(),this._w=W,Hash.call(this,128,112)}function S(X,Xl,n){return X>>>n|Xl<<32-n}function Ch(x,y,z){return x&y^~x&z}function Maj(x,y,z){return x&y^x&z^y&z}var K=[1116352408,3609767458,1899447441,602891725,3049323471,3964484399,3921009573,2173295548,961987163,4081628472,1508970993,3053834265,2453635748,2937671579,2870763221,3664609560,3624381080,2734883394,310598401,1164996542,607225278,1323610764,1426881987,3590304994,1925078388,4068182383,2162078206,991336113,2614888103,633803317,3248222580,3479774868,3835390401,2666613458,4022224774,944711139,264347078,2341262773,604807628,2007800933,770255983,1495990901,1249150122,1856431235,1555081692,3175218132,1996064986,2198950837,2554220882,3999719339,2821834349,766784016,2952996808,2566594879,3210313671,3203337956,3336571891,1034457026,3584528711,2466948901,113926993,3758326383,338241895,168717936,666307205,1188179964,773529912,1546045734,1294757372,1522805485,1396182291,2643833823,1695183700,2343527390,1986661051,1014477480,2177026350,1206759142,2456956037,344077627,2730485921,1290863460,2820302411,3158454273,3259730800,3505952657,3345764771,106217008,3516065817,3606008344,3600352804,1432725776,4094571909,1467031594,275423344,851169720,430227734,3100823752,506948616,1363258195,659060556,3750685593,883997877,3785050280,958139571,3318307427,1322822218,3812723403,1537002063,2003034995,1747873779,3602036899,1955562222,1575990012,2024104815,1125592928,2227730452,2716904306,2361852424,442776044,2428436474,593698344,2756734187,3733110249,3204031479,2999351573,3329325298,3815920427,3391569614,3928383900,3515267271,566280711,3940187606,3454069534,4118630271,4000239992,116418474,1914138554,174292421,2731055270,289380356,3203993006,460393269,320620315,685471733,587496836,852142971,1086792851,1017036298,365543100,1126000580,2618297676,1288033470,3409855158,1501505948,4234509866,1607167915,987167468,1816402316,1246189591],W=new Array(160);return inherits(Sha512,Hash),Sha512.prototype.init=function(){return this._a=1779033703,this._b=-1150833019,this._c=1013904242,this._d=-1521486534,this._e=1359893119,this._f=-1694144372,this._g=528734635,this._h=1541459225,this._al=-205731576,this._bl=-2067093701,this._cl=-23791573,this._dl=1595750129,this._el=-1377402159,this._fl=725511199,this._gl=-79577749,this._hl=327033209,this._len=this._s=0,this},Sha512.prototype._update=function(M){var a,b,c,d,e,f,g,h,al,bl,cl,dl,el,fl,gl,hl,W=this._w;a=0|this._a,b=0|this._b,c=0|this._c,d=0|this._d,e=0|this._e,f=0|this._f,g=0|this._g,h=0|this._h,al=0|this._al,bl=0|this._bl,cl=0|this._cl,dl=0|this._dl,el=0|this._el,fl=0|this._fl,gl=0|this._gl,hl=0|this._hl;for(var i=0;80>i;i++){var Wi,Wil,j=2*i;if(16>i)Wi=W[j]=M.readInt32BE(4*j),Wil=W[j+1]=M.readInt32BE(4*j+4);else{var x=W[j-30],xl=W[j-30+1],gamma0=S(x,xl,1)^S(x,xl,8)^x>>>7,gamma0l=S(xl,x,1)^S(xl,x,8)^S(xl,x,7);x=W[j-4],xl=W[j-4+1];var gamma1=S(x,xl,19)^S(xl,x,29)^x>>>6,gamma1l=S(xl,x,19)^S(x,xl,29)^S(xl,x,6),Wi7=W[j-14],Wi7l=W[j-14+1],Wi16=W[j-32],Wi16l=W[j-32+1];Wil=gamma0l+Wi7l,Wi=gamma0+Wi7+(gamma0l>>>0>Wil>>>0?1:0),Wil+=gamma1l,Wi=Wi+gamma1+(gamma1l>>>0>Wil>>>0?1:0),Wil+=Wi16l,Wi=Wi+Wi16+(Wi16l>>>0>Wil>>>0?1:0),W[j]=Wi,W[j+1]=Wil}var maj=Maj(a,b,c),majl=Maj(al,bl,cl),sigma0h=S(a,al,28)^S(al,a,2)^S(al,a,7),sigma0l=S(al,a,28)^S(a,al,2)^S(a,al,7),sigma1h=S(e,el,14)^S(e,el,18)^S(el,e,9),sigma1l=S(el,e,14)^S(el,e,18)^S(e,el,9),Ki=K[j],Kil=K[j+1],ch=Ch(e,f,g),chl=Ch(el,fl,gl),t1l=hl+sigma1l,t1=h+sigma1h+(hl>>>0>t1l>>>0?1:0);t1l+=chl,t1=t1+ch+(chl>>>0>t1l>>>0?1:0),t1l+=Kil,t1=t1+Ki+(Kil>>>0>t1l>>>0?1:0),t1l+=Wil,t1=t1+Wi+(Wil>>>0>t1l>>>0?1:0);var t2l=sigma0l+majl,t2=sigma0h+maj+(sigma0l>>>0>t2l>>>0?1:0);h=g,hl=gl,g=f,gl=fl,f=e,fl=el,el=dl+t1l|0,e=d+t1+(dl>>>0>el>>>0?1:0)|0,d=c,dl=cl,c=b,cl=bl,b=a,bl=al,al=t1l+t2l|0,a=t1+t2+(t1l>>>0>al>>>0?1:0)|0}this._al=this._al+al|0,this._bl=this._bl+bl|0,this._cl=this._cl+cl|0,this._dl=this._dl+dl|0,this._el=this._el+el|0,this._fl=this._fl+fl|0,this._gl=this._gl+gl|0,this._hl=this._hl+hl|0,this._a=this._a+a+(this._al>>>0<al>>>0?1:0)|0,this._b=this._b+b+(this._bl>>>0<bl>>>0?1:0)|0,this._c=this._c+c+(this._cl>>>0<cl>>>0?1:0)|0,this._d=this._d+d+(this._dl>>>0<dl>>>0?1:0)|0,this._e=this._e+e+(this._el>>>0<el>>>0?1:0)|0,this._f=this._f+f+(this._fl>>>0<fl>>>0?1:0)|0,this._g=this._g+g+(this._gl>>>0<gl>>>0?1:0)|0,this._h=this._h+h+(this._hl>>>0<hl>>>0?1:0)|0},Sha512.prototype._hash=function(){function writeInt64BE(h,l,offset){H.writeInt32BE(h,offset),H.writeInt32BE(l,offset+4)}var H=new Buffer(64);return writeInt64BE(this._a,this._al,0),writeInt64BE(this._b,this._bl,8),writeInt64BE(this._c,this._cl,16),writeInt64BE(this._d,this._dl,24),writeInt64BE(this._e,this._el,32),writeInt64BE(this._f,this._fl,40),writeInt64BE(this._g,this._gl,48),writeInt64BE(this._h,this._hl,56),H},Sha512}},function(module,exports,__webpack_require__){"use strict";function transform(chunk,enc,cb){var i,list=chunk.toString("utf8").split(this.matcher),remaining=list.pop();for(list.length>=1?push(this,this.mapper(this._last+list.shift())):remaining=this._last+remaining,i=0;i<list.length;i++)push(this,this.mapper(list[i]));this._last=remaining,cb()}function flush(cb){this._last&&push(this,this.mapper(this._last)),cb()}function push(self,val){void 0!==val&&self.push(val)}function noop(incoming){return incoming}function split(matcher,mapper,options){"object"!=typeof matcher||matcher instanceof RegExp||(options=matcher,matcher=null),"function"==typeof matcher&&(mapper=matcher,matcher=null),options=options||{};var stream=through(options,transform,flush);return stream._readableState.objectMode=!0,stream._last="",stream.matcher=matcher||/\r?\n/,stream.mapper=mapper||noop,stream}var through=__webpack_require__(45);module.exports=split},function(module,exports,__webpack_require__){module.exports=__webpack_require__(14)},function(module,exports,__webpack_require__){module.exports=__webpack_require__(81)},function(module,exports,__webpack_require__){exports=module.exports=__webpack_require__(82),exports.Stream=__webpack_require__(3),exports.Readable=exports,exports.Writable=__webpack_require__(43),exports.Duplex=__webpack_require__(14),exports.Transform=__webpack_require__(42),exports.PassThrough=__webpack_require__(81)},function(module,exports,__webpack_require__){module.exports=__webpack_require__(42)},function(module,exports,__webpack_require__){module.exports=__webpack_require__(43)},function(module,exports,__webpack_require__){(function(Buffer,global,process){function decideMode(preferBinary){return capability.fetch?"fetch":capability.mozchunkedarraybuffer?"moz-chunked-arraybuffer":capability.msstream?"ms-stream":capability.arraybuffer&&preferBinary?"arraybuffer":capability.vbArray&&preferBinary?"text:vbarray":"text"}function statusValid(xhr){try{var status=xhr.status;return null!==status&&0!==status}catch(e){return!1}}var capability=__webpack_require__(84),inherits=__webpack_require__(4),response=__webpack_require__(229),stream=__webpack_require__(3),IncomingMessage=response.IncomingMessage,rStates=response.readyStates,ClientRequest=module.exports=function(opts){var self=this;stream.Writable.call(self),self._opts=opts,self._body=[],self._headers={},opts.auth&&self.setHeader("Authorization","Basic "+new Buffer(opts.auth).toString("base64")),Object.keys(opts.headers).forEach(function(name){self.setHeader(name,opts.headers[name])});var preferBinary;if("prefer-streaming"===opts.mode)preferBinary=!1;else if("allow-wrong-content-type"===opts.mode)preferBinary=!capability.overrideMimeType;else{if(opts.mode&&"default"!==opts.mode&&"prefer-fast"!==opts.mode)throw new Error("Invalid value for opts.mode");preferBinary=!0}self._mode=decideMode(preferBinary),self.on("finish",function(){self._onFinish()})};inherits(ClientRequest,stream.Writable),ClientRequest.prototype.setHeader=function(name,value){var self=this,lowerName=name.toLowerCase();-1===unsafeHeaders.indexOf(lowerName)&&(self._headers[lowerName]={name:name,value:value})},ClientRequest.prototype.getHeader=function(name){var self=this;return self._headers[name.toLowerCase()].value},ClientRequest.prototype.removeHeader=function(name){var self=this;delete self._headers[name.toLowerCase()]},ClientRequest.prototype._onFinish=function(){var self=this;if(!self._destroyed){var body,opts=self._opts,headersObj=self._headers;if(("POST"===opts.method||"PUT"===opts.method||"PATCH"===opts.method)&&(body=capability.blobConstructor?new global.Blob(self._body.map(function(buffer){return buffer.toArrayBuffer()}),{type:(headersObj["content-type"]||{}).value||""}):Buffer.concat(self._body).toString()),"fetch"===self._mode){var headers=Object.keys(headersObj).map(function(name){return[headersObj[name].name,headersObj[name].value]});global.fetch(self._opts.url,{method:self._opts.method,headers:headers,body:body,mode:"cors",credentials:opts.withCredentials?"include":"same-origin"}).then(function(response){self._fetchResponse=response,self._connect()},function(reason){self.emit("error",reason)})}else{var xhr=self._xhr=new global.XMLHttpRequest;try{xhr.open(self._opts.method,self._opts.url,!0)}catch(err){return void process.nextTick(function(){self.emit("error",err)})}"responseType"in xhr&&(xhr.responseType=self._mode.split(":")[0]),"withCredentials"in xhr&&(xhr.withCredentials=!!opts.withCredentials),"text"===self._mode&&"overrideMimeType"in xhr&&xhr.overrideMimeType("text/plain; charset=x-user-defined"),Object.keys(headersObj).forEach(function(name){xhr.setRequestHeader(headersObj[name].name,headersObj[name].value)}),self._response=null,xhr.onreadystatechange=function(){switch(xhr.readyState){case rStates.LOADING:case rStates.DONE:self._onXHRProgress()}},"moz-chunked-arraybuffer"===self._mode&&(xhr.onprogress=function(){self._onXHRProgress()}),xhr.onerror=function(){self._destroyed||self.emit("error",new Error("XHR error"))};try{xhr.send(body)}catch(err){return void process.nextTick(function(){self.emit("error",err)})}}}},ClientRequest.prototype._onXHRProgress=function(){var self=this;statusValid(self._xhr)&&!self._destroyed&&(self._response||self._connect(),self._response._onXHRProgress())},ClientRequest.prototype._connect=function(){var self=this;self._destroyed||(self._response=new IncomingMessage(self._xhr,self._fetchResponse,self._mode),self.emit("response",self._response))},ClientRequest.prototype._write=function(chunk,encoding,cb){var self=this;self._body.push(chunk),cb()},ClientRequest.prototype.abort=ClientRequest.prototype.destroy=function(){var self=this;self._destroyed=!0,self._response&&(self._response._destroyed=!0),self._xhr&&self._xhr.abort()},ClientRequest.prototype.end=function(data,encoding,cb){var self=this;"function"==typeof data&&(cb=data,data=void 0),stream.Writable.prototype.end.call(self,data,encoding,cb)},ClientRequest.prototype.flushHeaders=function(){},ClientRequest.prototype.setTimeout=function(){},ClientRequest.prototype.setNoDelay=function(){},ClientRequest.prototype.setSocketKeepAlive=function(){};var unsafeHeaders=["accept-charset","accept-encoding","access-control-request-headers","access-control-request-method","connection","content-length","cookie","cookie2","date","dnt","expect","host","keep-alive","origin","referer","te","trailer","transfer-encoding","upgrade","user-agent","via"]}).call(exports,__webpack_require__(2).Buffer,function(){return this}(),__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process,Buffer,global){var capability=__webpack_require__(84),inherits=__webpack_require__(4),stream=__webpack_require__(3),rStates=exports.readyStates={UNSENT:0,OPENED:1,HEADERS_RECEIVED:2,LOADING:3,DONE:4},IncomingMessage=exports.IncomingMessage=function(xhr,response,mode){function read(){reader.read().then(function(result){if(!self._destroyed){if(result.done)return void self.push(null);self.push(new Buffer(result.value)),read()}})}var self=this;if(stream.Readable.call(self),self._mode=mode,self.headers={},self.rawHeaders=[],self.trailers={},self.rawTrailers=[],self.on("end",function(){process.nextTick(function(){self.emit("close")})}),"fetch"===mode){self._fetchResponse=response,self.statusCode=response.status,self.statusMessage=response.statusText;for(var header,_i,_it=response.headers[Symbol.iterator]();header=(_i=_it.next()).value,!_i.done;)self.headers[header[0].toLowerCase()]=header[1],self.rawHeaders.push(header[0],header[1]);var reader=response.body.getReader();read()}else{self._xhr=xhr,self._pos=0,self.statusCode=xhr.status,self.statusMessage=xhr.statusText;var headers=xhr.getAllResponseHeaders().split(/\r?\n/);if(headers.forEach(function(header){var matches=header.match(/^([^:]+):\s*(.*)/);if(matches){var key=matches[1].toLowerCase();void 0!==self.headers[key]?self.headers[key]+=", "+matches[2]:self.headers[key]=matches[2],self.rawHeaders.push(matches[1],matches[2])}}),self._charset="x-user-defined",!capability.overrideMimeType){var mimeType=self.rawHeaders["mime-type"];if(mimeType){var charsetMatch=mimeType.match(/;\s*charset=([^;])(;|$)/);charsetMatch&&(self._charset=charsetMatch[1].toLowerCase())}self._charset||(self._charset="utf-8")}}};inherits(IncomingMessage,stream.Readable),IncomingMessage.prototype._read=function(){},IncomingMessage.prototype._onXHRProgress=function(){var self=this,xhr=self._xhr,response=null;switch(self._mode){case"text:vbarray":if(xhr.readyState!==rStates.DONE)break;try{response=new global.VBArray(xhr.responseBody).toArray()}catch(e){}if(null!==response){self.push(new Buffer(response));break}case"text":try{response=xhr.responseText}catch(e){self._mode="text:vbarray";break}if(response.length>self._pos){var newData=response.substr(self._pos);if("x-user-defined"===self._charset){for(var buffer=new Buffer(newData.length),i=0;i<newData.length;i++)buffer[i]=255&newData.charCodeAt(i);self.push(buffer)}else self.push(newData,self._charset);self._pos=response.length}break;case"arraybuffer":if(xhr.readyState!==rStates.DONE)break;response=xhr.response,self.push(new Buffer(new Uint8Array(response)));break;case"moz-chunked-arraybuffer":if(response=xhr.response,xhr.readyState!==rStates.LOADING||!response)break;self.push(new Buffer(new Uint8Array(response)));break;case"ms-stream":if(response=xhr.response,xhr.readyState!==rStates.LOADING)break;var reader=new global.MSStreamReader;reader.onprogress=function(){reader.result.byteLength>self._pos&&(self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos)))),self._pos=reader.result.byteLength)},reader.onload=function(){self.push(null)},reader.readAsArrayBuffer(response)}self._xhr.readyState===rStates.DONE&&"ms-stream"!==self._mode&&self.push(null)}}).call(exports,__webpack_require__(1),__webpack_require__(2).Buffer,function(){return this}())},function(module,exports,__webpack_require__){"use strict";var firstChunk=__webpack_require__(178),stripBom=__webpack_require__(44);module.exports=function(){return firstChunk({minSize:3},function(chunk,enc,cb){this.push(stripBom(chunk)),cb()})}},function(module,exports,__webpack_require__){(function(process){function DestroyableTransform(opts){Transform.call(this,opts),this._destroyed=!1}function noop(chunk,enc,callback){callback(null,chunk)}function through2(construct){return function(options,transform,flush){return"function"==typeof options&&(flush=transform,transform=options,options={}),"function"!=typeof transform&&(transform=noop),"function"!=typeof flush&&(flush=null),construct(options,transform,flush)}}var Transform=__webpack_require__(41),inherits=__webpack_require__(7).inherits,xtend=__webpack_require__(15);inherits(DestroyableTransform,Transform),DestroyableTransform.prototype.destroy=function(err){if(!this._destroyed){this._destroyed=!0;var self=this;process.nextTick(function(){err&&self.emit("error",err),self.emit("close")})}},module.exports=through2(function(options,transform,flush){var t2=new DestroyableTransform(options);return t2._transform=transform,flush&&(t2._flush=flush),t2}),module.exports.ctor=through2(function(options,transform,flush){function Through2(override){return this instanceof Through2?(this.options=xtend(options,override),void DestroyableTransform.call(this,this.options)):new Through2(override)}return inherits(Through2,DestroyableTransform),Through2.prototype._transform=transform,flush&&(Through2.prototype._flush=flush),Through2}),module.exports.obj=through2(function(options,transform,flush){var t2=new DestroyableTransform(xtend({objectMode:!0,highWaterMark:16},options));return t2._transform=transform,flush&&(t2._flush=flush),t2})}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){function ReadableState(options,stream){options=options||{};var hwm=options.highWaterMark;this.highWaterMark=hwm||0===hwm?hwm:16384,this.highWaterMark=~~this.highWaterMark,this.buffer=[],this.length=0,this.pipes=null,this.pipesCount=0,this.flowing=!1,this.ended=!1,this.endEmitted=!1,this.reading=!1,this.calledRead=!1,this.sync=!0,this.needReadable=!1,this.emittedReadable=!1,this.readableListening=!1,this.objectMode=!!options.objectMode,this.defaultEncoding=options.defaultEncoding||"utf8",this.ranOut=!1,this.awaitDrain=0,this.readingMore=!1,this.decoder=null,this.encoding=null,options.encoding&&(StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this.decoder=new StringDecoder(options.encoding),this.encoding=options.encoding)}function Readable(options){return this instanceof Readable?(this._readableState=new ReadableState(options,this),this.readable=!0,void Stream.call(this)):new Readable(options)}function readableAddChunk(stream,state,chunk,encoding,addToFront){var er=chunkInvalid(state,chunk);if(er)stream.emit("error",er);else if(null===chunk||void 0===chunk)state.reading=!1,state.ended||onEofChunk(stream,state);else if(state.objectMode||chunk&&chunk.length>0)if(state.ended&&!addToFront){var e=new Error("stream.push() after EOF");stream.emit("error",e)}else if(state.endEmitted&&addToFront){var e=new Error("stream.unshift() after end event");stream.emit("error",e)}else!state.decoder||addToFront||encoding||(chunk=state.decoder.write(chunk)),state.length+=state.objectMode?1:chunk.length,addToFront?state.buffer.unshift(chunk):(state.reading=!1,state.buffer.push(chunk)),state.needReadable&&emitReadable(stream),maybeReadMore(stream,state);else addToFront||(state.reading=!1);return needMoreData(state)}function needMoreData(state){return!state.ended&&(state.needReadable||state.length<state.highWaterMark||0===state.length)}function roundUpToNextPowerOf2(n){if(n>=MAX_HWM)n=MAX_HWM;else{n--;for(var p=1;32>p;p<<=1)n|=n>>p;n++}return n}function howMuchToRead(n,state){return 0===state.length&&state.ended?0:state.objectMode?0===n?0:1:null===n||isNaN(n)?state.flowing&&state.buffer.length?state.buffer[0].length:state.length:0>=n?0:(n>state.highWaterMark&&(state.highWaterMark=roundUpToNextPowerOf2(n)),n>state.length?state.ended?state.length:(state.needReadable=!0,0):n)}function chunkInvalid(state,chunk){var er=null;return Buffer.isBuffer(chunk)||"string"==typeof chunk||null===chunk||void 0===chunk||state.objectMode||(er=new TypeError("Invalid non-string/buffer chunk")),er}function onEofChunk(stream,state){if(state.decoder&&!state.ended){var chunk=state.decoder.end();chunk&&chunk.length&&(state.buffer.push(chunk),state.length+=state.objectMode?1:chunk.length)}state.ended=!0,state.length>0?emitReadable(stream):endReadable(stream)}function emitReadable(stream){var state=stream._readableState;state.needReadable=!1,state.emittedReadable||(state.emittedReadable=!0,state.sync?process.nextTick(function(){emitReadable_(stream)}):emitReadable_(stream))}function emitReadable_(stream){stream.emit("readable")}function maybeReadMore(stream,state){state.readingMore||(state.readingMore=!0,process.nextTick(function(){maybeReadMore_(stream,state)}))}function maybeReadMore_(stream,state){for(var len=state.length;!state.reading&&!state.flowing&&!state.ended&&state.length<state.highWaterMark&&(stream.read(0),len!==state.length);)len=state.length;state.readingMore=!1}function pipeOnDrain(src){return function(){var state=src._readableState;state.awaitDrain--,0===state.awaitDrain&&flow(src)}}function flow(src){function write(dest,i,list){var written=dest.write(chunk);!1===written&&state.awaitDrain++}var chunk,state=src._readableState;for(state.awaitDrain=0;state.pipesCount&&null!==(chunk=src.read());)if(1===state.pipesCount?write(state.pipes,0,null):forEach(state.pipes,write),src.emit("data",chunk),state.awaitDrain>0)return;return 0===state.pipesCount?(state.flowing=!1,void(EE.listenerCount(src,"data")>0&&emitDataEvents(src))):void(state.ranOut=!0)}function pipeOnReadable(){this._readableState.ranOut&&(this._readableState.ranOut=!1,flow(this))}function emitDataEvents(stream,startPaused){var state=stream._readableState;if(state.flowing)throw new Error("Cannot switch to old mode now.");var paused=startPaused||!1,readable=!1;stream.readable=!0,stream.pipe=Stream.prototype.pipe,stream.on=stream.addListener=Stream.prototype.on,stream.on("readable",function(){readable=!0;for(var c;!paused&&null!==(c=stream.read());)stream.emit("data",c);null===c&&(readable=!1,stream._readableState.needReadable=!0)}),stream.pause=function(){paused=!0,this.emit("pause")},stream.resume=function(){paused=!1,readable?process.nextTick(function(){stream.emit("readable")}):this.read(0),this.emit("resume")},stream.emit("readable")}function fromList(n,state){var ret,list=state.buffer,length=state.length,stringMode=!!state.decoder,objectMode=!!state.objectMode;if(0===list.length)return null;if(0===length)ret=null;else if(objectMode)ret=list.shift();else if(!n||n>=length)ret=stringMode?list.join(""):Buffer.concat(list,length),list.length=0;else if(n<list[0].length){var buf=list[0];ret=buf.slice(0,n),list[0]=buf.slice(n)}else if(n===list[0].length)ret=list.shift();else{ret=stringMode?"":new Buffer(n);for(var c=0,i=0,l=list.length;l>i&&n>c;i++){var buf=list[0],cpy=Math.min(n-c,buf.length);stringMode?ret+=buf.slice(0,cpy):buf.copy(ret,c,0,cpy),cpy<buf.length?list[0]=buf.slice(cpy):list.shift(),c+=cpy}}return ret}function endReadable(stream){var state=stream._readableState;if(state.length>0)throw new Error("endReadable called on non-empty stream");!state.endEmitted&&state.calledRead&&(state.ended=!0,process.nextTick(function(){state.endEmitted||0!==state.length||(state.endEmitted=!0,stream.readable=!1,stream.emit("end"));
}))}function forEach(xs,f){for(var i=0,l=xs.length;l>i;i++)f(xs[i],i)}function indexOf(xs,x){for(var i=0,l=xs.length;l>i;i++)if(xs[i]===x)return i;return-1}module.exports=Readable;var isArray=__webpack_require__(33),Buffer=__webpack_require__(2).Buffer;Readable.ReadableState=ReadableState;var EE=__webpack_require__(13).EventEmitter;EE.listenerCount||(EE.listenerCount=function(emitter,type){return emitter.listeners(type).length});var Stream=__webpack_require__(3),util=__webpack_require__(8);util.inherits=__webpack_require__(4);var StringDecoder;util.inherits(Readable,Stream),Readable.prototype.push=function(chunk,encoding){var state=this._readableState;return"string"!=typeof chunk||state.objectMode||(encoding=encoding||state.defaultEncoding,encoding!==state.encoding&&(chunk=new Buffer(chunk,encoding),encoding="")),readableAddChunk(this,state,chunk,encoding,!1)},Readable.prototype.unshift=function(chunk){var state=this._readableState;return readableAddChunk(this,state,chunk,"",!0)},Readable.prototype.setEncoding=function(enc){StringDecoder||(StringDecoder=__webpack_require__(18).StringDecoder),this._readableState.decoder=new StringDecoder(enc),this._readableState.encoding=enc};var MAX_HWM=8388608;Readable.prototype.read=function(n){var state=this._readableState;state.calledRead=!0;var ret,nOrig=n;if(("number"!=typeof n||n>0)&&(state.emittedReadable=!1),0===n&&state.needReadable&&(state.length>=state.highWaterMark||state.ended))return emitReadable(this),null;if(n=howMuchToRead(n,state),0===n&&state.ended)return ret=null,state.length>0&&state.decoder&&(ret=fromList(n,state),state.length-=ret.length),0===state.length&&endReadable(this),ret;var doRead=state.needReadable;return state.length-n<=state.highWaterMark&&(doRead=!0),(state.ended||state.reading)&&(doRead=!1),doRead&&(state.reading=!0,state.sync=!0,0===state.length&&(state.needReadable=!0),this._read(state.highWaterMark),state.sync=!1),doRead&&!state.reading&&(n=howMuchToRead(nOrig,state)),ret=n>0?fromList(n,state):null,null===ret&&(state.needReadable=!0,n=0),state.length-=n,0!==state.length||state.ended||(state.needReadable=!0),state.ended&&!state.endEmitted&&0===state.length&&endReadable(this),ret},Readable.prototype._read=function(n){this.emit("error",new Error("not implemented"))},Readable.prototype.pipe=function(dest,pipeOpts){function onunpipe(readable){readable===src&&cleanup()}function onend(){dest.end()}function cleanup(){dest.removeListener("close",onclose),dest.removeListener("finish",onfinish),dest.removeListener("drain",ondrain),dest.removeListener("error",onerror),dest.removeListener("unpipe",onunpipe),src.removeListener("end",onend),src.removeListener("end",cleanup),(!dest._writableState||dest._writableState.needDrain)&&ondrain()}function onerror(er){unpipe(),dest.removeListener("error",onerror),0===EE.listenerCount(dest,"error")&&dest.emit("error",er)}function onclose(){dest.removeListener("finish",onfinish),unpipe()}function onfinish(){dest.removeListener("close",onclose),unpipe()}function unpipe(){src.unpipe(dest)}var src=this,state=this._readableState;switch(state.pipesCount){case 0:state.pipes=dest;break;case 1:state.pipes=[state.pipes,dest];break;default:state.pipes.push(dest)}state.pipesCount+=1;var doEnd=(!pipeOpts||pipeOpts.end!==!1)&&dest!==process.stdout&&dest!==process.stderr,endFn=doEnd?onend:cleanup;state.endEmitted?process.nextTick(endFn):src.once("end",endFn),dest.on("unpipe",onunpipe);var ondrain=pipeOnDrain(src);return dest.on("drain",ondrain),dest._events&&dest._events.error?isArray(dest._events.error)?dest._events.error.unshift(onerror):dest._events.error=[onerror,dest._events.error]:dest.on("error",onerror),dest.once("close",onclose),dest.once("finish",onfinish),dest.emit("pipe",src),state.flowing||(this.on("readable",pipeOnReadable),state.flowing=!0,process.nextTick(function(){flow(src)})),dest},Readable.prototype.unpipe=function(dest){var state=this._readableState;if(0===state.pipesCount)return this;if(1===state.pipesCount)return dest&&dest!==state.pipes?this:(dest||(dest=state.pipes),state.pipes=null,state.pipesCount=0,this.removeListener("readable",pipeOnReadable),state.flowing=!1,dest&&dest.emit("unpipe",this),this);if(!dest){var dests=state.pipes,len=state.pipesCount;state.pipes=null,state.pipesCount=0,this.removeListener("readable",pipeOnReadable),state.flowing=!1;for(var i=0;len>i;i++)dests[i].emit("unpipe",this);return this}var i=indexOf(state.pipes,dest);return-1===i?this:(state.pipes.splice(i,1),state.pipesCount-=1,1===state.pipesCount&&(state.pipes=state.pipes[0]),dest.emit("unpipe",this),this)},Readable.prototype.on=function(ev,fn){var res=Stream.prototype.on.call(this,ev,fn);if("data"!==ev||this._readableState.flowing||emitDataEvents(this),"readable"===ev&&this.readable){var state=this._readableState;state.readableListening||(state.readableListening=!0,state.emittedReadable=!1,state.needReadable=!0,state.reading?state.length&&emitReadable(this,state):this.read(0))}return res},Readable.prototype.addListener=Readable.prototype.on,Readable.prototype.resume=function(){emitDataEvents(this),this.read(0),this.emit("resume")},Readable.prototype.pause=function(){emitDataEvents(this,!0),this.emit("pause")},Readable.prototype.wrap=function(stream){var state=this._readableState,paused=!1,self=this;stream.on("end",function(){if(state.decoder&&!state.ended){var chunk=state.decoder.end();chunk&&chunk.length&&self.push(chunk)}self.push(null)}),stream.on("data",function(chunk){if(state.decoder&&(chunk=state.decoder.write(chunk)),(!state.objectMode||null!==chunk&&void 0!==chunk)&&(state.objectMode||chunk&&chunk.length)){var ret=self.push(chunk);ret||(paused=!0,stream.pause())}});for(var i in stream)"function"==typeof stream[i]&&"undefined"==typeof this[i]&&(this[i]=function(method){return function(){return stream[method].apply(stream,arguments)}}(i));var events=["error","close","destroy","pause","resume"];return forEach(events,function(ev){stream.on(ev,self.emit.bind(self,ev))}),self._read=function(n){paused&&(paused=!1,stream.resume())},self},Readable._fromList=fromList}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){function TransformState(options,stream){this.afterTransform=function(er,data){return afterTransform(stream,er,data)},this.needTransform=!1,this.transforming=!1,this.writecb=null,this.writechunk=null}function afterTransform(stream,er,data){var ts=stream._transformState;ts.transforming=!1;var cb=ts.writecb;if(!cb)return stream.emit("error",new Error("no writecb in Transform class"));ts.writechunk=null,ts.writecb=null,null!==data&&void 0!==data&&stream.push(data),cb&&cb(er);var rs=stream._readableState;rs.reading=!1,(rs.needReadable||rs.length<rs.highWaterMark)&&stream._read(rs.highWaterMark)}function Transform(options){if(!(this instanceof Transform))return new Transform(options);Duplex.call(this,options);var stream=(this._transformState=new TransformState(options,this),this);this._readableState.needReadable=!0,this._readableState.sync=!1,this.once("finish",function(){"function"==typeof this._flush?this._flush(function(er){done(stream,er)}):done(stream)})}function done(stream,er){if(er)return stream.emit("error",er);var ws=stream._writableState,ts=(stream._readableState,stream._transformState);if(ws.length)throw new Error("calling transform done when ws.length != 0");if(ts.transforming)throw new Error("calling transform done when still transforming");return stream.push(null)}module.exports=Transform;var Duplex=__webpack_require__(86),util=__webpack_require__(8);util.inherits=__webpack_require__(4),util.inherits(Transform,Duplex),Transform.prototype.push=function(chunk,encoding){return this._transformState.needTransform=!1,Duplex.prototype.push.call(this,chunk,encoding)},Transform.prototype._transform=function(chunk,encoding,cb){throw new Error("not implemented")},Transform.prototype._write=function(chunk,encoding,cb){var ts=this._transformState;if(ts.writecb=cb,ts.writechunk=chunk,ts.writeencoding=encoding,!ts.transforming){var rs=this._readableState;(ts.needTransform||rs.needReadable||rs.length<rs.highWaterMark)&&this._read(rs.highWaterMark)}},Transform.prototype._read=function(n){var ts=this._transformState;null!==ts.writechunk&&ts.writecb&&!ts.transforming?(ts.transforming=!0,this._transform(ts.writechunk,ts.writeencoding,ts.afterTransform)):ts.needTransform=!0}},function(module,exports,__webpack_require__){(function(process){function WriteReq(chunk,encoding,cb){this.chunk=chunk,this.encoding=encoding,this.callback=cb}function WritableState(options,stream){options=options||{};var hwm=options.highWaterMark;this.highWaterMark=hwm||0===hwm?hwm:16384,this.objectMode=!!options.objectMode,this.highWaterMark=~~this.highWaterMark,this.needDrain=!1,this.ending=!1,this.ended=!1,this.finished=!1;var noDecode=options.decodeStrings===!1;this.decodeStrings=!noDecode,this.defaultEncoding=options.defaultEncoding||"utf8",this.length=0,this.writing=!1,this.sync=!0,this.bufferProcessing=!1,this.onwrite=function(er){onwrite(stream,er)},this.writecb=null,this.writelen=0,this.buffer=[],this.errorEmitted=!1}function Writable(options){var Duplex=__webpack_require__(86);return this instanceof Writable||this instanceof Duplex?(this._writableState=new WritableState(options,this),this.writable=!0,void Stream.call(this)):new Writable(options)}function writeAfterEnd(stream,state,cb){var er=new Error("write after end");stream.emit("error",er),process.nextTick(function(){cb(er)})}function validChunk(stream,state,chunk,cb){var valid=!0;if(!Buffer.isBuffer(chunk)&&"string"!=typeof chunk&&null!==chunk&&void 0!==chunk&&!state.objectMode){var er=new TypeError("Invalid non-string/buffer chunk");stream.emit("error",er),process.nextTick(function(){cb(er)}),valid=!1}return valid}function decodeChunk(state,chunk,encoding){return state.objectMode||state.decodeStrings===!1||"string"!=typeof chunk||(chunk=new Buffer(chunk,encoding)),chunk}function writeOrBuffer(stream,state,chunk,encoding,cb){chunk=decodeChunk(state,chunk,encoding),Buffer.isBuffer(chunk)&&(encoding="buffer");var len=state.objectMode?1:chunk.length;state.length+=len;var ret=state.length<state.highWaterMark;return ret||(state.needDrain=!0),state.writing?state.buffer.push(new WriteReq(chunk,encoding,cb)):doWrite(stream,state,len,chunk,encoding,cb),ret}function doWrite(stream,state,len,chunk,encoding,cb){state.writelen=len,state.writecb=cb,state.writing=!0,state.sync=!0,stream._write(chunk,encoding,state.onwrite),state.sync=!1}function onwriteError(stream,state,sync,er,cb){sync?process.nextTick(function(){cb(er)}):cb(er),stream._writableState.errorEmitted=!0,stream.emit("error",er)}function onwriteStateUpdate(state){state.writing=!1,state.writecb=null,state.length-=state.writelen,state.writelen=0}function onwrite(stream,er){var state=stream._writableState,sync=state.sync,cb=state.writecb;if(onwriteStateUpdate(state),er)onwriteError(stream,state,sync,er,cb);else{var finished=needFinish(stream,state);finished||state.bufferProcessing||!state.buffer.length||clearBuffer(stream,state),sync?process.nextTick(function(){afterWrite(stream,state,finished,cb)}):afterWrite(stream,state,finished,cb)}}function afterWrite(stream,state,finished,cb){finished||onwriteDrain(stream,state),cb(),finished&&finishMaybe(stream,state)}function onwriteDrain(stream,state){0===state.length&&state.needDrain&&(state.needDrain=!1,stream.emit("drain"))}function clearBuffer(stream,state){state.bufferProcessing=!0;for(var c=0;c<state.buffer.length;c++){var entry=state.buffer[c],chunk=entry.chunk,encoding=entry.encoding,cb=entry.callback,len=state.objectMode?1:chunk.length;if(doWrite(stream,state,len,chunk,encoding,cb),state.writing){c++;break}}state.bufferProcessing=!1,c<state.buffer.length?state.buffer=state.buffer.slice(c):state.buffer.length=0}function needFinish(stream,state){return state.ending&&0===state.length&&!state.finished&&!state.writing}function finishMaybe(stream,state){var need=needFinish(stream,state);return need&&(state.finished=!0,stream.emit("finish")),need}function endWritable(stream,state,cb){state.ending=!0,finishMaybe(stream,state),cb&&(state.finished?process.nextTick(cb):stream.once("finish",cb)),state.ended=!0}module.exports=Writable;var Buffer=__webpack_require__(2).Buffer;Writable.WritableState=WritableState;var util=__webpack_require__(8);util.inherits=__webpack_require__(4);var Stream=__webpack_require__(3);util.inherits(Writable,Stream),Writable.prototype.pipe=function(){this.emit("error",new Error("Cannot pipe. Not readable."))},Writable.prototype.write=function(chunk,encoding,cb){var state=this._writableState,ret=!1;return"function"==typeof encoding&&(cb=encoding,encoding=null),Buffer.isBuffer(chunk)?encoding="buffer":encoding||(encoding=state.defaultEncoding),"function"!=typeof cb&&(cb=function(){}),state.ended?writeAfterEnd(this,state,cb):validChunk(this,state,chunk,cb)&&(ret=writeOrBuffer(this,state,chunk,encoding,cb)),ret},Writable.prototype._write=function(chunk,encoding,cb){cb(new Error("not implemented"))},Writable.prototype.end=function(chunk,encoding,cb){var state=this._writableState;"function"==typeof chunk?(cb=chunk,chunk=null,encoding=null):"function"==typeof encoding&&(cb=encoding,encoding=null),"undefined"!=typeof chunk&&null!==chunk&&this.write(chunk,encoding),state.ending||state.finished||endWritable(this,state,cb)}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){module.exports=__webpack_require__(233)},function(module,exports,__webpack_require__){(function(process){"use strict";var path=__webpack_require__(6),extend=__webpack_require__(175);module.exports=function(glob,options){var opts=extend({},options);opts.cwd=opts.cwd?path.resolve(opts.cwd):process.cwd();var prefix=glob.charAt(0),suffix=glob.slice(-1),isNegative="!"===prefix;return isNegative&&(glob=glob.slice(1)),glob=opts.root&&"/"===glob.charAt(0)?path.join(path.resolve(opts.root),"."+glob):path.resolve(opts.cwd,glob),"/"===suffix&&"/"!==glob.slice(-1)&&(glob+="/"),isNegative?"!"+glob:glob}}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(global){"use strict";function prop(propName){return function(data){return data[propName]}}function unique(propName,keyStore){keyStore=keyStore||new ES6Set;var keyfn=JSON.stringify;return"string"==typeof propName?keyfn=prop(propName):"function"==typeof propName&&(keyfn=propName),filter(function(data){var key=keyfn(data);return keyStore.has(key)?!1:(keyStore.add(key),!0)})}var ES6Set,filter=__webpack_require__(85).obj;ES6Set="function"==typeof global.Set?global.Set:function(){this.keys=[],this.has=function(val){return-1!==this.keys.indexOf(val)},this.add=function(val){this.keys.push(val)}},module.exports=unique}).call(exports,function(){return this}())},function(module,exports,__webpack_require__){var __WEBPACK_AMD_DEFINE_RESULT__;(function(module,global){!function(root){function error(type){throw RangeError(errors[type])}function map(array,fn){for(var length=array.length,result=[];length--;)result[length]=fn(array[length]);return result}function mapDomain(string,fn){var parts=string.split("@"),result="";parts.length>1&&(result=parts[0]+"@",string=parts[1]),string=string.replace(regexSeparators,".");var labels=string.split("."),encoded=map(labels,fn).join(".");return result+encoded}function ucs2decode(string){for(var value,extra,output=[],counter=0,length=string.length;length>counter;)value=string.charCodeAt(counter++),value>=55296&&56319>=value&&length>counter?(extra=string.charCodeAt(counter++),56320==(64512&extra)?output.push(((1023&value)<<10)+(1023&extra)+65536):(output.push(value),counter--)):output.push(value);return output}function ucs2encode(array){return map(array,function(value){var output="";return value>65535&&(value-=65536,output+=stringFromCharCode(value>>>10&1023|55296),value=56320|1023&value),output+=stringFromCharCode(value)}).join("")}function basicToDigit(codePoint){return 10>codePoint-48?codePoint-22:26>codePoint-65?codePoint-65:26>codePoint-97?codePoint-97:base}function digitToBasic(digit,flag){return digit+22+75*(26>digit)-((0!=flag)<<5)}function adapt(delta,numPoints,firstTime){var k=0;for(delta=firstTime?floor(delta/damp):delta>>1,delta+=floor(delta/numPoints);delta>baseMinusTMin*tMax>>1;k+=base)delta=floor(delta/baseMinusTMin);return floor(k+(baseMinusTMin+1)*delta/(delta+skew))}function decode(input){var out,basic,j,index,oldi,w,k,digit,t,baseMinusT,output=[],inputLength=input.length,i=0,n=initialN,bias=initialBias;for(basic=input.lastIndexOf(delimiter),0>basic&&(basic=0),j=0;basic>j;++j)input.charCodeAt(j)>=128&&error("not-basic"),output.push(input.charCodeAt(j));for(index=basic>0?basic+1:0;inputLength>index;){for(oldi=i,w=1,k=base;index>=inputLength&&error("invalid-input"),digit=basicToDigit(input.charCodeAt(index++)),(digit>=base||digit>floor((maxInt-i)/w))&&error("overflow"),i+=digit*w,t=bias>=k?tMin:k>=bias+tMax?tMax:k-bias,!(t>digit);k+=base)baseMinusT=base-t,w>floor(maxInt/baseMinusT)&&error("overflow"),w*=baseMinusT;out=output.length+1,bias=adapt(i-oldi,out,0==oldi),floor(i/out)>maxInt-n&&error("overflow"),n+=floor(i/out),i%=out,output.splice(i++,0,n)}return ucs2encode(output)}function encode(input){var n,delta,handledCPCount,basicLength,bias,j,m,q,k,t,currentValue,inputLength,handledCPCountPlusOne,baseMinusT,qMinusT,output=[];for(input=ucs2decode(input),inputLength=input.length,n=initialN,delta=0,bias=initialBias,j=0;inputLength>j;++j)currentValue=input[j],128>currentValue&&output.push(stringFromCharCode(currentValue));for(handledCPCount=basicLength=output.length,basicLength&&output.push(delimiter);inputLength>handledCPCount;){for(m=maxInt,j=0;inputLength>j;++j)currentValue=input[j],currentValue>=n&&m>currentValue&&(m=currentValue);for(handledCPCountPlusOne=handledCPCount+1,m-n>floor((maxInt-delta)/handledCPCountPlusOne)&&error("overflow"),delta+=(m-n)*handledCPCountPlusOne,n=m,j=0;inputLength>j;++j)if(currentValue=input[j],n>currentValue&&++delta>maxInt&&error("overflow"),currentValue==n){for(q=delta,k=base;t=bias>=k?tMin:k>=bias+tMax?tMax:k-bias,!(t>q);k+=base)qMinusT=q-t,baseMinusT=base-t,output.push(stringFromCharCode(digitToBasic(t+qMinusT%baseMinusT,0))),q=floor(qMinusT/baseMinusT);output.push(stringFromCharCode(digitToBasic(q,0))),bias=adapt(delta,handledCPCountPlusOne,handledCPCount==basicLength),delta=0,++handledCPCount}++delta,++n}return output.join("")}function toUnicode(input){return mapDomain(input,function(string){return regexPunycode.test(string)?decode(string.slice(4).toLowerCase()):string})}function toASCII(input){return mapDomain(input,function(string){return regexNonASCII.test(string)?"xn--"+encode(string):string})}var freeGlobal=("object"==typeof exports&&exports&&!exports.nodeType&&exports,"object"==typeof module&&module&&!module.nodeType&&module,"object"==typeof global&&global);(freeGlobal.global===freeGlobal||freeGlobal.window===freeGlobal||freeGlobal.self===freeGlobal)&&(root=freeGlobal);var punycode,maxInt=2147483647,base=36,tMin=1,tMax=26,skew=38,damp=700,initialBias=72,initialN=128,delimiter="-",regexPunycode=/^xn--/,regexNonASCII=/[^\x20-\x7E]/,regexSeparators=/[\x2E\u3002\uFF0E\uFF61]/g,errors={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},baseMinusTMin=base-tMin,floor=Math.floor,stringFromCharCode=String.fromCharCode;punycode={version:"1.3.2",ucs2:{decode:ucs2decode,encode:ucs2encode},decode:decode,encode:encode,toASCII:toASCII,toUnicode:toUnicode},__WEBPACK_AMD_DEFINE_RESULT__=function(){return punycode}.call(exports,__webpack_require__,exports,module),!(void 0!==__WEBPACK_AMD_DEFINE_RESULT__&&(module.exports=__WEBPACK_AMD_DEFINE_RESULT__))}(this)}).call(exports,__webpack_require__(264)(module),function(){return this}())},function(module,exports){(function(global){function deprecate(fn,msg){function deprecated(){if(!warned){if(config("throwDeprecation"))throw new Error(msg);config("traceDeprecation")?console.trace(msg):console.warn(msg),warned=!0}return fn.apply(this,arguments)}if(config("noDeprecation"))return fn;var warned=!1;return deprecated}function config(name){try{if(!global.localStorage)return!1}catch(_){return!1}var val=global.localStorage[name];return null==val?!1:"true"===String(val).toLowerCase()}module.exports=deprecate}).call(exports,function(){return this}())},function(module,exports){module.exports=function(arg){return arg&&"object"==typeof arg&&"function"==typeof arg.copy&&"function"==typeof arg.fill&&"function"==typeof arg.readUInt8}},function(module,exports,__webpack_require__){"use strict";module.exports={src:__webpack_require__(253),dest:__webpack_require__(242),symlink:__webpack_require__(255)}},function(module,exports,__webpack_require__){(function(process){"use strict";function dest(outFolder,opt){function saveFile(file,enc,cb){prepareWrite(outFolder,file,opt,function(err,writePath){return err?cb(err):void writeContents(writePath,file,cb)})}opt||(opt={});var saveStream=through2.obj(saveFile);if(!opt.sourcemaps)return saveStream;var mapStream=sourcemaps.write(opt.sourcemaps.path,opt.sourcemaps),outputStream=duplexify.obj(mapStream,saveStream);return mapStream.pipe(saveStream),outputStream}var through2=__webpack_require__(21),sourcemaps=process.browser?null:__webpack_require__(68),duplexify=__webpack_require__(28),prepareWrite=__webpack_require__(88),writeContents=__webpack_require__(243);module.exports=dest}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function writeContents(writePath,file,cb){function complete(err){cb(err,file)}function written(err){return isErrorFatal(err)?complete(err):!file.stat||"number"!=typeof file.stat.mode||file.symlink?complete():void fs.stat(writePath,function(err,st){if(err)return complete(err);var currentMode=st.mode&parseInt("0777",8),expectedMode=file.stat.mode&parseInt("0777",8);return currentMode===expectedMode?complete():void fs.chmod(writePath,expectedMode,complete)})}function isErrorFatal(err){return err?"EEXIST"===err.code&&"wx"===file.flag?!1:!0:!1}return file.isDirectory()?writeDir(writePath,file,written):file.isStream()?writeStream(writePath,file,written):file.symlink?writeSymbolicLink(writePath,file,written):file.isBuffer()?writeBuffer(writePath,file,written):file.isNull()?complete():void 0}var fs=__webpack_require__(5),writeDir=__webpack_require__(245),writeStream=__webpack_require__(246),writeBuffer=__webpack_require__(244),writeSymbolicLink=__webpack_require__(247);module.exports=writeContents},function(module,exports,__webpack_require__){(function(process){"use strict";function writeBuffer(writePath,file,cb){var opt={mode:file.stat.mode,flag:file.flag};fs.writeFile(writePath,file.contents,opt,cb)}var fs=__webpack_require__(process.browser?5:11);module.exports=writeBuffer}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function writeDir(writePath,file,cb){mkdirp(writePath,file.stat.mode,cb)}var mkdirp=__webpack_require__(72);module.exports=writeDir},function(module,exports,__webpack_require__){(function(process){"use strict";function writeStream(writePath,file,cb){function success(){streamFile(file,{},complete)}function complete(err){file.contents.removeListener("error",cb),outStream.removeListener("error",cb),outStream.removeListener("finish",success),cb(err)}var opt={mode:file.stat.mode,flag:file.flag},outStream=fs.createWriteStream(writePath,opt);file.contents.once("error",complete),outStream.once("error",complete),outStream.once("finish",success),file.contents.pipe(outStream)}var streamFile=__webpack_require__(89),fs=__webpack_require__(process.browser?5:11);module.exports=writeStream}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function writeSymbolicLink(writePath,file,cb){fs.symlink(file.symlink,writePath,function(err){return err&&"EEXIST"!==err.code?cb(err):void cb(null,file)})}var fs=__webpack_require__(process.browser?5:11);module.exports=writeSymbolicLink}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";var filter=__webpack_require__(85);module.exports=function(d){var isValid="number"==typeof d||d instanceof Number||d instanceof Date;if(!isValid)throw new Error("expected since option to be a date or a number");return filter.obj(function(file){return file.stat&&file.stat.mtime>d})}},function(module,exports,__webpack_require__){(function(process){"use strict";function bufferFile(file,opt,cb){fs.readFile(file.path,function(err,data){return err?cb(err):(opt.stripBOM?file.contents=stripBom(data):file.contents=data,void cb(null,file))})}var fs=__webpack_require__(process.browser?5:11),stripBom=__webpack_require__(44);module.exports=bufferFile}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){"use strict";function getContents(opt){return through2.obj(function(file,enc,cb){return file.isDirectory()?readDir(file,opt,cb):file.stat&&file.stat.isSymbolicLink()?readSymbolicLink(file,opt,cb):opt.buffer!==!1?bufferFile(file,opt,cb):streamFile(file,opt,cb)})}var through2=__webpack_require__(21),readDir=__webpack_require__(251),readSymbolicLink=__webpack_require__(252),bufferFile=__webpack_require__(249),streamFile=__webpack_require__(89);module.exports=getContents},function(module,exports){"use strict";function readDir(file,opt,cb){cb(null,file)}module.exports=readDir},function(module,exports,__webpack_require__){(function(process){"use strict";function readLink(file,opt,cb){fs.readlink(file.path,function(err,target){return err?cb(err):(file.symlink=target,cb(null,file))})}var fs=__webpack_require__(process.browser?5:11);module.exports=readLink}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function createFile(globFile,enc,cb){cb(null,new File(globFile))}function src(glob,opt){var inputPass,options=assign({read:!0,buffer:!0,stripBOM:!0,sourcemaps:!1,passthrough:!1,followSymlinks:!0},opt);if(!isValidGlob(glob))throw new Error("Invalid glob argument: "+glob);var globStream=gs.create(glob,options),outputStream=globStream.pipe(resolveSymlinks(options)).pipe(through.obj(createFile));return null!=options.since&&(outputStream=outputStream.pipe(filterSince(options.since))),options.read!==!1&&(outputStream=outputStream.pipe(getContents(options))),options.passthrough===!0&&(inputPass=through.obj(),outputStream=duplexify.obj(inputPass,merge(outputStream,inputPass))),options.sourcemaps===!0&&(outputStream=outputStream.pipe(sourcemaps.init({loadMaps:!0}))),globStream.on("error",outputStream.emit.bind(outputStream,"error")),outputStream}var assign=__webpack_require__(75),through=__webpack_require__(21),gs=__webpack_require__(179),File=__webpack_require__(46),duplexify=__webpack_require__(28),merge=__webpack_require__(71),sourcemaps=process.browser?null:__webpack_require__(68),filterSince=__webpack_require__(248),isValidGlob=__webpack_require__(192),getContents=__webpack_require__(250),resolveSymlinks=__webpack_require__(254);module.exports=src}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function resolveSymlinks(options){function resolveFile(globFile,enc,cb){fs.lstat(globFile.path,function(err,stat){return err?cb(err):(globFile.stat=stat,stat.isSymbolicLink()&&options.followSymlinks?void fs.realpath(globFile.path,function(err,filePath){return err?cb(err):(globFile.base=path.dirname(filePath),globFile.path=filePath,void resolveFile(globFile,enc,cb))}):cb(null,globFile))})}return through2.obj(resolveFile)}var through2=__webpack_require__(21),fs=__webpack_require__(process.browser?5:11),path=__webpack_require__(6);module.exports=resolveSymlinks}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){(function(process){"use strict";function symlink(outFolder,opt){function linkFile(file,enc,cb){var srcPath=file.path,symType=file.isDirectory()?"dir":"file";prepareWrite(outFolder,file,opt,function(err,writePath){return err?cb(err):void fs.symlink(srcPath,writePath,symType,function(err){return err&&"EEXIST"!==err.code?cb(err):void cb(null,file)})})}var stream=through2.obj(linkFile);return stream.resume(),stream}var through2=__webpack_require__(21),fs=__webpack_require__(process.browser?5:11),prepareWrite=__webpack_require__(88);module.exports=symlink}).call(exports,__webpack_require__(1))},function(module,exports,__webpack_require__){function collect(stream,cb){function get(name){return files.named[name]||(files.named[name]={children:[]}),files.named[name]}var files={paths:[],named:{},unnamed:[]};stream.on("data",function(file){if(null===cb)return void stream.on("data",function(){});if(file.path){var fo=get(file.path);fo.file=file;var po=get(Path.dirname(file.path));fo!==po&&po.children.push(fo),files.paths.push(file.path)}else files.unnamed.push({file:file,children:[]})}),stream.on("error",function(err){cb&&cb(err),cb=null}),stream.on("end",function(){cb&&cb(null,files),cb=null})}var Path=__webpack_require__(6);module.exports=collect},function(module,exports,__webpack_require__){var flat=__webpack_require__(258),tree=__webpack_require__(259),x=module.exports=tree;x.flat=flat,x.tree=tree},function(module,exports,__webpack_require__){function v2mpFlat(opts){opts=opts||{},opts.boundary=opts.boundary||randomString();var w=new stream.Writable({objectMode:!0}),r=new stream.PassThrough({objectMode:!0}),mp=new Multipart(opts.boundary);w._write=function(file,enc,cb){writePart(mp,file,cb)},w.on("finish",function(){mp.pipe(r)});var out=duplexify.obj(w,r);return out.boundary=opts.boundary,out}function writePart(mp,file,cb){var c=file.contents;null===c&&(c=emptyStream()),mp.addPart({body:file.contents,headers:headersForFile(file)}),cb(null)}function emptyStream(){var s=new stream.PassThrough({objectMode:!0});return s.write(null),s}function headersForFile(file){var fpath=common.cleanPath(file.path,file.base),h={};return h["Content-Disposition"]='file; filename="'+fpath+'"',file.isDirectory()?h["Content-Type"]="text/directory":h["Content-Type"]="application/octet-stream",h}function randomString(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}var Multipart=__webpack_require__(73),duplexify=__webpack_require__(28),stream=__webpack_require__(3),common=__webpack_require__(90);randomString=common.randomString,module.exports=v2mpFlat},function(module,exports,__webpack_require__){function v2mpTree(opts){opts=opts||{},opts.boundary=opts.boundary||randomString();var r=new stream.PassThrough({objectMode:!0}),w=new stream.PassThrough({objectMode:!0}),out=duplexify.obj(w,r);return out.boundary=opts.boundary,collect(w,function(err,files){if(err)return void r.emit("error",err);try{var mp=streamForCollection(opts.boundary,files);out.multipartHdr="Content-Type: multipart/mixed; boundary="+mp.boundary,opts.writeHeader&&(r.write(out.multipartHdr+"\r\n"),r.write("\r\n")),mp.pipe(r)}catch(e){r.emit("error",e)}}),out}function streamForCollection(boundary,files){var parts=[];files.paths.sort();for(var i=0;i<files.paths.length;i++){var n=files.paths[i],s=streamForPath(files,n);s&&parts.push({body:s,headers:headersForFile(files.named[n])})}for(var i=0;i<files.unnamed.length;i++){var f=files.unnamed[i],s=streamForWrapped(files,f);s&&parts.push({body:s,headers:headersForFile(f)})}if(0==parts.length){var s=streamForString("--"+boundary+"--\r\n");return s.boundary=boundary,s}for(var mp=new Multipart(boundary),i=0;i<parts.length;i++)mp.addPart(parts[i]);return mp}function streamForString(str){var s=new stream.PassThrough;return s.end(str),s}function streamForPath(files,path){var o=files.named[path];if(!o)throw new Error("no object for path. lib error.");if(o.file)return o.done?null:(o.done=!0,streamForWrapped(files,o))}function streamForWrapped(files,f){
return f.file.isDirectory()?multipartForDir(files,f):f.file.contents}function multipartForDir(files,dir){if(dir.boundary=randomString(),!dir.children||dir.children.length<1)return streamForString("--"+dir.boundary+"--\r\n");for(var mp=new Multipart(dir.boundary),i=0;i<dir.children.length;i++){var child=dir.children[i];if(!child.file)throw new Error("child has no file. lib error");var s=streamForPath(files,child.file.path);mp.addPart({body:s,headers:headersForFile(child)})}return mp}function headersForFile(o){var fpath=common.cleanPath(o.file.path,o.file.base),h={};return h["Content-Disposition"]='file; filename="'+fpath+'"',o.file.isDirectory()?h["Content-Type"]="multipart/mixed; boundary="+o.boundary:h["Content-Type"]="application/octet-stream",h}var Multipart=__webpack_require__(73),duplexify=__webpack_require__(28),stream=__webpack_require__(3),collect=(__webpack_require__(6),__webpack_require__(256)),common=__webpack_require__(90),randomString=common.randomString;module.exports=v2mpTree},function(module,exports,__webpack_require__){var Buffer=__webpack_require__(2).Buffer;module.exports=function(buf){var out=new Buffer(buf.length);return buf.copy(out),out}},function(module,exports,__webpack_require__){var isStream=__webpack_require__(91);module.exports=function(stream){if(isStream(stream)){var streamType=stream.constructor.name;return"Stream"===streamType&&(streamType=""),"<"+streamType+"Stream>"}}},function(module,exports,__webpack_require__){module.exports=__webpack_require__(2).Buffer.isBuffer},function(module,exports){module.exports=function(v){return null===v}},function(module,exports){module.exports=function(module){return module.webpackPolyfill||(module.deprecate=function(){},module.paths=[],module.children=[],module.webpackPolyfill=1),module}},function(module,exports){},function(module,exports){},function(module,exports){}]);

function uploadFile(result) {
	ipfs.add(new Buffer(result), function(err, res) {
    	if(err || !res) return console.error(err);
    	console.log(res.Hash);
    	console.log(res.Name);

    	//create smart contract
    	
	});
};

// Added by Truffle bootstrap.
// Supports Mist, and other wallets that provide 'web3'.
if (typeof web3 !== 'undefined') {
  // Use the Mist/wallet provider.
  window.web3 = new Web3(web3.currentProvider);
} else {
  // Use the provider from the config.
  window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}

Pudding.setWeb3(window.web3);
Pudding.load([Document], window);
