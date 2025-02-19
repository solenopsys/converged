import { describe, it, expect } from "bun:test";
import { SeedClipper } from "../src/lib/seed-crypt";
import { CryptoWrapper } from "../src/lib/crypto-wrapper";

describe('Encrypt', () => {
    it('should encrypt and decrypt', async () => {
        const clipper = new SeedClipper('AES-CBC', new CryptoWrapper(new Crypto()));
        const pass = "blabla";
        const protectText = "Hello, world!";
        const encrypted = await clipper.encryptText(protectText, pass);

        // In Vitest, toBe() is used for strict equality. not.toBe() checks that the values are not strictly equal.
        expect(encrypted).not.toBe(protectText);

        const decryptText = await clipper.decryptText(encrypted, pass);

        // Use toBe() to expect that decryptText strictly equals protectText
        expect(protectText).toBe(decryptText);
    });
});
