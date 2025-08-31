import { theme } from './Theme';
import { LUCIDE_ICONS } from './Icons';

// ============================================
// ТИПЫ
// ============================================
export interface NodeTypeProvider {
    (nodeName: string): Promise<string>;
}

export interface RenderState {
    nodes: string[];
    edges: [string, string][];
    completedNodes: Set<string>;
}

export interface NodePosition {
    x: number;
    y: number;
}

// ============================================
// RENDERER
// ============================================
export class DAGRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private getNodeType: NodeTypeProvider;
    private completedNodes: Set<string>;

    private hoveredNode: string | null = null;
    private selectedNodes: string[] = [];
    private nodePositions: Map<string, NodePosition> = new Map();
    private iconPaths: Map<string, Path2D> = new Map();
    private nodeTypeCache: Map<string, string> = new Map();

    constructor(canvas: HTMLCanvasElement, getNodeType: NodeTypeProvider, completedNodes: Set<string>) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
        this.getNodeType = getNodeType;
        this.completedNodes = completedNodes;
        
        this.initializeIconPaths();
    }

    private initializeIconPaths(): void {
        Object.entries(LUCIDE_ICONS).forEach(([name, icon]) => {
            const path2D = new Path2D(icon.path);
            this.iconPaths.set(name, path2D);
        });
    }

    private getColor(colorValue: string): string {
        if (colorValue.includes('var(')) {
            const temp = document.createElement('div');
            temp.style.color = colorValue;
            document.body.appendChild(temp);
            const computedColor = getComputedStyle(temp).color;
            document.body.removeChild(temp);
            return computedColor;
        }
        return colorValue;
    }

    private calculatePositions(nodes: string[]): void {
        this.nodePositions.clear();
        nodes.forEach((nodeName, index) => {
            this.nodePositions.set(nodeName, {
                x: theme.leftMargin + theme.cellSize / 2,
                y: theme.topOffset + index * theme.cellSize
            });
        });
    }

    getTotalHeight(nodeCount: number): number {
        if (nodeCount === 0) return 0;
        return theme.topOffset + (nodeCount - 1) * theme.cellSize + theme.cellSize / 2;
    }

    private getExitPoint(nodeName: string): { x: number, y: number } {
        const pos = this.nodePositions.get(nodeName);
        if (!pos) throw new Error(`Node ${nodeName} not found`);
        return {
            x: pos.x - theme.nodeRadius,
            y: pos.y + theme.nodeRadius / 2
        };
    }

    private getEntryPoint(nodeName: string): { x: number, y: number } {
        const pos = this.nodePositions.get(nodeName);
        if (!pos) throw new Error(`Node ${nodeName} not found`);
        return {
            x: pos.x - theme.nodeRadius,
            y: pos.y - theme.nodeRadius / 2
        };
    }

    // Новый метод для рисования стрелки
    private drawArrow(x: number, y: number, angle: number, size: number = 6): void {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-size, -size / 2);
        this.ctx.lineTo(-size, size / 2);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }

    private async renderIcon(nodeName: string, x: number, y: number, size: number = 16): Promise<void> {
        // Проверяем кэш
        let iconName = this.nodeTypeCache.get(nodeName);
        
        // Если нет в кэше, загружаем асинхронно
        if (!iconName) {
            try {
                iconName = await this.getNodeType(nodeName);
                this.nodeTypeCache.set(nodeName, iconName);
            } catch (error) {
                iconName = 'circle'; // fallback
                this.nodeTypeCache.set(nodeName, iconName);
            }
        }

        const iconPath = this.iconPaths.get(iconName);
        const iconDefinition = LUCIDE_ICONS[iconName];

                // Округляем координаты для четких пикселей
                const roundedX = Math.round(x);
                const roundedY = Math.round(y);
        
        if (!iconPath || !iconDefinition) {
            // Fallback: рисуем первую букву имени узла
            this.ctx.fillStyle = this.getColor(theme.colors.nodeText);
            this.ctx.font = theme.font;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(nodeName.charAt(0).toUpperCase(), roundedX,roundedY);
            return;
        }

        this.ctx.save();
        

        
        this.ctx.translate(roundedX, roundedY);
        
        const viewBoxSize = 24;
        const scale = size / viewBoxSize;
        this.ctx.scale(scale, scale);
        
        // Центрируем иконку
        this.ctx.translate(-12, -12); // Точные целые числа вместо viewBoxSize / 2
        
        this.ctx.strokeStyle = this.getColor(theme.colors.nodeText);
        this.ctx.fillStyle = 'none';
        this.ctx.lineWidth = 1.5; // Фиксированная толщина для четкости
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.stroke(iconPath);
        
        this.ctx.restore();
    }

    async render(state: RenderState, hoveredNode: string | null = null, selectedNodes: string[] = []): Promise<void> {
        this.hoveredNode = hoveredNode;
        this.selectedNodes = selectedNodes;
        this.completedNodes = state.completedNodes;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (state.nodes.length === 0) return;

        this.calculatePositions(state.nodes);

        this.renderConnections(state);
        await this.renderNodes(state);
    }

    private renderConnections(state: RenderState): void {
        state.edges.forEach(([fromName, toName]) => {
            const fromPos = this.nodePositions.get(fromName);
            const toPos = this.nodePositions.get(toName);

            if (!fromPos || !toPos) return;

            const exitPoint = this.getExitPoint(fromName);
            const entryPoint = this.getEntryPoint(toName);

            const fromIndex = state.nodes.indexOf(fromName);
            const toIndex = state.nodes.indexOf(toName);
            const nodeDistance = Math.abs(toIndex - fromIndex);
            const controlOffset = theme.bezier.baseOffset + (nodeDistance - 1) * theme.bezier.distanceMultiplier;

            let strokeColor = this.getColor(theme.colors.connectionDefault);
            let lineWidth = Math.max(1, theme.sizes.connectionWidth - 1); // Делаем линию тоньше

            if (this.hoveredNode !== null) {
                if (fromName === this.hoveredNode) {
                    strokeColor = this.getColor(theme.colors.connectionOutgoing);
                    lineWidth = Math.max(2, theme.sizes.connectionHoveredWidth - 1);
                } else if (toName === this.hoveredNode) {
                    strokeColor = this.getColor(theme.colors.connectionIncoming);
                    lineWidth = Math.max(2, theme.sizes.connectionHoveredWidth - 1);
                }
            }

            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = lineWidth;

            this.ctx.beginPath();
            this.ctx.moveTo(exitPoint.x, exitPoint.y);

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

            // Рисуем стрелку на конце связи
            this.ctx.fillStyle = strokeColor;
            
            // Правильно вычисляем угол касательной к кривой Безье в конечной точке
            // Касательная = производная кривой Безье в точке t=1
            const tangentX = 3 * (entryPoint.x - control2X);
            const tangentY = 3 * (entryPoint.y - control2Y);
            const angle = Math.atan2(tangentY, tangentX);
            
            this.drawArrow(entryPoint.x, entryPoint.y, angle, 5);
        });
    }

    private async renderNodes(state: RenderState): Promise<void> {
        for (const nodeName of state.nodes) {
            const pos = this.nodePositions.get(nodeName);
            if (!pos) continue;

            const isSelected = this.selectedNodes.includes(nodeName);
            const isCompleted = this.completedNodes.has(nodeName);

            // Определяем цвет фона узла
            let nodeColor = this.getColor(theme.colors.nodeBackground);
            if (isCompleted) {
                nodeColor = 'hsl(120, 60%, 50%)'; // зеленый для выполненных
            } else if (isSelected) {
                nodeColor = this.getColor(theme.colors.nodeSelected);
            }

            // Рисуем круг
            this.ctx.fillStyle = nodeColor;
            this.ctx.strokeStyle = this.getColor(theme.colors.nodeBorder);
            this.ctx.lineWidth = theme.sizes.nodeBorderWidth;

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, theme.nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Рисуем иконку
            await this.renderIcon(nodeName, pos.x, pos.y, theme.nodeRadius);

            // Убрали рендеринг цветных кружочков - теперь только стрелки на концах связей
        }
    }

    getNodeAt(x: number, y: number): string | null {
        for (const [nodeName, pos] of this.nodePositions) {
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
            if (dist <= theme.nodeRadius) {
                return nodeName;
            }
        }
        return null;
    }

    addIcon(name: string, pathData: string): void {
        LUCIDE_ICONS[name] = { path: pathData, viewBox: "0 0 24 24" };
        const path2D = new Path2D(pathData);
        this.iconPaths.set(name, path2D);
    }
}