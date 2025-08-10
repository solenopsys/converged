// nrpc-runtime/elysia-backend.ts
import { Elysia } from 'elysia';
import type { ServiceMetadata } from '../types';

export interface ElysiaBackendConfig {
  metadata: ServiceMetadata;
  serviceImpl?: any;
  serviceUrl?: string;
  configEnvVar?: string;
}

export interface PluginOptions {
  dbPath?: string;
  [key: string]: any;
}

export function createHttpBackend(config: ElysiaBackendConfig) {
  return (options: PluginOptions = {}) => (app: Elysia) => {
    const backend = new ElysiaBackend(config, options);
    
    // Регистрируем методы как POST эндпоинты
    for (const method of config.metadata.methods) {
      const path = `/${config.metadata.serviceName}/${method.name}`;
      
      const handler = async ({ body }: { body?: any }) => {
        try {
          return await backend.callMethod(method.name, body || {});
        } catch (error) {
          console.error(`Error in ${config.metadata.serviceName}.${method.name}:`, error);
          throw error;
        }
      };

      app.post(path, handler);
      console.log(`Registered route: POST ${path} -> ${config.metadata.serviceName}.${method.name}`);
    }

    return app;
  };
}

class ElysiaBackend {
  private serviceInstance: any;
  private isRemoteService: boolean;

  constructor(private config: ElysiaBackendConfig, private options: PluginOptions) {
    this.isRemoteService = !!config.serviceUrl;
    
    if (!this.isRemoteService && config.serviceImpl) {
      this.initializeLocalService();
    }
  }

  private initializeLocalService() {
    try { 
      let serviceConfig = { ...this.options };
      
      if (this.config.configEnvVar) {
        const envConfigValue = process.env[this.config.configEnvVar];
        
        if (envConfigValue) {
          try {
            const envConfig = JSON.parse(envConfigValue);
            serviceConfig = { ...serviceConfig, ...envConfig };
            console.log(`Config loaded from ${this.config.configEnvVar}`);
          } catch (error) {
            console.error(`Error parsing config from ${this.config.configEnvVar}:`, error);
          }
        } else {
          console.warn(`Environment variable ${this.config.configEnvVar} not found, using plugin options`);
        }
      }
      
      this.serviceInstance = new this.config.serviceImpl(serviceConfig);
      console.log(`Service ${this.config.metadata.serviceName} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing service ${this.config.metadata.serviceName}:`, error);
      throw error;
    }
  }

  async callMethod(methodName: string, params: any): Promise<any> {
    if (this.isRemoteService) {
      return this.callRemoteMethod(methodName, params);
    } else {
      return this.callLocalMethod(methodName, params);
    }
  }

  private async callLocalMethod(methodName: string, params: any): Promise<any> {
    if (!this.serviceInstance) {
      throw new Error(`Service instance not initialized`);
    }

    if (typeof this.serviceInstance[methodName] !== 'function') {
      throw new Error(`Method ${methodName} not found in service ${this.config.metadata.serviceName}`);
    }

    const methodMetadata = this.config.metadata.methods.find(m => m.name === methodName);
    if (!methodMetadata) {
      throw new Error(`Method metadata not found for ${methodName}`);
    }

    const args = methodMetadata.parameters.map(param => params[param.name]);
    return this.serviceInstance[methodName](...args);
  }

  private async callRemoteMethod(methodName: string, params: any): Promise<any> {
    if (!this.config.serviceUrl) {
      throw new Error('Service URL not configured for remote service');
    }

    const response = await fetch(`${this.config.serviceUrl}/${methodName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Remote service error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}