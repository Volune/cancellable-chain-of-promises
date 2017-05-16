const NOOP = () => undefined;
const CANCELLED_MESSAGE = 'Cancelled';
export function Cancelled(token) {
  Error.call(this, CANCELLED_MESSAGE);
  this.message = CANCELLED_MESSAGE;
  this.token = token;
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

const safeCall = (callback, that, args) => {
  try {
    callback.apply(that, args);
  } catch (ex) {
    setTimeout(() => {
      throw ex;
    });
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

export function propagate(source) {
  if (!source || typeof source.cancel !== 'function') {
    throw new Error('Invalid argument source');
  }
  const returnedPromise = this.catch((exception) => {
    if (exception instanceof Cancelled) {
      source.cancel(exception);
    }
    throw exception;
  });
  return silence(returnedPromise);
}

const looksLikeAPromise = promise => (promise && typeof promise.then === 'function');

const wrap = (token, handler) => function handle(...args) {
  if (token.cancellationRequested) {
    throw new Cancelled(token);
  }
  const result = handler.apply(this, args);
  if (!looksLikeAPromise(result)) {
    return result;
  }
  let registration;
  const returnedPromise = Promise.race([
    result,
    new Promise((resolve, reject) => {
      registration = token.register(() => reject(new Cancelled(token)));
    }),
  ]);
  return always.call(returnedPromise, () => registration.unregister());
};

export default function makeChain(token) {
  return {
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
        if (token.cancellationRequested) {
          return callback(token);
        }
        return value;
      }

      function handleReject(exception) {
        if (token.cancellationRequested) {
          return callback(token);
        }
        throw exception;
      }

      return this.then(handleResolve, handleReject); // don't silent that one
    },
    newPromise(...args) {
      if (token.cancellationRequested) {
        return Promise.reject(new Cancelled(token));
      }
      return new Promise(...args);
    },
    resolve(...args) {
      if (token.cancellationRequested) {
        return Promise.reject(new Cancelled(token));
      }
      return Promise.resolve(...args);
    },
    reject(...args) {
      if (token.cancellationRequested) {
        return Promise.reject(new Cancelled(token));
      }
      return Promise.reject(...args);
    },
    propagate,
    always,
  };
}
