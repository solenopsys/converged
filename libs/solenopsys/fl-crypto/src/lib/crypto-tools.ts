// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as secp256k1 from 'secp256k1';


import {entropyToMnemonic} from "bip39";
import {buf2hex} from "./hex";
import {CryptoWrapper} from "./crypto-wrapper";


export class CryptoTools {
    encoder = new TextEncoder();

    constructor(private cryptoWrapper: CryptoWrapper) {
    }

    async privateKeyFromSeed(seedPhrase: string): Promise<Uint8Array> {
        const hash: ArrayBuffer = await this.cryptoWrapper.sha256(this.encoder.encode(seedPhrase));
        const privateKey = new Uint8Array(hash.slice(0, 32));
        const hexHash = buf2hex(new Uint8Array(hash));
        console.log("HASH", hexHash)
        while (!secp256k1.privateKeyVerify(privateKey)) {
            const reHash = await this.cryptoWrapper.sha256(new Uint8Array(hash));
            privateKey.set(new Uint8Array(reHash.slice(0, 32)));
        }
        return privateKey;
    }

    async publicKeyFromPrivateKey(privateKey: Uint8Array): Promise<Uint8Array> {
        return secp256k1.publicKeyCreate(privateKey);
    }
}


//@ts-ignore
import  Buffer  from 'buffer';

export function generateMnemonic() {

//    window.Buffer = Buffer;
    const entropy = new Uint8Array(32)

    window.crypto.getRandomValues(entropy);
    const stringEntropy = buf2hex(entropy);


    return entropyToMnemonic(stringEntropy)
}