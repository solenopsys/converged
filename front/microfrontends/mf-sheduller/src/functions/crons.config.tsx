import React, { useState, useEffect, useRef } from "react";
import { BasicFormView, getAllFormFields, CreateWidget, CreateAction } from "front-core";
import { cronsFields } from "./fields";
import { CronsListView } from "../views/CronsListView";
import { openCronForm, $currentCron, $providers, refreshCronsClicked } from "../domain-crons";
import { useUnit } from "effector-react";
import shedullerService from "../service";

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
  const [selectedProvider, setSelectedProvider] = useState<string>(currentCron?.provider ?? "");
  const formRef = useRef<{ resetField?: (id: string, value: any) => void }>(null);

  useEffect(() => {
    setSelectedProvider(currentCron?.provider ?? "");
  }, [currentCron?.id]);

  const providerOptions = providers.map((provider) => ({
    value: provider.code,
    label: provider.title ?? provider.code,
  }));

  const selectedProviderDef = providers.find((p) => p.code === selectedProvider);
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
    } else {
      const { id } = await shedullerService.createCron(payload);
      openCronForm({ cron: { ...payload, id } });
    }

    refreshCronsClicked();
  };

  const handleDelete = currentCron?.id
    ? async () => {
        await shedullerService.deleteCron(currentCron.id);
        refreshCronsClicked();
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

const createCronsListWidget: CreateWidget<typeof CronsListView> = (bus) => ({
  view: CronsListView,
  placement: () => "center",
  config: {
    bus,
  },
});

const createShowCronsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_CRONS_LIST,
  description: "Show crons list",
  invoke: () => {
    bus.present({ widget: createCronsListWidget(bus) });
  },
});

const createShowCronFormAction: CreateAction<any> = (bus) => ({
  id: SHOW_CRON_FORM,
  description: "Show cron form",
  invoke: ({ cron }: { cron?: any }) => {
    openCronForm({ cron });
    bus.present({ widget: createCronFormWidget(bus) });
  },
});

export {
  SHOW_CRONS_LIST,
  SHOW_CRON_FORM,
  createShowCronsListAction,
  createShowCronFormAction,
};

const ACTIONS = [createShowCronsListAction, createShowCronFormAction];

export default ACTIONS;
