/* eslint-env mocha */
import expect from 'must';
import sinon from 'sinon';
import configureMustSinon from 'must-sinon';
import { CancellationTokenSource, CancellationToken } from 'prex';
import makeChain, { Cancelled, propagate, always } from '../src/index';

configureMustSinon(expect);

const SOME_VALUE = {};
const NOOP = () => undefined;
const NOT_CALLED = () => {
  throw new Error('Should not be called');
};

const UNHANDLED_REJECTION_EVENT = 'unhandledRejection';
let unhandledRejectionHandler = null;

const timeout = (duration = 0) => new Promise((resolve, reject) => {
  setTimeout(() => reject(new Error('Timeout')), duration);
});

const testSilent = (runSilent) => {
  it('is silent', () => {
    unhandledRejectionHandler = sinon.spy();
    process.on(UNHANDLED_REJECTION_EVENT, unhandledRejectionHandler);
    runSilent();
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(unhandledRejectionHandler).to.not.have.been.called();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 10);
    });
  });
};

const testThenCatch = (run) => {
  it('returns a promise', () => {
    const promise = run(NOOP);
    expect(promise).to.be.a(Promise);
  });

  const runSilent = () => {
    run(NOOP, { parentToken: CancellationToken.canceled });
  };

  testSilent(runSilent);
};

const testCallback = (run, callbackName = 'callback') => {
  it(`passes value to ${callbackName}`, () => {
    const callback = sinon.spy();
    return run(callback, { input: SOME_VALUE })
      .then(() => {
        expect(callback).to.have.been.calledOnce();
        expect(callback).to.have.been.calledWithExactly(SOME_VALUE);
      });
  });

  it(`rejects Cancelled exception instead of calling ${callbackName} if cancelled`, () => {
    const callback = sinon.spy();
    return run(callback, { parentToken: CancellationToken.canceled })
      .then(NOT_CALLED, (exception) => {
        expect(callback).to.not.have.been.called();
        expect(exception).to.be.a(Cancelled);
      });
  });

  it(`resolves with value returned from ${callbackName}`, () => {
    const callback = sinon.stub().returns(SOME_VALUE);
    return run(callback)
      .then((value) => {
        expect(callback).to.have.been.calledOnce();
        expect(value).to.equal(SOME_VALUE);
      });
  });

  it(`rejects with exception thrown from ${callbackName}`, () => {
    const callback = sinon.stub().throws(SOME_VALUE);
    return run(callback)
      .then(NOT_CALLED, (value) => {
        expect(callback).to.have.been.calledOnce();
        expect(value).to.equal(SOME_VALUE);
      });
  });

  it(`doesn't wait for ${callbackName} to complete if cancelled`, () => {
    const callback = sinon.stub().returns(new Promise(NOOP));
    const source = new CancellationTokenSource();
    const promise = Promise.race([
      run(callback, { parentToken: source.token }),
      timeout(100),
    ])
      .then(NOT_CALLED, (value) => {
        expect(callback).to.have.been.calledOnce();
        expect(value).to.be.a(Cancelled);
      });
    setTimeout(() => source.cancel(), 10);
    return promise;
  });

  it(`isn't silent with rejection from ${callbackName}`, () => {
    unhandledRejectionHandler = sinon.spy();
    process.on(UNHANDLED_REJECTION_EVENT, unhandledRejectionHandler);
    run(() => Promise.reject(SOME_VALUE));
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          expect(unhandledRejectionHandler).to.have.been.calledOnce();
          expect(unhandledRejectionHandler).to.have.been.calledWith(SOME_VALUE);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 10);
    });
  });
};

describe('cancellable-chain-of-promises', () => {
  describe('always', () => {
    it('is called with resolved value', () => {
      const callback = sinon.spy();
      return Promise.resolve(SOME_VALUE)
        ::always(callback)
        .then(() => {
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(undefined, SOME_VALUE);
        });
    });

    it('is called with rejected value', () => {
      const callback = sinon.spy();
      return Promise.reject(SOME_VALUE)
        ::always(callback)
        .then(NOT_CALLED, () => {
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(SOME_VALUE, undefined);
        });
    });

    it('is still called after then with cancelled exception', () => {
      const chain = makeChain(CancellationToken.canceled);
      const callback = sinon.spy();
      return Promise.resolve()
        ::chain.then(NOT_CALLED)
        ::always(callback)
        .then(NOT_CALLED, (cancelledError) => {
          expect(cancelledError).to.be.a(Cancelled);
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(cancelledError, undefined);
        });
    });

    it('is still called after catch with cancelled exception', () => {
      const chain = makeChain(CancellationToken.canceled);
      const callback = sinon.spy();
      return Promise.reject()
        ::chain.catch(NOT_CALLED)
        ::always(callback)
        .then(NOT_CALLED, (cancelledError) => {
          expect(cancelledError).to.be.a(Cancelled);
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(cancelledError, undefined);
        });
    });

    const runSilent = () =>
      (Promise.reject(new Cancelled(CancellationToken.canceled))::always(NOOP));

    testSilent(runSilent);
  });

  describe('token', () => {
    describe('chain', () => {
      describe('then', () => {
        const run = (callback, { input, parentToken = CancellationToken.none } = {}) => {
          const chain = makeChain(parentToken);
          return Promise.resolve(input)
            ::chain.then(callback);
        };

        const runRejection = (callback, { input, parentToken = CancellationToken.none } = {}) => {
          const chain = makeChain(parentToken);
          return Promise.reject(input)
            ::chain.then(NOT_CALLED, callback);
        };

        testThenCatch(run);
        testCallback(run);
        testCallback(runRejection, 'rejection callback');
      });

      describe('catch', () => {
        const run = (callback, { input, parentToken = CancellationToken.none } = {}) => {
          const chain = makeChain(parentToken);
          return Promise.reject(input)
            ::chain.catch(callback);
        };

        testThenCatch(run);
        testCallback(run);
      });

      describe('ifcancelled', () => {
        it('is called if cancelled', () => {
          const chain = makeChain(CancellationToken.canceled);
          const callback = sinon.spy();
          return Promise.resolve()
            ::chain.ifcancelled(callback)
            .then(() => {
              expect(callback).to.have.been.calledOnce();
              expect(callback).to.have.been.calledWithExactly(
                sinon.match.instanceOf(CancellationToken));
            });
        });

        it('resolves with returned value if cancelled', () => {
          const chain = makeChain(CancellationToken.canceled);
          const callback = sinon.stub().returns(SOME_VALUE);
          return Promise.resolve()
            ::chain.ifcancelled(callback)
            .then((value) => {
              expect(callback).to.have.been.calledOnce();
              expect(value).to.equal(SOME_VALUE);
            });
        });

        it('rejects with thrown exception if cancelled', () => {
          const chain = makeChain(CancellationToken.canceled);
          const callback = sinon.stub().throws(SOME_VALUE);
          return Promise.resolve()
            ::chain.ifcancelled(callback)
            .then(NOT_CALLED, (exception) => {
              expect(callback).to.have.been.calledOnce();
              expect(exception).to.equal(SOME_VALUE);
            });
        });

        it('is not called if not cancelled', () => {
          const chain = makeChain(CancellationToken.none);
          const callback = sinon.spy();
          return Promise.resolve()
            ::chain.ifcancelled(callback)
            .then(() => {
              expect(callback).to.not.have.been.called();
            });
        });
      });
    });

    describe('newPromise', () => {
      it('returns a new Promise using the callback if not cancelled', () => {
        const callback = sinon.spy();
        const chain = makeChain(CancellationToken.none);
        const promise = chain.newPromise(callback);
        expect(promise).to.be.a(Promise);
        expect(callback).to.have.been.calledOnce();
      });

      it('returns a new Promise that resolves from callback', () => {
        const callback = sinon.stub().callsArgWith(0, SOME_VALUE);
        const chain = makeChain(CancellationToken.none);
        const promise = chain.newPromise(callback);
        expect(promise).to.be.a(Promise);
        expect(callback).to.have.been.calledOnce();
        return expect(promise).to.resolve.to.equal(SOME_VALUE);
      });

      it('returns a new Promise that rejects from callback', () => {
        const callback = sinon.stub().callsArgWith(1, SOME_VALUE);
        const chain = makeChain(CancellationToken.none);
        const promise = chain.newPromise(callback);
        expect(promise).to.be.a(Promise);
        expect(callback).to.have.been.calledOnce();
        return expect(promise).to.reject.to.equal(SOME_VALUE);
      });

      it('doesn\'t call callback and return a Promise rejected with Cancelled exception if cancelled', () => {
        const callback = sinon.stub().callsArgWith(0, SOME_VALUE);
        const chain = makeChain(CancellationToken.canceled);
        const promise = chain.newPromise(callback);
        expect(promise).to.be.a(Promise);
        expect(callback).to.not.have.been.called();
        return expect(promise).to.reject.to.instanceof(Cancelled);
      });
    });

    describe('resolve', () => {
      it('returns a Promise resolved to the given value', () => {
        const chain = makeChain(CancellationToken.none);
        const promise = chain.resolve(SOME_VALUE);
        expect(promise).to.be.a(Promise);
        return expect(promise).to.resolve.to.equal(SOME_VALUE);
      });

      it('return a rejected Promise with Cancelled exception if cancelled', () => {
        const chain = makeChain(CancellationToken.canceled);
        const promise = chain.resolve(SOME_VALUE);
        expect(promise).to.be.a(Promise);
        return expect(promise).to.reject.to.instanceof(Cancelled);
      });
    });

    describe('reject', () => {
      it('returns a Promise rejected to the given value', () => {
        const chain = makeChain(CancellationToken.none);
        const promise = chain.resolve(SOME_VALUE);
        expect(promise).to.be.a(Promise);
        return expect(promise).to.resolve.to.equal(SOME_VALUE);
      });

      it('return a Promise rejected with Cancelled exception if cancelled', () => {
        const chain = makeChain(CancellationToken.canceled);
        const promise = chain.resolve(SOME_VALUE);
        expect(promise).to.be.a(Promise);
        return expect(promise).to.reject.to.instanceof(Cancelled);
      });
    });
  });

  describe('propagate', () => {
    it('updates cancelled', () => {
      const source = new CancellationTokenSource();
      const chain = makeChain(source.token);
      const childChain = makeChain(CancellationToken.canceled);
      const callback = sinon.spy();
      return Promise.resolve()
        ::childChain.then(NOOP)
        ::propagate(source)
        ::chain.catch(callback)
        .then(NOT_CALLED, (/* cancelled */) => {
          expect(callback).to.not.have.been.called();
          expect(source.token.cancellationRequested).to.be.true();
        });
    });

    it('doesn\'t update cancelled if not called', () => {
      const source = new CancellationTokenSource();
      const chain = makeChain(source.token);
      const childChain = makeChain(CancellationToken.canceled);
      const callback = sinon.spy();
      return Promise.resolve()
        ::childChain.then(NOOP)
        ::chain.catch(callback)
        .then(() => {
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(sinon.match.instanceOf(Cancelled));
          expect(source.token.cancellationRequested).to.be.false();
        });
    });

    it('returns a promise', () => {
      const source = new CancellationTokenSource();
      const promise = Promise.resolve()
        ::propagate(source);
      expect(promise).to.be.a(Promise);
    });

    const runSilent = () => {
      const source = new CancellationTokenSource();
      source.cancel();
      return Promise.resolve()
        ::propagate(source);
    };

    testSilent(runSilent);
  });

  afterEach(() => {
    if (unhandledRejectionHandler !== null) {
      process.removeListener(UNHANDLED_REJECTION_EVENT, unhandledRejectionHandler);
    }
    unhandledRejectionHandler = null;
  });
});
