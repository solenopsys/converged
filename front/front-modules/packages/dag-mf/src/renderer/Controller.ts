import { DAGEngine, State } from "./Engine";
import { DAGRenderer } from "./Renderer";

// ============================================
// КОНТРОЛЛЕР
// ============================================
export class DAGController {
    private canvas: HTMLCanvasElement;
    private engine: DAGEngine;
    private renderer: DAGRenderer;

    private connectionMode: boolean = false;
    private selectedNodes: number[] = [];
    private hoveredNode: number = -1;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id ${canvasId} not found`);
        }
        this.canvas = canvas;
        this.engine = new DAGEngine();
        this.renderer = new DAGRenderer(this.canvas);

        this.setupEventListeners();
        this.initializeDemo();
    }

    private setupEventListeners(): void {
        // События движка
        this.engine.on('stateChanged', (state: State) => {
            this.renderer.render(state, this.hoveredNode, this.selectedNodes);
        });

        // События мыши
        this.canvas.addEventListener('click', (e: MouseEvent) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e: MouseEvent) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', (e: MouseEvent) => this.handleMouseLeave(e));
    }

    private initializeDemo(): void {
        // Создаем демо граф
        this.engine.addNode(); // A
        this.engine.addNode(); // B
        this.engine.addNode(); // C
        this.engine.addNode(); // D

        this.engine.addConnection(0, 1); // A -> B
        this.engine.addConnection(0, 2); // A -> C
        this.engine.addConnection(0, 3); // A -> D
        this.engine.addConnection(1, 3); // B -> D
    }

    private handleClick(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (this.connectionMode) {
            const nodeIndex = this.renderer.getNodeAt(x, y);

            if (nodeIndex !== -1) {
                this.selectedNodes.push(nodeIndex);

                if (this.selectedNodes.length === 2) {
                    const result = this.engine.addConnection(
                        this.selectedNodes[0],
                        this.selectedNodes[1]
                    );

                    const debugInfo = document.getElementById('debugInfo');
                    if (debugInfo && !result.success) {
                        debugInfo.textContent = `Ошибка: ${result.reason}`;
                    }

                    this.selectedNodes = [];
                }

                const state = this.engine.getState();
                this.renderer.render(state, this.hoveredNode, this.selectedNodes);
            }
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const nodeIndex = this.renderer.getNodeAt(x, y);

        if (nodeIndex !== this.hoveredNode) {
            this.hoveredNode = nodeIndex;
            const state = this.engine.getState();
            this.renderer.render(state, this.hoveredNode, this.selectedNodes);

            const debugInfo = document.getElementById('debugInfo');
            if (debugInfo && nodeIndex !== -1) {
                const node = this.engine.nodes[nodeIndex];
                debugInfo.textContent = `Наведение на узел: ${node.letter} (индекс ${nodeIndex})`;
            }
        }
    }

    private handleMouseLeave(event: MouseEvent): void {
        if (this.hoveredNode !== -1) {
            this.hoveredNode = -1;
            const state = this.engine.getState();
            this.renderer.render(state, this.hoveredNode, this.selectedNodes);
        }
    }

    addNode(): void {
        this.engine.addNode();
    }

    clearAll(): void {
        this.engine.clear();
        this.selectedNodes = [];
        this.hoveredNode = -1;
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

        const state = this.engine.getState();
        this.renderer.render(state, this.hoveredNode, this.selectedNodes);
    }

    resort(): void {
        const sorted = this.engine.topologicalSort();

        // This logic seems to be re-implementing state management that should be in the engine.
        // For now, I will just add types.
        const newNodes = sorted.map(index => this.engine.nodes[index]);
        const newConnections = this.engine.connections.map(conn => {
            const newFrom = sorted.indexOf(conn.from);
            const newTo = sorted.indexOf(conn.to);
            return { from: newFrom, to: newTo };
        });

        // Обновляем индексы в узлах
        newNodes.forEach((node, index) => {
            node.index = index;
        });

        this.engine.nodes = newNodes;
        this.engine.connections = newConnections;

        const state = this.engine.getState();
        this.renderer.render(state, this.hoveredNode, this.selectedNodes);

        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.textContent = `Топологическая сортировка: ${newNodes.map(n => n.letter).join(' → ')}`;
        }
    }
}