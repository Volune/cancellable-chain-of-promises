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
  if (token.cancellationRequested) {
    return undefined;
  }
  let id;
  const registration = token.register(() => clearTimeout(id));
  id = setTimeout(function onTimeout(...args) {
    registration.unregister();
    callback.apply(this, args);
  }, delayParam);
  return id;
};

export default setCancellableTimeout;
