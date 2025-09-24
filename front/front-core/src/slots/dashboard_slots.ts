import { $slotContents, mountWhenReady } from "./slots"; 
import { ReactNode } from "react";


 class DashboardSlots {
    public list: string[] = [];
    private counter = 0;
    private savedWidgets: Map<string, ReactNode> = new Map();

    next(prefix: string): string {
        const slotId = `${prefix}-${this.counter}`;
        this.counter++;
        this.list.push(slotId);
        console.log("DashboardSlots next", slotId);
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
        this.counter = 0;
    }
}

export const dashboardSlots = new DashboardSlots();
