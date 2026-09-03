import { sample } from "effector";
import { useUnit } from "effector-preact";
import type { NodeMap } from "front-core";
import { useEffect } from "preact/compat";
import DagViewer from "../components/DagViewer";
import { createNodeMap } from "../components/nodeUtils";
import domain from "../domain";
import dagClient from "../service";

const loadWorkflow = domain.createEvent<string>();
const getNodeDescription = domain.createEvent<string>();
const nodeClicked = domain.createEvent<string>();

const loadWorkflowFx = domain.createEffect(async (workflowId: string) => {
	const versions = await (await dagClient.getWorkflowVersions(workflowId))
		.versions;
	const config = await dagClient.getWorkflowConfigByName(
		workflowId,
		versions[versions.length - 1],
	);
	return createNodeMap(config);
});

export const getNodeDescriptionFx = domain.createEffect(
	async (nodeName: string) => {
		return (await dagClient.getNode(nodeName)).config.codeVersion;
	},
);

const $nodeMap = domain.createStore<NodeMap | null>(null);
const $loading = domain.createStore(false);
const $nodeDescriptions = domain.createStore<Record<string, string>>({});

sample({ clock: loadWorkflow, target: loadWorkflowFx });
sample({ clock: loadWorkflowFx.doneData, target: $nodeMap });
sample({ clock: loadWorkflowFx.pending, target: $loading });

sample({ clock: getNodeDescription, target: getNodeDescriptionFx });
sample({
	clock: getNodeDescriptionFx.doneData,
	source: $nodeDescriptions,
	fn: (descriptions, { params, result }) => ({
		...descriptions,
		[params]: result,
	}),
	target: $nodeDescriptions,
});

enum NodeEventType {
	select = "select",
	run = "run",
}

interface DagContainerProps {
	id: string;
	onNodeEvent?: (nodeName: string, eventType: NodeEventType) => void;
}

const DagContainer: React.FC<DagContainerProps> = ({ id, onNodeEvent }) => {
	const nodeMap = useUnit($nodeMap);
	const loading = useUnit($loading);
	const nodeDescriptions = useUnit($nodeDescriptions);

	useEffect(() => {
		loadWorkflow(id);
	}, [id]);

	const handleGetNodeDescription = async (nodeName: string) => {
		if (customGetNodeDescription) {
			return await customGetNodeDescription(nodeName);
		}

		if (nodeDescriptions[nodeName]) {
			return nodeDescriptions[nodeName];
		}

		getNodeDescription(nodeName);

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
