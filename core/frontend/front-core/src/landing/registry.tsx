import type { ComponentChildren } from "preact";
import type { LandingMenuLink, ResolvedBlock } from "./types";



export type BlockContext = {

	composer?: ComponentChildren;
	menu?: LandingMenuLink[];
	locale?: string;
	pathname?: string;
};

export type LandingBlock = (block: ResolvedBlock, context: BlockContext) => ComponentChildren;

export type LandingBlockMap = Record<string, LandingBlock>;


export type LandingHeaderRenderer = (context: BlockContext) => ComponentChildren;

const blocks: LandingBlockMap = {};
let header: LandingHeaderRenderer | undefined;


export function registerLandingBlocks(map: LandingBlockMap): void {
	for (const [type, render] of Object.entries(map)) {
		const known = blocks[type];
		if (known && known !== render) {
			throw new Error(`[landing] block type registered twice: ${type}`);
		}
		blocks[type] = render;
	}
}

export function registerLandingHeader(next: LandingHeaderRenderer): void {
	if (header && header !== next) {
		throw new Error("[landing] header registered twice");
	}
	header = next;
}

export function renderLandingHeader(context: BlockContext): ComponentChildren {
	return header?.(context) ?? null;
}

export function renderBlock(block: ResolvedBlock, context: BlockContext) {
	const render = blocks[block.type];
	if (!render) {
		return renderConfigurationError(block, `Блок типа «${block.type}» не зарегистрирован.`);
	}

	try {
		return render(block, context);
	} catch (error) {
		console.error(`[landing] failed to create block "${block.type}" (${block.id})`, error);
		return renderConfigurationError(block, "Не удалось создать блок из его данных.");
	}
}

function renderConfigurationError(block: ResolvedBlock, message: string): ComponentChildren {
	console.error(`[landing] ${message} id=${block.id}`);
	return (
		<section class="landing-block-error" data-block-id={block.id} data-block-type={block.type} role="alert">
			<strong>Ошибка конфигурации лендинга</strong>
			<span>{message}</span>
			<code>id: {block.id}</code>
		</section>
	);
}
