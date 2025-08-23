import { useEffect, useState, useRef } from 'react';
import { WorkflowData } from './types';
import GraphComponent from './graph/GraphComponent';

// Простой компонент рендеринга
export const GraphRenderer: React.FC<{ filePath: string }> = ({ filePath }) => {
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<any>(null);

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
      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '600px',
        fontSize: '16px'
      }}>
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '600px',
        color: 'red',
        fontSize: '16px'
      }}>
        Ошибка: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Отладочная информация */}
      <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
        Файл: {filePath} | Данные загружены: {data ? 'Да' : 'Нет'}
        {data && (
          <span> | Узлов: {dataInfo.nodes} | Связей: {dataInfo.edges}</span>
        )}
      </div>
      
      <GraphComponent 
        ref={graphRef}
        width={1200} 
        height={800} 
        renderConfig={{
          nodeSize: 120,
          nodeShape: 'rounded',
          borderRadius: 8,
          fontSize: 11,
          shadowIntensity: 0.2
        }}
      />
      
      {/* Кнопки управления */}
      <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Применяем layout заново');
              graphRef.current.applyLayout();
            } else {
              console.log('График еще не готов');
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Применить Layout
        </button>

        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Меняем направление на вертикальное');
              graphRef.current.updateLayoutConfig({ 
                rankdir: 'TB',
                nodesep: 60,
                ranksep: 100 
              });
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Вертикальный Layout
        </button>

        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Меняем направление на горизонтальное');
              graphRef.current.updateLayoutConfig({ 
                rankdir: 'LR',
                nodesep: 80,
                ranksep: 120 
              });
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Горизонтальный Layout
        </button>

        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Компактный layout');
              graphRef.current.updateLayoutConfig({ 
                nodesep: 40,
                ranksep: 60,
                marginx: 10,
                marginy: 10 
              });
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Компактный
        </button>

        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Просторный layout');
              graphRef.current.updateLayoutConfig({ 
                nodesep: 120,
                ranksep: 200,
                marginx: 50,
                marginy: 50 
              });
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#607D8B',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Просторный
        </button>
        
        <button 
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
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Перезагрузить данные
        </button>
        
        <button 
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
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Отладка состояния
        </button>
        
        <button 
          onClick={() => {
            if (graphRef.current?.isReady?.()) {
              console.log('Очищаем граф');
              graphRef.current.clear();
            } else {
              console.log('График еще не готов');
            }
          }}
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Очистить
        </button>
      </div>
      
      {/* Статус для отладки */}
      {data && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>Загруженные данные:</strong>
          <br/>
          Узлы: {Object.keys(data.nodes || {}).join(', ')}
          <br/>
          Связи: {Object.entries(data.connections || {}).map(([from, to]) => 
            `${from} → [${Array.isArray(to) ? to.join(', ') : to}]`
          ).join('; ')}
        </div>
      )}
    </div>
  );
};