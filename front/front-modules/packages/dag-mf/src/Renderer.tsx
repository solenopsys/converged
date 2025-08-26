import { useEffect, useState, useRef, useCallback } from 'react';
import { WorkflowData } from './types';
import GraphComponent from './graph/GraphComponent';
import { Button } from 'converged-core';
import { Card, CardContent } from 'converged-core';
import { Alert, AlertDescription } from 'converged-core';

// Адаптивный компонент рендеринга
export const GraphRenderer: React.FC<{ filePath: string }> = ({ filePath }) => {
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Функция для обновления размеров
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const padding = 20; // отступы
      
      // Вычисляем доступную ширину (минус отступы)
      const availableWidth = Math.max(600, rect.width - padding);
      
      // Высота адаптируется к viewport, но имеет разумные ограничения
      const viewportHeight = window.innerHeight;
      const headerHeight = 200; // примерная высота для кнопок и отладочной информации
      const availableHeight = Math.max(400, Math.min(800, viewportHeight - headerHeight));
      
      setDimensions({
        width: availableWidth,
        height: availableHeight
      });
    }
  }, []);

  // Обновляем размеры при изменении размера окна
  useEffect(() => {
    updateDimensions();
    
    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [updateDimensions]);

  // Обновляем размеры графа при изменении dimensions
  useEffect(() => {
    if (graphRef.current?.isReady?.()) {
      graphRef.current.updateSize(dimensions.width, dimensions.height);
    }
  }, [dimensions]);

  useEffect(() => {
    if (!filePath) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        console.log('Данные загружены:', jsonData);
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  // Загружаем данные в граф когда они готовы
  useEffect(() => {
    if (data && graphRef.current) {
      console.log('Загружаем данные в граф:', data);
      
      // Проверяем готовность компонента с интервалом
      const checkAndLoad = () => {
        if (graphRef.current?.isReady?.()) {
          graphRef.current.clear();
          graphRef.current.loadData(data);
        } else {
          // Если не готов, пробуем через 100мс
          setTimeout(checkAndLoad, 100);
        }
      };
      
      // Добавляем небольшую задержку для уверенности что граф инициализирован
      setTimeout(checkAndLoad, 50);
    }
  }, [data]);

  const getDataInfo = (data: WorkflowData | null) => {
    if (!data) return { nodes: 0, edges: 0 };
    
    const nodeCount = data.nodes ? Object.keys(data.nodes).length : 0;
    const edgeCount = data.connections ? 
      Object.values(data.connections).reduce((sum: number, arr: any) => 
        sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
    
    return { nodes: nodeCount, edges: edgeCount };
  };

  const dataInfo = getDataInfo(data);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-base">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-[60vh] p-5">
        <Alert variant="destructive">
          <AlertDescription>
            Ошибка: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full p-2.5">
      {/* Отладочная информация */}
      <div className="mb-2.5 text-xs text-muted-foreground break-all">
        Файл: {filePath} | Данные загружены: {data ? 'Да' : 'Нет'}
        {data && (
          <span> | Узлов: {dataInfo.nodes} | Связей: {dataInfo.edges}</span>
        )}
        <br/>
        Размеры: {dimensions.width}×{dimensions.height}
      </div>
      
      {/* Контейнер для графа */}
      <Card className="mb-2.5">
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <GraphComponent 
              ref={graphRef}
              width={dimensions.width} 
              height={dimensions.height} 
              renderConfig={{
                nodeSize: Math.max(80, Math.min(120, dimensions.width / 15)), // адаптивный размер узлов
                nodeShape: 'rounded',
                borderRadius: 8,
                fontSize: Math.max(9, Math.min(11, dimensions.width / 120)), // адаптивный размер шрифта
                shadowIntensity: 0.2
              }}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Кнопки управления */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          size="sm"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Применяем layout заново');
              graphRef.current.applyLayout();
            } else {
              console.log('График еще не готов');
            }
          }}
        >
          Layout
        </Button>

        <Button 
          size="sm"
          variant="secondary"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Меняем направление на вертикальное');
              graphRef.current.updateLayoutConfig({ 
                rankdir: 'TB',
                nodesep: Math.max(40, dimensions.width / 20),
                ranksep: Math.max(60, dimensions.height / 13)
              });
            }
          }}
        >
          Вертик.
        </Button>

        <Button 
          size="sm"
          variant="secondary"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Меняем направление на горизонтальное');
              graphRef.current.updateLayoutConfig({ 
                rankdir: 'LR',
                nodesep: Math.max(60, dimensions.height / 13),
                ranksep: Math.max(80, dimensions.width / 15)
              });
            }
          }}
        >
          Гориз.
        </Button>

        <Button 
          size="sm"
          variant="outline"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Компактный layout');
              graphRef.current.updateLayoutConfig({ 
                nodesep: Math.max(30, dimensions.width / 30),
                ranksep: Math.max(40, dimensions.height / 20),
                marginx: 10,
                marginy: 10 
              });
            }
          }}
        >
          Компакт.
        </Button>

        <Button 
          size="sm"
          variant="outline"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Просторный layout');
              graphRef.current.updateLayoutConfig({ 
                nodesep: Math.max(100, dimensions.width / 10),
                ranksep: Math.max(150, dimensions.height / 5),
                marginx: 50,
                marginy: 50 
              });
            }
          }}
        >
          Простор.
        </Button>
        
        <Button 
          size="sm"
          variant="secondary"
          onClick={() => {
            if (data && graphRef.current?.isReady?.()) {
              console.log('Перезагружаем данные');
              graphRef.current.clear();
              setTimeout(() => {
                if (graphRef.current?.isReady?.()) {
                  graphRef.current.loadData(data);
                }
              }, 50);
            } else {
              console.log('График еще не готов или нет данных');
            }
          }}
        >
          Перезагр.
        </Button>
        
        <Button 
          size="sm"
          variant="outline"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              const nodes = graphRef.current.getAllNodes();
              const edges = graphRef.current.getAllEdges();
              console.log('=== ОТЛАДКА СОСТОЯНИЯ ===');
              console.log('Узлов в графе:', nodes.length);
              console.log('Связей в графе:', edges.length);
              console.log('Исходные данные:', data);
              
              if (nodes.length > 0) {
                console.log('--- УЗЛЫ ---');
                nodes.forEach((node, index) => {
                  console.log(`Node ${index} (${node.nodeData?.id}):`, {
                    type: node.nodeData?.type,
                    position: { x: node.position.x, y: node.position.y },
                    visible: node.visible,
                    alpha: node.alpha,
                    size: node.nodeSize
                  });
                });
              }
              
              if (edges.length > 0) {
                console.log('--- СВЯЗИ ---');
                edges.forEach((edge, index) => {
                  console.log(`Edge ${index}:`, {
                    from: edge.fromNode?.nodeData?.id,
                    to: edge.toNode?.nodeData?.id,
                    visible: edge.visible,
                    alpha: edge.alpha
                  });
                });
              } else {
                console.log('Связи не найдены!');
              }
            } else {
              console.log('График еще не готов');
            }
          }}
        >
          Отладка
        </Button>
        
        <Button 
          size="sm"
          variant="destructive"
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Очищаем граф');
              graphRef.current.clear();
            } else {
              console.log('График еще не готов');
            }
          }}
        >
          Очистить
        </Button>
      </div>
      
      {/* Статус для отладки */}
      {data && (
        <Card className="mt-4">
          <CardContent className="p-2.5">
            <div className="text-xs break-words">
              <strong>Загруженные данные:</strong>
              <br/>
              Узлы: {Object.keys(data.nodes || {}).join(', ')}
              <br/>
              Связи: {Object.entries(data.connections || {}).map(([from, to]) => 
                `${from} → [${Array.isArray(to) ? to.join(', ') : to}]`
              ).join('; ')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};