export function generateULID(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function generateUUID(): Uint8Array {
  // Простая генерация UUID v4 в виде 16 байт
  const uuid = new Uint8Array(16);
  crypto.getRandomValues(uuid);
  
  // Установим версию (4) и вариант согласно RFC 4122
  uuid[6] = (uuid[6] & 0x0f) | 0x40; // версия 4
  uuid[8] = (uuid[8] & 0x3f) | 0x80; // вариант 10
  
  return uuid;
}


export function extractCommentParam(code:string){
  const lines = code.split("\n")[0];
  const strParams = lines.split("//")[1];
  
  return JSON.parse(strParams);
}

export function timeVersion(){
  return new Date().getTime().toString();
}


 