# Cancellable Chain Of Promises

[![npm version](https://badge.fury.io/js/cancellable-chain-of-promises.svg)](https://badge.fury.io/js/cancellable-chain-of-promises) [![Build Status](https://travis-ci.org/Volune/cancellable-chain-of-promises.svg?branch=master)](https://travis-ci.org/Volune/cancellable-chain-of-promises)

A library to write cancellable chain of promises.

This library is based on the [This-Binding Syntax](https://github.com/tc39/proposal-bind-operator) proposal.


## Examples

```javascript
import CancelToken, { Aborted } from 'cancellable-chain-of-promises';

const token = new CancelToken((abort) => {
    cancelButton.onclick = abort;
});

// Write your asynchronous code:
const promise = Promise.resolve()
  ::token.then(doSomething)
  ::token.then(doSomethingElse)
  ::token.catch(handleError);

// If you abort, the "promise" object will reject with an Aborted exception.
```


## Documentation

This library is still experimental and may change in future releases.

### CancelToken

The `CancelToken` object is used to represent a cancellable operation.

**Constructor**: `new CancelToken([callback] [, ...parentTokens])`

- _callback_: A function that get the `abort` function as a parameter.
- _parentTokens_: Tokens that will propagate their aborted state to this token.
 
**token.chain**:

An object providing several utility functions to chain promises in a cancellable way.

**token.chain.then**: (alias: *token.then*) `promise::token.chain.then(onFulfilled[, onRejected])`

Similar to `Promise.prototype.then`. If the token is in a aborted state, `onFulfilled` and `onRejected` will not be called, and the returned promise will reject with the Aborted error.

**token.chain.catch**: (alias: *token.catch*) `promise::token.chain.catch(onRejected)`

Similar to `Promise.prototype.catch`. If the token is in a aborted state, `onRejected` will not be called, and the returned promise will reject with the Aborted error.

### Aborted

An `Aborted` is used to represent the cancellation of an operation. It is the rejected value to propagate the cancellation through a chain of promises.

### Utility functions

**always**: (aliases: *token.chain.always*, *token.always*) `promise::always(callback)`

Use `always` to always call a callback in a chain of promises. The returned or thrown value


## Other Examples

### Cancellable Request

```javascript
const request = (url, { method, body, cancelToken }) => {
  const token = new CancelToken(cancelToken);
  let abortListener;
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    abortListener = (abortError) => {
      xhr.abort();
      reject(abortError);
    };
    token.addAbortListener(abortListener);
    xhr.open(method, url);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send(body);
  })::always(() => token.removeAbortListener(abortListener))
};
```

### Cancel Previous Operations

```javascript
const once = (builder) => {
  let previousCancel = null;
  return function () {
    let clean = null;
    if (previousCancel) {
      previousCancel();
    }
    const token = new CancelToken((cancel) => {
      previousCancel = cancel;
      clean = () => {
        if (previousCancel === cancel) {
          previousCancel = null;
        }
      }
    });
    const func = builder(token);
    const result = func.apply(this, arguments);
    Promise.resolve(result)::token.always(clean);
    return result;
  }
};
```

### Cancel Operations When Removing a Widget

```javascript
class Widget {
  constructor() {
    this.token = new CancelToken(abort => {
      this.abort = abort;
    });
  }

  destroy() {
    this.abort();
  }

  onclick() {
    request('/random', {cancelToken: this.token})
      ::this.token.then(response => response.json())
      ::this.token.then(response => this.updateState(response));
  }

  // other methods ...
}
```



