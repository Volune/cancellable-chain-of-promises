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
  let id;
  const listener = () => clearTimeout(id);
  id = setInterval(function onTimeout(...args) {
    callback.apply(this, args);
  }, delayParam);
  tokenParam.addCancelListener(listener);
  return id;
};

export default setCancellableInterval;
