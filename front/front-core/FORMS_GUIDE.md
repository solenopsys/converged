# Unified Forms & Tables Guide

## Overview

Эта система позволяет использовать единую конфигурацию полей для таблиц и форм, избегая дублирования кода.

## Архитектура

### 1. Единая конфигурация полей

Создайте файл с конфигурацией полей (например, `fields.ts`):

```typescript
import { FieldConfig } from 'front-core';

export const leadsFields: FieldConfig[] = [
  {
    id: 'id',
    title: 'ID',
    type: 'text',
    tableVisible: true,   // Показывать в таблице
    formVisible: false,   // Не показывать в форме (авто-генерируется)
    readonly: true,
    width: 100
  },
  {
    id: 'description',
    title: 'Description',
    type: 'textarea',
    tableVisible: true,   // В таблице как текст
    formVisible: true,    // В форме как textarea
    required: true,
    placeholder: 'Enter description...',
    rows: 4,
    validation: {
      minLength: 10,
      maxLength: 500,
      message: 'Description must be between 10 and 500 characters'
    }
  },
  {
    id: 'status',
    title: 'Status',
    type: 'select',
    tableVisible: true,
    formVisible: true,
    required: true,
    options: [
      { value: 'new', label: 'New' },
      { value: 'active', label: 'Active' }
    ],
    statusConfig: {  // Для таблицы
      new: { label: 'New', variant: 'secondary' },
      active: { label: 'Active', variant: 'default' }
    }
  },
  {
    id: 'email',
    title: 'Email',
    type: 'email',
    tableVisible: false,  // Только в форме
    formVisible: true,
    required: true
  }
];
```

### 2. Типы полей

```typescript
const FIELD_TYPES = {
  TEXT: 'text',           // Обычный текст
  NUMBER: 'number',       // Число
  EMAIL: 'email',         // Email
  PASSWORD: 'password',   // Пароль
  DATE: 'date',          // Дата
  DATETIME: 'datetime',  // Дата и время
  BOOLEAN: 'boolean',    // Checkbox
  SELECT: 'select',      // Dropdown
  TEXTAREA: 'textarea',  // Многострочный текст
  TAGS: 'tags',         // Теги (массив)
  CUSTOM: 'custom'      // Кастомный рендер
};
```

### 3. Свойства конфигурации

#### Общие:
- `id` - уникальный идентификатор поля
- `title` - заголовок поля
- `type` - тип поля из FIELD_TYPES

#### Видимость:
- `tableVisible` - показывать в таблице (default: true)
- `formVisible` - показывать в форме (default: true)

#### Для таблицы:
- `width` - ширина колонки
- `minWidth` - минимальная ширина
- `sortable` - можно ли сортировать
- `statusConfig` - конфигурация для статусов
- `tableRender` - кастомный рендер

#### Для формы:
- `required` - обязательное поле
- `readonly` - только чтение
- `placeholder` - плейсхолдер
- `rows` - количество строк (для textarea)
- `options` - опции (для select)
- `defaultValue` - значение по умолчанию
- `helpText` - текст подсказки
- `validation` - правила валидации

### 4. Генерация колонок и полей

```typescript
import { getTableColumns, getFormFields } from 'front-core';
import { leadsFields } from './fields';

// Для таблицы
export const leadsColumns = getTableColumns(leadsFields);

// Для формы
const leadFormFields = getFormFields(leadsFields);
```

### 5. Использование в виджетах

#### Таблица с формой:

```typescript
import { TableView, BasicFormView, createTableStore } from 'front-core';
import { leadsColumns } from './columns';
import { leadsFields } from './fields';

// Store для таблицы
const $leadsStore = createTableStore(domain, leadsDataFunction);

// Store для текущей редактируемой сущности
const $currentLead = domain.createStore<Lead | null>(null);

// Effects
const createLeadFx = domain.createEffect(/*...*/);
const updateLeadFx = domain.createEffect(/*...*/);
const openLeadForm = domain.createEvent<{ lead?: Lead }>();

// Виджет формы
const createLeadFormWidget: CreateWidget<typeof BasicFormView> = () => ({
  view: BasicFormView,
  placement: () => "sidebar:tab:lead",
  config: {
    fields: getFormFields(leadsFields),
    entityStore: $currentLead,
    title: "Lead",
    subtitle: "Create or edit lead"
  },
  commands: {
    onSave: async (data) => {
      const current = $currentLead.getState();
      if (current?.id) {
        await updateLeadFx({ ...data, id: current.id });
      } else {
        await createLeadFx(data);
      }
    },
    onCancel: () => {
      $currentLead.setState(null);
    }
  }
});

// Виджет таблицы
const createLeadsWidget: CreateWidget<typeof TableView> = (bus) => ({
  view: TableView,
  placement: () => "center",
  config: {
    columns: leadsColumns,
    title: "Leads",
    store: $leadsStore
  },
  commands: {
    onRowClick: (row) => {
      openLeadForm({ lead: row });
      bus.present({ widget: createLeadFormWidget(bus) });
    }
  }
});
```

## Валидация

### Встроенная валидация:

```typescript
{
  id: 'email',
  type: 'email',
  validation: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Invalid email format'
  }
}
```

### Валидация длины:

```typescript
{
  id: 'description',
  type: 'textarea',
  validation: {
    minLength: 10,
    maxLength: 500,
    message: 'Must be between 10 and 500 characters'
  }
}
```

### Валидация чисел:

```typescript
{
  id: 'age',
  type: 'number',
  validation: {
    min: 18,
    max: 100,
    message: 'Age must be between 18 and 100'
  }
}
```

### Кастомная валидация:

```typescript
{
  id: 'username',
  type: 'text',
  validation: {
    custom: (value) => {
      if (value.includes(' ')) return 'Username cannot contain spaces';
      return true;
    }
  }
}
```

## Примеры

### Простая форма:

```typescript
const userFields = [
  { id: 'name', title: 'Name', type: 'text', required: true },
  { id: 'email', title: 'Email', type: 'email', required: true },
  { id: 'bio', title: 'Bio', type: 'textarea', rows: 3 }
];
```

### Форма с группировкой:

```typescript
const contactFields = [
  { id: 'firstName', title: 'First Name', type: 'text', formGroup: 'personal' },
  { id: 'lastName', title: 'Last Name', type: 'text', formGroup: 'personal' },
  { id: 'email', title: 'Email', type: 'email', formGroup: 'contact' },
  { id: 'phone', title: 'Phone', type: 'text', formGroup: 'contact' }
];
```

## Миграция со старых таблиц

Старые компоненты удалены:
- ❌ `DataTable` (tanstack table с пагинацией)
- ❌ `UniversalDataTable` (старая таблица с пагинацией)

Используйте:
- ✅ `InfiniteScrollDataTable` (для infinite scroll)
- ✅ `BasicFormView` (для форм)

## Best Practices

1. **Один источник истины**: Одна конфигурация полей на сущность
2. **DRY**: Не дублируйте конфигурацию полей
3. **Type Safety**: Используйте TypeScript типы из основного модуля
4. **Валидация**: Определяйте валидацию в конфигурации полей
5. **Readonly поля**: Используйте для авто-генерируемых полей (id, createdAt)
