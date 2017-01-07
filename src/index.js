const EMPTY_TOKENS = [];
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

const safeCall = (callback, that, args) => {
  try {
    callback.apply(that, args);
  } catch (ex) {
    setTimeout(() => {
      throw ex;
    });
  }
};

export function always(callback) {
  return this.then(function alwaysThen(resolvedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [undefined, resolvedValue]);
    return resolvedValue;
  }, function alwaysCatch(rejectedValue) {
    // Put rejected value first to promote error handling
    safeCall(callback, this, [rejectedValue, undefined]);
    throw rejectedValue;
  });
}

export const createCancellable = (...unfilteredTokens) => {
  let abortError = null;

  const tokens = unfilteredTokens.length > 0 ?
    unfilteredTokens.filter(Boolean) : EMPTY_TOKENS;

  let listeners = [];

  const addAbortListener = (listener) => {
    if (abortError !== null) {
      listener(abortError);
      return;
    }
    if (listeners.indexOf(listener) < 0) {
      listeners.push(listener);
    }
  };

  const removeAbortListener = (listener) => {
    const listenerIndex = listeners.indexOf(listener);
    if (listenerIndex >= 0) {
      listeners.splice(listenerIndex, 1);
    }
  };

  const triggerAbort = (newAbortError) => {
    if (abortError !== null) {
      return;
    }
    abortError = newAbortError;
    tokens.forEach((parentToken) => {
      parentToken.removeAbortListener(triggerAbort);
    });
    const listenersToCall = listeners;
    listeners = [];
    listenersToCall.forEach((listener) => {
      safeCall(listener, undefined, [abortError]);
    });
  };

  const abort = () => {
    triggerAbort(new Aborted());
  };

  const isAborted = () => {
    if (abortError !== null) {
      return true;
    }
    return tokens.length > 0 &&
      tokens.some(t => t.aborted);
  };

  const wrap = handler => function handle(...args) {
    if (isAborted()) {
      throw abortError;
    }
    let listener;
    return Promise.race([
      handler.apply(this, args),
      new Promise((resolve, reject) => {
        listener = reject;
        addAbortListener(reject);
      }),
    ])
      ::always(() => removeAbortListener(listener));
  };

  function cancellableThen(resolveHandler, rejectHandler = undefined) {
    if (rejectHandler) {
      return this.then(wrap(resolveHandler), wrap(rejectHandler));
    }
    return this.then(wrap(resolveHandler));
  }

  function cancellableCatch(rejectHandler) {
    return this.catch(wrap(rejectHandler));
  }

  function propagate() {
    return this.catch((exception) => {
      if (isAborted()) {
        throw abortError;
      }
      if (exception instanceof Aborted) {
        triggerAbort(exception);
      }
      throw exception;
    });
  }

  function ifAborted(callback) {
    function handleResolve(value) {
      if (isAborted()) {
        return callback(abortError);
      }
      return value;
    }

    function handleReject(exception) {
      if (isAborted()) {
        return callback(abortError);
      }
      throw exception;
    }

    return this.then(handleResolve, handleReject);
  }

  const token = {
    get aborted() {
      return isAborted();
    },
    get abortError() {
      return abortError;
    },
    then: cancellableThen,
    catch: cancellableCatch,
    ifaborted: ifAborted,
    propagate,
    addAbortListener,
    removeAbortListener,
    always,
  };

  tokens.some((parentToken) => {
    if (parentToken.aborted) {
      abortError = parentToken.abortError;
      return true;
    }
    return false;
  });
  if (abortError === null) {
    tokens.forEach((parentToken) => {
      parentToken.addAbortListener(triggerAbort);
    });
  }

  return {
    token,
    abort,
  };
};

createCancellable.create = createCancellable;
createCancellable.always = always;
createCancellable.Aborted = Aborted;

export default createCancellable;
