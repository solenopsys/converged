import React, { useEffect } from 'react';
import { useStore } from 'effector-react';
import { Button } from 'converged-core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NodeForm from '../components/NodeForm';
import DagViewer from './DagViewer';
import JsonExample from './ContextViewer';
import {
  $isPanelCollapsed,
  $workflowConfig,
  $completedNodes,
  $activeNodeName,
  $activeNodeHash,
  $isLoading,
  $workflowName,
  $currentNodeIndex,
  $totalNodesCount,
  setPanelCollapsed,
  setWorkflowName,
  nodeClicked,
} from './workflow';
import { createNodeMap, getNodeType, getNodeDescription } from './nodeUtils';

interface WorkflowLayoutProps {
  initialWorkflowName?: string;
}

const WorkflowLayout: React.FC<WorkflowLayoutProps> = ({ initialWorkflowName }) => {
  const isPanelCollapsed = useStore($isPanelCollapsed);
  const workflowConfig = useStore($workflowConfig);
  const completedNodes = useStore($completedNodes);
  const activeNodeName = useStore($activeNodeName);
  const activeNodeHash = useStore($activeNodeHash);
  const isLoading = useStore($isLoading);
  const workflowName = useStore($workflowName);
  const currentNodeIndex = useStore($currentNodeIndex);
  const totalNodesCount = useStore($totalNodesCount);

  // Инициализация workflow при монтировании
  useEffect(() => {
    if (initialWorkflowName) {
      setWorkflowName(initialWorkflowName);
    }
  }, [initialWorkflowName]);

  // Обработчик клика по узлу в DAG
  const handleNodeClick = (clickedNodeName: string) => {
    console.log("Node clicked:", clickedNodeName);
    nodeClicked(clickedNodeName);
  };

  // Обработчик переключения панели
  const handleTogglePanel = () => {
    setPanelCollapsed(!isPanelCollapsed);
  };

  // Если идет загрузка, показываем индикатор
  if (isLoading || !workflowConfig) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Загрузка workflow...</div>
          {workflowName && (
            <div className="text-sm text-muted-foreground">
              Workflow: {workflowName}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Левая колонка — JSON просмотр */}
      <div className="flex-1 basis-0 min-w-0 overflow-hidden border-r">
        <JsonExample />
      </div>

      {/* Центральная колонка — форма узла */}
      <div className="flex-1 basis-0 min-w-0 overflow-auto">
        {activeNodeName && activeNodeHash ? (
          <>
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{activeNodeName}</h2>
                  <div className="text-sm text-muted-foreground">
                    Hash: {activeNodeHash.substring(0, 12)}...
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentNodeIndex} из {totalNodesCount}
                </div>
              </div>
            </div>
            <div className="p-4">
              <NodeForm hash={activeNodeHash} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <div className="text-lg mb-2">Выберите узел</div>
              <div className="text-sm">
                Кликните на узел в графе справа для просмотра его конфигурации
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Правая панель — DAG визуализация */}
      <div
        className={`flex-none ${isPanelCollapsed ? 'w-12' : 'w-64'} transition-all duration-300 bg-card border-l flex flex-col`}
      >
        <div className="flex items-center justify-between p-2 border-b">
          <Button
            variant="ghost"
            onClick={handleTogglePanel}
            className="p-2"
            title={isPanelCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          >
            {isPanelCollapsed ? <ChevronLeft /> : <ChevronRight />}
          </Button>
          {!isPanelCollapsed && (
            <div className="text-sm font-medium">
              Граф узлов
            </div>
          )}
        </div>
        
        {!isPanelCollapsed && (
          <div className="p-4 min-h-0 bg-muted/30 overflow-auto flex-1">
            <DagViewer
              nodeMap={createNodeMap(workflowConfig)}
              getNodeType={getNodeType}
              getNodeDescription={getNodeDescription}
              completedNodes={completedNodes}
              onclick={handleNodeClick}
              activeNode={activeNodeName}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowLayout;