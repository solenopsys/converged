import type { CreateAction, CreateWidget } from "front-core";
import { SecretDetailView } from "../views/SecretDetailView";
import { SecretsListView } from "../views/SecretsListView";

const SHOW_SECRETS = "secrets.show";

export const createSecretDetailWidget: CreateWidget<
	typeof SecretDetailView
> = () => ({
	view: SecretDetailView,
	placement: () => "sidebar:tab:secrets",
	commands: {},
});

const createSecretsListWidget: CreateWidget<typeof SecretsListView> = (
	bus,
) => ({
	view: SecretsListView,
	placement: () => "center",
	config: { bus },
});

const createShowSecretsAction: CreateAction<any> = (bus) => ({
	id: SHOW_SECRETS,
	invoke: () => {
		bus.present({ widget: createSecretsListWidget(bus) });
	},
});

export { createShowSecretsAction, SHOW_SECRETS };

const ACTIONS = [createShowSecretsAction];
export default ACTIONS;
