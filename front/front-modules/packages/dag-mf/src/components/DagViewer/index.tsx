import { useEffect, useState, useRef } from "react";
import { DAGController } from "./Controller";

interface DagViewerProps {
  nodeMap: Map<string, string | string[]>;
  getNodeType: (nodeName: string) => Promise<string>;
  getNodeDescription: (nodeName: string) => Promise<string>;
  completedNodes?: Set<string>;
  onclick?: (nodeName: string) => void;
}

export default function DagViewer({
  nodeMap,
  getNodeType,
  getNodeDescription,
  completedNodes = new Set(),
  onclick
}: DagViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [controller, setController] = useState<DAGController | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const initController = async () => {
      // Создаем контроллер БЕЗ автоматического рендеринга
      const newController = new DAGController(canvasRef.current!, getNodeType, getNodeDescription);

      // Инициализируем граф из мапы
      await newController.initFromMap(nodeMap);

      // Применяем выполненные узлы
      for (const nodeName of completedNodes) {
        newController.markNodeCompleted(nodeName);
      }

      // ВАЖНО: получаем отсортированные узлы ПОСЛЕ полной инициализации
      const nodeList = newController.getNodes(); // Это уже возвращает topologicalSort()
      setNodes(nodeList);

      // Загружаем описания для отсортированных узлов
      try {
        const nodeDescriptions = await Promise.all(
          nodeList.map(async (nodeName) => {
            try {
              return await getNodeDescription(nodeName);
            } catch (error) {
              console.warn(`Ошибка загрузки описания для ${nodeName}:`, error);
              return "Ошибка загрузки описания";
            }
          })
        );
        setDescriptions(nodeDescriptions);
      } catch (error) {
        console.error("Ошибка загрузки описаний:", error);
        setDescriptions(nodeList.map(() => "Ошибка загрузки описания"));
      }

      // ФИНАЛЬНАЯ ПЕРЕРИСОВКА: теперь рендерим с правильным порядком узлов
      const edges = newController.getEdges();
      const renderState = {
        nodes: nodeList,
        edges: edges,
        completedNodes: completedNodes
      };

      // Принудительно перерисовываем с правильным состоянием
      newController.renderer.render(renderState, null, []);

      setController(newController);
    };

    initController();
  }, [nodeMap, getNodeType, getNodeDescription, completedNodes]);

  return (
    <div className="flex w-full h-full min-h-0">
      <canvas
        ref={canvasRef}
        width={80}
        height={600}
        className="border flex-none"
        style={{
          width: '80px',
          height: '600px'
        }}
      />

      <div className="ml-4 flex-1 min-w-0 overflow-y-auto">
        {nodes.map((nodeName, i) => {
          const description = descriptions[i] || "Загрузка...";
          const isCompleted = completedNodes.has(nodeName);

          return (
            <div
              key={`${nodeName}-${i}`}
              className={`text-sm border-l-2 pl-2 cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground min-w-0 ${isCompleted ? 'border-green-500' : 'border-gray-300'
                }`}
              style={{ height: "40px" }}
              onClick={() => onclick?.(nodeName)}
            >
              <div className="font-medium text-xs truncate" title={nodeName}>
                {nodeName}
              </div>
              <div className="text-xs text-muted-foreground leading-tight truncate" title={description}>
                {description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}