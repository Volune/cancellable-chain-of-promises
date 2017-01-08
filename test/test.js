/* eslint-env mocha */
import expect from 'must';
import sinon from 'sinon';
import configureMustSinon from 'must-sinon';
import Cancellable, { Aborted } from '../src/index';

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
    const { token: parentToken, abort } = Cancellable();
    abort();
    run(NOOP, { parentToken });
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

  it(`rejects Aborted exception instead of calling ${callbackName} if aborted`, () => {
    const { token: parentToken, abort } = Cancellable();
    abort();
    const callback = sinon.spy();
    return run(callback, { parentToken })
      .then(NOT_CALLED, (exception) => {
        expect(callback).to.not.have.been.called();
        expect(exception).to.be.an(Aborted);
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

  it(`doesn't wait for ${callbackName} to complete if aborted`, () => {
    const callback = sinon.stub().returns(new Promise(NOOP));
    const { token: parentToken, abort } = Cancellable();
    const promise = Promise.race([
      run(callback, { parentToken }),
      timeout(100),
    ])
      .then(NOT_CALLED, (value) => {
        expect(callback).to.have.been.calledOnce();
        expect(value).to.be.an(Aborted);
      });
    setTimeout(abort, 10);
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

describe('Cancellable', () => {
  it('returns a token object and an abort function', () => {
    const { token, abort } = Cancellable();
    expect(token).to.be.an.object();
    expect(token.aborted).to.be.a.boolean();
    expect(token.then).to.be.a.function();
    expect(token.catch).to.be.a.function();
    expect(abort).to.be.a.function();
  });

  describe('abort', () => {
    it('updates the token', () => {
      const { token, abort } = Cancellable();
      expect(token.aborted).to.be.false();
      abort();
      expect(token.aborted).to.be.true();
    });

    it('propagates to child token', () => {
      const { token: parentToken, abort } = Cancellable();
      const { token } = Cancellable(parentToken);
      expect(token.aborted).to.be.false();
      abort();
      expect(token.aborted).to.be.true();
    });
  });

  describe('always', () => {
    it('is called with resolved value', () => {
      const { token, abort } = Cancellable();
      abort();
      const callback = sinon.spy();
      return Promise.resolve(SOME_VALUE)
        ::token.always(callback)
        .then(() => {
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(undefined, SOME_VALUE);
        });
    });

    it('is called with rejected value', () => {
      const { token, abort } = Cancellable();
      abort();
      const callback = sinon.spy();
      return Promise.reject(SOME_VALUE)
        ::token.always(callback)
        .then(NOT_CALLED, () => {
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(SOME_VALUE, undefined);
        });
    });

    it('is still called after then with aborted exception', () => {
      const { token, abort } = Cancellable();
      abort();
      const callback = sinon.spy();
      return Promise.resolve()
        ::token.then(NOT_CALLED)
        ::token.always(callback)
        .then(NOT_CALLED, (abortedException) => {
          expect(abortedException).to.be.an(Aborted);
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(abortedException, undefined);
        });
    });

    it('is still called after catch with aborted exception', () => {
      const { token, abort } = Cancellable();
      abort();
      const callback = sinon.spy();
      return Promise.reject()
        ::token.catch(NOT_CALLED)
        ::token.always(callback)
        .then(NOT_CALLED, (abortedException) => {
          expect(abortedException).to.be.an(Aborted);
          expect(callback).to.have.been.calledOnce();
          expect(callback).to.have.been.calledWithExactly(abortedException, undefined);
        });
    });

    const runSilent = () => {
      const { token, abort } = Cancellable();
      abort();
      return Promise.reject(token.abortError)
        ::token.always(NOOP);
    };

    testSilent(runSilent);
  });

  describe('token', () => {
    describe('then', () => {
      const run = (callback, { input, parentToken } = {}) => {
        const { token } = Cancellable(parentToken);
        return Promise.resolve(input)
          ::token.then(callback);
      };

      const runRejection = (callback, { input, parentToken } = {}) => {
        const { token } = Cancellable(parentToken);
        return Promise.reject(input)
          ::token.then(NOT_CALLED, callback);
      };

      testThenCatch(run);
      testCallback(run);
      testCallback(runRejection, 'rejection callback');
    });

    describe('catch', () => {
      const run = (callback, { input, parentToken } = {}) => {
        const { token } = Cancellable(parentToken);
        return Promise.reject(input)
          ::token.catch(callback);
      };

      testThenCatch(run);
      testCallback(run);
    });

    describe('propagate', () => {
      it('updates aborted', () => {
        const { token } = Cancellable();
        const { token: childToken, abort } = Cancellable(token);
        abort();
        const callback = sinon.spy();
        return Promise.resolve()
          ::childToken.then(NOOP)
          ::token.propagate()
          ::token.catch(callback)
          .then(NOT_CALLED, (/* aborted */) => {
            expect(callback).to.not.have.been.called();
            expect(token.aborted).to.be.true();
          });
      });

      it('doesn\'t update aborted if not called', () => {
        const { token } = Cancellable();
        const { token: childToken, abort } = Cancellable(token);
        abort();
        const callback = sinon.spy();
        return Promise.resolve()
          ::childToken.then(NOOP)
          ::token.catch(callback)
          .then(() => {
            expect(callback).to.have.been.calledOnce();
            expect(callback).to.have.been.calledWithExactly(sinon.match.instanceOf(Aborted));
            expect(token.aborted).to.be.false();
          });
      });

      const runSilent = () => {
        const { token, abort } = Cancellable();
        abort();
        return Promise.resolve()::token.propagate();
      };

      testSilent(runSilent);
    });

    describe('ifaborted', () => {
      it('is called if aborted', () => {
        const { token, abort } = Cancellable();
        abort();
        const callback = sinon.spy();
        return Promise.resolve()
          ::token.ifaborted(callback)
          .then(() => {
            expect(callback).to.have.been.calledOnce();
            expect(callback).to.have.been.calledWithExactly(sinon.match.instanceOf(Aborted));
          });
      });

      it('resolves with returned value if aborted', () => {
        const { token, abort } = Cancellable();
        abort();
        const callback = sinon.stub().returns(SOME_VALUE);
        return Promise.resolve()
          ::token.ifaborted(callback)
          .then((value) => {
            expect(callback).to.have.been.calledOnce();
            expect(value).to.equal(SOME_VALUE);
          });
      });

      it('rejects with thrown exception if aborted', () => {
        const { token, abort } = Cancellable();
        abort();
        const callback = sinon.stub().throws(SOME_VALUE);
        return Promise.resolve()
          ::token.ifaborted(callback)
          .then(NOT_CALLED, (exception) => {
            expect(callback).to.have.been.calledOnce();
            expect(exception).to.equal(SOME_VALUE);
          });
      });

      it('is not called if not aborted', () => {
        const { token } = Cancellable();
        const callback = sinon.spy();
        return Promise.resolve()
          ::token.ifaborted(callback)
          .then(() => {
            expect(callback).to.not.have.been.called();
          });
      });
    });

    describe('addAbortListener', () => {
      it('is called with abort error on abort', () => {
        const { token, abort } = Cancellable();
        const listener = sinon.spy();
        token.addAbortListener(listener);
        expect(listener).to.not.have.been.called();
        abort();
        expect(listener).to.have.been.calledOnce();
        expect(listener).to.have.been.calledWithExactly(sinon.match.instanceOf(Aborted));
      });
    });
  });

  afterEach(() => {
    if (unhandledRejectionHandler !== null) {
      process.removeListener(UNHANDLED_REJECTION_EVENT, unhandledRejectionHandler);
    }
    unhandledRejectionHandler = null;
  });
});
