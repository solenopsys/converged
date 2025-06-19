import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as PIXI from 'pixi.js';
import { GraphRenderer } from './GraphRenderer';
import { GraphController } from './GraphController';
import { GraphComponentProps, GraphComponentRef, WorkflowData } from './types';

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
  const appRef = useRef<PIXI.Application | null>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const controllerRef = useRef<GraphController | null>(null);

  // Инициализация PixiJS
  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      width,
      height,
      backgroundColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    const renderer = new GraphRenderer(renderConfig);
    const controller = new GraphController(app, renderer);

    containerRef.current.appendChild(app.view as HTMLCanvasElement);

    appRef.current = app;
    rendererRef.current = renderer;
    controllerRef.current = controller;

    return () => {
      if (containerRef.current && app.view && containerRef.current.contains(app.view as Node)) {
        containerRef.current.removeChild(app.view as HTMLCanvasElement);
      }
      app.destroy(true, true);
    };
  }, [width, height, backgroundColor]);

  // Обновление конфигурации рендерера
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateConfig(renderConfig);
    }
  }, [renderConfig]);

  // Обработка кликов
  useEffect(() => {
    if (!appRef.current || !controllerRef.current) return;

    const handlePointerDown = (event: PIXI.FederatedPointerEvent) => {
      const target = event.target as any;
      
      if (target?.nodeData && onNodeClick) {
        onNodeClick(target.nodeData, event);
      }
      
      if (target?.edgeData && onEdgeClick) {
        onEdgeClick(target.edgeData, event);
      }
    };

    appRef.current.stage.on('pointerdown', handlePointerDown);

    return () => {
      if (appRef.current) {
        appRef.current.stage.off('pointerdown', handlePointerDown);
      }
    };
  }, [onNodeClick, onEdgeClick]);

  // Публичные методы через ref
  useImperativeHandle(ref, (): GraphComponentRef => ({
    loadData: (graphData: WorkflowData) => {
      controllerRef.current?.loadFromJSON(graphData);
    },

    loadFromFile: async (file: File) => {
      if (!controllerRef.current) {
        throw new Error('Controller not initialized');
      }
      return controllerRef.current.loadFromFile(file);
    },

    addNode: (nodeData) => {
      return controllerRef.current?.addNode(nodeData);
    },

    addEdge: (fromId, toId, edgeData) => {
      return controllerRef.current?.addEdge(fromId, toId, edgeData) || null;
    },

    removeNode: (nodeId) => {
      controllerRef.current?.removeNode(nodeId);
    },

    removeEdge: (edgeId) => {
      controllerRef.current?.removeEdge(edgeId);
    },

    applyLayout: () => {
      controllerRef.current?.applyLayout();
    },

    clear: () => {
      controllerRef.current?.clear();
    },

    exportData: () => {
      return controllerRef.current?.exportToJSON() || null;
    },

    exportToFile: (filename) => {
      controllerRef.current?.exportToFile(filename);
    },

    updateRenderConfig: (config) => {
      controllerRef.current?.updateRenderConfig(config);
    },

    getNode: (nodeId) => {
      return controllerRef.current?.getNode(nodeId);
    },

    getAllNodes: () => {
      return controllerRef.current?.getAllNodes() || [];
    },

    getAllEdges: () => {
      return controllerRef.current?.getAllEdges() || [];
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
        overflow: 'hidden'
      }} 
    />
  );
});

GraphComponent.displayName = 'GraphComponent';

export default GraphComponent;