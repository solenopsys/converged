import { useUnit } from "effector-preact";
import {
	BasicFormView,
	type CreateAction,
	type CreateWidget,
	getAllFormFields,
} from "front-core";
import {
	objectChanged,
	objectRef,
	presentReference,
	setRef,
} from "front-core/object-runtime";
import {
	$currentEndpoint,
	$providers,
	openEndpointForm,
	providersRequested,
} from "../domain-endpoints";
import webhooksService from "../service";
import { endpointFields } from "./fields";

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
			objectChanged({
				ref: objectRef("webhooks.endpoint", currentEndpoint.id),
			});
		} else {
			const { id } = await webhooksService.createEndpoint(payload);
			objectChanged({ ref: objectRef("webhooks.endpoint", id) });
		}

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

export const createEndpointFormWidget: CreateWidget<
	typeof EndpointFormView
> = () => ({
	view: EndpointFormView,
	placement: () => "sidebar:tab:webhooks",
	config: {},
	commands: {},
});

const createShowEndpointsListAction: CreateAction = () => ({
	id: SHOW_ENDPOINTS_LIST,
	invoke: () => {
		void presentReference(setRef("webhooks.endpoint", { kind: "query" }));
	},
});

const createShowEndpointFormAction: CreateAction<any> = (bus) => ({
	id: SHOW_ENDPOINT_FORM,
	invoke: ({ endpoint }: { endpoint?: any }) => {
		providersRequested();
		openEndpointForm({ endpoint });
		bus.present({ widget: createEndpointFormWidget(bus) });
	},
});

export {
	createShowEndpointFormAction,
	createShowEndpointsListAction,
	SHOW_ENDPOINT_FORM,
	SHOW_ENDPOINTS_LIST,
};

const ACTIONS = [createShowEndpointsListAction, createShowEndpointFormAction];

export default ACTIONS;
