import domain from "../domain";
import { createNodeMap } from "../components/nodeUtils";
import dagClient from "../service";
import { sample } from "effector";

import { useStore } from "effector-react";
import { useEffect } from "react";
import { NodeMap } from "converged-core";
import DagViewer from "../components/DagViewer";


const loadWorkflow = domain.createEvent<string>();
const getNodeDescription = domain.createEvent<string>();
const nodeClicked = domain.createEvent<string>();

const loadWorkflowFx = domain.createEffect(async (workflowId: string) => {
    const versions = await (await dagClient.getWorkflowVersions(workflowId)).versions;
    const config = await dagClient.getWorkflowConfigByName(workflowId, versions[versions.length - 1]);
    return createNodeMap(config);
});

export const getNodeDescriptionFx = domain.createEffect(async (nodeName: string) => {
    return (await dagClient.getNode(nodeName)).config.codeVersion;
});

const $nodeMap = domain.createStore<NodeMap | null>(null);
const $loading = domain.createStore(false);
const $nodeDescriptions = domain.createStore<Record<string, string>>({});

// Связки
sample({ clock: loadWorkflow, target: loadWorkflowFx });
sample({ clock: loadWorkflowFx.doneData, target: $nodeMap });
sample({ clock: loadWorkflowFx.pending, target: $loading });

sample({ clock: getNodeDescription, target: getNodeDescriptionFx });
sample({
    clock: getNodeDescriptionFx.doneData,
    source: $nodeDescriptions,
    fn: (descriptions, { params, result }) => ({
        ...descriptions,
        [params]: result
    }),
    target: $nodeDescriptions
});

enum NodeEventType {
    select = 'select',
    run = 'run'
}


interface DagContainerProps {
    id: string;
    onNodeEvent?: (nodeName: string, eventType: NodeEventType) => void;
}

const DagContainer: React.FC<DagContainerProps> = ({
    id,
    onNodeEvent
}) => {
    const nodeMap = useStore($nodeMap);
    const loading = useStore($loading);
    const nodeDescriptions = useStore($nodeDescriptions);

    useEffect(() => {
        loadWorkflow(id);
    }, [id]);

    const handleGetNodeDescription = async (nodeName: string) => {
        if (customGetNodeDescription) {
            return await customGetNodeDescription(nodeName);
        }

        // Проверяем кеш
        if (nodeDescriptions[nodeName]) {
            return nodeDescriptions[nodeName];
        }

        // Загружаем через Effector
        getNodeDescription(nodeName);

        // Ждем результат (можно улучшить)
        return new Promise<string>((resolve) => {
            const unsubscribe = $nodeDescriptions.watch((descriptions) => {
                if (descriptions[nodeName]) {
                    unsubscribe();
                    resolve(descriptions[nodeName]);
                }
            });
        });
    };

    const handleNodeClick = (nodeName: string) => {
        if (onNodeClick) {
            onNodeClick(nodeName);
        } else {
            nodeClicked(nodeName);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!nodeMap) return <div>No data</div>;

    return (
        <DagViewer
            nodeMap={nodeMap}
            getNodeDescription={handleGetNodeDescription}
            getNodeType={getNodeType}
            onNodeClick={handleNodeClick}
        />
    );
};

export default DagContainer;