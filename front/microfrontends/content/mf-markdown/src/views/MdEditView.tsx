import { useUnit } from "effector-react";
import { HeaderPanelLayout } from "front-core";
import { Save } from "lucide-react";
import { $selectedMd, saveMdClicked } from "../domain-markdown";

export const MdEditView = () => {
  const selectedMd = useUnit($selectedMd);

  if (!selectedMd) {
    return <div>No file selected</div>;
  }

  const headerConfig = {
    title: selectedMd.path,
    actions: [
      {
        id: "save",
        label: "Save",
        icon: Save,
        event: () => saveMdClicked(selectedMd),
        variant: "default" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <textarea
          className="w-full h-full p-4 font-mono text-sm border rounded resize-none"
          value={selectedMd.content}
          onChange={(e) => {
            // TODO: update store
          }}
        />
    </HeaderPanelLayout>
  );
};
