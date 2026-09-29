let baseTitle: string | undefined;

export function setPageTitle(title?: string): void {
	if (typeof document === "undefined") return;
	baseTitle ??=
		document.documentElement.dataset.siteTitle?.trim() || document.title;
	document.title = title ? `${title} | ${baseTitle}` : baseTitle;
}
