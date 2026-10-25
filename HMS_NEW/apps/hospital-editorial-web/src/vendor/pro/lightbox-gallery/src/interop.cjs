// Small Webpack export helpers; no runtime loader or eval.
exports.d = (target, defs) => {
  for (const key in defs) if (!Object.prototype.hasOwnProperty.call(target, key)) Object.defineProperty(target, key, {
    enumerable: true,
    get: defs[key]
  });
};
exports.r = target => {
  Object.defineProperty(target, Symbol.toStringTag, {
    value: 'Module'
  });
  Object.defineProperty(target, '__esModule', {
    value: true
  });
};
exports.n = value => {
  const getter = value && value.__esModule ? () => value.default : () => value;
  Object.defineProperty(getter, 'a', {
    get: getter
  });
  return getter;
};
exports.t = (value, mode, requireModule) => {
  if (mode & 1) {
    if (typeof requireModule !== 'function') throw new Error('Webpack namespace mode 1 requires an explicit module resolver');
    value = requireModule(value);
  }
  if (mode & 8) return value;
  if (mode & 4 && value && typeof value === 'object' && value.__esModule) return value;
  const namespace = Object.create(null);
  exports.r(namespace);
  Object.defineProperty(namespace, 'default', {
    enumerable: true,
    value
  });
  if (mode & 2 && typeof value !== 'string' && value != null) for (const key in Object(value)) exports.d(namespace, {
    [key]: () => value[key]
  });
  return namespace;
};
exports.o = (object, property) => Object.prototype.hasOwnProperty.call(object, property);
exports.nc = undefined;
exports.g = globalThis;
