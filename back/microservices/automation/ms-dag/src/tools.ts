// Конверт наносекунд в строку
export const nanosToString = (ns: bigint | number): string =>
  new Date(Number((typeof ns === 'bigint' ? ns : BigInt(ns)) / 1000000n)).toISOString();

// Конверт строки в наносекунды  
export const stringToNanos = (str: string): bigint =>
  BigInt(new Date(str).getTime()) * 1000000n;


export const toHex = (hashBuffer: Uint8Array): string => {
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
import { createHash } from 'crypto';


export function genHash (body:string){
   const hash=createHash('sha256').update(body).digest();
   const hashString=toHex(hash);
   return hashString;
}

export function preciseStringfy(obj: any): string {
  return JSON.stringify(sortKeysDeep(obj));
}

export function sortKeysDeep<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(sortKeysDeep) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    // Проверяем, не является ли объект специальным типом
    if (obj instanceof Date || obj instanceof RegExp ||
      obj instanceof Map || obj instanceof Set) {
      return obj;
    }

    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortKeysDeep((obj as any)[key]);
        return acc;
      }, {}) as T;
  }

  return obj;
}