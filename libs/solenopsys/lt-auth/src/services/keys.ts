
// const HOST = "https://keys.solenopsys.org"
// const HOST = "http://localhost:5373"
const HOST = "http://127.0.0.1:8899"
import { jsonFeth } from "./fetcher";

export type RegisterData = {
  transport: string;
  login: string;
  encryptedKey: string;
  publicKey: string;
  hash: string;
}

export class KeysService {
  async register(registerData:any) {
    return jsonFeth(`${HOST}/api/register`,registerData);
  }

  async key(hash:string) {
    return jsonFeth(`${HOST}/api/register`,{ hash });
  }
}
