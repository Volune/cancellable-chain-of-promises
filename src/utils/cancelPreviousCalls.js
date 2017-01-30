import CancelToken, { always } from '../index';

const cancelPreviousCalls = (builder) => {
  let previousCancel = null;
  return function wrapper(...arts) {
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
    const func = builder(token);
    const result = func.apply(this, arts);
    always.call(Promise.resolve(result), clean);
    return result;
  };
};

export default cancelPreviousCalls;
