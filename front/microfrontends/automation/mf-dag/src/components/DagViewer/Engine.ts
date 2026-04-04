export class DAGEngine {
    private nodes = new Set<string>();
    private edges = new Map<string, Set<string>>();
    private listeners = new Map<string, Array<(nodes: string[], edges: [string, string][]) => void>>();

    // Events
    on(event: string, callback: (nodes: string[], edges: [string, string][]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    private emit(event: string): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const nodes = Array.from(this.nodes);
            const edges = this.getEdgesArray();
            callbacks.forEach(callback => callback(nodes, edges));
        }
    }

    // Core operations
    addNode(name: string): boolean {
        if (this.nodes.has(name)) return false;
        
        this.nodes.add(name);
        this.edges.set(name, new Set());
        this.emit('change');
        return true;
    }

    removeNode(name: string): boolean {
        if (!this.nodes.has(name)) return false;

        this.nodes.delete(name);
        this.edges.delete(name);
        
        // Remove all edges to this node
        for (const [, targets] of this.edges) {
            targets.delete(name);
        }
        
        this.emit('change');
        return true;
    }

    addEdge(from: string, to: string): boolean {
        if (!this.nodes.has(from) || !this.nodes.has(to)) return false;
        if (from === to) return false;
        
        const fromEdges = this.edges.get(from)!;
        if (fromEdges.has(to)) return false;
        
        // Check for cycles
        if (this.wouldCreateCycle(from, to)) return false;
        
        fromEdges.add(to);
        this.emit('change');
        return true;
    }

    removeEdge(from: string, to: string): boolean {
        const fromEdges = this.edges.get(from);
        if (!fromEdges || !fromEdges.has(to)) return false;
        
        fromEdges.delete(to);
        this.emit('change');
        return true;
    }

    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.emit('change');
    }

    // Queries
    hasNode(name: string): boolean {
        return this.nodes.has(name);
    }

    hasEdge(from: string, to: string): boolean {
        return this.edges.get(from)?.has(to) || false;
    }

    getNodes(): string[] {
        return this.topologicalSort();
    }

    getEdges(): [string, string][] {
        return this.getEdgesArray();
    }

    getOutgoing(node: string): string[] {
        return Array.from(this.edges.get(node) || []);
    }

    getIncoming(node: string): string[] {
        const incoming: string[] = [];
        for (const [from, targets] of this.edges) {
            if (targets.has(node)) {
                incoming.push(from);
            }
        }
        return incoming;
    }

    getNodeConnections(name: string) {
        return {
            incoming: this.getIncoming(name),
            outgoing: this.getOutgoing(name)
        };
    }

    // Algorithms
    topologicalSort(): string[] {
        const inDegree = new Map<string, number>();
        const result: string[] = [];

        // Initialize in-degrees
        for (const node of this.nodes) {
            inDegree.set(node, 0);
        }

        for (const [, targets] of this.edges) {
            for (const target of targets) {
                inDegree.set(target, inDegree.get(target)! + 1);
            }
        }

        // Find nodes with no incoming edges and sort them
        const noIncomingNodes: string[] = [];
        for (const [node, degree] of inDegree) {
            if (degree === 0) {
                noIncomingNodes.push(node);
            }
        }
        noIncomingNodes.sort(); // Сортируем узлы без входящих связей по имени

        const queue = [...noIncomingNodes];

        // Process queue
        while (queue.length > 0) {
            const current = queue.shift()!;
            result.push(current);

            const targets = Array.from(this.edges.get(current)!);
            // Сортируем targets для детерминированного порядка
            targets.sort();
            
            for (const target of targets) {
                const newDegree = inDegree.get(target)! - 1;
                inDegree.set(target, newDegree);
                if (newDegree === 0) {
                    queue.push(target);
                }
            }
        }

        return result.length === this.nodes.size ? result : [];
    }

    hasCycle(): boolean {
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const dfs = (node: string): boolean => {
            visited.add(node);
            recStack.add(node);

            const targets = this.edges.get(node)!;
            for (const target of targets) {
                if (!visited.has(target)) {
                    if (dfs(target)) return true;
                } else if (recStack.has(target)) {
                    return true;
                }
            }

            recStack.delete(node);
            return false;
        };

        for (const node of this.nodes) {
            if (!visited.has(node)) {
                if (dfs(node)) return true;
            }
        }

        return false;
    }

    // Private helpers
    private wouldCreateCycle(from: string, to: string): boolean {
        const visited = new Set<string>();
        
        const dfs = (current: string): boolean => {
            if (current === from) return true;
            if (visited.has(current)) return false;
            
            visited.add(current);
            const targets = this.edges.get(current);
            if (!targets) return false;
            
            for (const target of targets) {
                if (dfs(target)) return true;
            }
            
            return false;
        };

        return dfs(to);
    }

    private getEdgesArray(): [string, string][] {
        const result: [string, string][] = [];
        for (const [from, targets] of this.edges) {
            for (const to of targets) {
                result.push([from, to]);
            }
        }
        return result;
    }
}