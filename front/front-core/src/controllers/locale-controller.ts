

export class LocaleController {
    private static instance: LocaleController | null = null;
    private locales:   {[id:string]:any} = {};
    
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
      this.locales[microfrontendId] = locales;
    }

    getLocales(microfrontendId: string): any {
      return this.locales[microfrontendId];
    }
    
}