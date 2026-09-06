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
import { useEffect, useState } from "preact/compat";
import {
	$currentCron,
	$providers,
	openCronForm,
	providersRequested,
} from "../domain-crons";
import shedullerService from "../service";
import { cronsFields } from "./fields";

const SHOW_CRONS_LIST = "crons.show";
const SHOW_CRON_FORM = "cron_form.show";

const cronFormFields = getAllFormFields(cronsFields);

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
		} catch {
			const err: any = new Error("Must be valid JSON");
			err.statusCode = 400;
			throw err;
		}
	}
	return value;
};

const CronFormView = () => {
	const providers = useUnit($providers);
	const currentCron = useUnit($currentCron);
	const [selectedProvider, setSelectedProvider] = useState<string>(
		currentCron?.provider ?? "",
	);
	useEffect(() => {
		setSelectedProvider(currentCron?.provider ?? "");
	}, [currentCron?.id]);

	const providerOptions = providers.map((provider) => ({
		value: provider.code,
		label: provider.title ?? provider.code,
	}));

	const selectedProviderDef = providers.find(
		(p) => p.code === selectedProvider,
	);
	const actionOptions = selectedProviderDef
		? selectedProviderDef.actions.map((action) => ({
				value: action,
				label: action,
			}))
		: [];

	const fields = cronFormFields.map((field) => {
		if (field.id === "provider") {
			return {
				...field,
				options: providerOptions,
				onChange: (value: string) => setSelectedProvider(value),
			};
		}
		if (field.id === "action") {
			return { ...field, options: actionOptions };
		}
		return field;
	});

	const handleSave = async (data: any) => {
		const payload = {
			name: data.name,
			expression: data.expression,
			provider: data.provider,
			action: data.action,
			params: parseJsonField(data.params),
			providerSettings: parseJsonField(data.providerSettings),
			status: data.status ?? "active",
		};

		if (currentCron?.id) {
			await shedullerService.updateCron(currentCron.id, payload);
			objectChanged({ ref: objectRef("scheduler.cron", currentCron.id) });
		} else {
			const { id } = await shedullerService.createCron(payload);
			openCronForm({ cron: { ...payload, id } });
			objectChanged({ ref: objectRef("scheduler.cron", id) });
		}
	};

	const handleDelete = currentCron?.id
		? async () => {
				await shedullerService.deleteCron(currentCron.id);
				objectChanged({ ref: objectRef("scheduler.cron", currentCron.id) });
				openCronForm({ cron: null });
			}
		: undefined;

	return (
		<BasicFormView
			fields={fields}
			entityStore={$currentCron}
			title="Cron Configuration"
			subtitle="Configure scheduled task"
			onSave={handleSave}
			onDelete={handleDelete}
			onCancel={() => {
				openCronForm({ cron: null });
			}}
		/>
	);
};

export const createCronFormWidget: CreateWidget<typeof CronFormView> = () => ({
	view: CronFormView,
	placement: () => "sidebar:tab:sheduller",
	config: {},
	commands: {},
});

const createShowCronsListAction: CreateAction = () => ({
	id: SHOW_CRONS_LIST,
	invoke: () => {
		void presentReference(setRef("scheduler.cron", { kind: "query" }));
	},
});

const createShowCronFormAction: CreateAction<any> = (bus) => ({
	id: SHOW_CRON_FORM,
	invoke: ({ cron }: { cron?: any }) => {
		providersRequested();
		openCronForm({ cron });
		bus.present({ widget: createCronFormWidget(bus) });
	},
});

export {
	createShowCronFormAction,
	createShowCronsListAction,
	SHOW_CRON_FORM,
	SHOW_CRONS_LIST,
};

const ACTIONS = [createShowCronsListAction, createShowCronFormAction];

export default ACTIONS;
