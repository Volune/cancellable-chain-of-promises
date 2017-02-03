const NOOP = () => undefined;
const CANCELLED_MESSAGE = 'Cancelled';
export function Cancelled() {
  Error.call(this, CANCELLED_MESSAGE);
  this.message = CANCELLED_MESSAGE;
  if (typeof Error.captureStackTrace === 'function') {
    Error.captureStackTrace(this, Cancelled);
  } else {
    this.stack = (new Error(CANCELLED_MESSAGE)).stack;
  }
}
Cancelled.prototype = Object.create(Error.prototype);
Cancelled.prototype.name = 'Cancelled';

const isCancelled = exception => exception instanceof Cancelled;
Cancelled.isCancelled = isCancelled;

const CANCEL_ERROR = Symbol('cancelError');
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

const throwIfCancelled = (token) => {
  const cancelError = token.cancelError;
  if (cancelError) {
    throw cancelError;
  }
};

function silence(promise) {
  const returnedPromise = promise.catch((rejectedValue) => {
    if (rejectedValue instanceof Cancelled) {
      returnedPromise.catch(NOOP);
    }
    throw rejectedValue;
  });
  return returnedPromise;
}

export function always(callback) {
  const returnedPromise = this.then(function alwaysThen(resolvedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [undefined, resolvedValue]);
    return resolvedValue;
  }, function alwaysCatch(rejectedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [rejectedValue, undefined]);
    throw rejectedValue;
  });
  return silence(returnedPromise);
}

export function propagate(cancel) {
  if (typeof cancel !== 'function') {
    throw new Error('Invalid argument cancel');
  }
  const returnedPromise = this.catch((exception) => {
    if (exception instanceof Cancelled) {
      cancel(exception);
    }
    throw exception;
  });
  return silence(returnedPromise);
}

const looksLikeAPromise = promise => (promise && typeof promise.then === 'function');

const wrap = (token, handler) => function handle(...args) {
  throwIfCancelled(token);
  const result = handler.apply(this, args);
  if (!looksLikeAPromise(result)) {
    return result;
  }
  let listener;
  const returnedPromise = Promise.race([
    result,
    new Promise((resolve, reject) => {
      listener = reject;
      token.addCancelListener(reject);
    }),
  ]);
  return always.call(returnedPromise, () => token.removeCancelListener(listener));
};

const makeChainFunctions = token => ({
  then(resolveHandler, rejectHandler) {
    let returnedPromise;
    if (rejectHandler) {
      returnedPromise = this.then(wrap(token, resolveHandler), wrap(token, rejectHandler));
    } else {
      returnedPromise = this.then(wrap(token, resolveHandler));
    }
    return silence(returnedPromise);
  },
  catch(rejectHandler) {
    const returnedPromise = this.catch(wrap(token, rejectHandler));
    return silence(returnedPromise);
  },
  ifcancelled(callback) {
    function handleResolve(value) {
      const cancelError = token.cancelError;
      if (cancelError) {
        return callback(cancelError);
      }
      return value;
    }

    function handleReject(exception) {
      const cancelError = token.cancelError;
      if (cancelError) {
        return callback(cancelError);
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

    this[CANCEL_ERROR] = null;
    this[LISTENERS] = [];

    const cancel = (newCancelError = undefined) => {
      if (this[CANCEL_ERROR] !== null) {
        return;
      }
      const cancelError = this[CANCEL_ERROR] = newCancelError || new Cancelled();
      parentTokens.forEach((parentToken) => {
        parentToken.removeCancelListener(cancel);
      });
      const listenersToCall = this[LISTENERS];
      this[LISTENERS] = [];
      listenersToCall.forEach((listener) => {
        safeCall(listener, undefined, [cancelError]);
      });
    };

    if (callback) {
      callback(cancel);
    }

    this.chain = makeChainFunctions(this);
    // alias chain functions on the token
    Object.assign(this, this.chain);

    // Propagate cancelled state from parent tokens
    if (this[CANCEL_ERROR] === null) {
      parentTokens.some((parentToken) => {
        if (parentToken.cancelled) {
          this[CANCEL_ERROR] = parentToken.cancelError;
          return true;
        }
        return false;
      });
    }
    // if not canceleld yet, then listen to parent tokens
    if (this[CANCEL_ERROR] === null) {
      parentTokens.forEach((parentToken) => {
        parentToken.addCancelListener(cancel);
      });
    }
  }

  get cancelError() {
    return this[CANCEL_ERROR];
  }

  get cancelled() {
    return Boolean(this[CANCEL_ERROR]);
  }

  addCancelListener(listener) {
    const cancelError = this[CANCEL_ERROR];
    if (cancelError) {
      listener(cancelError);
      return;
    }
    const listeners = this[LISTENERS];
    if (listeners.indexOf(listener) < 0) {
      listeners.push(listener);
    }
  }

  removeCancelListener(listener) {
    const listeners = this[LISTENERS];
    const listenerIndex = listeners.indexOf(listener);
    if (listenerIndex >= 0) {
      listeners.splice(listenerIndex, 1);
    }
  }

  newPromise(...args) {
    if (this.cancelError) {
      return Promise.reject(this.cancelError);
    }
    return new Promise(...args);
  }

  resolve(...args) {
    if (this.cancelError) {
      return Promise.reject(this.cancelError);
    }
    return Promise.resolve(...args);
  }

  reject(...args) {
    if (this.cancelError) {
      return Promise.reject(this.cancelError);
    }
    return Promise.reject(...args);
  }
}
CancelToken.isCancelToken = token => token instanceof CancelToken;

export const create = (...parentTokens) => {
  let cancel;
  const callback = typeof parentTokens[0] === 'function' ? parentTokens.shift() : undefined;
  parentTokens.unshift((cancelFunction) => {
    cancel = cancelFunction;
    if (callback) {
      callback(cancelFunction);
    }
  });
  const token = new CancelToken(...parentTokens);
  return {
    token,
    cancel,
  };
};
