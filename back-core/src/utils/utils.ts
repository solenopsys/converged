const KEY_SEPARATOR = ":";
const RANGE_START_SUFFIX = KEY_SEPARATOR;
const RANGE_END_SUFFIX = ";";
export {KEY_SEPARATOR,RANGE_START_SUFFIX,RANGE_END_SUFFIX};

export type ULID = string;

export function generateULID(): ULID {
  const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  
  // 48 бит времени (6 байт)
  const time = Date.now();
  let timeStr = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
      timeStr = BASE32[t % 32] + timeStr;
      t = Math.floor(t / 32);
  }
  
  // 80 бит случайности (16 символов)
  let randomStr = '';
  for (let i = 0; i < 16; i++) {
      randomStr += BASE32[Math.floor(Math.random() * 32)];
  }
  
  return timeStr + randomStr;  // 26 символов
}

export function newULID(): ULID {
  return generateULID();
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


 