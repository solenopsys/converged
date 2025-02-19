import {
	CryptoWrapper,
	Hash,
	SeedClipper,
	Tokens,
} from "@solenopsys/fl-crypto";
import $ from "@solenopsys/converged-reactive";
import { Component } from "@solenopsys/converged-renderer";
import {useNavigate} from "@solenopsys/converged-router";
import { SESSION_SERVICE } from "../services"
import {UiTextField} from "@solenopsys/ui-forms";
import {UiButton} from "@solenopsys/ui-controls";

import fieldsStyles from "./styles/fields.module.scss"
import styles from "./styles/login.module.scss"


const cw = new CryptoWrapper(window.crypto);

const LoginComponent: Component = () => {
	const login = $("");
	const password = $("");
	const error = $(undefined);
	
	const result = $("");
	const navigate = useNavigate();

	const clipper=new SeedClipper(new SeedClipper("AES-CBC", cw));

	const load = async () => {
		const h = new Hash(cw);
		const hash = await h.genHash(password(), login());
		try {
			const res = await SESSION_SERVICE.key(hash);
			const privateKey = await clipper.decryptData(
				res.encryptedKey,
				password(),
			);

			console.log("succesed", res, privateKey);

			const dayMills = 24 * 60 * 60 * 1000;
			const expired = new Date().getTime() + 14 * dayMills;

			const t = new Tokens(cw);
			const token = await t.createToken(
				{ user: res.publicKey, access: "simple", expired: expired.toString() },
				privateKey,
			);

			await SESSION_SERVICE.saveSession(res.publicKey, token);

			navigate("/status", { state: token });
			console.log("succes token", token);
		} catch (e) {
			result(`Error: ${e.message}`);
			error(e);
		}
	};

	
	
	

	return (
		<div>
			<h4>Login</h4>
			<div class={fieldsStyles.fieldBlock}>
				<div>
					<UiTextField
						title="Login"
						value={login()}
						onInput={(e:any) => login(e.target.value)}
					/>
				</div>
				<div class={fieldsStyles.fieldDescription}>Account name</div>
			</div>
			{login() && (
				<>
					<h4>Password</h4>
					<div class={fieldsStyles.fieldBlock}>
						<div>
							<UiTextField
								title="Password"
								password={true}
								value={password()}
								onInput={(e:any) => password(e.target.value)}
							/>
						</div>
						<div class={fieldsStyles.fieldDescription}>password for seed decryption</div>
					</div>
					{password() && <UiButton title="Login" onClick={load} />}
				</>
			)}
			<div class={fieldsStyles.fieldBlock}>
				<a
					style={{
						cursor: "pointer",
						color: "red",
						textDecoration: "underline",
					}}
					href="/register"
				>
					register
				</a>
			</div>
			<div class={fieldsStyles.fieldBlock}>{error() && `Error: ${error().message}`}</div>
		</div>
	);
};

export default LoginComponent;
