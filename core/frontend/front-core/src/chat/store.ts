import {
	bindChatFiles,
	type ChatStore,
	createChatLifecycle,
	createChatStore,
	createConversation,
	createFilesProcessTool,
	createFilesStep,
	createFunctionCatalogTools,
	createFunctionSteps,
	createUploadedChatFilesTool,
	type ExecutableTool,
	type FunctionCatalogContext,
	type OrchestratorCatalog,
	type StepName,
	type TurnFile,
} from "assistant-state";
import { $files, filesPickerOpened, uploadCompleted } from "files-state";
import { refreshFocusedObjects } from "front-core/object-runtime";
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

export type CatalogEntryView = {
	id: string;
	brief?: string;
	description?: string;
	category?: string;
	priority?: "primary" | "normal" | "secondary";
	/** Owning microfrontend, and its human name — the catalog's first level. */
	module?: string;
	moduleLabel?: string;
	targetType?: string;
	intent?: "create" | "mutate" | "read";
	parameters?: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

export type CatalogView = {
	all(): CatalogEntryView[];
	meta(id: string): CatalogEntryView | undefined;
	loaded(id: string): boolean;
	listCategories(): Array<{ id: string; count: number }>;
	listByCategory(category: string): CatalogEntryView[];
	listUserVisible(): CatalogEntryView[];
	search(query: string): CatalogEntryView[];
	invoke(id: string, params: Record<string, unknown>): unknown;
};

export type ChatCatalog = {
	catalog: OrchestratorCatalog;
	turnContext?: () => unknown;
	/** What the conversation is working on; see object-runtime/focus.ts. */
	focus?: () => Array<{ key: string; type: string; label: string }>;

	// The meta-tool contour lists by category and by recency; the orchestrator
	// ports do neither, so handing it `catalog` gives the model tools that throw
	// on call — and a model whose tool just threw calls again.
	context?: FunctionCatalogContext;

	label?: (id: string) => string | undefined;

	/**
	 * The delivery's own view of its catalog. It is what gets published to the
	 * orchestrator — the meta-tool contour above lists a slice, this is the list.
	 */
	diagnostics?: CatalogView;

	/** Functions arrive while the chat runs; this is how it learns about them. */
	onChange?: (republish: () => void) => void;
};

type IntakeFile = {
	fileId: string;
	fileName: string;
	fileSize?: number;
	fileType?: string;
	status?: string;
	/** The workflow's verdict: this is a production model, not a drawing. */
	model?: boolean;
};

type IntakeReport = {
	contents: IntakeFile[];
	/** Archives whose contents are now known, so they can leave the context. */
	archiveIds: string[];
};

/** What wf-files-process reports, narrowed to what the chat needs. The workflow
 *  is a service reply, not a typed import: read it defensively. */
function readIntake(report: unknown): IntakeReport {
	const empty: IntakeReport = { contents: [], archiveIds: [] };
	if (typeof report !== "object" || report === null) return empty;
	const result = (report as { result?: unknown }).result;
	if (typeof result !== "object" || result === null) return empty;

	const rows = (result as { contents?: unknown }).contents;
	const files = (result as { files?: unknown }).files;
	return {
		contents: (Array.isArray(rows) ? rows : []).flatMap((row): IntakeFile[] => {
			if (typeof row !== "object" || row === null) return [];
			const { fileId, name, fileType, size, model } = row as Record<
				string,
				unknown
			>;
			if (typeof fileId !== "string" || typeof name !== "string") return [];
			return [
				{
					fileId,
					fileName: name,
					...(typeof size === "number" ? { fileSize: size } : {}),
					...(typeof fileType === "string" ? { fileType } : {}),
					...(model === true ? { model: true } : {}),
					status: "ready",
				},
			];
		}),
		archiveIds: (Array.isArray(files) ? files : []).flatMap((row): string[] => {
			if (typeof row !== "object" || row === null) return [];
			const { fileId, archive } = row as Record<string, unknown>;
			return archive === true && typeof fileId === "string" ? [fileId] : [];
		}),
	};
}

/** Analysis is the second half of an upload and by far the slower one: a CAM
 *  pass or a slice runs in a native container for as long as it takes, while
 *  the visitor is watching their files appear. So it is started here and never
 *  awaited by intake — the run's own turn reports it when it lands.
 *
 *  Never rejects: a slicer that is down must cost the estimates and nothing
 *  else, and the returned promise is held across an await, where a rejection
 *  with no handler yet would surface as an unhandled one. */
function startFileAnalysis(
	workflow: { runWorkflow(script: string, params: Record<string, unknown>): Promise<unknown> },
	fileIds: string[],
): Promise<unknown | null> {
	return workflow
		.runWorkflow("workflows/wf-files-analyze.js", { fileIds })
		.catch((error: unknown) => {
			console.error("[chat] file analysis unavailable", error);
			return null;
		});
}

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
		(["route", "select", "args", "files"] as const).map((step) => [
			step as string,
			createContextPromptResolver(contextsClient, {
				section: step,
				requireSection: true,
			}),
		]),
	);
	// A step with no section of its own falls back to the conversation prompt.
	// A deciding step must not: answering a landing visitor is not the same job,
	// and a step given the wrong instructions decides confidently and wrongly.
	const stepPrompt = (step: StepName) =>
		(stepResolvers.get(step) ?? resolveSystemPrompt)({
			contextName: config.contextName,
			language: config.language,
		});

	/** Files an upload turned into, by id. Filled once, read for the rest of the
	 *  thread: a request is usually created several messages after the upload. */
	const processedFiles = new Map<string, IntakeFile>();
	/** Archives whose contents are known, so they stop standing for themselves. */
	const unpackedArchives = new Set<string>();

	// What the chat can put on a request: what the browser uploaded, plus what
	// came out of it. An extracted STL never passes through the upload store —
	// the workflow created it — so without the second half the assistant knows
	// only about the archive it cannot use.
	const uploadedFiles = () => [
		...Array.from($files.getState().entries()).map(([fileId, file]) => ({
			fileId,
			fileName: file.fileName,
			fileSize: file.fileSize,
			fileType: file.fileType,
			status: file.status,
		})),
		...processedFiles.values(),
	];

	/** The same list as the files module sees it: an unpacked archive is gone,
	 *  its contents stand in its place, and a production model is marked. */
	const turnFiles = (): TurnFile[] =>
		uploadedFiles()
			.filter((file) => !unpackedArchives.has(file.fileId))
			.map((file) => ({
				fileId: file.fileId,
				name: file.fileName ?? file.fileId,
				...(file.fileType ? { fileType: file.fileType } : {}),
				...("model" in file && file.model ? { primary: true } : {}),
			}));

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
		turnContext: host?.turnContext,
		focus: host?.focus,
		// The built-in flow reads the user's words to find a function and to fill
		// its arguments. Files are not words: after an archive is unpacked the
		// turn holds identifiers nobody typed, and the only question worth a model
		// is what they are for. The module asks that once; the identifiers are
		// filled here, where they have been all along.
		steps: (catalog) => [
			createFilesStep({
				files: turnFiles,
				intents: {
					request: {
						// The operation mf-requests publishes through the object
						// resolver; it starts the analysis once the request exists.
						id: "core.create:requests.request",
						brief: "these files are something to manufacture",
						arguments: (files) => ({
							files: Object.fromEntries(
								files.map((file) => [file.name, file.fileId]),
							),
						}),
						complete: true,
					},
				},
			}),
			...createFunctionSteps({ catalog }),
		],
	});
	conversation.turn.turnFinished.watch(refreshFocusedObjects);

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
					module: "workflows",
					moduleLabel: "Workflows",
					parameters: workflow.parameters,
				})),
			});
		})
		.catch((error) =>
			console.error("[chat] workflow catalog unavailable", error),
		);

	// The orchestrator sees the stable operator vocabulary. Domain types and
	// operations stay behind the object resolver instead of becoming tools.
	if (host?.catalog) {
		const { catalog } = host;
		conversation.catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			modules: catalog.listModules,
			meta: (id) => catalog.meta(id),
			load: catalog.load,
			invoke: (id, args) => catalog.invoke(id, args),
		});
		const republish = () =>
			conversation.catalog.functionsPublished({
				source: "ui",
				functions: (host.diagnostics?.all() ?? []).map((entry) => {
					return {
						id: entry.id,
						brief: entry.brief ?? entry.id,
						description: entry.description ?? entry.brief ?? entry.id,
						category: entry.category,
						priority: entry.priority,
						// Without these the published catalog is flat and the flow has
						// no section to narrow to before it picks a function.
						module: entry.module,
						moduleLabel: entry.moduleLabel,
						// Without these the flow cannot tell a function that continues
						// the open work from one that starts it over.
						targetType: entry.targetType,
						intent: entry.intent,
						parameters: "parameters" in entry ? entry.parameters : undefined,
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
		// Processing an upload is only half of it. What the upload finally
		// amounts to are the files inside it — an archive of thirteen STLs is
		// what a request is made of, and the archive itself is not.
		processFiles: async (fileIds) => {
			const report = await store.invokeFunction("startFilesProcess", {
				fileIds,
			});
			const intake = readIntake(report);
			for (const file of intake.contents) processedFiles.set(file.fileId, file);
			for (const archive of intake.archiveIds) unpackedArchives.add(archive);
			// Start the processors on everything intake called a production model,
			// archives already expanded. Started before the intake turn so the
			// containers are working while the assistant is still talking, and
			// reported after it, because two turns opened at once interleave in
			// the transcript.
			const modelIds = intake.contents
				.filter((file) => file.model)
				.map((file) => file.fileId);
			const analysis = modelIds.length
				? startFileAnalysis(dagClient, modelIds)
				: null;
			// Unpacking produced files, so the chat shows files: each one as the
			// same downloadable bubble an upload leaves behind. Their names and
			// sizes are the readable result of the operation — a report the
			// visitor can click, instead of one they have to be told about.
			for (const file of intake.contents) {
				store.attach({
					id: file.fileId,
					name: file.fileName,
					size: file.fileSize,
					type: file.fileType,
				});
			}
			// The assistant gets the same report as a turn, because deciding what
			// to do with the files (create a request, ask, say nothing) is its
			// call and it never gets to make it otherwise.
			await store.follow(
				`Uploaded files were processed. Report:\n${JSON.stringify(report, null, 2)}`,
			);

			// The estimates are the point of the upload, so they get a turn of
			// their own rather than being left in a workflow's return value.
			if (analysis) {
				void analysis.then((result) => {
					if (result === null) return;
					return store.follow(
						`Uploaded models were analysed. Report:\n${JSON.stringify(result, null, 2)}`,
					);
				});
			}
		},
	});

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

	registerBuiltinSlashCommands();

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
