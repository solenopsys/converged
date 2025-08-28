import { DAGController } from "./Controller";

export * from "./Engine";
export * from "./Controller";
export * from "./Renderer";

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const controller = new DAGController('dagCanvas');

    document.getElementById('addNodeBtn')?.addEventListener('click', () => controller.addNode());
    document.getElementById('clearBtn')?.addEventListener('click', () => controller.clearAll());
    document.getElementById('connectionBtn')?.addEventListener('click', () => controller.toggleConnectionMode());
    document.getElementById('resortBtn')?.addEventListener('click', () => controller.resort());
});
