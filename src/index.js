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

export function always(callback) {
  const call = (that, resolvedValue, rejectedValue) => {
    try {
      // Put rejected value first to promote error handling
      callback.call(that, rejectedValue, resolvedValue);
    } catch (ex) {
      setTimeout(() => {
        throw ex;
      });
    }
  };

  return this.then(function alwaysThen(resolvedValue) {
    call(this, resolvedValue, undefined);
    return resolvedValue;
  }, function alwaysCatch(rejectedValue) {
    call(this, undefined, rejectedValue);
    throw rejectedValue;
  });
}

export const createCancellable = (...unfilteredTokens) => {
  let abortError = null;

  const tokens = unfilteredTokens.length > 0 ?
    unfilteredTokens.filter(Boolean) : EMPTY_TOKENS;

  const isAborted = () => {
    if (abortError !== null) {
      return true;
    }
    return tokens.length > 0 &&
      tokens.some((t) => {
        if (t.aborted) {
          abortError = t.abortError;
          return true;
        }
        return false;
      });
  };

  function cancellableThen(resolveHandler, rejectHandler = undefined) {
    function handleResolve(...args) {
      if (isAborted()) {
        throw abortError;
      }
      return resolveHandler.apply(this, args);
    }

    function handleReject(...args) {
      if (isAborted()) {
        throw abortError;
      }
      return rejectHandler.apply(this, args);
    }

    if (rejectHandler) {
      return this.then(handleResolve, handleReject);
    }
    return this.then(handleResolve);
  }

  // eslint-disable-next-line no-underscore-dangle
  function cancellableCatch(rejectHandler) {
    function handleReject(...args) {
      if (isAborted()) {
        throw abortError;
      }
      return rejectHandler.apply(this, args);
    }

    return this.catch(handleReject);
  }

  function propagateAbort() {
    return this.catch((exception) => {
      if (isAborted()) {
        throw abortError;
      }
      if (exception instanceof Aborted) {
        abortError = exception;
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
    propagate: propagateAbort,
    ifaborted: ifAborted,
    always,
  };
  const abort = () => {
    abortError = new Aborted();
  };

  return {
    token,
    abort,
  };
};

createCancellable.create = createCancellable;
createCancellable.always = always;
createCancellable.Aborted = Aborted;

export default createCancellable;
