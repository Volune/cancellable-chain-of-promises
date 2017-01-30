const setCancellableTimeout = (callback, delayParam = 0, tokenParam = undefined) => {
  let delay = delayParam;
  let token = tokenParam;
  if (arguments.length === 2 && typeof delayParam === 'object') {
    token = delayParam;
    delay = 0;
  }
  if (!token) {
    return setTimeout(callback, delay);
  }
  let id;
  const listener = () => clearTimeout(id);
  id = setTimeout(function onTimeout(...args) {
    tokenParam.removeCancelListener(listener);
    callback.apply(this, args);
  }, delayParam);
  tokenParam.addCancelListener(listener);
  return id;
};

export default setCancellableTimeout;
