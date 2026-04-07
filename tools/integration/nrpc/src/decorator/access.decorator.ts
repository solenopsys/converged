export type AccessLevel = "public" | "internal" | "user";

const METHOD_ACCESS = new WeakMap<Function, AccessLevel>();
const CLASS_ACCESS = new WeakMap<object, AccessLevel>();

export function Access(level: AccessLevel) {
  return function (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) {
    if (context.kind === "class") {
      CLASS_ACCESS.set(value.prototype, level);
    } else if (context.kind === "method") {
      METHOD_ACCESS.set(value, level);
    }
  };
}

export function resolveMethodAccess(instanceOrProto: any, methodName: string): AccessLevel {
  const proto = typeof instanceOrProto === "object" && instanceOrProto !== null
    ? (instanceOrProto.constructor?.prototype === instanceOrProto
        ? instanceOrProto
        : Object.getPrototypeOf(instanceOrProto))
    : instanceOrProto;

  const method = proto[methodName];
  if (typeof method === "function") {
    const methodLevel = METHOD_ACCESS.get(method);
    if (methodLevel) return methodLevel;
  }

  const classLevel = CLASS_ACCESS.get(proto);
  if (classLevel) return classLevel;

  return "user";
}
