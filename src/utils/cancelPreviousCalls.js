import { always } from '../index';

const cancelPreviousCalls = (builder, CancellationTokenSource) => {
  let previousSource = null;
  return function wrapper(...arts) {
    if (previousSource) {
      previousSource.cancel();
    }
    const source = new CancellationTokenSource();
    previousSource = source;
    const func = builder(source.token);
    const result = func.apply(this, arts);
    always.call(Promise.resolve(result), () => {
      if (previousSource === source) {
        previousSource = null;
      }
    });
    return result;
  };
};

export default cancelPreviousCalls;
