# HeaderPanel Component Guide (Effector)

Универсальная верхняя панель с поддержкой вкладок и кнопок действий через Effector.

## Features

- ✅ Вкладки (Tabs) - состояние через Effector store
- ✅ Кнопки действий - вызывают Effector events
- ✅ Адаптивный дизайн - на мобильных dropdown меню
- ✅ Badges на вкладках
- ✅ Поддержка иконок

## Basic Usage with Effector

### Setup Effector Stores & Events

```typescript
import { createDomain } from 'effector';

const domain = createDomain('mailing');

// Store для активной вкладки
const $activeTab = domain.createStore('all');

// Event для смены вкладки
const tabChanged = domain.createEvent<string>('TAB_CHANGED');

// Event для действий
const refreshClicked = domain.createEvent('REFRESH_CLICKED');
const exportClicked = domain.createEvent('EXPORT_CLICKED');
const createMailClicked = domain.createEvent('CREATE_MAIL_CLICKED');

// Связываем event с store
$activeTab.on(tabChanged, (_, tab) => tab);

// Effects для действий
const refreshFx = domain.createEffect(async () => {
  // Логика обновления
});

const exportFx = domain.createEffect(async () => {
  // Логика экспорта
});

// Связываем events с effects
sample({ clock: refreshClicked, target: refreshFx });
sample({ clock: exportClicked, target: exportFx });
```

### Simple Title

```typescript
import { HeaderPanel } from 'front-core';

const config = {
  title: 'Leads',
  subtitle: 'Manage your leads'
};

<HeaderPanel config={config} />
```

### With Tabs

```typescript
import { HeaderPanel } from 'front-core';

const config = {
  tabs: [
    { id: 'all', label: 'All', value: 'all' },
    { id: 'active', label: 'Active', value: 'active', badge: 5 },
    { id: 'archived', label: 'Archived', value: 'archived' }
  ],
  $activeTab: $activeTab,  // Effector store
  tabChanged: tabChanged   // Effector event
};

<HeaderPanel config={config} />
```

### With Actions

```typescript
import { HeaderPanel } from 'front-core';
import { Plus, RefreshCw } from 'lucide-react';

const config = {
  title: 'Contacts',
  actions: [
    {
      id: 'create',
      label: 'Create New',
      icon: Plus,
      event: createContactClicked,  // Effector event
      variant: 'default'
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: RefreshCw,
      event: refreshClicked,  // Effector event
      variant: 'outline'
    }
  ]
};

<HeaderPanel config={config} />
```

## Complete Mailing Example

```typescript
// mailing/src/domain.ts
import { createDomain } from 'effector';
import { sample } from 'effector';

const domain = createDomain('mailing-incoming');

// ==================== STORES ====================
export const $activeTab = domain.createStore<string>('all');
export const $unreadCounts = domain.createStore({
  responses: 5,
  reports: 12,
  bounces: 3
});

// ==================== EVENTS ====================
export const tabChanged = domain.createEvent<string>('TAB_CHANGED');
export const refreshClicked = domain.createEvent('REFRESH_CLICKED');
export const exportClicked = domain.createEvent('EXPORT_CLICKED');

// ==================== EFFECTS ====================
export const refreshMailsFx = domain.createEffect(async () => {
  // Загружаем почту
  const data = await mailingService.listIncoming({ offset: 0, limit: 50 });
  return data;
});

export const exportMailsFx = domain.createEffect(async () => {
  // Экспортируем данные
  const data = await mailingService.exportMails();
  return data;
});

// ==================== CONNECTIONS ====================
$activeTab.on(tabChanged, (_, tab) => tab);

sample({ clock: refreshClicked, target: refreshMailsFx });
sample({ clock: exportClicked, target: exportMailsFx });

// При смене вкладки - перезагружаем данные
sample({ 
  clock: tabChanged, 
  target: refreshMailsFx 
});
```

```typescript
// mailing/src/views/IncomingMailView.tsx
import { HeaderPanel } from 'front-core';
import { useUnit } from 'effector-react';
import { RefreshCw, Download } from 'lucide-react';
import {
  $activeTab,
  $unreadCounts,
  tabChanged,
  refreshClicked,
  exportClicked
} from '../domain';

export const IncomingMailView = () => {
  const activeTab = useUnit($activeTab);
  const unreadCounts = useUnit($unreadCounts);

  const headerConfig = {
    tabs: [
      { 
        id: 'all', 
        label: 'All Messages', 
        value: 'all' 
      },
      { 
        id: 'responses', 
        label: 'Responses', 
        value: 'responses',
        badge: unreadCounts.responses 
      },
      { 
        id: 'reports', 
        label: 'Mailing Reports', 
        value: 'reports',
        badge: unreadCounts.reports 
      },
      { 
        id: 'bounces', 
        label: 'Bounce Reports', 
        value: 'bounces',
        badge: unreadCounts.bounces 
      }
    ],
    $activeTab: $activeTab,
    tabChanged: tabChanged,
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshClicked,
        variant: 'outline'
      },
      {
        id: 'export',
        label: 'Export',
        icon: Download,
        event: exportClicked,
        variant: 'outline'
      }
    ]
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      
      <div className="flex-1 p-4">
        {activeTab === 'all' && <AllMessagesTable />}
        {activeTab === 'responses' && <ResponsesTable />}
        {activeTab === 'reports' && <ReportsTable />}
        {activeTab === 'bounces' && <BouncesTable />}
      </div>
    </div>
  );
};
```

## API Reference

### HeaderPanelConfig

```typescript
interface HeaderPanelConfig {
  title?: string;              // Заголовок (только без tabs)
  subtitle?: string;           // Подзаголовок (только без tabs)
  tabs?: HeaderTab[];          // Массив вкладок
  $activeTab?: Store<string>;  // Effector store активной вкладки
  tabChanged?: Event<string>;  // Effector event смены вкладки
  actions?: HeaderAction[];    // Массив действий
  className?: string;          // CSS классы
}
```

### HeaderTab

```typescript
interface HeaderTab {
  id: string;           // Уникальный идентификатор
  label: string;        // Текст вкладки
  value: string;        // Значение для store
  badge?: string | number; // Badge (счетчик)
}
```

### HeaderAction

```typescript
interface HeaderAction {
  id: string;                      // Уникальный идентификатор
  label: string;                   // Текст кнопки
  icon?: ComponentType;            // Иконка (lucide-react)
  event: Event<any>;               // Effector event для вызова
  payload?: any;                   // Опциональный payload
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;              // Отключить кнопку
  hidden?: boolean;                // Скрыть кнопку
}
```

## Action with Payload

```typescript
const deleteClicked = domain.createEvent<{ id: string }>('DELETE_CLICKED');

const action = {
  id: 'delete',
  label: 'Delete',
  event: deleteClicked,
  payload: { id: selectedId },  // Передаем payload
  variant: 'destructive'
};
```

## Dynamic Badges

Badges обновляются автоматически через Effector stores:

```typescript
// Store с счетчиками
const $badges = domain.createStore({
  new: 5,
  urgent: 2
});

// В компоненте
const badges = useUnit($badges);

const config = {
  tabs: [
    { id: 'all', label: 'All', value: 'all' },
    { id: 'new', label: 'New', value: 'new', badge: badges.new },
    { id: 'urgent', label: 'Urgent', value: 'urgent', badge: badges.urgent }
  ],
  // ...
};
```

## Best Practices

1. **Создавайте domain** для каждого модуля/view
2. **Группируйте stores и events** - держите в одном файле domain.ts
3. **Используйте sample** для связи events с effects
4. **Обновляйте badges через stores** - для реактивности
5. **Добавляйте типизацию** - TypeScript для payload событий
6. **Не забывайте про loading states** - используйте pending для effects

## Integration Pattern

```
domain.ts          → stores, events, effects
views/XxxView.tsx  → HeaderPanel + content
functions/xxx.ts   → actions, data loading
```

## Responsive Behavior

### Desktop (≥768px)
- Tabs как TabsList
- Actions как отдельные кнопки

### Mobile (<768px)
- Tabs в dropdown с текущей вкладкой
- Actions в dropdown (если >1)
