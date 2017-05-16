# Cancellable Chain Of Promises

[![npm version](https://badge.fury.io/js/cancellable-chain-of-promises.svg)](https://badge.fury.io/js/cancellable-chain-of-promises) [![Build Status](https://travis-ci.org/Volune/cancellable-chain-of-promises.svg?branch=master)](https://travis-ci.org/Volune/cancellable-chain-of-promises)

A library to write cancellable chain of promises.

This library is inspired by the [This-Binding Syntax](https://github.com/tc39/proposal-bind-operator) proposal.
If you don't want to depend on this proposal, you can have a look at the [like-bind-operator]() library.

This library relies on the [Cancellation](https://github.com/tc39/proposal-cancellation) proposal, and the [prex](https://www.npmjs.com/package/prex) implementation.


## Examples

```javascript
import { CancellationTokenSource } from 'prex';
import makeChain from 'cancellable-chain-of-promises';

const source = new CancellationTokenSource();
cancelButton.onclick = () => source.cancel();

// Write your asynchronous code:
const chain = makeChain(source.token);
const promise = chain.resolve()
  ::chain.then(doSomething)
  ::chain.then(doSomethingElse)
  ::chain.catch(handleError);

// If you cancel, the "promise" object will reject with an Cancelled error.
```

#### Using `like-bind-operator`

```javascript
import { CancellationTokenSource } from 'prex';
import makeChain from 'cancellable-chain-of-promises';
import $ from 'like-bind-operator';

const source = new CancellationTokenSource();
cancelButton.onclick = () => source.cancel();

// Write your asynchronous code:
const chain = makeChain(source.token);
const promise = chain.resolve()
  [$](chain.then)(doSomething)
  [$](chain.then)(doSomethingElse)
  [$](chain.catch)(handleError);

// If you cancel, the "promise" object will reject with an Cancelled error.
```


## Documentation

This library is still experimental and may change in future releases.

### chain

The `chain` object contains.

**makeChain**: `chain = makeChain(source.token)`

Creates a chain object linked to a cancellation token.
 
**chain.then**: `promise::chain.then(onFulfilled[, onRejected])`

Similar to `Promise.prototype.then`. If the token is in a cancelled state, `onFulfilled` and `onRejected` will not be called, and the returned promise will reject with the Cancelled error.

**chain.catch**: `promise::chain.catch(onRejected)`

Similar to `Promise.prototype.catch`. If the token is in a cancelled state, `onRejected` will not be called, and the returned promise will reject with the Cancelled error.

**chain.newPromise**: `chain.newPromise((resolve, reject) => {})`

A Promise factory, that returns a rejected Promise if the token is cancelled, or construct a new Promise. The callback is not called is the token is cancelled.

**chain.resolve**: `chain.resolve(value)`

A function that returns a rejected Promise if the token is cancelled, or a Promise resolved with the given value.

**chain.reject**: `chain.reject(value)`

A function that returns a rejected Promise if the token is cancelled, or a Promise rejected with the given value.

### Cancelled

An `Cancelled` is used to represent the cancellation of an operation. It is the rejected value to propagate the cancellation through a chain of promises.

### Utility functions

**always**: (aliases: *chain.always*) `promise::always(callback)`

Use `always` to always call a callback in a chain of promises. The returned or thrown value


## Other Examples

Check some examples in `src/utils/`.

### Cancellable Request

```javascript
const request = (url, { method, body, cancelToken = CancellationToken.none }) => {
  let registration;
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    registration = cancelToken.register(() => {
      xhr.abort();
      reject(new Cancelled(cancelToken));
    });
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
  })::always(() => registration.unregister())
};
```

### Cancel Operations When Removing a Widget

```javascript
class Widget {
  constructor() {
  	this.source = new CancellationTokenSource();
    this.chain = makeChain(this.source.token);
  }

  destroy() {
    this.source.cancel();
  }

  onclick() {
    request('/random', {cancelToken: this.source.token})
      ::this.chain.then(response => this.updateState(response));
  }

  // other methods ...
}
```
