import { CryptoTools, generateMnemonic } from "../src/lib/crypto-tools";
import * as secp256k1 from 'secp256k1';
import { CryptoWrapper } from "../src/lib/crypto-wrapper";
import { describe, it, expect } from "bun:test";

const cw = new CryptoWrapper(new Crypto());

describe('Crypto Tools', () => {

    it('should generate seed', () => {
        const mnemonic = generateMnemonic();
        console.log(mnemonic);

        const strings = mnemonic.split(" ");
        expect(strings.length).toBeGreaterThan(10);
        expect(mnemonic.length).toBeGreaterThan(50);
    });

    it('should generate private key', async () => {
        const ct = new CryptoTools(cw);
        const privateKey = await ct.privateKeyFromSeed("bachelor spy list giggle velvet adjust impulse weasel blush grant hole concert");
        expect(privateKey.buffer.byteLength).toBe(32);
        const hex = Buffer.from(privateKey).toString('hex');
        expect(hex).toBe("c6e35b65ae3a4b385fbc4583d2704c5e0f0bbde105c83850b8dd79e6229ebf6b");
    });

    it('should generate public key', async () => {
        const ct = new CryptoTools(cw);
        const privateKey = await ct.privateKeyFromSeed("bachelor spy list giggle velvet adjust impulse weasel blush grant hole concert");
        const publicKey = await ct.publicKeyFromPrivateKey(privateKey)
        expect(publicKey.buffer.byteLength).toBe(33);
        const hex = Buffer.from(publicKey).toString('hex');
        expect(hex).toBe("030146392224a667aa4399b4c748516296d90719321d57366b4dc9987bf5f98915");
    });

    it('should sign and verify', async () => {
        const ct = new CryptoTools(cw);
        const privateKey = await ct.privateKeyFromSeed("bachelor spy list giggle velvet adjust impulse weasel blush grant hole concert");
        const publicKey = await ct.publicKeyFromPrivateKey(privateKey);
        const message = "Hello World";
        const messageHash = await cw.sha256(ct.encoder.encode(message));
        const signature = secp256k1.ecdsaSign(messageHash, privateKey);
        const verified = secp256k1.ecdsaVerify(signature.signature, messageHash, publicKey);
        expect(verified).toBeTruthy();
    });
});
