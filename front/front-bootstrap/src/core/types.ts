


interface DunamicModule {
    context: any;

    load(): Promise<void>;
	
}

// core/types.ts - Типы для динамической архитектуры

import { ComponentType, ReactNode } from 'react';

// Базовые типы
export type LayoutType = 'sidebar' | 'simple';

export type DisplayArea = 'center' | 'left' | 'right' | 'top' | 'bottom';

import { Capability, CapabilityContext, ShowArea} from 'converged-core';

// Конфигурация модуля
export interface ModuleConfig {
  name: string;
  protected: boolean;
  link: string;
  locales: Record<string, string>;
}




 
// Экспорт модуля
export interface ModuleExport {
  capabilities?: Capabilities;
  component?: ComponentType<any>;
  css?: string;
  externals?: Record<string, string>;
  id?: string;
  menu?: any;
}

// Загруженный модуль
export interface LoadedModule {
  name: string;
  id: string;
  link: string;
  locales: Record<string, string>;
  isProtected: boolean;
  actions: Capabilities; 
  menu?: any;
  originalExports: ModuleExport;
}


// Роут
export interface Route {
  module: LoadedModule;
  capability: Capability;
  capabilityKey: string;
  path: string;
}

// Представление
export interface View {
  type: 'capability' | 'not-found' | 'error' | 'loading';
  module?: LoadedModule;
  capability?: Capability;
  capabilityKey?: string;
  params?: Record<string, any>;
  layout: LayoutType;
  path: string;
  error?: Error;
  message?: string;
}

// Контекст рендеринга
export interface RenderContext {
  navigate: (path: string, params?: Record<string, any>) => void;
  routingProcessor?: any;
  moduleLoader?: any;
  renderer?: any;
  [key: string]: any;
}

// Параметры команды
export interface CommandParams {
  [key: string]: any;
}

// Контекст команды
export interface CommandContext {
  row?: Record<string, any>;
  data?: any;
  params?: Record<string, any>;
  [key: string]: any;
}

// Результат валидации
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Результат парсинга пути
export interface ParsedPath {
  moduleName: string;
  capabilityKey: string;
  additionalSegments: string[];
}

// Результат сопоставления роута
export interface RouteMatch {
  params: Record<string, any>;
}

// Опции загрузки модуля
export interface ModuleLoadOptions {
  eager?: boolean;
  timeout?: number;
  retryCount?: number;
}

// Состояние загрузки
export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  progress?: number;
}

// Метаданные модуля
export interface ModuleMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
}

// Конфигурация приложения
export interface AppConfig {
  defaultRoute?: string;
  theme?: string;
  locale?: string;
  debug?: boolean;
}

// Хуки состояния
export interface UseModuleState {
  modules: LoadedModule[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

export interface UseRouteState {
  currentView: View | null;
  navigate: (path: string, params?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
}

// Провайдеры контекста
export interface ModuleContextValue {
  modules: LoadedModule[];
  getModule: (name: string) => LoadedModule | undefined;
  getCapability: (moduleName: string, capabilityKey: string) => Capability | undefined;
  isModuleLoaded: (name: string) => boolean;
}

export interface NavigationContextValue {
  currentPath: string;
  params: Record<string, any>;
  navigate: (path: string, params?: Record<string, any>) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

// Типы событий
export interface NavigationEvent {
  type: 'navigate' | 'back' | 'forward';
  path: string;
  params: Record<string, any>;
  timestamp: number;
}

export interface ModuleEvent {
  type: 'loaded' | 'unloaded' | 'error';
  module: string;
  error?: Error;
  timestamp: number;
}

// Интерфейсы для классов

export interface IRoutingProcessor {
  initialize(modules: LoadedModule[]): void;
  processRoute(path: string, modules: LoadedModule[]): View;
  navigate(path: string, params?: Record<string, any>): void;
  getCurrentRoute(): Route | null;
  getAllRoutes(): string[];
  hasRoute(path: string): boolean;
  getModuleCapabilities(moduleName: string): Array<Route & { path: string }>;
}

export interface IModuleLoader {
  loadModule(moduleConfig: ModuleConfig, options?: ModuleLoadOptions): Promise<LoadedModule>;
  getModule(name: string): LoadedModule | undefined;
  getAllModules(): LoadedModule[];
  isModuleLoaded(name: string): boolean;
  getCapability(moduleName: string, capabilityKey: string): Capability | null;
  getAllCapabilities(): Array<{
    moduleName: string;
    capabilityKey: string;
    capability: Capability;
    path: string;
  }>;
  clearModules(): void;
  reloadModule(name: string): Promise<LoadedModule>;
}

export interface IDynamicRenderer {
  render(currentView: View | null, context?: RenderContext): ReactNode;
  renderCapability(view: View, context: RenderContext): ReactNode;
  renderWithLayout(element: ReactNode, layoutType: LayoutType, view: View, context: RenderContext): ReactNode;
  renderNotFound(path?: string): ReactNode;
  renderError(error: Error, context?: RenderContext): ReactNode;
  renderLoading(message?: string): ReactNode;
}

// Utility типы
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Типы для HOC
export interface WithCapabilityAuthProps {
  capability: Capability;
  context: CapabilityContext;
}

export interface WithLoadingProps {
  loading: boolean;
  error: Error | null;
}

export interface WithNavigationProps {
  navigate: (path: string, params?: Record<string, any>) => void;
  currentPath: string;
  params: Record<string, any>;
}

// Типы для хелперов
export interface CapabilityUtilsType {
  hasCommand: (capability: Capability, commandName: string) => boolean;
  getConfig: <T = any>(capability: Capability, key: string, defaultValue?: T) => T;
  hasShowArea: (capability: Capability, area: ShowArea) => boolean;
  getCommandDescription: (capability: Capability, commandName: string) => string;
  validateCapability: (capability: Capability) => ValidationResult;
  generateCapabilityPath: (moduleName: string, capabilityKey: string) => string;
  parseCapabilityPath: (path: string) => ParsedPath | null;
}

export interface CoreUtilsType {
  createApplication: () => {
    routingProcessor: IRoutingProcessor;
    moduleLoader: IModuleLoader;
    dynamicRenderer: IDynamicRenderer;
  };
  validateModule: (moduleConfig: ModuleConfig) => ValidationResult;
  validateCapability: (capability: Capability) => ValidationResult;
  generateCapabilityPath: (moduleName: string, capabilityKey: string) => string;
  parseCapabilityPath: (path: string) => ParsedPath | null;
}