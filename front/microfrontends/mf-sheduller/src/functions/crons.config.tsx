import React from "react";
import { BasicFormView, getAllFormFields, CreateWidget, CreateAction } from "front-core";
import { cronsFields } from "./fields";
import { CronsListView } from "../views/CronsListView";
import { openCronForm, $currentCron, $providers } from "../domain-crons";
import { useUnit } from "effector-react";

const SHOW_CRONS_LIST = "crons.show";
const SHOW_CRON_FORM = "cron_form.show";

const cronFormFields = getAllFormFields(cronsFields);

const CronFormView = () => {
  const providers = useUnit($providers);

  const providerOptions = providers.map((provider) => ({
    value: provider.code,
    label: provider.title ?? provider.code,
  }));

  const actionOptions = providers.flatMap((provider) =>
    provider.actions.map((action) => ({
      value: action.name,
      label: `${provider.code}:${action.name}`,
    })),
  );

  const fields = cronFormFields.map((field) => {
    if (field.id === "provider") {
      return { ...field, options: providerOptions };
    }
    if (field.id === "action") {
      return { ...field, options: actionOptions };
    }
    return field;
  });

  return (
    <BasicFormView
      fields={fields}
      entityStore={$currentCron}
      title="Cron Configuration"
      subtitle="Configure scheduled task"
      onSave={async (data: any) => {
        console.log("Save cron:", data);
      }}
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
