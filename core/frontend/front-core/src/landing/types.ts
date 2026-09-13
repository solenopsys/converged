

export type LandingBlockConfig = {
	id?: string;
	type: string;
	/** Locale documents: the path is resolved inside the page's language tree. */
	sources?: Record<string, string>;
	/**
	 * Language-free document sets, by alias. The value names a directory in the
	 * root of `struct` holding an `index.json` manifest and one file per entry;
	 * the block receives them keyed by entry id.
	 */
	collections?: Record<string, string>;
	props?: Record<string, unknown>;
};

export type LandingNavigationConfig = {
	menuLinks?: Array<{
		blockId?: string;
		href?: string;
		label?: string;
	}>;
};

export type LandingConfig = {
	id?: string;
	title?: string;
	navigation?: LandingNavigationConfig;
	blocks?: LandingBlockConfig[];
};


export type ResolvedBlock = {
	id: string;
	type: string;
	props: Record<string, unknown>;
	data: Record<string, unknown>;
};

export type LandingMenuLink = { href: string; label: string };


export type LandingPayload = {
	configPath: string;

	locale?: string;
	pathname?: string;
	navigation?: { menuLinks?: LandingMenuLink[] };
	blocks: ResolvedBlock[];
};
