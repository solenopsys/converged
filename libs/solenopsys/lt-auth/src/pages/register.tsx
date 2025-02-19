import {
	CryptoWrapper,
	Hash,
	SeedClipper,
	generateMnemonic,
	CryptoTools,
	buf2hex,
} from "@solenopsys/fl-crypto";
import { Component } from "@solenopsys/converged-renderer";
import {UiTextField,UiSelectField,UiMultilineField} from "@solenopsys/ui-forms";
import {UiButton} from "@solenopsys/ui-controls";

const cw = new CryptoWrapper(window.crypto);

const EMAIL = { uid: "email", title: "Email" };
import $ from "@solenopsys/converged-reactive";
import {effect,Observable} from "@solenopsys/converged-reactive";
import {KEY_SERVICE} from "../services"

import fieldsStyles from "./styles/fields.module.scss"

class MessagersDataProvider {
	privateKey: string;

	public fieldWidth = 400;

	data = $([{ uid: "log", title: "Log" }, EMAIL]);

	initObserver(str: Observable<string>): Observable<EntityTitle[]> {
		return this.data;
	}

	byId(id: string): Observable<string> {
		return this.data
			.asObservable()
			.pipe(map((list) => list.find((i) => i.uid === id)?.title));
	}
}

const RegisterComponent: Component = () => {
	const password = $("");
	const mnemonic = $("");
	const login = $("");
	
	const clipper=new SeedClipper(new SeedClipper("AES-CBC", cw));
	const encryptedKey= $("");
	const regenerate = $(null);
	const transport= $(EMAIL);
	const messagersProvider= $(
		new MessagersDataProvider(),
	);
	const publicKey = $("");
	const privateKey = $(null);
	const success = $(false);
	const error = $(null);
	const fieldWidth = $(300);

	

	async function sendCode() {
		const tr = transport().uid;
		const h = new Hash(cw);
		const hash = await h.genHash(password(), login());
		const publicKey = await new CryptoTools(cw).publicKeyFromPrivateKey(
			privateKey(),
		);
		const pubkeyHex = buf2hex(publicKey);
		const registerData: RegisterData = {
			transport: tr,
			login: login(),
			encryptedKey: encryptedKey(),
			publicKey: pubkeyHex,
			hash: hash,
		};

		console.log(registerData);

		KEY_SERVICE.register(registerData)
			.then((res:string) => {
				success(true);
				console.log(res);
			})
			.catch((err:any) => {
				error(err);
				console.log(err);
			});
	}

	function generateSeed() {
		mnemonic(generateMnemonic());
		regenerate({});
	}

	effect(() => {
		if (regenerate()) {
			(async () => {
				privateKey(await new CryptoTools(cw).privateKeyFromSeed(mnemonic()));
				encryptedKey(await clipper.encryptData(privateKey(), password()));
			})();
		}
	});


 
	

//	onCleanup(() => {});

	return (
		<div style={{ display: "flex" }}>
			<div style={{ width: "600px" }}>
				{!success() && (
					<>
						<h4>Seed phase.</h4>
						<div class={fieldsStyles.fieldBlock}>
							<div>
								<div>
									<UiMultilineField
										width={fieldWidth()}
										title="Seed phase"
										value={mnemonic()}
										onValueChange={(e:any) => mnemonic(e.target.value)}
										onInput={(e:any) => regenerate({})}
									/>
								</div>
							</div>
							<div class={fieldsStyles.fieldDescription}>
								With the help of this phrase, you can perform any important
								action in Solenopsys, such as logging in, sending money, and
								controlling your clusters. You can imagine your own seed phase
								or{" "}
								<a
									style={{
										cursor: "pointer",
										color: "red",
										textDecoration: "underline",
									}}
									onClick={generateSeed}
								>
									generate
								</a>{" "}
								it.
							</div>
						</div>
						{mnemonic() && (
							<>
								<h4>Password</h4>
								<div class={fieldsStyles.fieldBlock}>
									<div>
										<div>
											<UiTextField
												width={fieldWidth()}
												value={password()}
												onInput={(e:any) => password(e.target.value)}
												onValueChange={(e:any) => regenerate({})}
												password={true}
												title="Password"
											/>
										</div>
									</div>
									<div class={fieldsStyles.fieldDescription}>
										to protect the seed phase. The seed phase is always stored
										and transferred in an encrypted
									</div>
								</div>
								{password() && (
									<>
										<h4>Encrypted seed</h4>
										<div class={fieldsStyles.fieldBlock}>
											<div
												style={{ minWidth: fieldWidth() + "px" }}
												class="qr-wrapper"
											>
												<UiQrcode data={encryptedKey()} />
											</div>
											<div class={fieldsStyles.fieldDescription}>
												You are can save this QR code to restore your seed phase
												in the future.
											</div>
										</div>
										<h4>Messenger</h4>
										<div class={fieldsStyles.fieldBlock}>
											<div>
												<UiSelectField
													width={fieldWidth()}
													value={transport()}
													dataProvider={messagersProvider()}
													onValueChange={transport}
												/>
											</div>
											<div class={fieldsStyles.fieldDescription}>
												What is the most convenient way for you to authenticate?
											</div>
										</div>
										<h4>Account</h4>
										<div class={fieldsStyles.fieldBlock}>
											<div>
												<div>
													<UiTextField
														title="Login"
														width={fieldWidth()}
														value={login()}
														onInput={(e:any) => login(e.target.value)}
													/>
												</div>
											</div>
											<div class={fieldsStyles.fieldDescription}>name in your massager</div>
										</div>
										<div class={fieldsStyles.fieldBlock}>
											{login() && (
												<UiButton
													title="Зарегистрироваться"
													onClick={sendCode}
												/>
											)}
										</div>
										<div class={fieldsStyles.fieldBlock}>
											{error() && `Error: ${error().message}`}
										</div>
									</>
								)}
							</>
						)}
					</>
				)}
				{success() && (
					<>
						Private key is sent to the server. To store this key on the server,
						you need to open the link in the message that is sent to you to the{" "}
						<b>{transport()?.title}</b>
					</>
				)}
			</div>
		</div>
	);
};

export default RegisterComponent;
