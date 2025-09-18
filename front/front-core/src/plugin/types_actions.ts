type Surface = "full" | "center" | "modal" | "chat.inline";
import { type EventBus } from "./types";

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



type Entity = { id: string };


type Action<I> = {
    id: string;
    description: string;
    invoke: (p: I) => Promise<void>|void  ;
};

type CreateAction<I> = (bus: EventBus) => Action<I>;


type Widget<V > = {
    view: V;
    placement: (ctx: InsertContext) => Placement | string | null;
    commands?: Record<string, (p: any) => void>;
};

type CreateWidget<V = any> = (bus: EventBus) => Widget<V>;

export type { Widget, Action, Surface,CreateAction,CreateWidget }
