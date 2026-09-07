export type AccessLevel = "public" | "internal" | "user";

const METHOD_ACCESS = new WeakMap<Function, AccessLevel>();
const CLASS_ACCESS = new WeakMap<object, AccessLevel>();
// A container bundles the runtime and each service entry separately. They can
// therefore load separate copies of this module, while the runtime must still
// read decorators applied by a service chunk. Symbols survive that boundary;
// WeakMaps remain the fast path for a single module instance.
const METHOD_ACCESS_SYMBOL = Symbol.for("nrpc.access.method");
const CLASS_ACCESS_SYMBOL = Symbol.for("nrpc.access.class");

export function Access(level: AccessLevel) {
  return function (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) {
    if (context.kind === "class") {
      CLASS_ACCESS.set(value.prototype, level);
      Object.defineProperty(value.prototype, CLASS_ACCESS_SYMBOL, {
        value: level,
        configurable: true,
      });
    } else if (context.kind === "method") {
      METHOD_ACCESS.set(value, level);
      Object.defineProperty(value, METHOD_ACCESS_SYMBOL, {
        value: level,
        configurable: true,
      });
    }
  };
}

export function resolveMethodAccess(
  instanceOrProto: any,
  methodName: string,
  fallback: AccessLevel = "user",
): AccessLevel {
  const proto = resolveProto(instanceOrProto);
  const method = proto[methodName];
  if (typeof method === "function") {
    const methodLevel =
      METHOD_ACCESS.get(method) ??
      (method as { [METHOD_ACCESS_SYMBOL]?: AccessLevel })[METHOD_ACCESS_SYMBOL];
    if (methodLevel) return methodLevel;
  }
  const classLevel =
    CLASS_ACCESS.get(proto) ??
    (proto as { [CLASS_ACCESS_SYMBOL]?: AccessLevel })[CLASS_ACCESS_SYMBOL];
  if (classLevel) return classLevel;
  return fallback;
}

const CLASS_SERVICE = new WeakMap<object, string>();

export function Service(name: string) {
  return function (value: any, context: ClassDecoratorContext) {
    CLASS_SERVICE.set(value.prototype, name);
  };
}

export function resolveServiceName(instanceOrProto: any): string | undefined {
  return CLASS_SERVICE.get(resolveProto(instanceOrProto));
}

export interface LLMOptions {
  brief: string;
  category?: string;
}

const METHOD_LLM = new WeakMap<Function, LLMOptions>();

export function LLM(options: LLMOptions) {
  return function (value: any, context: ClassMethodDecoratorContext) {
    METHOD_LLM.set(value, options);
  };
}

export function resolveMethodLLM(instanceOrProto: any, methodName: string): LLMOptions | undefined {
  const proto = resolveProto(instanceOrProto);
  const method = proto[methodName];
  if (typeof method === "function") {
    return METHOD_LLM.get(method);
  }
  return undefined;
}

function resolveProto(instanceOrProto: any): any {
  if (typeof instanceOrProto === "object" && instanceOrProto !== null) {
    if (instanceOrProto.constructor?.prototype === instanceOrProto) return instanceOrProto;
    return Object.getPrototypeOf(instanceOrProto);
  }
  return instanceOrProto;
}
