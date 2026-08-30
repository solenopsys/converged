import {
	bindChatFiles,
	type ChatStore,
	createChatLifecycle,
	createChatStore,
	createConversation,
	createFilesProcessTool,
	createFunctionCatalogTools,
	createUploadedChatFilesTool,
	type ExecutableTool,
	type FunctionCatalogContext,
	type OrchestratorCatalog,
	type StepName,
} from "assistant-state";
import { $files, filesPickerOpened, uploadCompleted } from "files-state";
import { resolveActionMeta } from "front-core/core";
import type { CatalogView } from "./commands/builtin";
import { registerBuiltinSlashCommands } from "./commands/builtin";
import { isSlashInput, runSlashCommand } from "./commands/registry";
import type { ChatConfig } from "./config";
import { createContextPromptResolver } from "./context-prompt";
import { initChatMessages } from "./i18n";
import { createServices } from "./services";
import { setActionBriefResolver } from "./ui/labels";

export type Chat = {
	store: ChatStore;
	sendMessage: (text: string) => void;
	attachFiles: (files: File[]) => void;
};

export type ChatCatalog = {
	catalog: OrchestratorCatalog;

	// The meta-tool contour lists by category and by recency; the orchestrator
	// ports do neither, so handing it `catalog` gives the model tools that throw
	// on call — and a model whose tool just threw calls again.
	context?: FunctionCatalogContext;

	label?: (id: string) => string | undefined;

	diagnostics?: CatalogView;

	/** Functions arrive while the chat runs; this is how it learns about them. */
	onChange?: (republish: () => void) => void;
};

let instance: Chat | null = null;

export function initChatStore(config: ChatConfig, host?: ChatCatalog): Chat {
	if (instance) return instance;

	const {
		assistantClient,
		chatDriver,
		contextsClient,
		dagCatalogClient,
		dagClient,
		resonusSession,
		threadsClient,
	} = createServices(config);

	initChatMessages(undefined, config.language);

	const resolveSystemPrompt = createContextPromptResolver(contextsClient, {
		section: "answer",
	});

	// Deciding steps read sections only: the conversation prompt is noise on
	// `route`. Without sections the machine answers straight away and the chat
	// falls back to the meta-tool contour below.
	const stepResolvers = new Map(
		(["route", "select", "args"] as const).map((step) => [
			step,
			createContextPromptResolver(contextsClient, {
				section: step,
				requireSection: true,
			}),
		]),
	);
	const stepPrompt = (step: StepName) =>
		(
			stepResolvers.get(step as "route" | "select" | "args") ??
			resolveSystemPrompt
		)({
			contextName: config.contextName,
			language: config.language,
		});

	const conversation = createConversation({
		ask: resonusSession.ask,
		prompt: stepPrompt,
		driver: chatDriver,
		systemPrompt: () =>
			resolveSystemPrompt({
				contextName: config.contextName,
				language: config.language,
			}),
		model: "fast",
	});

	const workflows = new Map<
		string,
		{
			script: string;
			brief?: string;
			description?: string;
			parameters?: {
				type: "object";
				properties: Record<string, unknown>;
				required?: string[];
			};
		}
	>();
	conversation.catalog.sourceRegistered({
		id: "workflows",
		group: "workflows",
		meta: (id) => workflows.get(id),
		invoke: (id, args) => {
			const workflow = workflows.get(id);
			if (!workflow) throw new Error(`Unknown workflow: ${id}`);
			return dagClient.runWorkflow(workflow.script, args);
		},
	});
	void dagCatalogClient
		.listAvailableWorkflows()
		.then(({ items }) => {
			for (const workflow of items) {
				if (!workflow.brief || !workflow.description || !workflow.parameters)
					continue;
				workflows.set(`workflows.${workflow.id}`, workflow);
			}
			conversation.catalog.functionsPublished({
				source: "workflows",
				functions: [...workflows].map(([id, workflow]) => ({
					id,
					brief: workflow.brief ?? workflow.script,
					description: workflow.description ?? workflow.script,
					category: "workflows",
					parameters: workflow.parameters,
				})),
			});
		})
		.catch((error) =>
			console.error("[chat] workflow catalog unavailable", error),
		);

	// The delivery's functions become a source in the catalog store, so a module
	// that registers later is simply published again — nothing is rebuilt.
	if (host?.catalog) {
		const { catalog } = host;
		conversation.catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			meta: (id) => catalog.meta(id),
			load: catalog.load,
			invoke: (id, args) => catalog.invoke(id, args),
		});
		const republish = () =>
			conversation.catalog.functionsPublished({
				source: "ui",
				functions: (host.diagnostics?.all() ?? []).map((action) => {
					const resolved = resolveActionMeta(action);
					return {
						id: resolved.id,
						brief: resolved.brief,
						description: resolved.description,
						category: resolved.category,
						priority: resolved.priority,
						parameters: resolved.parameters,
					};
				}),
			});
		republish();
		host.onChange?.(republish);
	}

	const threadId = crypto.randomUUID();

	const store = createChatStore({
		conversation,
		threadsService: threadsClient,
		metadataService: assistantClient,
		threadId,
		label: host?.label,
	});

	const lifecycle = createChatLifecycle({
		store,
		registry: assistantClient,
	});
	const ensureReady = () => lifecycle.ensureInitialized();

	bindChatFiles({
		store,
		threadsService: threadsClient,
		registry: assistantClient,
		uploads: {
			uploadCompleted,
			getFile: (fileId) => $files.getState().get(fileId),
		},
		ensureReady,
		processFiles: (fileIds) =>
			store.invokeFunction("workflows.files-process", { fileIds }),
	});

	const uploadedFiles = () =>
		Array.from($files.getState().entries()).map(([fileId, file]) => ({
			fileId,
			fileName: file.fileName,
			fileSize: file.fileSize,
			fileType: file.fileType,
			status: file.status,
		}));

	for (const tool of [
		createUploadedChatFilesTool(uploadedFiles),
		createFilesProcessTool(dagClient),
	] satisfies ExecutableTool[]) {
		store.registerFunction(tool.name, tool);
	}

	// Route/select is preferred when its context is available, but it is loaded
	// through the same signal connection as the chat. Register the catalog tools
	// eagerly so a reconnect, timeout or missing route section cannot make the
	// first user message reach the model with no path to host functions.
	const context = host?.context;
	if (!context) {
		console.error(
			"[chat] no catalog context: the chat has no way to reach host functions",
		);
	} else {
		for (const tool of createFunctionCatalogTools({
			registry: { get: (id) => host?.catalog.meta(id) },
			context,
			invoke: (id, args) => conversation.catalog.catalog.invoke(id, args),
			load: (id) =>
				conversation.catalog.catalog.load?.(id) ?? Promise.resolve(),
		})) {
			store.registerFunction(tool.name, tool);
		}
	}

	if (host?.label) setActionBriefResolver(host.label);

	registerBuiltinSlashCommands({
		readTools: () => [...store.$functions.getState().values()],
		readContext: async () => ({
			contextName: config.contextName,
			language: config.language,
			prompt: await resolveSystemPrompt({
				contextName: config.contextName,
				language: config.language,
			}),
		}),
		catalog: host?.diagnostics,
	});

	instance = {
		store,
		sendMessage: (text) => {
			const content = text.trim();
			if (!content) return;
			if (isSlashInput(content)) {
				store.addLocalMessage(content, "user");
				void runSlashCommand(content).then((answer) => {
					store.addLocalMessage(answer);
				});
				return;
			}
			ensureReady();
			store.send(content);
		},
		attachFiles: (files) => {
			if (files.length === 0) return;
			ensureReady();
			filesPickerOpened(files);
		},
	};
	return instance;
}

export function chat(): Chat {
	if (!instance) throw new Error("[chat] not initialized: call initChat first");
	return instance;
}
