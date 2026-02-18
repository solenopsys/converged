import { $slotContents, mountWhenReady } from "./slots";
import { ReactNode } from "react";


 class DashboardSlots {
    public list: string[] = [];
    private counter = 0;
    private savedWidgets: Map<string, ReactNode> = new Map();
    private widgetSlots: Map<string, string> = new Map(); // widgetId -> slotId

    next(prefix: string, widgetId?: string): string {
        // Если widgetId указан и уже есть слот для него - возвращаем существующий
        if (widgetId && this.widgetSlots.has(widgetId)) {
            const existingSlot = this.widgetSlots.get(widgetId)!;
            console.log("DashboardSlots: reusing existing slot", existingSlot, "for widget", widgetId);
            return existingSlot;
        }

        // Создаем новый слот
        const slotId = `${prefix}-${this.counter}`;
        this.counter++;
        this.list.push(slotId);

        // Сохраняем связь widgetId -> slotId
        if (widgetId) {
            this.widgetSlots.set(widgetId, slotId);
        }

        console.log("DashboardSlots next", slotId, widgetId ? `for widget ${widgetId}` : "");
        return slotId;
    }

    // Сохраняем виджеты перед уходом с dashboard
    saveWidgets() {
        const contents = $slotContents.getState();
        this.savedWidgets.clear();

        Object.entries(contents).forEach(([slotId, component]) => {
            if (slotId.startsWith('dashboard:')) {
                this.savedWidgets.set(slotId, component);
                console.log("Saved widget for slot:", slotId);
            }
        });
    }

    // Восстанавливаем виджеты при возврате
    restoreWidgets() {
        console.log("Restoring", this.savedWidgets.size, "widgets");

        this.savedWidgets.forEach((component, slotId) => {
            mountWhenReady(component, slotId, { layoutName: "dashboard" });
        });
    }

    // Очищаем всё (опционально)
    clear() {
        this.list = [];
        this.savedWidgets.clear();
        this.widgetSlots.clear();
        this.counter = 0;
    }
}

export const dashboardSlots = new DashboardSlots();
