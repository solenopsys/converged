enum ProviderState {
  STARTING = 'starting',   // процесс запуска
  READY = 'ready',         // готов к работе
  ERROR = 'error',         // ошибка подключения
  STOPPING = 'stopping',   // процесс остановки
  STOPPED = 'stopped'      // остановлен
}


 

 

interface Provider {
  name: string;
  
  readonly state: ProviderState;
  start(): Promise<void>;
  stop(): Promise<void>;
 

  // Health check
  isReady(): boolean;

}

interface ProvidersStore {
  getProvider(name: string): Promise<{ hash: string, code: string, config: any }>;
  providerExists(name: string): Promise<boolean>;
}

export { Provider, ProvidersStore,ProviderState };
