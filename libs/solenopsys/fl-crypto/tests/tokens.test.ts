import { describe, it, expect } from "bun:test";
import { CryptoTools } from "../src/lib/crypto-tools";
import * as moment from "moment";
import { CryptoWrapper } from "../src/lib/crypto-wrapper";
import { Tokens } from "../src/lib/tokens";

describe('Tokens Tools', () => {
    it('sing and check', async () => {
        const cw = new CryptoWrapper(new Crypto());
        const tokens = new Tokens(cw);
        const ct = new CryptoTools(cw);
        const privateKey = await ct.privateKeyFromSeed("bachelor spy list giggle velvet adjust impulse weasel blush grant hole concert");
        const publicKey = await ct.publicKeyFromPrivateKey(privateKey);
        const dataExpired = moment().add(14, "days").valueOf();
        const token = await tokens.createToken({ test: "test", expired: "" + dataExpired }, privateKey);
        const body = await tokens.readToken(token, publicKey);
        console.log("GENERATED", body);

        // Add expectations here if needed, e.g.:
        // expect(body).toHaveProperty('test', 'test');
        // expect(body).toHaveProperty('expired');
    });
});
