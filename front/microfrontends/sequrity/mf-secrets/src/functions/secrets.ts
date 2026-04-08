import { CreateAction, CreateWidget } from "front-core";
import { SecretsListView } from "../views/SecretsListView";
import { SecretDetailView } from "../views/SecretDetailView";

const SHOW_SECRETS = "secrets.show";

export const createSecretDetailWidget: CreateWidget<typeof SecretDetailView> = () => ({
  view: SecretDetailView,
  placement: () => "sidebar:tab:secrets",
  commands: {},
});

const createSecretsListWidget: CreateWidget<typeof SecretsListView> = (bus) => ({
  view: SecretsListView,
  placement: () => "center",
  config: { bus },
});

const createShowSecretsAction: CreateAction<any> = (bus) => ({
  id: SHOW_SECRETS,
  description: "Show secrets list",
  invoke: () => {
    bus.present({ widget: createSecretsListWidget(bus) });
  },
});

export { SHOW_SECRETS, createShowSecretsAction };

const ACTIONS = [createShowSecretsAction];
export default ACTIONS;
