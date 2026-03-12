import { useEffect, useState, useRef, useMemo } from "react";
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

  // Стабилизируем completedNodes через useMemo
  const stableCompletedNodes = useMemo(() => {
    return Array.from(completedNodes).sort().join(',');
  }, [completedNodes]);

  // Стабилизируем nodeMap
  const stableNodeMap = useMemo(() => {
    const entries = Array.from(nodeMap.entries()).sort();
    return JSON.stringify(entries);
  }, [nodeMap]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let isCancelled = false; // Флаг для предотвращения race conditions

    const initController = async () => {
      try {
        // Создаем контроллер БЕЗ автоматического рендеринга
        const newController = new DAGController(canvasRef.current!, getNodeType, getNodeDescription);

        // Инициализируем граф из мапы
        await newController.initFromMap(nodeMap);

        if (isCancelled) return; // Проверяем, не отменен ли эффект

        // Применяем выполненные узлы
        for (const nodeName of completedNodes) {
          newController.markNodeCompleted(nodeName);
        }

        // Получаем отсортированные узлы ПОСЛЕ полной инициализации
        const nodeList = newController.getNodes();
        
        if (isCancelled) return;
        
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
          
          if (isCancelled) return;
          
          setDescriptions(nodeDescriptions);
        } catch (error) {
          console.error("Ошибка загрузки описаний:", error);
          if (!isCancelled) {
            setDescriptions(nodeList.map(() => "Ошибка загрузки описания"));
          }
        }

        if (isCancelled) return;

        // ФИНАЛЬНАЯ ПЕРЕРИСОВКА
        const edges = newController.getEdges();
        const renderState = {
          nodes: nodeList,
          edges: edges,
          completedNodes: completedNodes
        };

        newController.renderer.render(renderState, null, []);
        setController(newController);
        
      } catch (error) {
        console.error("Ошибка инициализации контроллера:", error);
      }
    };

    initController();

    // Cleanup функция
    return () => {
      isCancelled = true;
    };
  }, [stableNodeMap, stableCompletedNodes, getNodeType, getNodeDescription]);

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
              className={`text-sm border-l-2 pl-2 cursor-pointer transition-colors duration-200 hover:bg-accent hover:text-accent-foreground min-w-0 ${
                isCompleted ? 'border-green-500' : 'border-gray-300'
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