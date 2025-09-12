type Surface = "full" | "center" | "modal" | "chat.inline";

type Placement =
    | { surface: Surface }
    | { slot: { parentInstanceId: string; slotId: string } };

type InsertContext = {
    // кто сейчас родитель (если есть)
    parentInstanceId?: string;
    // какие слоты у родителя доступны (id и, опционально, простые теги)
    parentSlots?: { id: string; tags?: string[]; capacity?: "one" | "many"; busy?: boolean }[];
    // курсор/фокус, текущая сцена, сущность и т.п. — всё опционально
    focusNodeId?: string;
    entityType?: string; // "nav" | "mail" | "graph" ...
};


type Widget<V = any> = {
    view: V;
    // вот главный хук:
    palacement: (ctx: InsertContext) => Placement | { slotId: string } | null;
    mount: (p: { instanceId: string; target: Placement; params?: any }) => void;
    // опционально:
    config?: Partial<React.ComponentProps<any>>;
    bindings?: Record<string, (p: any) => void>;
};

type Entity = { id: string };


type Action<I, O> = {
    description: string;
    // id опционально; можно вообще не использовать, работать по прямой ссылке
    id?: string;
    invoke: (p: I) => Promise<O> | O; // допускаем sync/async
    // опционально: декларация сущностей
    entity?: Record<string, new () => Entity | object>;
  };

export type { Widget, Action ,Surface}
