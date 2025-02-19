// Типы для JSON
type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// Интерфейсы для обработчиков
interface SpecialField {
    fieldName: string;
    value: JsonValue;
}

interface FieldHandler {
    filedName(): string;
    process(field: SpecialField): Promise<JsonObject>;
}

// Базовые утилиты
const isObject = (value: unknown): value is JsonObject => 
    typeof value === 'object' && value !== null && !Array.isArray(value);

const findSpecialField = (obj: JsonObject): SpecialField | null => {
    const entry = Object.entries(obj).find(([key]) => key.startsWith('@'));
    return entry ? { fieldName: entry[0], value: entry[1] } : null;
};


// Процессор полей
class SpecialFieldHandlersRegistry {
    private processors:  Record<string, FieldHandler> = {};

    register(handler: FieldHandler): void {
        this.processors[handler.filedName()] = handler;
    }

    async processField(field: SpecialField): Promise<JsonObject> {
        console.log("processField",field)
        const processor = this.processors[field.fieldName];
        if (!processor) {
            throw new Error(`No processor found for field: ${field.fieldName}`);
        }
        return processor.process(field);
    }
}

// Основной процессор JSON
class JsonFieldProcessor {
    constructor(private processorRegistry: SpecialFieldHandlersRegistry) {}

    async process(jsonObject: any): Promise<JsonObject> {
        const processNode = async (value: JsonValue): Promise<JsonValue> => {
            if (!isObject(value)) {
                return value;
            }

            const result = { ...value };
            const specialField = findSpecialField(value);

            if (specialField) {
                return this.processorRegistry.processField(specialField);
            }

            for (const [key, val] of Object.entries(result)) {
                result[key] = await processNode(val);
            }

            return result;
        };

        return processNode(jsonObject) as Promise<JsonObject>;
    }
}

export type { JsonValue, JsonObject, JsonArray ,FieldHandler,SpecialField};
export {   SpecialFieldHandlersRegistry, JsonFieldProcessor };