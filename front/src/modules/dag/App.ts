import React, { useRef, useState, useCallback } from 'react';
import GraphComponent from './GraphComponent';
import { GraphComponentRef, NodeData, WorkflowData, RenderConfig } from './types';
import * as PIXI from 'pixi.js';

const App: React.FC = () => {
  const graphRef = useRef<GraphComponentRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>('');

  // Пример данных
  const exampleWorkflow: WorkflowData = {
    nodes: {
      start: {
        type: 'StartNode',
        params: {
          consts: {
            footer_raw: 'Example footer'
          }
        }
      },
      get_data: {
        type: 'SQLQueryNode',
        params: {
          query: 'SELECT * FROM users',
          provider: 'mainDB'
        }
      },
      process_ai: {
        type: 'AiRequest',
        params: {
          config: {
            system: 'Process the data',
            user: 'Analyze: {{data}}'
          },
          provider: 'openai'
        }
      },
      output: {
        type: 'PrintNode',
        params: {}
      }
    },
    connections: {
      start: ['get_data'],
      get_data: ['process_ai'],
      process_ai: ['output']
    }
  };

  const [renderConfig, setRenderConfig] = useState<RenderConfig>({
    nodeShape: 'rounded',
    bgColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 11,
    fontColor: '#333333',
    shadowIntensity: 0.15
  });

  // Загрузка файла
  const handleFileLoad = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      await graphRef.current?.loadFromFile(file);
      setLoadedFileName(file.name);
      console.log(`Successfully loaded: ${file.name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Ошибка загрузки файла: ${errorMessage}`);
      console.error('File load error:', err);
    } finally {
      setIsLoading(false);
      // Сбрасываем input для возможности загрузки того же файла
      if (event.target) {
        event.target.value = '';
      }
    }
  }, []);

  // Загрузка примера
  const handleLoadExample = useCallback(() => {
    graphRef.current?.loadData(exampleWorkflow);
    setLoadedFileName('example-workflow.json');
    setError(null);
  }, []);

  // Клик по узлу
  const handleNodeClick = useCallback((nodeData: NodeData, event: PIXI.FederatedPointerEvent) => {
    console.log('Node clicked:', {
      id: nodeData.id,
      type: nodeData.type,
      params: nodeData.params
    });
    
    // Можно показать модальное окно с параметрами узла
    alert(`Node: ${nodeData.id}\nType: ${nodeData.type}\nParams: ${JSON.stringify(nodeData.params, null, 2)}`);
  }, []);

  // Добавление узла
  const handleAddNode = useCallback(() => {
    const newNodeId = `node_${Date.now()}`;
    const newNode: NodeData = {
      id: newNodeId,
      type: 'SQLQueryNode',
      params: {
        query: 'SELECT * FROM new_table',
        provider: 'defaultProvider'
      }
    };
    
    graphRef.current?.addNode(newNode);
  }, []);

  // Экспорт в файл
  const handleExport = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g,