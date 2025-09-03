import React, { useState, useEffect } from 'react';
import { Button } from 'converged-core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import NodeForm from './NodeForm';
import DagViewer from './DagViewer';
import JsonExample from './ContextViewer';
import dagClient from '../service';

interface WorkflowConfig {
  nodes: Record<string, string>;
  links: Record<string, string>;
}

const WorkflowLayout = () => {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const { workflowName, nodeName } = useParams<{ 
    workflowName: string; 
    nodeName?: string; 
  }>();
  const navigate = useNavigate();

  // Получаем активный узел из URL или выбираем первый доступный
  const activeNodeName = nodeName || (workflowConfig ? Object.keys(workflowConfig.nodes)[0] : null);
  const activeNodeHash = activeNodeName && workflowConfig ? workflowConfig.nodes[activeNodeName] : null;

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!workflowName) return;

      try {
        const versions = await (await dagClient.getWorkflowVersions(workflowName)).versions;
        const config: { nodes: Record<string, string>; links: Record<string, string>; } = 
          await dagClient.getWorkflowConfigByName(workflowName, versions[versions.length - 1]);
        
        console.log("CONFIG", config);
        setWorkflowConfig(config);
      } catch (error) {
        console.error("Error fetching workflow:", error);
      }
    };

    fetchWorkflow();
  }, [workflowName]);

  // Обработчик клика по узлу в DAG
  const handleNodeClick = (clickedNodeName: string) => {
    console.log("Node clicked:", clickedNodeName);
    
    // Проверяем, что узел существует в конфиге
    if (workflowConfig && workflowConfig.nodes[clickedNodeName]) {
      navigate(`/workflow/${workflowName}/node/${clickedNodeName}`);
    }
  };

  // Преобразуем структуру из API в Map для DagViewer
  const createNodeMap = (config: WorkflowConfig): Map<string, string[]> => {
    const nodeMap = new Map<string, string[]>();
    
    // Инициализируем все узлы
    Object.keys(config.nodes).forEach(nodeName => {
      nodeMap.set(nodeName, []);
    });
    
    // Заполняем связи
    Object.entries(config.links).forEach(([fromNode, toNode]) => {
      if (nodeMap.has(fromNode)) {
        const connections = nodeMap.get(fromNode)!;
        connections.push(toNode);
      }
    });
    
    return nodeMap;
  };

  // Функция для получения типа узла (иконки)
  const getNodeType = async (nodeName: string): Promise<string> => {
    const typeMap: Record<string, string> = {
      'start': 'play',
      'get_object': 'database',
      'get_template_types': 'file',
      'get_sender': 'user',
      'ai_select_template_type': 'brain',
      'select_one_template_by_type': 'filter',
      'templateInjectorFooter': 'type',
      'templateInjectorBody': 'edit',
      'templateInjectorSubject': 'mail',
      'randomStringN': 'shuffle',
      'convertHtmlN': 'code',
      'insert_mail': 'send'
    };
    
    return typeMap[nodeName] || 'circle';
  };

  // Функция для получения описания узла
  const getNodeDescription = async (nodeName: string): Promise<string> => {
    const descriptionMap: Record<string, string> = {
      'start': 'Начальная точка выполнения workflow',
      'get_object': 'Получение объекта из базы данных',
      'get_template_types': 'Загрузка типов шаблонов',
      'get_sender': 'Получение информации об отправителе',
      'ai_select_template_type': 'ИИ выбор подходящего типа шаблона',
      'select_one_template_by_type': 'Выбор конкретного шаблона по типу',
      'templateInjectorFooter': 'Вставка футера в шаблон',
      'templateInjectorBody': 'Вставка основного содержимого',
      'templateInjectorSubject': 'Формирование темы письма',
      'randomStringN': 'Генерация случайной строки',
      'convertHtmlN': 'Конвертация в HTML формат',
      'insert_mail': 'Сохранение письма в базу данных'
    };
    
    return descriptionMap[nodeName] || 'Описание недоступно';
  };

  // Если нет конфига, показываем загрузку
  if (!workflowConfig) {
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
                  {Object.keys(workflowConfig.nodes).indexOf(activeNodeName) + 1} из {Object.keys(workflowConfig.nodes).length}
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
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
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
              activeNode={activeNodeName} // Передаем активный узел для выделения
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowLayout;