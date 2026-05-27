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
  const proto = resolveProto(instanceOrProto);
  const method = proto[methodName];
  if (typeof method === "function") {
    const methodLevel = METHOD_ACCESS.get(method);
    if (methodLevel) return methodLevel;
  }
  const classLevel = CLASS_ACCESS.get(proto);
  if (classLevel) return classLevel;
  return "user";
}

// --- @Service decorator ---
const CLASS_SERVICE = new WeakMap<object, string>();

export function Service(name: string) {
  return function (value: any, context: ClassDecoratorContext) {
    CLASS_SERVICE.set(value.prototype, name);
  };
}

export function resolveServiceName(instanceOrProto: any): string | undefined {
  return CLASS_SERVICE.get(resolveProto(instanceOrProto));
}

// --- @LLM decorator ---
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
