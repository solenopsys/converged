// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as secp256k1 from 'secp256k1';
import {buf2hex, hex2buf} from "./hex";
import {CryptoWrapper} from "./crypto-wrapper";


export class Tokens {


    constructor(private cryptoWrapper: CryptoWrapper) {

    }


    async createToken(payload: { [key: string]: string }, privateKey: Uint8Array): Promise<string> {
        const body = new TextEncoder().encode(JSON.stringify(payload));
        const hash = await this.cryptoWrapper.sha256(body);
        const signature = secp256k1.ecdsaSign(hash, privateKey);
        console.log("LEN", signature.signature.length)
        return buf2hex(signature.signature) + buf2hex(body);
    }


    async readToken(token: string, publicKey: Uint8Array): Promise<any> {
        const firstPart = token.slice(0, 128);
        const fromHexSignature: Uint8Array = hex2buf(firstPart);

        const secondPart = token.slice(128);
        const fronHexBody: Uint8Array = hex2buf(secondPart);

        const hash = await this.cryptoWrapper.sha256(fronHexBody);

        const verified = secp256k1.ecdsaVerify(fromHexSignature, hash, publicKey);

        if (verified) {
            const payload = JSON.parse(new TextDecoder().decode(fronHexBody));
            const exppiredInMils = parseInt(payload["expired"]);
            if (payload["expired"] && exppiredInMils > new Date().getMilliseconds()) {
                return {verified: true, payload: payload}
            } else {
                return {verified: false, error: "expired"};
            }
        } else {
            return {verified: false, error: "signature"};
        }
    }

}