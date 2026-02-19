import React from 'react';
import { useUnit } from 'effector-react';
import { Store, Event } from 'effector';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu } from 'lucide-react';
import { cn } from '../lib/utils';

export interface HeaderTab {
  id: string;
  label: string;
  value: string;
  badge?: string | number;
}

export interface HeaderAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  event: Event<any>; // Effector event для вызова
  payload?: any; // Опциональный payload для event
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  hidden?: boolean;
}

export interface HeaderPanelConfig {
  title?: string;
  subtitle?: string;
  tabs?: HeaderTab[];
  $activeTab?: Store<string>; // Effector store с активной вкладкой
  tabChanged?: Event<string>; // Event для смены вкладки
  actions?: HeaderAction[];
  className?: string;
}

export interface HeaderPanelProps {
  config: HeaderPanelConfig;
  children?: React.ReactNode;
}

/**
 * Универсальная верхняя панель с заголовком, вкладками и действиями
 * Работает через Effector stores и events
 * Вкладки на мобильных устройствах превращаются в dropdown меню
 */
export const HeaderPanel: React.FC<HeaderPanelProps> = ({ config, children }) => {
  const {
    title,
    subtitle,
    tabs = [],
    $activeTab,
    tabChanged,
    actions = [],
    className
  } = config;

  // Подписываемся на store активной вкладки
  const activeTab = $activeTab ? useUnit($activeTab) : undefined;

  // Получаем события для actions
  const actionEvents = useUnit(
    actions.reduce((acc, action) => {
      acc[action.id] = action.event;
      return acc;
    }, {} as Record<string, any>)
  );

  const visibleActions = actions.filter(action => !action.hidden);

  const handleTabChange = (value: string) => {
    if (tabChanged) {
      tabChanged(value);
    }
  };

  const handleActionClick = (action: HeaderAction) => {
    const event = actionEvents[action.id];
    if (event) {
      event(action.payload);
    }
  };

  return (
    <div className={cn('border-b bg-background', className)}>
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo + Children + Title/Subtitle */}
        <div className="flex items-center min-w-0 shrink-0 gap-4">
          <img src="/console/assets/logo.svg?v=2" alt="logo" className="h-5 w-auto" />
          {children}
          {title && (
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Tabs and Actions */}
        <div className="flex items-center gap-4">
          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="flex items-center">
            {/* Desktop tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="hidden md:block">
              <TabsList>
                {tabs.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.value}>
                    {tab.label}
                    {tab.badge && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Mobile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4 mr-2" />
                  {tabs.find(t => t.value === activeTab)?.label || 'Menu'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {tabs.map(tab => (
                  <DropdownMenuItem
                    key={tab.id}
                    onClick={() => handleTabChange(tab.value)}
                  >
                    <span className="flex-1">{tab.label}</span>
                    {tab.badge && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {tab.badge}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          )}

          {/* Actions */}
          {visibleActions.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
            {visibleActions.map(action => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled}
                  className="inline-flex"
                >
                  {Icon && <Icon className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              );
            })}

            {/* Mobile actions dropdown */}
            {visibleActions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="sm:hidden">
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {visibleActions.map(action => {
                    const Icon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleActionClick(action)}
                        disabled={action.disabled}
                      >
                        {Icon && <Icon className="h-4 w-4 mr-2" />}
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
