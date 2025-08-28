import { Node, State } from './Engine';

// ============================================
// РЕНДЕРЕР
// ============================================
interface NodePosition {
    x: number;
    y: number;
}

export class DAGRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private nodeRadius: number = 20;
    private nodeSpacing: number = 80;
    private leftMargin: number = 150;

    private hoveredNodeIndex: number = -1;
    private selectedNodes: number[] = [];

    private nodePositions: NodePosition[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
    }

    // Вычисление позиций узлов (вертикальный список)
    private calculatePositions(nodes: Node[]): void {
        this.nodePositions = nodes.map((node, index) => ({
            x: this.leftMargin + 100,
            y: 60 + index * this.nodeSpacing
        }));
    }

    // Получить позицию точки выхода узла
    private getExitPoint(nodeIndex: number): { x: number, y: number } {
        const pos = this.nodePositions[nodeIndex];
        return {
            x: pos.x - this.nodeRadius,
            y: pos.y + this.nodeRadius / 2
        };
    }

    // Получить позицию точки входа узла
    private getEntryPoint(nodeIndex: number): { x: number, y: number } {
        const pos = this.nodePositions[nodeIndex];
        return {
            x: pos.x - this.nodeRadius,
            y: pos.y - this.nodeRadius / 2
        };
    }

    // Главный метод рендеринга
    render(state: State, hoveredIndex: number = -1, selectedNodes: number[] = []): void {
        this.hoveredNodeIndex = hoveredIndex;
        this.selectedNodes = selectedNodes;

        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (state.nodes.length === 0) return;

        // Вычисляем позиции
        this.calculatePositions(state.nodes);

        // Рисуем связи
        this.renderConnections(state);

        // Рисуем узлы
        this.renderNodes(state);
    }

    // Рендер связей
    private renderConnections(state: State): void {
        state.connections.forEach(conn => {
            const fromPos = this.nodePositions[conn.from];
            const toPos = this.nodePositions[conn.to];

            if (!fromPos || !toPos) return;

            // Получаем точные координаты точек входа и выхода
            const exitPoint = this.getExitPoint(conn.from);
            const entryPoint = this.getEntryPoint(conn.to);

            // Вычисляем расстояние между узлами (в индексах)
            const nodeDistance = Math.abs(conn.to - conn.from);
            
            // Определяем смещение контрольных точек в зависимости от расстояния
            // Чем больше расстояние, тем больше "выгиб" кривой влево
            const baseOffset = 30;
            const distanceMultiplier = 25; // Добавочное смещение за каждый узел
            const controlOffset = baseOffset + (nodeDistance - 1) * distanceMultiplier;

            // Определяем цвет линии
            let strokeColor: string = '#ccc';
            let lineWidth: number = 2;

            if (this.hoveredNodeIndex !== -1) {
                if (conn.from === this.hoveredNodeIndex) {
                    strokeColor = '#f44336'; // Исходящая - красная
                    lineWidth = 3;
                } else if (conn.to === this.hoveredNodeIndex) {
                    strokeColor = '#4caf50'; // Входящая - зеленая
                    lineWidth = 3;
                }
            }

            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = lineWidth;

            // Рисуем кривую Безье от точки выхода к точке входа
            this.ctx.beginPath();
            this.ctx.moveTo(exitPoint.x, exitPoint.y);

            // Контрольные точки с градацией по расстоянию
            const control1X = exitPoint.x - controlOffset;
            const control1Y = exitPoint.y;
            const control2X = entryPoint.x - controlOffset;
            const control2Y = entryPoint.y;

            this.ctx.bezierCurveTo(
                control1X, control1Y,
                control2X, control2Y,
                entryPoint.x, entryPoint.y
            );

            this.ctx.stroke();
        });
    }

    // Рендер узлов
    private renderNodes(state: State): void {
        state.nodes.forEach((node, index) => {
            const pos = this.nodePositions[index];
            const isSelected = this.selectedNodes.includes(index);

            // Рисуем круг
            this.ctx.fillStyle = isSelected ? '#ffeb3b' : '#e3f2fd';
            this.ctx.strokeStyle = '#1976d2';
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Рисуем букву
            this.ctx.fillStyle = '#1976d2';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.letter, pos.x, pos.y);

            // Точки входа/выхода
            // Вход сверху
            const entryPoint = this.getEntryPoint(index);
            this.ctx.fillStyle = '#4caf50';
            this.ctx.beginPath();
            this.ctx.arc(entryPoint.x, entryPoint.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();

            // Выход снизу
            const exitPoint = this.getExitPoint(index);
            this.ctx.fillStyle = '#f44336';
            this.ctx.beginPath();
            this.ctx.arc(exitPoint.x, exitPoint.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    // Получить узел по координатам
    getNodeAt(x: number, y: number): number {
        for (let i = 0; i < this.nodePositions.length; i++) {
            const pos = this.nodePositions[i];
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist <= this.nodeRadius) {
                return i;
            }
        }
        return -1;
    }
}