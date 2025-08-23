import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { GraphRenderer } from './GraphRenderer';
import { GraphController } from './GraphController';
import { GraphComponentProps, GraphComponentRef, WorkflowData, NodeData, EdgeData } from '../types';

const GraphComponent = forwardRef<GraphComponentRef, GraphComponentProps>(({ 
  width = 800, 
  height = 600, 
  backgroundColor = 0xf8f9fa,
  renderConfig = {},
  onNodeClick,
  onEdgeClick,
  className = ''
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const controllerRef = useRef<GraphController | null>(null);
  const initializedRef = useRef(false);

  // Инициализация
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    const initGraph = async () => {
      try {
        console.log('Initializing Graph...');
        
        // Создаем canvas элемент
        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;
        
        const renderer = new GraphRenderer(canvas, renderConfig);
        await renderer.init(width, height, backgroundColor);
        
        const controller = new GraphController(renderer);

        // Добавляем canvas в контейнер
        if (containerRef.current) {
          containerRef.current.appendChild(canvas);
        }

        // Настраиваем обработчики событий
        if (onNodeClick) {
          renderer.onNodeClick(onNodeClick);
        }
        
        if (onEdgeClick) {
          renderer.onEdgeClick(onEdgeClick);
        }

        rendererRef.current = renderer;
        controllerRef.current = controller;
        initializedRef.current = true;
        
        console.log('Graph initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Graph:', error);
      }
    };

    initGraph();

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
      rendererRef.current = null;
      controllerRef.current = null;
      initializedRef.current = false;
    };
  }, []); // Единичная инициализация

  // Обновление размеров
  useEffect(() => {
    if (!rendererRef.current || !initializedRef.current) return;
    rendererRef.current.resize(width, height);
  }, [width, height]);

  // Обновление фона
  useEffect(() => {
    if (!rendererRef.current || !initializedRef.current) return;
    rendererRef.current.setBackgroundColor(backgroundColor);
  }, [backgroundColor]);

  // Обновление конфигурации рендерера
  useEffect(() => {
    if (!rendererRef.current || !initializedRef.current) return;
    rendererRef.current.updateConfig(renderConfig);
  }, [renderConfig]);

  // Публичные методы через ref
  useImperativeHandle(ref, (): GraphComponentRef => ({
    loadData: (graphData: WorkflowData) => {
      console.log('GraphComponent.loadData called with:', graphData);
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return;
      }
      controllerRef.current.loadFromJSON(graphData);
    },

    loadFromFile: async (file: File) => {
      if (!controllerRef.current || !initializedRef.current) {
        throw new Error('Controller not initialized');
      }
      return controllerRef.current.loadFromFile(file);
    },

    addNode: (nodeData: NodeData) => {
      console.log('GraphComponent.addNode called with:', nodeData);
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return;
      }
      controllerRef.current.addNode(nodeData);
    },

    addEdge: (fromId: string, toId: string, edgeData?: EdgeData) => {
      console.log('GraphComponent.addEdge called:', fromId, '->', toId);
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return;
      }
      controllerRef.current.addEdge(fromId, toId, edgeData);
    },

    removeNode: (nodeId: string) => {
      if (!controllerRef.current || !initializedRef.current) return;
      controllerRef.current.removeNode(nodeId);
    },

    removeEdge: (edgeId: string) => {
      if (!controllerRef.current || !initializedRef.current) return;
      controllerRef.current.removeEdge(edgeId);
    },

    applyLayout: () => {
      console.log('GraphComponent.applyLayout called');
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return;
      }
      controllerRef.current.applyLayout();
    },

    clear: () => {
      console.log('GraphComponent.clear called');
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return;
      }
      controllerRef.current.clear();
    },

    exportData: () => {
      if (!controllerRef.current || !initializedRef.current) {
        console.error('Controller not initialized!');
        return null;
      }
      return controllerRef.current.exportToJSON();
    },

    exportToFile: (filename?: string) => {
      if (!controllerRef.current || !initializedRef.current) return;
      controllerRef.current.exportToFile(filename);
    },

    updateRenderConfig: (config) => {
      if (!controllerRef.current || !initializedRef.current) return;
      controllerRef.current.updateRenderConfig(config);
    },

    updateLayoutConfig: (config) => {
      if (!controllerRef.current || !initializedRef.current) return;
      controllerRef.current.updateLayoutConfig(config);
    },

    isReady: () => {
      return initializedRef.current && !!controllerRef.current && !!rendererRef.current;
    }
  }), []);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        display: 'inline-block', 
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}
    />
  );
});

GraphComponent.displayName = 'GraphComponent';

export default GraphComponent;