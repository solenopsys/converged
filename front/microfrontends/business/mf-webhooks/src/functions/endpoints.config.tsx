import React from "react";
import { BasicFormView, getAllFormFields, CreateWidget, CreateAction } from "front-core";
import { endpointFields } from "./fields";
import { EndpointsListView } from "../views/EndpointsListView";
import {
  openEndpointForm,
  $currentEndpoint,
  $providers,
  refreshEndpointsClicked,
} from "../domain-endpoints";
import { useUnit } from "effector-react";
import webhooksService from "../service";

const SHOW_ENDPOINTS_LIST = "webhooks.endpoints.show";
const SHOW_ENDPOINT_FORM = "webhooks.endpoint_form.show";

const endpointFormFields = getAllFormFields(endpointFields);

const parseJsonField = (value: any) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      const err: any = new Error("Params must be valid JSON");
      err.statusCode = 400;
      throw err;
    }
  }
  return value;
};

const EndpointFormView = () => {
  const providers = useUnit($providers);
  const currentEndpoint = useUnit($currentEndpoint);

  const providerOptions = providers.map((provider) => ({
    value: provider.code,
    label: provider.title ?? provider.code,
  }));

  const fields = endpointFormFields.map((field) => {
    if (field.id === "provider") {
      return { ...field, options: providerOptions };
    }
    return field;
  });

  const handleSave = async (data: any) => {
    const payload = {
      name: data.name,
      provider: data.provider,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      params: parseJsonField(data.params),
    };

    if (currentEndpoint?.id) {
      await webhooksService.updateEndpoint(currentEndpoint.id, payload);
    } else {
      await webhooksService.createEndpoint(payload);
    }

    refreshEndpointsClicked();
    openEndpointForm({ endpoint: null });
  };

  return (
    <BasicFormView
      fields={fields}
      entityStore={$currentEndpoint}
      title="Webhook Endpoint"
      subtitle="Configure incoming webhook endpoint"
      onSave={handleSave}
      onCancel={() => {
        openEndpointForm({ endpoint: null });
      }}
    />
  );
};

export const createEndpointFormWidget: CreateWidget<typeof EndpointFormView> = () => ({
  view: EndpointFormView,
  placement: () => "sidebar:tab:webhooks",
  config: {},
  commands: {},
});

const createEndpointsListWidget: CreateWidget<typeof EndpointsListView> = (bus) => ({
  view: EndpointsListView,
  placement: () => "center",
  config: {
    bus,
  },
});

const createShowEndpointsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_ENDPOINTS_LIST,
  description: "Show webhook endpoints",
  invoke: () => {
    bus.present({ widget: createEndpointsListWidget(bus) });
  },
});

const createShowEndpointFormAction: CreateAction<any> = (bus) => ({
  id: SHOW_ENDPOINT_FORM,
  description: "Show webhook endpoint form",
  invoke: ({ endpoint }: { endpoint?: any }) => {
    openEndpointForm({ endpoint });
    bus.present({ widget: createEndpointFormWidget(bus) });
  },
});

export {
  SHOW_ENDPOINTS_LIST,
  SHOW_ENDPOINT_FORM,
  createShowEndpointsListAction,
  createShowEndpointFormAction,
};

const ACTIONS = [createShowEndpointsListAction, createShowEndpointFormAction];

export default ACTIONS;
