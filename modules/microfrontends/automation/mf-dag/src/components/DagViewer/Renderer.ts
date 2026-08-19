import { theme } from './Theme';
import { STREAMLINE_ICONS } from './Icons';

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

// RENDERER
export class DAGRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private getNodeType: NodeTypeProvider;
    private completedNodes: Set<string>;

    private hoveredNode: string | null = null;
    private selectedNodes: string[] = [];
    private nodePositions: Map<string, NodePosition> = new Map();
    private iconImages: Map<string, Promise<HTMLImageElement>> = new Map();
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
    }

    private loadIcon(name: string, color: string): Promise<HTMLImageElement> {
        const cacheKey = `${name}:${color}`;
        const cached = this.iconImages.get(cacheKey);
        if (cached) return cached;

        const icon = STREAMLINE_ICONS[name];
        if (!icon) return Promise.reject(new Error(`Icon ${name} not found`));

        const width = icon.width ?? 14;
        const height = icon.height ?? 14;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.body.replaceAll("currentColor", color)}</svg>`;
        const image = new Image();
        const pending = new Promise<HTMLImageElement>((resolve, reject) => {
            image.addEventListener('load', () => resolve(image), { once: true });
            image.addEventListener('error', () => reject(new Error(`Failed to load icon ${name}`)), { once: true });
        });

        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        this.iconImages.set(cacheKey, pending);
        return pending;
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
        let iconName = this.nodeTypeCache.get(nodeName);

        if (!iconName) {
            try {
                iconName = await this.getNodeType(nodeName);
                this.nodeTypeCache.set(nodeName, iconName);
            } catch (error) {
                iconName = 'circle'; // fallback
                this.nodeTypeCache.set(nodeName, iconName);
            }
        }

        const iconDefinition = STREAMLINE_ICONS[iconName];
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);

        if (!iconPath || !iconDefinition) {
            this.ctx.fillStyle = this.getColor(theme.colors.nodeText);
            this.ctx.font = theme.font;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(nodeName.charAt(0).toUpperCase(), roundedX,roundedY);
            return;
        }

        try {
            const image = await this.loadIcon(iconName, this.getColor(theme.colors.nodeText));
            this.ctx.drawImage(image, roundedX - size / 2, roundedY - size / 2, size, size);
        } catch {
            this.ctx.fillStyle = this.getColor(theme.colors.nodeText);
            this.ctx.font = theme.font;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(nodeName.charAt(0).toUpperCase(), roundedX, roundedY);
        }
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
            let lineWidth = Math.max(1, theme.sizes.connectionWidth - 1);
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

            this.ctx.fillStyle = strokeColor;

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

            let nodeColor = this.getColor(theme.colors.nodeBackground);
            if (isCompleted) {
                nodeColor = 'hsl(120, 60%, 50%)';            } else if (isSelected) {
                nodeColor = this.getColor(theme.colors.nodeSelected);
            }

            this.ctx.fillStyle = nodeColor;
            this.ctx.strokeStyle = this.getColor(theme.colors.nodeBorder);
            this.ctx.lineWidth = theme.sizes.nodeBorderWidth;

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, theme.nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            await this.renderIcon(nodeName, pos.x, pos.y, theme.nodeRadius);

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

    addIcon(name: string, body: string): void {
        STREAMLINE_ICONS[name] = { body };
        for (const cacheKey of this.iconImages.keys()) {
            if (cacheKey.startsWith(`${name}:`)) this.iconImages.delete(cacheKey);
        }
    }
}
