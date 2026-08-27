import { CreateWidget, CreateAction } from "front-core";
import { ProvidersListView } from "../views/ProvidersListView";
import { ProviderConfigForm, providerFormReset } from "../views/ProviderConfigForm";

const SHOW_PROVIDERS_LIST = "providers.show";
const SHOW_PROVIDER_FORM = "provider_form.show";

// Form widget - opens in sidebar
export const createProviderFormWidget: CreateWidget<typeof ProviderConfigForm> = (bus) => ({
    view: ProviderConfigForm,
    placement: () => "sidebar:tab:dag",
    config: {},
    commands: {
        onSave: () => {
            bus.run(SHOW_PROVIDERS_LIST, {});
        },
        onCancel: () => {
            providerFormReset();
        }
    }
});

// List widget - opens in center
const createProvidersListWidget: CreateWidget<typeof ProvidersListView> = (bus) => ({
    view: ProvidersListView,
    placement: () => "center",
    config: {
        bus
    }
});

const createShowProvidersListAction: CreateAction<any> = (bus) => ({
    id: SHOW_PROVIDERS_LIST,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.providers_show.brief",
      description: "llm.actions.providers_show.description",
    },
    exposure: "user",
    priority: "primary",
    invoke: () => {
        bus.present({ widget: createProvidersListWidget(bus) });
    }
});

const createShowProviderFormAction: CreateAction<any> = (bus) => ({
    id: SHOW_PROVIDER_FORM,
    llm: {
      microfrontend: "dag-mf",
      brief: "llm.actions.provider_form_show.brief",
      description: "llm.actions.provider_form_show.description",
    },
    exposure: "user",
    priority: "primary",
    invoke: () => {
        bus.present({ widget: createProviderFormWidget(bus) });
    }
});

export {
    SHOW_PROVIDERS_LIST,
    SHOW_PROVIDER_FORM,
    createShowProvidersListAction,
    createShowProviderFormAction,
};

const ACTIONS = [
    createShowProvidersListAction,
    createShowProviderFormAction,
];

export default ACTIONS;
