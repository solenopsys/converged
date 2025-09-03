import { DAGEngine } from "./Engine";
import { DAGRenderer } from "./Renderer";

// ============================================
// ТИПЫ
// ============================================
export interface NodeTypeProvider {
    (nodeName: string): Promise<string>;
}

export interface NodeDescriptionProvider {
    (nodeName: string): Promise<string>;
}

export interface RenderState {
    nodes: string[];
    edges: [string, string][];
    completedNodes: Set<string>;
}

// ============================================
// КОНТРОЛЛЕР
// ============================================
export class DAGController {
    private canvas: HTMLCanvasElement;
    private engine: DAGEngine;
    private renderer: DAGRenderer;
    private getNodeType: NodeTypeProvider;
    private getNodeDescription: NodeDescriptionProvider;

    private connectionMode: boolean = false;
    private selectedNodes: string[] = [];
    private hoveredNode: string | null = null;
    private completedNodes: Set<string> = new Set();

    constructor(
        canvas: HTMLCanvasElement, 
        getNodeType: NodeTypeProvider,
        getNodeDescription: NodeDescriptionProvider
    ) {
        this.canvas = canvas;
        this.engine = new DAGEngine();
        this.renderer = new DAGRenderer(this.canvas, getNodeType, this.completedNodes);
        this.getNodeType = getNodeType;
        this.getNodeDescription = getNodeDescription;

        this.setupEventListeners(); 
    }

    private setupEventListeners(): void {
        // События движка
        this.engine.on('change', (nodes: string[], edges: [string, string][]) => {
            this.renderer.render({ 
                nodes, 
                edges, 
                completedNodes: this.completedNodes 
            }, this.hoveredNode, this.selectedNodes);
        });

        // События мыши
        this.canvas.addEventListener('click', (e: MouseEvent) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    private handleClick(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (this.connectionMode) {
            const nodeName = this.renderer.getNodeAt(x, y);

            if (nodeName) {
                this.selectedNodes.push(nodeName);

                if (this.selectedNodes.length === 2) {
                    const success = this.engine.addEdge(this.selectedNodes[0], this.selectedNodes[1]);

                    const debugInfo = document.getElementById('debugInfo');
                    if (debugInfo && !success) {
                        debugInfo.textContent = `Ошибка: не удалось создать связь ${this.selectedNodes[0]} -> ${this.selectedNodes[1]}`;
                    }

                    this.selectedNodes = [];
                }

                const nodes = this.engine.getNodes();
                const edges = this.engine.getEdges();
                this.renderer.render({ 
                    nodes, 
                    edges, 
                    completedNodes: this.completedNodes 
                }, this.hoveredNode, this.selectedNodes);
            }
        }
    }

    private async handleMouseMove(event: MouseEvent): Promise<void> {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const nodeName = this.renderer.getNodeAt(x, y);

        if (nodeName !== this.hoveredNode) {
            this.hoveredNode = nodeName;
            const nodes = this.engine.getNodes();
            const edges = this.engine.getEdges();
            this.renderer.render({ 
                nodes, 
                edges, 
                completedNodes: this.completedNodes 
            }, this.hoveredNode, this.selectedNodes);

            const debugInfo = document.getElementById('debugInfo');
            if (debugInfo && nodeName) {
                try {
                    const nodeType = await this.getNodeType(nodeName);
                    debugInfo.textContent = `Наведение на узел: ${nodeName} (тип: ${nodeType})`;
                } catch (error) {
                    debugInfo.textContent = `Наведение на узел: ${nodeName} (ошибка загрузки типа)`;
                }
            }
        }
    }

    private handleMouseLeave(): void {
        if (this.hoveredNode !== null) {
            this.hoveredNode = null;
            const nodes = this.engine.getNodes();
            const edges = this.engine.getEdges();
            this.renderer.render({ 
                nodes, 
                edges, 
                completedNodes: this.completedNodes 
            }, this.hoveredNode, this.selectedNodes);
        }
    }

    // Инициализация из мапы
    async initFromMap(nodeMap: Map<string, string | string[]>): Promise<void> {
        this.clearAll();
        
        // Добавляем все узлы
        for (const nodeName of nodeMap.keys()) {
            this.engine.addNode(nodeName);
        }
        
        // Добавляем связи
        for (const [fromNode, connections] of nodeMap.entries()) {
            const targets = Array.isArray(connections) ? connections : [connections];
            for (const toNode of targets) {
                if (nodeMap.has(toNode)) {
                    this.engine.addEdge(fromNode, toNode);
                }
            }
        }
    }

    // Управление выполненными узлами
    markNodeCompleted(nodeName: string): void {
        this.completedNodes.add(nodeName);
        const nodes = this.engine.getNodes();
        const edges = this.engine.getEdges();
        this.renderer.render({ 
            nodes, 
            edges, 
            completedNodes: this.completedNodes 
        }, this.hoveredNode, this.selectedNodes);
    }

    markNodeIncomplete(nodeName: string): void {
        this.completedNodes.delete(nodeName);
        const nodes = this.engine.getNodes();
        const edges = this.engine.getEdges();
        this.renderer.render({ 
            nodes, 
            edges, 
            completedNodes: this.completedNodes 
        }, this.hoveredNode, this.selectedNodes);
    }

    getCompletedNodes(): Set<string> {
        return new Set(this.completedNodes);
    }

    // Получить описания узлов
    async getNodeDescriptions(): Promise<Map<string, string>> {
        const descriptions = new Map<string, string>();
        const nodes = this.engine.getNodes();
        
        for (const nodeName of nodes) {
            try {
                const description = await this.getNodeDescription(nodeName);
                descriptions.set(nodeName, description);
            } catch (error) {
                descriptions.set(nodeName, 'Ошибка загрузки описания');
            }
        }
        
        return descriptions;
    }

    // Публичные методы (остаются без изменений)
    addNode(name: string): boolean {
        return this.engine.addNode(name);
    }

    removeNode(name: string): boolean {
        this.selectedNodes = this.selectedNodes.filter(node => node !== name);
        if (this.hoveredNode === name) {
            this.hoveredNode = null;
        }
        this.completedNodes.delete(name);
        return this.engine.removeNode(name);
    }

    addEdge(from: string, to: string): boolean {
        return this.engine.addEdge(from, to);
    }

    removeEdge(from: string, to: string): boolean {
        return this.engine.removeEdge(from, to);
    }

    clearAll(): void {
        this.engine.clear();
        this.selectedNodes = [];
        this.hoveredNode = null;
        this.completedNodes.clear();
    }

    getNodes(): string[] {
        return this.engine.getNodes();
    }

    getEdges(): [string, string][] {
        return this.engine.getEdges();
    }

    getNodeConnections(name: string) {
        return this.engine.getNodeConnections(name);
    }

    hasNode(name: string): boolean {
        return this.engine.hasNode(name);
    }

    hasEdge(from: string, to: string): boolean {
        return this.engine.hasEdge(from, to);
    }

    toggleConnectionMode(): void {
        this.connectionMode = !this.connectionMode;
        this.selectedNodes = [];

        const btn = document.getElementById('connectionBtn') as HTMLButtonElement;
        if (btn) {
            btn.textContent = `Режим соединения: ${this.connectionMode ? 'ВКЛ' : 'ВЫКЛ'}`;
            btn.className = this.connectionMode ? 'active' : '';
        }

        this.canvas.style.cursor = this.connectionMode ? 'crosshair' : 'pointer';

        const nodes = this.engine.getNodes();
        const edges = this.engine.getEdges();
        this.renderer.render({ 
            nodes, 
            edges, 
            completedNodes: this.completedNodes 
        }, this.hoveredNode, this.selectedNodes);
    }

    isConnectionMode(): boolean {
        return this.connectionMode;
    }

    getSelectedNodes(): string[] {
        return [...this.selectedNodes];
    }

    getHoveredNode(): string | null {
        return this.hoveredNode;
    }

    hasCycle(): boolean {
        return this.engine.hasCycle();
    }

    topologicalSort(): string[] {
        return this.engine.topologicalSort();
    }
}