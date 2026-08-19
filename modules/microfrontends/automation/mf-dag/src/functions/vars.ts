import { BasicFormView, CreateAction, CreateWidget, getAllFormFields } from "front-core";
import { VarsView } from "../views/VarsView";
import { $currentVar, openVarForm, updateVarFx } from "../domain-vars";

const SHOW_VARS_LIST = "vars.show_list";
const SHOW_VAR_FORM = "var_form.show";

const varsFormFields = getAllFormFields([
  {
    id: "value",
    title: "Value",
    type: "textarea",
    required: true,
    rows: 8,
    placeholder: "Enter value (JSON supported)",
    helpText: "Valid JSON will be saved as JSON, otherwise as plain text.",
  },
]);

const parseVarValue = (raw: any) => {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed.length) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};

export const createVarFormWidget: CreateWidget<typeof BasicFormView> = () => ({
  view: BasicFormView,
  placement: () => "sidebar:tab:dag",
  config: {
    fields: varsFormFields,
    entityStore: $currentVar,
    title: "Edit variable",
    subtitle: "Update variable value",
  },
  commands: {
    onSave: async (data: { value: any }) => {
      const current = $currentVar.getState();
      if (!current?.key) return;
      await updateVarFx({ key: current.key, value: parseVarValue(data?.value) });
    },
    onCancel: () => {
      openVarForm({ variable: null });
    },
  },
});

const createVarsWidget: CreateWidget<typeof VarsView> = (bus) => ({
  view: VarsView,
  placement: () => "center",
  config: { bus },
  commands: {},
});

const createShowVarsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_VARS_LIST,
  description: "Show vars list",
  invoke: () => {
    bus.present({ widget: createVarsWidget(bus) });
  },
});

const createShowVarFormAction: CreateAction<any> = (bus) => ({
  id: SHOW_VAR_FORM,
  description: "Show variable form",
  invoke: ({ variable }: { variable?: { key: string; value: any } }) => {
    openVarForm({ variable: variable ?? null });
    bus.present({ widget: createVarFormWidget(bus) });
  },
});

export { SHOW_VARS_LIST, SHOW_VAR_FORM, createShowVarsListAction, createShowVarFormAction };

const ACTIONS = [createShowVarsListAction, createShowVarFormAction];

export default ACTIONS;
