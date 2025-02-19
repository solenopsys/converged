import { CryptoWrapper } from "../src/lib/crypto-wrapper";
import { Hash } from "../src/lib/hash";
import { describe, it, expect } from "bun:test";

describe('Encrypt', () => {
    it('should encrypt', async () => {
        const cw = new CryptoWrapper(new Crypto());
        const hashTool = new Hash(cw);
        const hash = await hashTool.genHash("bla2", "bla1")
        expect(hash).toBe("e64938fc6124b4dfa8a2f225cc4998df473cbd6710c364684a1f42f6257d8f8c");
    });
});
