import { AuthForm } from "./form";

export * from "./auths/google";

export const createMicrofronend = async () => {
	return {
		center: AuthForm,
	};
};