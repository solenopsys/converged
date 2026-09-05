import { createDomain, sample } from "effector";
import type { MdFile } from "./functions/types";
import markdownService from "./service";

const domain = createDomain("markdown");

export const editMdClicked = domain.createEvent<MdFile>("EDIT_MD_CLICKED");
export const saveMdClicked = domain.createEvent<MdFile>("SAVE_MD_CLICKED");

export const $selectedMd = domain.createStore<MdFile | null>(null);

$selectedMd.on(editMdClicked, (_, md) => md);

const saveMdFx = domain.createEffect<MdFile, string>({
	name: "SAVE_MD",
	handler: async (mdFile: MdFile) => {
		return await markdownService.saveMd(mdFile);
	},
});

sample({
	clock: saveMdClicked,
	target: saveMdFx,
});

export default domain;
