import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { SecretDetailView } from "../views/SecretDetailView";

const SHOW_SECRETS = "secrets.show";

export const createSecretDetailWidget: CreateWidget<
	typeof SecretDetailView
> = () => ({
	view: SecretDetailView,
	placement: () => "sidebar:tab:secrets",
	commands: {},
});

const createShowSecretsAction: CreateAction = () => ({
	id: SHOW_SECRETS,
	invoke: () =>
		void presentReference(setRef("secrets.secret", { kind: "query" })),
});

export { createShowSecretsAction, SHOW_SECRETS };

const ACTIONS = [createShowSecretsAction];
export default ACTIONS;
