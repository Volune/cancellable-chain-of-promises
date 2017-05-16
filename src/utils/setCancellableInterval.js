const setCancellableInterval = (callback, delayParam = +Infinity, tokenParam = undefined) => {
  let delay = delayParam;
  let token = tokenParam;
  if (arguments.length === 2 && typeof delayParam === 'object') {
    token = delayParam;
    delay = 0;
  }
  if (!token) {
    return setInterval(callback, delay);
  }
  if (token.cancellationRequested) {
    return undefined;
  }
  const id = setInterval(function onTimeout(...args) {
    callback.apply(this, args);
  }, delayParam);
  token.register(() => clearInterval(id));
  return id;
};

export default setCancellableInterval;
