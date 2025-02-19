

export class CryptoWrapper{
    constructor(public crypto: Crypto) {
    }

    async sha256(data: Uint8Array): Promise<Uint8Array> {
        const hash = await this.crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hash);
    }

}