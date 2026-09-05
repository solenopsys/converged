import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import {
	ProviderConfigForm,
	providerFormReset,
} from "../views/ProviderConfigForm";

const SHOW_PROVIDERS_LIST = "providers.show";
const SHOW_PROVIDER_FORM = "provider_form.show";

// Form widget - opens in sidebar
export const createProviderFormWidget: CreateWidget<
	typeof ProviderConfigForm
> = (bus) => ({
	view: ProviderConfigForm,
	placement: () => "sidebar:tab:dag",
	config: {},
	commands: {
		onSave: () => {
			bus.run(SHOW_PROVIDERS_LIST, {});
		},
		onCancel: () => {
			providerFormReset();
		},
	},
});

const createShowProvidersListAction: CreateAction = () => ({
	id: SHOW_PROVIDERS_LIST,
	invoke: () =>
		void presentReference(setRef("dag.provider", { kind: "query" })),
});

const createShowProviderFormAction: CreateAction<any> = (bus) => ({
	id: SHOW_PROVIDER_FORM,
	invoke: () => {
		bus.present({ widget: createProviderFormWidget(bus) });
	},
});

export {
	createShowProviderFormAction,
	createShowProvidersListAction,
	SHOW_PROVIDER_FORM,
	SHOW_PROVIDERS_LIST,
};

const ACTIONS = [createShowProvidersListAction, createShowProviderFormAction];

export default ACTIONS;
