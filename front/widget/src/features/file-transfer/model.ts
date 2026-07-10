import { fileSelected, $fileListItems } from "files-state";

// Re-export from shared library for backwards compatibility
export { $fileListItems as $fileTransferItems } from "files-state";

export const enqueueFiles = (files: File[]) => {
  files.forEach((file) => fileSelected(file));
};
