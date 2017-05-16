/* eslint-env mocha */
import expect from 'must';
import sinon from 'sinon';
import { CancellationTokenSource, CancellationToken } from 'prex';
import cancelPreviousCalls from '../src/utils/cancelPreviousCalls';
import setCancellableTimeout from '../src/utils/setCancellableTimeout';
import setCancellableInterval from '../src/utils/setCancellableInterval';

const NOOP = () => undefined;

describe('setCancellableTimeout', () => {
  it('calls callback if not cancelled', (done) => {
    const callback = sinon.spy();
    const token = CancellationToken.none;
    setCancellableTimeout(callback, 1, token);
    setTimeout(() => {
      expect(callback).to.have.been.calledOnce();
      done();
    }, 5);
  });

  it('doesn\'t call callback if cancelled before', (done) => {
    const callback = sinon.spy();
    const source = new CancellationTokenSource();
    const token = source.token;
    source.cancel();
    setCancellableTimeout(callback, 1, token);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 5);
  });

  it('doesn\'t call callback if cancelled after', (done) => {
    const callback = sinon.spy();
    const source = new CancellationTokenSource();
    const token = source.token;
    setCancellableTimeout(callback, 5, token);
    setTimeout(() => source.cancel(), 0);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 10);
  });

  it('has optional delay argument', (done) => {
    const callback = sinon.spy();
    const token = CancellationToken.none;
    setCancellableTimeout(callback, token);
    setTimeout(() => {
      expect(callback).to.have.been.calledOnce();
      done();
    }, 5);
  });

  it('has optional token argument', (done) => {
    const callback = sinon.spy();
    setCancellableTimeout(callback, 1);
    setTimeout(() => {
      expect(callback).to.have.been.calledOnce();
      done();
    }, 5);
  });

  it('returns timeout id', (done) => {
    const callback = sinon.spy();
    const id = setCancellableTimeout(callback, 1);
    expect(id).not.to.be.undefined();
    clearTimeout(id);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 5);
  });
});

describe('setCancellableInterval', () => {
  it('calls callback if not cancelled', (done) => {
    const callback = sinon.spy();
    const token = CancellationToken.none;
    const id = setCancellableInterval(callback, 1, token);
    setTimeout(() => {
      clearInterval(id);
      expect(callback).to.have.been.called();
      expect(callback.callCount).to.be.at.least(2);
      done();
    }, 10);
  });

  it('doesn\'t call callback if cancelled before', (done) => {
    const callback = sinon.spy();
    const source = new CancellationTokenSource();
    const token = source.token;
    source.cancel();
    setCancellableInterval(callback, 1, token);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 5);
  });

  it('doesn\'t call callback if cancelled after', (done) => {
    const callback = sinon.spy();
    const source = new CancellationTokenSource();
    const token = source.token;
    setCancellableInterval(callback, 5, token);
    setTimeout(() => source.cancel(), 0);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 10);
  });

  it('has optional token argument', (done) => {
    const callback = sinon.spy();
    const id = setCancellableInterval(callback, 1);
    setTimeout(() => {
      clearInterval(id);
      expect(callback).to.have.been.called();
      done();
    }, 5);
  });

  it('returns interval id', (done) => {
    const callback = sinon.spy();
    const id = setCancellableInterval(callback, 1);
    expect(id).not.to.be.undefined();
    clearInterval(id);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 5);
  });
});

describe('cancelPreviousCalls', () => {
  it('provides a token', () => {
    const builder = sinon.stub().returns(NOOP);
    const func = cancelPreviousCalls(builder, CancellationTokenSource);
    func();
    expect(builder).to.have.been.calledOnce();
    expect(builder).to.have.been.calledWith(sinon.match.instanceOf(CancellationToken));
  });

  it('cancels previous token on next call', () => {
    const tokens = [];
    const func = cancelPreviousCalls((token) => {
      tokens.push(token);
      return NOOP;
    }, CancellationTokenSource);
    func();
    func();
    expect(tokens).to.have.length(2);
    expect(tokens[0].cancellationRequested).to.be.true();
    expect(tokens[1].cancellationRequested).to.be.false();
  });

  it('passes arguments and returne value', () => {
    const SOME_ARG = { someArg: true };
    const SOME_ARG_2 = { someArg2: true };
    const SOME_RESULT = { someResult: true };
    const spy = sinon.stub().returns(SOME_RESULT);
    const func = cancelPreviousCalls(() => spy, CancellationTokenSource);
    const returnedValue = func(SOME_ARG, SOME_ARG_2);
    expect(spy).to.have.been.calledOnce();
    expect(spy).to.have.been.calledWithExactly(SOME_ARG, SOME_ARG_2);
    expect(returnedValue).to.equal(SOME_RESULT);
  });
});
