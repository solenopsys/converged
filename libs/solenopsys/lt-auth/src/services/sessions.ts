
import {CryptoWrapper, hex2buf, Tokens} from "@solenopsys/fl-crypto";

const STORAGE_KEY = "auth";

export type Auth = {
    pubKey: string,
    expiredAt: Date,
}



export class SessionsService {

    async saveSession(pubKey: string, sessionToken: string) {
        let auth: any = localStorage.getItem(STORAGE_KEY);
        if (!auth) {
            auth = {}
        } else {
            auth = JSON.parse(auth)
        }
        auth[pubKey] = sessionToken
        localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    }

    async getSessions() {
        const auth = localStorage.getItem(STORAGE_KEY);
        const obj = JSON.parse(auth)
        console.log("AUTH",)
        const items: Auth[] = [];
        if (obj) {
            const keys = Object.keys(obj);
            for (const key of keys) {
                const tokenBytes = obj[key];
                try {
                    const cw=new CryptoWrapper(crypto)
                    const tokens= new Tokens(cw);

                    const tokenData = await tokens.readToken(tokenBytes, hex2buf(key));
                    console.log("KEY", key, tokenData)
                    const expired: number = parseInt(tokenData.payload.expired) ;
                    items.push({pubKey: key, expiredAt: new Date(expired * 1000)})
                } catch (e) {
                    console.log("ERROR", e)
                }
            }

        }
        return items;
    }

    deleteSession(pubKey: any) {
        const auth = localStorage.getItem(STORAGE_KEY);
        const obj = JSON.parse(auth)
        delete obj[pubKey]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    }
}