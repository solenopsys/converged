export class StylesInjector {
	cssCache = new Map();

	constructor(private document: Document) {}

	public createCSSClass(className, styles): boolean {
		if (this.cssCache.has(className)) {
			return false;
		}

		const styleElement = this.document.createElement("style");
		styleElement.setAttribute("type", "text/css");

		const cssText = `.${className} { ${styles} }`;
		styleElement.textContent = cssText;

		this.document.head.appendChild(styleElement);

		this.cssCache.set(className, cssText);

		return true;
	}
}
