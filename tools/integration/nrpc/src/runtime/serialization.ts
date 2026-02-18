// serialization.ts - Type handler registration system

export interface TypeHandler {
  serialize: (value: any) => any;
  deserialize: (value: any) => any;
  detect?: (value: any) => boolean;
}

class TypeHandlerRegistry {
  private handlers = new Map<string, TypeHandler>();
  private autoDetectHandlers: Array<{
    detect: (value: any) => boolean;
    deserialize: (value: any) => any;
  }> = [];

  register(typeName: string, handler: TypeHandler) {
    this.handlers.set(typeName, handler);
    if (handler.detect) {
      this.autoDetectHandlers.push({
        detect: handler.detect,
        deserialize: handler.deserialize,
      });
    }
  }

  getHandler(typeName: string): TypeHandler | undefined {
    return this.handlers.get(typeName);
  }

  autoDetectAndDeserialize(value: any): any {
    for (const handler of this.autoDetectHandlers) {
      if (handler.detect(value)) {
        return handler.deserialize(value);
      }
    }
    return value;
  }
}

const registry = new TypeHandlerRegistry();

// Register Date handler
registry.register("Date", {
  serialize: (value: any) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Если пришло число (timestamp) или строка - пытаемся конвертировать
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    // Если конвертация не удалась - возвращаем как есть
    return value;
  },
  deserialize: (value: string) => new Date(value),
  detect: (value: any) => {
    if (typeof value !== "string") return false;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoDateRegex.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
});

// Register Uint8Array handler (base64 encoding)
registry.register("Uint8Array", {
  serialize: (value: any) => {
    if (value instanceof Uint8Array) {
      // Convert to base64
      let binary = "";
      for (let i = 0; i < value.byteLength; i++) {
        binary += String.fromCharCode(value[i]);
      }
      return { __type: "Uint8Array", data: btoa(binary) };
    }
    return value;
  },
  deserialize: (value: any) => {
    if (
      typeof value === "object" &&
      value.__type === "Uint8Array" &&
      typeof value.data === "string"
    ) {
      const binary = atob(value.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    // Also handle plain base64 string
    if (typeof value === "string") {
      try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch {
        return value;
      }
    }
    return value;
  },
  detect: (value: any) => {
    return (
      typeof value === "object" &&
      value !== null &&
      value.__type === "Uint8Array"
    );
  },
});

export function serializeValue(value: any, typeName?: string): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, typeName));
  }

  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler && value.constructor.name === typeName) {
      return handler.serialize(value);
    }
  }

  // Auto-detect built-in types
  const handlerForType = registry.getHandler(value.constructor.name);
  if (handlerForType) {
    return handlerForType.serialize(value);
  }

  if (typeof value === "object") {
    const result: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        result[key] = serializeValue(value[key]);
      }
    }
    return result;
  }

  return value;
}

export function deserializeValue(value: any, typeName?: string): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item, typeName));
  }

  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler) {
      return handler.deserialize(value);
    }
  }

  if (typeof value === "object") {
    const result: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        const childValue = value[key];
        const detected = registry.autoDetectAndDeserialize(childValue);
        // Если обнаружение сработало, используем результат, иначе рекурсивно десериализуем
        result[key] =
          detected !== childValue ? detected : deserializeValue(childValue);
      }
    }
    return result;
  }

  return registry.autoDetectAndDeserialize(value);
}

export { registry as typeHandlerRegistry };
