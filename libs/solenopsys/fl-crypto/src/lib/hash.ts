import {CryptoWrapper} from "./crypto-wrapper";


const encoder = new TextEncoder();


export class Hash{

    constructor(private cryptoWrapper: CryptoWrapper) {
    }

     async   genHash(password: string, login: string){
        const group= password + login
        const encoded = Uint8Array.from(group, c => c.charCodeAt(0));
        const hash = await this.cryptoWrapper.sha256(encoded);
        const hexHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        return hexHash;
    }
}






