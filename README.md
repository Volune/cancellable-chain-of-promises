# Cancellable Chain Of Promises

A library to write cancellable chain of promises.

This library is based on the [This-Binding Syntax](https://github.com/tc39/proposal-bind-operator) proposal.

## Examples

```javascript
import Cancellable, { Aborted } from 'cancellable-chain-of-promises';

const { token, abort } = Cancellable();

// Write your asynchronous code:
const promise = Promise.resolve()
  ::token.then(doSomething)
  ::token.then(doSomethingElse)
  ::token.catch(handleError);

// You can abort at any time:
abort();

// If you abort, the "promise" object will reject with an Aborted exception.
```
