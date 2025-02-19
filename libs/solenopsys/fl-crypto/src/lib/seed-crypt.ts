import {CryptoWrapper} from "./crypto-wrapper";

export class SeedClipper {
    encoder = new TextEncoder();
    decoder = new TextDecoder();


    constructor(private algorithm: string, private cryptoWrapper: CryptoWrapper) {

    }

    getPassData(password: string): Uint8Array {

        const passwordData = this.encoder.encode(password);
        const passData = new Uint8Array(32)
        passData.set(passwordData, 0);
        return passData
    }

    async encryptData(data: Uint8Array, password: string): Promise<string> { // todo add salt
        const algorithm = {name: this.algorithm, length: 256};
        const key = await this.cryptoWrapper.crypto.subtle.importKey('raw', this.getPassData(password), algorithm, false, ['encrypt']);
        const iv = await this.cryptoWrapper.crypto.getRandomValues(new Uint8Array(16));
        const encryptedData = await this.cryptoWrapper.crypto.subtle.encrypt({name: this.algorithm, iv}, key, data);

        const buffer = new Uint8Array(iv.byteLength + encryptedData.byteLength);
        buffer.set(iv, 0);
        buffer.set(new Uint8Array(encryptedData), iv.byteLength);
        return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    // Encrypt a text string using a password
    async encryptText(text: string, password: string): Promise<string> {
        const data = this.encoder.encode(text);

        return this.encryptData(data, password)
    }


// Decrypt an encrypted text string using a password
    async decryptText(encryptedText: string, password: string): Promise<string> {
        const data = await this.decryptData(encryptedText, password);

        const decryptedText = this.decoder.decode(data);

        return decryptedText;
    }

    async decryptData(encryptedText: string, password: string): Promise<Uint8Array> {
        const algorithm = {name: this.algorithm, length: 256};
        const key = await this.cryptoWrapper.crypto.subtle.importKey('raw', this.getPassData(password), algorithm, false, ['decrypt']);

        // @ts-ignore
        const buffer = new Uint8Array(encryptedText.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)));
        const iv = buffer.slice(0, 16);
        const encryptedData = buffer.slice(16);
        const decryptedData = await this.cryptoWrapper.crypto.subtle.decrypt({
            name: this.algorithm,
            iv
        }, key, encryptedData);

        return new Uint8Array(decryptedData);
    }

}


