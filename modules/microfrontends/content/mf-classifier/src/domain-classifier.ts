import { createDomain, sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import classifierService from "./service";
import type {
	ClassifierMapping,
	ClassifierTreeNode,
	PaginationParams,
} from "./functions/types";

const domain = createDomain("classifier");

export const CLASSIFIER_SERVICES_GROUP = "company.services";
export const CLASSIFIER_TREE_ROOT = "__root__";

export const classifierNodesViewMounted = domain.createEvent(
	"CLASSIFIER_NODES_VIEW_MOUNTED",
);
export const refreshClassifierNodesClicked = domain.createEvent(
	"REFRESH_CLASSIFIER_NODES_CLICKED",
);
export const classifierMappingsViewMounted = domain.createEvent(
	"CLASSIFIER_MAPPINGS_VIEW_MOUNTED",
);
export const refreshClassifierMappingsClicked = domain.createEvent(
	"REFRESH_CLASSIFIER_MAPPINGS_CLICKED",
);
export const classifierDashboardViewMounted = domain.createEvent(
	"CLASSIFIER_DASHBOARD_VIEW_MOUNTED",
);
export const refreshClassifierDashboardClicked = domain.createEvent(
	"REFRESH_CLASSIFIER_DASHBOARD_CLICKED",
);
export const classifierTreeViewMounted = domain.createEvent(
	"CLASSIFIER_TREE_VIEW_MOUNTED",
);
export const refreshClassifierTreeClicked = domain.createEvent(
	"REFRESH_CLASSIFIER_TREE_CLICKED",
);
export const classifierTreeNodeRequested = domain.createEvent<{
	parentId?: string | null;
}>("CLASSIFIER_TREE_NODE_REQUESTED");
export const classifierTreeNodeToggled = domain.createEvent<{
	id: string;
	childrenCount: number;
	expanded: boolean;
}>("CLASSIFIER_TREE_NODE_TOGGLED");

const listNodesFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_CLASSIFIER_NODES",
	handler: async (params) => classifierService.listNodes(params),
});

const listMappingsFx = domain.createEffect<string, ClassifierMapping[]>({
	name: "LIST_CLASSIFIER_MAPPINGS",
	handler: async (groupId) => {
		const mappings = await classifierService.listMappings(groupId);
		return mappings.sort(
			(a, b) =>
				Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
				a.key.localeCompare(b.key),
		);
	},
});

const loadDashboardFx = domain.createEffect<
	void,
	{ nodes: number; mappings: number }
>({
	name: "LOAD_CLASSIFIER_DASHBOARD",
	handler: async () => {
		const [nodesPage, groups] = await Promise.all([
			classifierService.listNodes({ offset: 0, limit: 1 }),
			classifierService.listMappingGroups(),
		]);
		return {
			nodes: Number(nodesPage.totalCount ?? nodesPage.items.length),
			mappings: groups.reduce(
				(sum, group) => sum + Number(group.count ?? 0),
				0,
			),
		};
	},
});

const getParentKey = (parentId?: string | null) =>
	parentId === null || parentId === undefined ? CLASSIFIER_TREE_ROOT : parentId;

const listTreeChildrenFx = domain.createEffect<
	{ parentId?: string | null },
	{ parentKey: string; items: ClassifierTreeNode[] }
>({
	name: "LIST_CLASSIFIER_TREE_CHILDREN",
	handler: async (params) => ({
		parentKey: getParentKey(params.parentId),
		items: await classifierService.listTreeChildren(params.parentId),
	}),
});

export const $classifierNodesStore = createInfiniteTableStore(
	domain,
	listNodesFx,
);
export const $classifierMappings = domain.createStore<ClassifierMapping[]>([]);
export const $classifierMappingsLoading = listMappingsFx.pending;
export const $classifierDashboard = domain.createStore({
	nodes: 0,
	mappings: 0,
});
export const $classifierDashboardLoading = loadDashboardFx.pending;

type ClassifierTreeState = {
	nodesByParent: Record<string, ClassifierTreeNode[]>;
	loadingByParent: Record<string, boolean>;
	expanded: Record<string, boolean>;
};

const treeInitialState: ClassifierTreeState = {
	nodesByParent: {},
	loadingByParent: {},
	expanded: {},
};

export const $classifierTreeStore = domain
	.createStore<ClassifierTreeState>(treeInitialState)
	.on(classifierTreeNodeRequested, (state, params) => {
		const parentKey = getParentKey(params.parentId);
		return {
			...state,
			loadingByParent: {
				...state.loadingByParent,
				[parentKey]: true,
			},
		};
	})
	.on(listTreeChildrenFx.doneData, (state, payload) => ({
		...state,
		nodesByParent: {
			...state.nodesByParent,
			[payload.parentKey]: payload.items,
		},
		loadingByParent: {
			...state.loadingByParent,
			[payload.parentKey]: false,
		},
	}))
	.on(listTreeChildrenFx.fail, (state, payload) => {
		const parentKey = getParentKey(payload.params.parentId);
		return {
			...state,
			loadingByParent: {
				...state.loadingByParent,
				[parentKey]: false,
			},
		};
	})
	.on(classifierTreeNodeToggled, (state, payload) => ({
		...state,
		expanded: {
			...state.expanded,
			[payload.id]: payload.expanded,
		},
	}))
	.on(refreshClassifierTreeClicked, () => treeInitialState);

$classifierMappings.on(listMappingsFx.doneData, (_state, mappings) => mappings);
$classifierDashboard.on(loadDashboardFx.doneData, (_state, stats) => stats);

sample({
	clock: classifierNodesViewMounted,
	filter: () => {
		const state = $classifierNodesStore.$state.getState();
		return !state.isInitialized && !state.loading;
	},
	fn: () => ({}),
	target: $classifierNodesStore.loadMore,
});

sample({
	clock: refreshClassifierNodesClicked,
	fn: () => ({}),
	target: $classifierNodesStore.reset,
});

sample({
	clock: refreshClassifierNodesClicked,
	fn: () => ({}),
	target: $classifierNodesStore.loadMore,
});

sample({
	clock: classifierMappingsViewMounted,
	source: $classifierMappings,
	filter: (mappings) => mappings.length === 0,
	fn: () => CLASSIFIER_SERVICES_GROUP,
	target: listMappingsFx,
});

sample({
	clock: refreshClassifierMappingsClicked,
	fn: () => CLASSIFIER_SERVICES_GROUP,
	target: listMappingsFx,
});

sample({
	clock: classifierDashboardViewMounted,
	filter: () => {
		const stats = $classifierDashboard.getState();
		return stats.nodes === 0 && stats.mappings === 0;
	},
	target: loadDashboardFx,
});

sample({
	clock: refreshClassifierDashboardClicked,
	target: loadDashboardFx,
});

sample({
	clock: classifierTreeNodeRequested,
	target: listTreeChildrenFx,
});

sample({
	clock: classifierTreeViewMounted,
	source: $classifierTreeStore,
	filter: (state) =>
		!state.nodesByParent[CLASSIFIER_TREE_ROOT] &&
		!state.loadingByParent[CLASSIFIER_TREE_ROOT],
	fn: () => ({ parentId: null }),
	target: classifierTreeNodeRequested,
});

sample({
	clock: refreshClassifierTreeClicked,
	fn: () => ({ parentId: null }),
	target: classifierTreeNodeRequested,
});

sample({
	clock: classifierTreeNodeToggled,
	source: $classifierTreeStore,
	filter: (state, payload) => {
		const alreadyLoaded = Boolean(state.nodesByParent[payload.id]);
		const loading = Boolean(state.loadingByParent[payload.id]);
		return (
			payload.expanded &&
			payload.childrenCount > 0 &&
			!alreadyLoaded &&
			!loading
		);
	},
	fn: (_state, payload) => ({ parentId: payload.id }),
	target: classifierTreeNodeRequested,
});

export default domain;
