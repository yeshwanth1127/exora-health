// Minimal Webpack export-interop semantics for already-resolved captured modules.
exports.d = (target, definitions) => {
  for (const key of Object.keys(definitions)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      Object.defineProperty(target, key, { enumerable: true, get: definitions[key] });
    }
  }
};
exports.r = target => {
  if (typeof Symbol !== "undefined" && Symbol.toStringTag) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
  Object.defineProperty(target, "__esModule", { value: true });
};
exports.n = value => {
  const getter = value && value.__esModule ? () => value.default : () => value;
  Object.defineProperty(getter, "a", { get: getter });
  return getter;
};
exports.t = (value, mode, load) => {
  if (mode & 1) {
    if (typeof load !== "function") throw new Error("Webpack interop.t mode 1 needs a resolved-module loader");
    value = load(value);
  }
  if (mode & 8) return value;
  if ((mode & 4) && value && typeof value === "object" && value.__esModule) return value;
  const namespace = Object.create(null);
  exports.r(namespace);
  const definitions = Object.create(null);
  definitions.default = () => value;
  if ((mode & 2) && value != null && typeof value !== "string") {
    for (const key in Object(value)) {
      if (key !== "default" && !Object.prototype.hasOwnProperty.call(definitions, key)) {
        definitions[key] = () => value[key];
      }
    }
  }
  exports.d(namespace, definitions);
  return namespace;
};
exports.o = (object, property) => Object.prototype.hasOwnProperty.call(object, property);
exports.g = globalThis;
exports.nc = undefined;
