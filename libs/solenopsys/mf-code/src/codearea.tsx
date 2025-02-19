import * as monaco from 'monaco-editor';
import $ from "@solenopsys/converged-reactive";
import { Component, Event } from "@solenopsys/converged-renderer";
import { EntityTitle } from "@solenopsys/ui-utils";

export const UiCodeArea: Component<any> = (props: any) => {
  const editorContainer = $(null);
  const language = $(props.language || "");
  const value = $(props.value || "");
  const editor = $(null);
  const editorOptions = {
    theme: 'vs',
    language: language(),
    value: value(),
  };

  const valueChange = new Event();

  const onInitEditor = () => {
    editor(monaco.editor.create(editorContainer(), editorOptions));
    editor().onDidChangeModelContent((event:any) => {
      const newValue = editor().getValue();
      value(newValue);
      props.valueChange(newValue);
      valueChange.emit(newValue);
    });
  };

  $.effect(() => {
    value(props.value);
    language(props.language);
    if (editor()) {
      editor().updateOptions({ language: language() });
      editor().setValue(value());
    }
  });

  $.effect(() => {
    if (editorContainer()) {
      onInitEditor();
    }
  });

  return (
    <div style={{ height: 'auto' }}>
      <div ref={editorContainer} style={{ height: '90vh', width: '100%' }}></div>
    </div>
  );
};
