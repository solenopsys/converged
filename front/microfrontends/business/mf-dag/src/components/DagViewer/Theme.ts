export const theme = {
    // Размер ячейки для каждого узла (квадрат)
    cellSize: 40,
    
    // Радиус узла (должен помещаться в ячейку с отступами)
    nodeRadius: 16,
    
    // Расстояние между центрами узлов (равно размеру ячейки)
    nodeSpacing: 40,
    
    // Отступ слева
    leftMargin: 40,
    
    // Отступ сверху для первого узла (половина ячейки для центрирования)
    topOffset: 20,
         
    colors: {
        nodeBackground: 'gray',
        nodeSelected: 'hsl(var(--accent))',
        nodeBorder: 'gray',
        nodeText: 'white',
                 
        entryPoint: 'hsla(120, 100%, 50%, 0.7)', // зеленый с прозрачностью 70%
        exitPoint: 'hsla(0, 100%, 50%, 0.7)', // красный с прозрачностью 70%
                 
        connectionDefault: 'hsl(var(--muted))',
        connectionIncoming: 'hsl(120, 100%, 50%)',
        connectionOutgoing: 'hsl(0, 100%, 50%)'
    },
         
    sizes: {
        nodeBorderWidth: 2,
        connectionPointRadius: 4,
        connectionWidth: 2,
        connectionHoveredWidth: 3
    },
         
    bezier: {
        baseOffset: 15,
        distanceMultiplier: 15
    },
         
font: 'lighter 14px Arial',
    
    // Вспомогательные методы для расчета позиций
    getNodePosition: (index) => ({
        x: theme.leftMargin + theme.cellSize / 2,
        y: theme.topOffset + index * theme.cellSize
    }),
    
    // Получить границы ячейки для узла
    getCellBounds: (index) => ({
        left: theme.leftMargin,
        top: theme.topOffset - theme.cellSize / 2 + index * theme.cellSize,
        right: theme.leftMargin + theme.cellSize,
        bottom: theme.topOffset + theme.cellSize / 2 + index * theme.cellSize,
        width: theme.cellSize,
        height: theme.cellSize
    }),
    
    // Проверить, что узел помещается в свою ячейку
    validateNodeFitsInCell: () => {
        const maxNodeSize = theme.nodeRadius * 2;
        const availableSpace = theme.cellSize - 8; // 4px отступ с каждой стороны
        return maxNodeSize <= availableSpace;
    }
};