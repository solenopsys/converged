import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { Button, HeaderPanelLayout, ScrollArea } from "front-core";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
	$classifierTreeStore,
	CLASSIFIER_TREE_ROOT,
	classifierTreeNodeToggled,
	classifierTreeViewMounted,
	refreshClassifierTreeClicked,
} from "../domain-classifier";
import type { ClassifierTreeNode } from "../functions/types";

export const ClassifierTreeView = () => {
	const treeState = useUnit($classifierTreeStore);

	useEffect(() => {
		classifierTreeViewMounted();
	}, []);

	const headerConfig = {
		title: "Classifier",
		subtitle: "Tree",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshClassifierTreeClicked,
				variant: "outline" as const,
			},
		],
	};

	const renderNode = (node: ClassifierTreeNode) => {
		const isExpanded = Boolean(treeState.expanded[node.id]);
		const hasChildren = node.childrenCount > 0;
		const children = treeState.nodesByParent[node.id] ?? [];
		const isLoading = Boolean(treeState.loadingByParent[node.id]);

		return (
			<div key={node.id} className="space-y-1">
				<div className="flex items-center gap-2">
					{hasChildren ? (
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={() =>
								classifierTreeNodeToggled({
									id: node.id,
									childrenCount: node.childrenCount,
									expanded: !isExpanded,
								})
							}
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
					) : (
						<div className="h-7 w-7" />
					)}
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">{node.name}</span>
						{node.childrenCount > 0 && (
							<span className="text-xs text-muted-foreground">
								({node.childrenCount})
							</span>
						)}
						<span className="text-xs text-muted-foreground">{node.slug}</span>
					</div>
				</div>
				{hasChildren && isExpanded && (
					<div className="pl-6 space-y-2">
						{isLoading && (
							<div className="text-xs text-muted-foreground py-1">
								Loading...
							</div>
						)}
						{!isLoading && children.map((child) => renderNode(child))}
						{!isLoading && children.length === 0 && (
							<div className="text-xs text-muted-foreground py-1">No items</div>
						)}
					</div>
				)}
			</div>
		);
	};

	const rootNodes = treeState.nodesByParent[CLASSIFIER_TREE_ROOT] ?? [];
	const rootLoading = Boolean(treeState.loadingByParent[CLASSIFIER_TREE_ROOT]);

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				{rootLoading && (
					<div className="text-sm text-muted-foreground py-2">Loading...</div>
				)}
				{!rootLoading && rootNodes.length === 0 && (
					<div className="text-sm text-muted-foreground py-2">No data</div>
				)}
				<div className="space-y-2">
					{rootNodes.map((node) => renderNode(node))}
				</div>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
