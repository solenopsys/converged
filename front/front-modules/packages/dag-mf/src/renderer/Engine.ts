// ============================================
// ДВИЖОК
// ============================================

export interface Node {
    index: number;
    letter: string;
}

export interface Connection {
    from: number;
    to: number;
}

export interface State {
    nodes: Node[];
    connections: Connection[];
}

type ListenerCallback = (data: State) => void;

export class DAGEngine {
    public nodes: Node[] = [];
    public connections: Connection[] = [];
    private listeners: { [key: string]: ListenerCallback[] } = {};

    // Подписка на события
    on(event: string, callback: ListenerCallback): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // Оповещение
    emit(event: string, data: State): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    // Получение текущего состояния
    getState(): State {
        return {
            nodes: this.nodes,
            connections: this.connections
        };
    }

    // Добавление узла
    addNode(): void {
        const newNode: Node = {
            index: this.nodes.length,
            letter: String.fromCharCode(65 + this.nodes.length)
        };
        this.nodes.push(newNode);
        this.emit('stateChanged', this.getState());
    }

    // Добавление связи
    addConnection(fromIndex: number, toIndex: number): { success: boolean; reason?: string } {
        if (fromIndex === toIndex) {
            return { success: false, reason: 'Нельзя соединить узел с самим собой' };
        }

        const exists = this.connections.some(
            conn => (conn.from === fromIndex && conn.to === toIndex)
        );

        if (exists) {
            return { success: false, reason: 'Такое соединение уже существует' };
        }

        // Проверка на создание цикла
        if (this.createsCycle(fromIndex, toIndex)) {
            return { success: false, reason: 'Это действие создаст цикл' };
        }

        this.connections.push({ from: fromIndex, to: toIndex });
        this.emit('stateChanged', this.getState());
        return { success: true };
    }

    // Очистка
    clear(): void {
        this.nodes = [];
        this.connections = [];
        this.emit('stateChanged', this.getState());
    }

    // ============================================
    // АЛГОРИТМЫ
    // ============================================

    // Проверка на создание цикла (DFS)
    createsCycle(from: number, to: number): boolean {
        const tempConnections: Connection[] = [...this.connections, { from, to }];
        const visited: Set<number> = new Set();
        const recursionStack: Set<number> = new Set();

        const hasCycle = (nodeIndex: number): boolean => {
            visited.add(nodeIndex);
            recursionStack.add(nodeIndex);

            const neighbors = tempConnections
                .filter(conn => conn.from === nodeIndex)
                .map(conn => conn.to);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor)) {
                        return true;
                    }
                } else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }

            recursionStack.delete(nodeIndex);
            return false;
        };

        for (let i = 0; i < this.nodes.length; i++) {
            if (!visited.has(i)) {
                if (hasCycle(i)) {
                    return true;
                }
            }
        }

        return false;
    }

    // Топологическая сортировка (алгоритм Кана)
    topologicalSort(): number[] {
        const inDegree: number[] = new Array(this.nodes.length).fill(0);
        this.connections.forEach(conn => {
            inDegree[conn.to]++;
        });

        const queue: number[] = [];
        for (let i = 0; i < this.nodes.length; i++) {
            if (inDegree[i] === 0) {
                queue.push(i);
            }
        }

        const sortedOrder: number[] = [];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            sortedOrder.push(u);

            this.connections
                .filter(conn => conn.from === u)
                .forEach(conn => {
                    inDegree[conn.to]--;
                    if (inDegree[conn.to] === 0) {
                        queue.push(conn.to);
                    }
                });
        }

        if (sortedOrder.length !== this.nodes.length) {
            console.error("Обнаружен цикл, топологическая сортировка невозможна.");
            return [];
        }

        return sortedOrder;
    }
}
