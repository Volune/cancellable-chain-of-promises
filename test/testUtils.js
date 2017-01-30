/* eslint-env mocha */
import expect from 'must';
import sinon from 'sinon';
import CancelToken, { create as createCancelToken } from '../src/index';
import setCancellableTimeout from '../src/utils/setCancellableTimeout';

describe('setCancellableTimeout', () => {
  it('calls callback if not cancelled', (done) => {
    const callback = sinon.spy();
    const token = new CancelToken();
    setCancellableTimeout(callback, 1, token);
    setTimeout(() => {
      expect(callback).to.have.been.calledOnce();
      done();
    }, 5);
  });

  it('doesn\'t call callback if cancelled before', (done) => {
    const callback = sinon.spy();
    const { token, cancel } = createCancelToken();
    cancel();
    setCancellableTimeout(callback, 1, token);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 5);
  });

  it('doesn\'t call callback if cancelled after', (done) => {
    const callback = sinon.spy();
    const { token, cancel } = createCancelToken();
    setCancellableTimeout(callback, 5, token);
    setTimeout(cancel, 0);
    setTimeout(() => {
      expect(callback).to.not.have.been.called();
      done();
    }, 10);
  });

  it('has optional delay argument', (done) => {
    const callback = sinon.spy();
    const token = new CancelToken();
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
