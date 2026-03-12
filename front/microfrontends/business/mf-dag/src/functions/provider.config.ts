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

// Actions
const createShowProvidersListAction: CreateAction<any> = (bus) => ({
    id: SHOW_PROVIDERS_LIST,
    description: "Show providers list",
    invoke: () => {
        bus.present({ widget: createProvidersListWidget(bus) });
    }
});

const createShowProviderFormAction: CreateAction<any> = (bus) => ({
    id: SHOW_PROVIDER_FORM,
    description: "Show provider form",
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
