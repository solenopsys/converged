

export class LocaleController {
    private static instance: LocaleController | null = null;
    private locales:   {[id:string]:any} = {};

    private toMicrofrontendNamespace(microfrontendId: string): string {
      if (microfrontendId.startsWith("mf-")) return microfrontendId;
      if (microfrontendId.endsWith("-mf")) {
        return `mf-${microfrontendId.slice(0, -3)}`;
      }
      return microfrontendId;
    }

    private normalizeLocaleUrl(
      rawUrl: unknown,
      lang: string,
      namespace: string,
    ): unknown {
      if (typeof rawUrl !== "string") return rawUrl;

      // Most microfrontends register "../locales/{lang}.json", which resolves
      // to "/locales/{lang}.json" at runtime and points to core locales.
      // Rewrite to "/locales/{lang}/{namespace}.json" served by spa plugin.
      const matcher = new RegExp(
        `(^|/)locales/${lang}\\.json([?#].*)?$`,
        "i",
      );

      if (!matcher.test(rawUrl)) return rawUrl;

      return rawUrl.replace(
        matcher,
        `$1locales/${lang}/${namespace}.json$2`,
      );
    }

    constructor() {
      if (LocaleController.instance) return LocaleController.instance;
      LocaleController.instance = this;
    }

    static getInstance(): LocaleController {
      if (!LocaleController.instance) {
        new LocaleController();
      }
      return LocaleController.instance!;
    }

    setLocales(microfrontendId: string, locales: any): void {
      const namespace = this.toMicrofrontendNamespace(microfrontendId);

      if (!locales || typeof locales !== "object") {
        this.locales[microfrontendId] = locales;
        return;
      }

      const normalizedLocales: Record<string, unknown> = {};
      for (const [lang, url] of Object.entries(locales)) {
        normalizedLocales[lang] = this.normalizeLocaleUrl(url, lang, namespace);
      }

      this.locales[microfrontendId] = normalizedLocales;
    }

    getLocales(microfrontendId: string): any {
      return this.locales[microfrontendId];
    }

}
