import React from 'preact/compat';
import { useUnit } from 'effector-preact';
import { Store, EventCallable } from 'effector';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu } from "../icons";
import { cn } from '../lib/utils';

export interface HeaderTab {
  id: string;
  label: string;
  value: string;
  badge?: string | number;
}

export interface HeaderAction {
  id: string;
  label: string | ((count: number) => string);
  icon?: React.ComponentType<{ className?: string }>;
  event: EventCallable<any>;  payload?: any;  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  hidden?: boolean;
}

export interface SelectionAction {
  id: string;
  label: string | ((count: number) => string);
  icon?: React.ComponentType<{ className?: string }>;
  handler: (selectedRows: any[]) => void | Promise<void>;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

export interface HeaderPanelConfig {
  title?: string;
  subtitle?: string;
  tabs?: HeaderTab[];
  $activeTab?: Store<string>;  tabChanged?: (value: string) => void;  actions?: HeaderAction[];
  selectionActions?: SelectionAction[];
  className?: string;
}

export interface HeaderPanelProps {
  config: HeaderPanelConfig;
  selectedRows?: any[];
  onClearSelection?: () => void;
  children?: React.ReactNode;
}


export const HeaderPanel: React.FC<HeaderPanelProps> = ({ config, selectedRows = [], onClearSelection, children }) => {
  const {
    title,
    subtitle,
    tabs = [],
    $activeTab,
    tabChanged,
    actions = [],
    selectionActions = [],
    className
  } = config;

  const activeTab = $activeTab ? useUnit($activeTab) : undefined;

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


        <div className="flex items-center min-w-0 shrink-0 gap-4">
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


        <div className="flex items-center gap-4">

          {tabs.length > 0 && (
            <div className="flex items-center">

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


          {selectedRows.length > 0 && selectionActions.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {selectionActions.map(action => {
                const Icon = action.icon;
                const label = typeof action.label === 'function'
                  ? action.label(selectedRows.length)
                  : `${action.label} (${selectedRows.length})`;
                return (
                  <Button
                    key={action.id}
                    variant={action.variant || 'default'}
                    size="sm"
                    onClick={async () => {
                      await action.handler(selectedRows);
                      onClearSelection?.();
                    }}
                    className="inline-flex"
                  >
                    {Icon && <Icon className="h-4 w-4 mr-2" />}
                    {label}
                  </Button>
                );
              })}
            </div>
          )}


          {visibleActions.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
            {visibleActions.map(action => {
              const Icon = action.icon;
              const label = typeof action.label === 'function'
                ? action.label(selectedRows.length)
                : action.label;
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
                  {label}
                </Button>
              );
            })}


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
