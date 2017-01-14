const NOOP = () => undefined;
const ABORTED_MESSAGE = 'Aborted';
export function Aborted() {
  Error.call(this, ABORTED_MESSAGE);
  this.message = ABORTED_MESSAGE;
  if (typeof Error.captureStackTrace === 'function') {
    Error.captureStackTrace(this, Aborted);
  } else {
    this.stack = (new Error(ABORTED_MESSAGE)).stack;
  }
}
Aborted.prototype = Object.create(Error.prototype);
Aborted.prototype.name = 'Aborted';

const isAborted = exception => exception instanceof Aborted;
Aborted.isAborted = isAborted;

const ABORT_ERROR = Symbol('abortError');
const LISTENERS = Symbol('listeners');

const safeCall = (callback, that, args) => {
  try {
    callback.apply(that, args);
  } catch (ex) {
    setTimeout(() => {
      throw ex;
    });
  }
};

const throwIfAborted = (token) => {
  const abortError = token.abortError;
  if (abortError) {
    throw abortError;
  }
};

function silent() {
  const promise = this.catch((rejectedValue) => {
    if (rejectedValue instanceof Aborted) {
      promise.catch(NOOP);
    }
    throw rejectedValue;
  });
  return promise;
}

export function always(callback) {
  return this.then(function alwaysThen(resolvedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [undefined, resolvedValue]);
    return resolvedValue;
  }, function alwaysCatch(rejectedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [rejectedValue, undefined]);
    throw rejectedValue;
  })::silent();
}

export function propagate(abort) {
  if (typeof abort !== 'function') {
    throw new Error('Invalid argument abort');
  }
  return this.catch((exception) => {
    if (exception instanceof Aborted) {
      abort(exception);
    }
    throw exception;
  })::silent();
}

const looksLikeAPromise = promise => (promise && typeof promise.then === 'function');

const wrap = (token, handler) => function handle(...args) {
  throwIfAborted(token);
  const result = handler.apply(this, args);
  if (!looksLikeAPromise(result)) {
    return result;
  }
  let listener;
  return Promise.race([
    result,
    new Promise((resolve, reject) => {
      listener = reject;
      token.addAbortListener(reject);
    }),
  ])
    ::always(() => token.removeAbortListener(listener));
};

const makeChainFunctions = token => ({
  then(resolveHandler, rejectHandler) {
    if (rejectHandler) {
      return this.then(wrap(token, resolveHandler), wrap(token, rejectHandler))::silent();
    }
    return this.then(wrap(token, resolveHandler))::silent();
  },
  catch(rejectHandler) {
    return this.catch(wrap(token, rejectHandler))::silent();
  },
  ifaborted(callback) {
    function handleResolve(value) {
      const abortError = token.abortError;
      if (abortError) {
        return callback(abortError);
      }
      return value;
    }

    function handleReject(exception) {
      const abortError = token.abortError;
      if (abortError) {
        return callback(abortError);
      }
      throw exception;
    }

    return this.then(handleResolve, handleReject); // don't silent that one
  },
  propagate,
  always,
});

export default class CancelToken {
  constructor(...parentTokens) {
    const callback = typeof parentTokens[0] === 'function' ? parentTokens.shift() : undefined;
    if (parentTokens.some(parentToken => !(parentToken instanceof CancelToken))) {
      throw new Error('Invalid argument parentToken');
    }

    this[ABORT_ERROR] = null;
    this[LISTENERS] = [];

    const abort = (newAbortError = undefined) => {
      if (this[ABORT_ERROR] !== null) {
        return;
      }
      const abortError = this[ABORT_ERROR] = newAbortError || new Aborted();
      parentTokens.forEach((parentToken) => {
        parentToken.removeAbortListener(abort);
      });
      const listenersToCall = this[LISTENERS];
      this[LISTENERS] = [];
      listenersToCall.forEach((listener) => {
        safeCall(listener, undefined, [abortError]);
      });
    };

    if (callback) {
      callback(abort);
    }

    this.chain = makeChainFunctions(this);
    // alias chain functions on the token
    Object.assign(this, this.chain);

    // Propagate aborted state from parent tokens
    if (this[ABORT_ERROR] === null) {
      parentTokens.some((parentToken) => {
        if (parentToken.aborted) {
          this[ABORT_ERROR] = parentToken.abortError;
          return true;
        }
        return false;
      });
    }
    // if not aborted yet, then listen to parent tokens
    if (this[ABORT_ERROR] === null) {
      parentTokens.forEach((parentToken) => {
        parentToken.addAbortListener(abort);
      });
    }
  }

  get abortError() {
    return this[ABORT_ERROR];
  }

  get aborted() {
    return Boolean(this[ABORT_ERROR]);
  }

  addAbortListener(listener) {
    const abortError = this[ABORT_ERROR];
    if (abortError) {
      listener(abortError);
      return;
    }
    const listeners = this[LISTENERS];
    if (listeners.indexOf(listener) < 0) {
      listeners.push(listener);
    }
  }

  removeAbortListener(listener) {
    const listeners = this[LISTENERS];
    const listenerIndex = listeners.indexOf(listener);
    if (listenerIndex >= 0) {
      listeners.splice(listenerIndex, 1);
    }
  }
}
CancelToken.isCancelToken = token => token instanceof CancelToken;

export const create = (...parentTokens) => {
  let abort;
  const callback = typeof parentTokens[0] === 'function' ? parentTokens.shift() : undefined;
  parentTokens.unshift((abortFunction) => {
    abort = abortFunction;
    if (callback) {
      callback(abortFunction);
    }
  });
  const token = new CancelToken(...parentTokens);
  return {
    token,
    abort,
  };
};
