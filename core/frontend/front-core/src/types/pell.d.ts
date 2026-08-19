declare module "pell" {
	export type PellAction =
		| "bold"
		| "italic"
		| "underline"
		| "strikethrough"
		| "heading1"
		| "heading2"
		| "paragraph"
		| "quote"
		| "olist"
		| "ulist"
		| "code"
		| "line"
		| "link"
		| "image"
		| {
				name?: string;
				icon: string;
				title?: string;
				state?: () => boolean;
				result: () => undefined | boolean;
		  };

	export type PellClasses = {
		actionbar?: string;
		button?: string;
		content?: string;
		selected?: string;
	};

	export type PellSettings = {
		element: HTMLElement & { content?: HTMLElement };
		onChange: (html: string) => void;
		defaultParagraphSeparator?: "div" | "p";
		styleWithCSS?: boolean;
		actions?: PellAction[];
		classes?: PellClasses;
	};

	export function init(settings: PellSettings): HTMLElement & {
		content: HTMLElement;
	};

	export function exec(command: string, value?: string | null): boolean;

	const pell: {
		init: typeof init;
		exec: typeof exec;
	};

	export default pell;
}
