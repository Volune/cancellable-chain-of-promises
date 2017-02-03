# Cancellable Chain Of Promises

[![npm version](https://badge.fury.io/js/cancellable-chain-of-promises.svg)](https://badge.fury.io/js/cancellable-chain-of-promises) [![Build Status](https://travis-ci.org/Volune/cancellable-chain-of-promises.svg?branch=master)](https://travis-ci.org/Volune/cancellable-chain-of-promises)

A library to write cancellable chain of promises.

This library is inspired by the [This-Binding Syntax](https://github.com/tc39/proposal-bind-operator) proposal.
If you don't want to depend on this proposal, you can have a look at the [like-bind-operator]() library.


## Examples

```javascript
import CancelToken, { Cancelled } from 'cancellable-chain-of-promises';

const token = new CancelToken((cancel) => {
    cancelButton.onclick = cancel;
});

// Write your asynchronous code:
const promise = token.resolve()
  ::token.then(doSomething)
  ::token.then(doSomethingElse)
  ::token.catch(handleError);

// If you cancel, the "promise" object will reject with an Cancelled error.
```

#### Using `like-bind-operator`

```javascript
import CancelToken, { Cancelled } from 'cancellable-chain-of-promises';
import $ from 'like-bind-operator';

const token = new CancelToken((cancel) => {
    cancelButton.onclick = cancel;
});

// Write your asynchronous code:
const promise = token.resolve()
  [$](token.then)(doSomething)
  [$](token.then)(doSomethingElse)
  [$](token.catch)(handleError);

// If you cancel, the "promise" object will reject with an Cancelled error.
```


## Documentation

This library is still experimental and may change in future releases.

### CancelToken

The `CancelToken` object is used to represent a cancellable operation.

**Constructor**: `new CancelToken([callback] [, ...parentTokens])`

- _callback_: A function that get the `cancel` function as a parameter.
- _parentTokens_: Tokens that will propagate their cancelled state to this token.
 
**token.chain**:

An object providing several utility functions to chain promises in a cancellable way.

**token.chain.then**: (alias: *token.then*) `promise::token.chain.then(onFulfilled[, onRejected])`

Similar to `Promise.prototype.then`. If the token is in a cancelled state, `onFulfilled` and `onRejected` will not be called, and the returned promise will reject with the Cancelled error.

**token.chain.catch**: (alias: *token.catch*) `promise::token.chain.catch(onRejected)`

Similar to `Promise.prototype.catch`. If the token is in a cancelled state, `onRejected` will not be called, and the returned promise will reject with the Cancelled error.

**token.newPromise**: `token.newPromise((resolve, reject) => {})`

A Promise factory, that returns a rejected Promise if the token is cancelled, or construct a new Promise. The callback is not called is the token is cancelled.

**token.resolve**: `token.resolve(value)`

A function that returns a rejected Promise if the token is cancelled, or a Promise resolved with the given value.

**token.reject**: `token.reject(value)`

A function that returns a rejected Promise if the token is cancelled, or a Promise rejected with the given value.

### Cancelled

An `Cancelled` is used to represent the cancellation of an operation. It is the rejected value to propagate the cancellation through a chain of promises.

### Utility functions

**always**: (aliases: *token.chain.always*, *token.always*) `promise::always(callback)`

Use `always` to always call a callback in a chain of promises. The returned or thrown value


## Other Examples

### Cancellable Request

```javascript
const request = (url, { method, body, cancelToken }) => {
  const token = new CancelToken(cancelToken);
  let cancelListener;
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    cancelListener = (cancelError) => {
      xhr.abort();
      reject(cancelError);
    };
    token.addCancelListener(cancelListener);
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
  })::always(() => token.removeCancelListener(cancelListener))
};
```

### Cancel Previous Operations

```javascript
let previousCancel = null;
function example() {
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
    };
  });

  request('/example', {cancelToken: this.token})
    ::this.token.chain.then(response => processResponse(response))
    ::always(clean);
}
```

### Cancel Operations When Removing a Widget

```javascript
class Widget {
  constructor() {
    this.token = new CancelToken(cancel => {
      this.cancel = cancel;
    });
  }

  destroy() {
    this.cancel();
  }

  onclick() {
    request('/random', {cancelToken: this.token})
      ::this.token.chain.then(response => this.updateState(response));
  }

  // other methods ...
}
```

### Cancellable setTimeout

```javascript
const setCancellableTimeout = (fn, duration, token) => {
  if (!token.aborted) {
    let id = 0;
    const cancel = () => {
      cancelTimeout(id);
      token.removeCancelListener(cancel);
    };
    id = setTimeout(() => {
      token.removeCancelListener(cancel);
      fn();
    }, duration);
  }
};
```

