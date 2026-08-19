

export type LandingBlockConfig = {
	id?: string;
	type: string;
	sources?: Record<string, string>;
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
