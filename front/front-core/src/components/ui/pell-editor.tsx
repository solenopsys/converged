import { exec, init, type PellAction } from "pell";
import * as React from "react";

import { cn } from "../../lib/utils";
import "./pell-editor.css";

export type PellEditorChange = {
	html: string;
	text: string;
};

export type PellEditorProps = Omit<
	React.HTMLAttributes<HTMLDivElement>,
	"children" | "onChange"
> & {
	value?: string;
	defaultValue?: string;
	onChange?: (html: string, text: string) => void;
	onValueChange?: (value: PellEditorChange) => void;
	placeholder?: string;
	disabled?: boolean;
	minHeight?: number | string;
	maxHeight?: number | string;
	actions?: PellAction[];
	contentClassName?: string;
	defaultParagraphSeparator?: "div" | "p";
	styleWithCSS?: boolean;
};

const DEFAULT_ACTIONS: PellAction[] = [
	"bold",
	"italic",
	"underline",
	"ulist",
	"olist",
	"quote",
	"link",
	{
		icon: "&#8630;",
		title: "Undo",
		result: () => {
			return exec("undo");
		},
	},
	{
		icon: "&#8631;",
		title: "Redo",
		result: () => {
			return exec("redo");
		},
	},
	{
		icon: "Tx",
		title: "Clear formatting",
		result: () => {
			return exec("removeFormat");
		},
	},
];

function toCssSize(value: number | string | undefined): string | undefined {
	if (typeof value === "number") {
		return `${value}px`;
	}
	return value;
}

function getTextFromContent(content: HTMLElement | null): string {
	return content?.innerText ?? "";
}

function getContentNode(root: HTMLElement | null): HTMLElement | null {
	return (
		(root as (HTMLElement & { content?: HTMLElement }) | null)?.content ?? null
	);
}

export function plainTextToEmailHtml(text: string): string {
	return text
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map(
			(paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
		)
		.join("");
}

export function emailHtmlToPlainText(html: string): string {
	if (typeof document === "undefined") {
		return html
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	const element = document.createElement("div");
	element.innerHTML = html;
	return element.innerText.trim();
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function PellEditor({
	value,
	defaultValue = "",
	onChange,
	onValueChange,
	placeholder = "Write a message...",
	disabled = false,
	minHeight = 160,
	maxHeight,
	actions = DEFAULT_ACTIONS,
	contentClassName,
	className,
	defaultParagraphSeparator = "div",
	styleWithCSS = false,
	style,
	"aria-label": ariaLabel,
	...props
}: PellEditorProps) {
	const rootRef = React.useRef<HTMLDivElement | null>(null);
	const latestHtmlRef = React.useRef(value ?? defaultValue);
	const onChangeRef = React.useRef(onChange);
	const onValueChangeRef = React.useRef(onValueChange);
	const actionsRef = React.useRef(actions);
	const initializedRef = React.useRef(false);

	React.useEffect(() => {
		onChangeRef.current = onChange;
		onValueChangeRef.current = onValueChange;
	});

	React.useEffect(() => {
		const root = rootRef.current;
		if (!root || initializedRef.current) {
			return;
		}

		init({
			element: root,
			defaultParagraphSeparator,
			styleWithCSS,
			actions: actionsRef.current,
			classes: {
				actionbar: "pell-editor__actionbar",
				button: "pell-editor__button",
				content: cn("pell-editor__content", contentClassName),
				selected: "pell-editor__button-selected",
			},
			onChange: (html) => {
				latestHtmlRef.current = html;
				const text = getTextFromContent(getContentNode(root));
				onChangeRef.current?.(html, text);
				onValueChangeRef.current?.({ html, text });
			},
		});

		const content = getContentNode(root);
		if (content) {
			content.innerHTML = latestHtmlRef.current;
		}

		initializedRef.current = true;

		return () => {
			initializedRef.current = false;
			root.innerHTML = "";
		};
	}, [contentClassName, defaultParagraphSeparator, styleWithCSS]);

	React.useEffect(() => {
		if (value === undefined || value === latestHtmlRef.current) {
			return;
		}

		latestHtmlRef.current = value;
		const content = getContentNode(rootRef.current);
		if (content && content.innerHTML !== value) {
			content.innerHTML = value;
		}
	}, [value]);

	React.useEffect(() => {
		const root = rootRef.current;
		const content = getContentNode(root);
		if (!content) {
			return;
		}

		content.dataset.placeholder = placeholder;
		content.setAttribute("aria-label", ariaLabel ?? "Rich text editor");
		content.contentEditable = disabled ? "false" : "true";

		root
			?.querySelectorAll<HTMLButtonElement>(".pell-editor__button")
			.forEach((button) => {
				button.disabled = disabled;
			});
	}, [ariaLabel, disabled, placeholder]);

	const cssProperties = {
		...style,
		"--pell-editor-min-height": toCssSize(minHeight),
		"--pell-editor-max-height": toCssSize(maxHeight),
	} as React.CSSProperties;

	return (
		<div
			{...props}
			ref={rootRef}
			className={cn("pell-editor", className)}
			data-disabled={disabled ? "true" : "false"}
			style={cssProperties}
		/>
	);
}

export { PellEditor };
