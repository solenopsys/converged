import { useUnit } from "effector-react";
import { services } from "files-state";
import { createFilesServiceClient, type FileMetadata } from "g-files";
import type { RequestFieldState, RequestModel } from "g-requests";
import { createStoreServiceClient } from "g-store";
import { ModelViewer } from "model3d";
import { useEffect, useMemo, useState } from "react";
import { RequestQr } from "../components/RequestQr";
import {
	$requestError,
	$requestLoading,
	$requestModel,
	requestDetailOpened,
	requestModelReceived,
} from "../domain-requests";
import { createRuntimeAssistantServiceClient } from "g-rt-assistant";

const chatRuntimeClient = createRuntimeAssistantServiceClient({ baseUrl: "/runtime" });

if (typeof window !== "undefined" && !services.getFilesService()) {
	services.setFilesService(createFilesServiceClient({ baseUrl: "/services" }));
	services.setStoreService(createStoreServiceClient({ baseUrl: "/services" }));
}

const groupLabels: Record<string, string> = {
	basic: "Основное",
	geometry: "Геометрия",
	quality: "Качество",
	logistics: "Сроки и доставка",
	contact: "Контакт",
	analysis: "Аналитика",
	request: "Дополнительные требования",
};

const statusLabels: Record<string, string> = {
	draft: "Черновик",
	new: "Новая",
	needs_clarification: "Нужно уточнение",
	needs_files: "Нужны файлы",
	file_analysis_pending: "Файлы обрабатываются",
	file_analysis_done: "Файлы обработаны",
};

const processLabels: Record<string, string> = {
	cnc_machining: "ЧПУ обработка",
	laser_cutting: "Лазерная резка",
	plastic_cutting: "Резка пластика",
	"3d_printing": "3D печать",
	generic: "Производство",
};

const analysisFieldKeys = new Set([
	"file_analysis_estimates",
	"file_analysis_errors",
]);

function publicRequestUrl(requestId: string): string {
	if (typeof window === "undefined") return `/request/${requestId}`;
	return `${window.location.origin}/request/${requestId}`;
}

function formatDate(value?: string): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatValue(field: RequestFieldState): string {
	const value = field.value;
	if (value === undefined || value === null || value === "")
		return "Не заполнено";
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	const text = String(value);
	return field.unit ? `${text} ${field.unit}` : text;
}

function groupFields(
	model: RequestModel,
): Array<[string, RequestFieldState[]]> {
	const groups = new Map<string, RequestFieldState[]>();
	for (const key of model.fieldOrder) {
		if (analysisFieldKeys.has(key)) continue;
		const field = model.fields[key];
		if (!field) continue;
		const group = field.group || "request";
		const list = groups.get(group) ?? [];
		list.push(field);
		groups.set(group, list);
	}
	return Array.from(groups.entries());
}

function FieldCard({ field }: { field: RequestFieldState }) {
	const isMissing = field.status === "missing" && field.required;
	const isReview = field.status === "needs_review";
	return (
		<div
			className={[
				"rounded-xl border p-4 transition-colors",
				isMissing
					? "border-amber-400/45 bg-amber-400/8"
					: isReview
						? "border-sky-300/35 bg-sky-300/8"
						: "border-white/10 bg-white/[0.045]",
			].join(" ")}
		>
			<div className="mb-2 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-sm font-medium text-white">{field.label}</div>
					{field.description ? (
						<div className="mt-1 text-xs leading-relaxed text-slate-400">
							{field.description}
						</div>
					) : null}
				</div>
				{field.required ? (
					<span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">
						обяз.
					</span>
				) : null}
			</div>
			<div
				className={[
					"break-words text-sm leading-relaxed",
					isMissing ? "text-amber-100" : "text-slate-100",
				].join(" ")}
			>
				{formatValue(field)}
			</div>
		</div>
	);
}

type AnalysisEstimate = {
	sourceFileId?: string;
	type?: string;
	data?: Record<string, any>;
};

function asNumber(value: unknown): number | undefined {
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function formatNumber(value: unknown, digits = 1): string | null {
	const number = asNumber(value);
	if (number === undefined) return null;
	return number.toLocaleString("ru-RU", {
		maximumFractionDigits: digits,
	});
}

function formatDuration(seconds: unknown): string | null {
	const value = asNumber(seconds);
	if (value === undefined) return null;
	const minutes = Math.round(value / 60);
	if (minutes < 60) return `${minutes} мин`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function getAnalysisEstimates(model: RequestModel): AnalysisEstimate[] {
	const value = model.fields.file_analysis_estimates?.value;
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is AnalysisEstimate =>
			Boolean(item) && typeof item === "object" && !Array.isArray(item),
	);
}

function getAnalysisErrors(model: RequestModel): Array<Record<string, any>> {
	const value = model.fields.file_analysis_errors?.value;
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is Record<string, any> =>
			Boolean(item) && typeof item === "object" && !Array.isArray(item),
	);
}

function estimateRows(estimate: AnalysisEstimate): Array<[string, string]> {
	const data = estimate.data ?? {};
	const rows: Array<[string, string | null]> = [];
	if (estimate.type === "printing" || estimate.type === "gcode") {
		rows.push(["Время печати", formatDuration(data.timeSeconds)]);
		rows.push(["Пластик", formatNumber(data.weightGrams, 1)?.concat(" г") ?? null]);
		rows.push([
			"Филамент",
			formatNumber(data.filamentLengthMeters, 2)?.concat(" м") ?? null,
		]);
		rows.push([
			"Объем материала",
			formatNumber(data.materialVolumeMm3, 0)?.concat(" мм³") ?? null,
		]);
	}
	if (estimate.type === "milling") {
		rows.push(["Время обработки", formatDuration(data.totalTimeSec)]);
		rows.push(["Проходы", formatNumber(data.passes, 0)]);
		rows.push(["Рез", formatNumber(data.cutLengthMm, 0)?.concat(" мм") ?? null]);
		rows.push(["Быстрый ход", formatNumber(data.rapidLengthMm, 0)?.concat(" мм") ?? null]);
	}
	if (data.dimensionsMm && typeof data.dimensionsMm === "object") {
		const x = formatNumber(data.dimensionsMm.x, 1);
		const y = formatNumber(data.dimensionsMm.y, 1);
		const z = formatNumber(data.dimensionsMm.z, 1);
		if (x && y && z) rows.push(["Габариты", `${x} × ${y} × ${z} мм`]);
	} else if (
		asNumber(data.maxX) !== undefined &&
		asNumber(data.minX) !== undefined &&
		asNumber(data.maxY) !== undefined &&
		asNumber(data.minY) !== undefined &&
		asNumber(data.maxZ) !== undefined &&
		asNumber(data.minZ) !== undefined
	) {
		rows.push([
			"Габариты",
			`${formatNumber(asNumber(data.maxX)! - asNumber(data.minX)!, 1)} × ${formatNumber(asNumber(data.maxY)! - asNumber(data.minY)!, 1)} × ${formatNumber(asNumber(data.maxZ)! - asNumber(data.minZ)!, 1)} мм`,
		]);
	}
	rows.push(["Источник", typeof data.estimator === "string" ? data.estimator : null]);
	return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function fileBaseName(name: string): string {
	return name
		.replace(/\\/g, "/")
		.split("/")
		.pop()!
		.replace(/\.[^.]+$/, "")
		.toLowerCase();
}

function findEstimatePreview(
	estimate: AnalysisEstimate,
	sourceLabel: string | undefined,
	files: Array<[string, string]>,
	fileMetadata: Record<string, FileMetadata>,
): [string, string] | undefined {
	const sourceName =
		typeof estimate.data?.sourceName === "string"
			? estimate.data.sourceName
			: sourceLabel;
	const sourceBase = sourceName ? fileBaseName(sourceName) : undefined;

	if (sourceBase) {
		const exactPreview = files.find(([label, fileId]) => {
			return (
				isModelFile(label, fileMetadata[fileId]?.fileType) &&
				fileBaseName(label) === sourceBase
			);
		});
		if (exactPreview) return exactPreview;
	}

	if (estimate.sourceFileId) {
		const directModel = files.find(([label, fileId]) => {
			return (
				fileId === estimate.sourceFileId &&
				isModelFile(label, fileMetadata[fileId]?.fileType)
			);
		});
		if (directModel) return directModel;
	}

	return undefined;
}

function AnalysisSection({
	estimates,
	errors,
	files,
	fileMetadata,
}: {
	estimates: AnalysisEstimate[];
	errors: Array<Record<string, any>>;
	files: Array<[string, string]>;
	fileMetadata: Record<string, FileMetadata>;
}) {
	if (estimates.length === 0 && errors.length === 0) return null;
	const fileLabels = new Map(files.map(([label, id]) => [id, label]));

	return (
		<section className="rounded-3xl border border-emerald-300/20 bg-[#08110f] p-4 shadow-xl shadow-black/20 sm:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold text-white">Аналитика</h2>
				<span className="rounded-full border border-emerald-200/20 px-2.5 py-1 text-xs text-emerald-100">
					{estimates.length} расчетов
				</span>
			</div>
			{estimates.length > 0 ? (
				<div className="flex flex-col gap-4">
					{estimates.map((estimate, index) => {
						const rows = estimateRows(estimate);
						const sourceLabel = estimate.sourceFileId
							? fileLabels.get(estimate.sourceFileId)
							: undefined;
						const preview = findEstimatePreview(
							estimate,
							sourceLabel,
							files,
							fileMetadata,
						);
						const title =
							sourceLabel ||
							(typeof estimate.data?.sourceName === "string"
								? estimate.data.sourceName
								: `Расчет ${index + 1}`);
						return (
							<div
								key={`${estimate.sourceFileId ?? "estimate"}:${index}`}
								className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]"
							>
								<div className="border-b border-white/10 p-4">
									<div className="text-sm font-medium text-white">{title}</div>
									<div className="mt-1 text-xs text-slate-400">
										{estimate.type === "printing"
											? "3D печать"
											: estimate.type === "milling"
												? "ЧПУ"
												: estimate.type ?? "Расчет"}
									</div>
								</div>
								<div className="grid gap-0 min-[560px]:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] min-[900px]:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
									<div className="border-b border-white/10 bg-black/20 min-[560px]:border-b-0 min-[560px]:border-r">
										{preview ? (
											<ModelViewer
												fileId={preview[1]}
												alt={preview[0]}
												style={{ height: 280 }}
											/>
										) : (
											<div className="flex h-64 items-center justify-center px-5 text-center text-sm text-slate-500">
												Preview модели не найден
											</div>
										)}
									</div>
									<div className="p-4">
										<div className="space-y-2 text-sm">
											{rows.map(([label, value]) => (
												<div
													key={label}
													className="flex justify-between gap-3 border-b border-white/10 pb-2 last:border-b-0 last:pb-0"
												>
													<span className="text-slate-400">{label}</span>
													<span className="text-right text-slate-100">{value}</span>
												</div>
											))}
										</div>
										{estimate.data?.assumptions ? (
											<div className="mt-3 rounded-lg border border-amber-200/20 bg-amber-300/8 p-2 text-xs leading-relaxed text-amber-100">
												Грубая оценка по геометрии STL. Для точного времени нужен
												Cura definition.
											</div>
										) : null}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			) : null}
			{errors.length > 0 ? (
				<div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/8 p-3 text-sm text-amber-100">
					Не все этапы анализа выполнились: {errors.length}
				</div>
			) : null}
		</section>
	);
}

const filesClient = createFilesServiceClient({ baseUrl: "/services" });

const GLB_MIMES = new Set(["model/gltf-binary", "model/gltf+json"]);

function isGlbMime(mime?: string): boolean {
	return Boolean(mime && GLB_MIMES.has(mime));
}

function isModelFile(label: string, mime?: string): boolean {
	return isGlbMime(mime) || /\.(glb2?|gltf)$/i.test(label);
}

function uniqueFileLabel(files: Record<string, string>, name: string, fileId: string) {
	let key = name;
	let suffix = 2;
	while (files[key] && files[key] !== fileId) {
		const dot = name.lastIndexOf(".");
		key =
			dot > 0
				? `${name.slice(0, dot)}-${suffix}${name.slice(dot)}`
				: `${name}-${suffix}`;
		suffix += 1;
	}
	return key;
}

function useFileMetadata(fileIds: string[]): Record<string, FileMetadata> {
	const [fileMetadata, setFileMetadata] = useState<Record<string, FileMetadata>>({});
	const key = fileIds.join(",");

	useEffect(() => {
		if (!fileIds.length) return;
		Promise.all(
			fileIds.map((id) =>
				filesClient.get(id)
					.then((meta) => [id, meta] as const)
					.catch(() => null),
			),
		).then((results) => {
			const map: Record<string, FileMetadata> = {};
			for (const r of results) {
				if (r) map[r[0]] = r[1];
			}
			setFileMetadata(map);
		});
	}, [key]);

	return fileMetadata;
}

function useCollectionFiles(collectionIds: string[]): Record<string, FileMetadata> {
	const [filesById, setFilesById] = useState<Record<string, FileMetadata>>({});
	const key = [...collectionIds].sort().join(",");

	useEffect(() => {
		if (!collectionIds.length) return;
		Promise.all(
			collectionIds.map((id) =>
				filesClient.listByCollection(id).catch(() => []),
			),
		).then((results) => {
			const map: Record<string, FileMetadata> = {};
			for (const files of results) {
				for (const file of files) {
					map[file.id] = file;
				}
			}
			setFilesById(map);
		});
	}, [key]);

	return filesById;
}

function RequestPageBody({ model }: { model: RequestModel }) {
	const url = publicRequestUrl(model.id);
	const grouped = useMemo(() => groupFields(model), [model]);
	const analysisEstimates = useMemo(() => getAnalysisEstimates(model), [model]);
	const analysisErrors = useMemo(() => getAnalysisErrors(model), [model]);
	const baseFiles = Object.entries(model.files);
	const baseFileMetadata = useFileMetadata(baseFiles.map(([, id]) => id));
	const collectionIds = useMemo(
		() =>
			Array.from(
				new Set(
					Object.values(baseFileMetadata)
						.map((file) => file.collectionId)
						.filter((id): id is string => Boolean(id)),
				),
			),
		[baseFileMetadata],
	);
	const collectionFiles = useCollectionFiles(collectionIds);
	const fileMetadata = useMemo(
		() => ({ ...baseFileMetadata, ...collectionFiles }),
		[baseFileMetadata, collectionFiles],
	);
	const files = useMemo(() => {
		const merged: Record<string, string> = {};
		for (const [label, fileId] of baseFiles) {
			merged[uniqueFileLabel(merged, label, fileId)] = fileId;
		}
		for (const file of Object.values(collectionFiles)) {
			if (Object.values(merged).includes(file.id)) continue;
			merged[uniqueFileLabel(merged, file.name, file.id)] = file.id;
		}
		return Object.entries(merged);
	}, [baseFiles, collectionFiles]);
	const sortedFiles = useMemo(
		() =>
			[...files].sort(([leftLabel, leftId], [rightLabel, rightId]) => {
				const leftIsModel = isModelFile(leftLabel, fileMetadata[leftId]?.fileType);
				const rightIsModel = isModelFile(rightLabel, fileMetadata[rightId]?.fileType);
				if (leftIsModel !== rightIsModel) return leftIsModel ? -1 : 1;
				return leftLabel.localeCompare(rightLabel);
			}),
		[files, fileMetadata],
	);

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#050608] text-white">
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
					<header className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.9)_48%,rgba(6,78,59,0.7))] shadow-2xl shadow-black/35">
					<div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="flex min-w-0 flex-col gap-5">
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
									{statusLabels[model.status] ?? model.status}
								</span>
								<span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
									Версия {model.revision}
								</span>
								<span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
									{processLabels[model.processType] ?? model.processType}
								</span>
							</div>
							<div>
								<h1 className="max-w-4xl text-3xl font-semibold leading-[1.05] tracking-normal text-white sm:text-5xl">
									{model.title || "Производственная заявка"}
								</h1>
								<p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
									{model.summary || ""}
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
									<div className="text-2xl font-semibold">
										{model.completion.percent}%
									</div>
									<div className="mt-1 text-xs text-slate-400">
										заполнено по обязательным полям
									</div>
									<div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
										<div
											className="h-full rounded-full bg-emerald-300"
											style={{ width: `${model.completion.percent}%` }}
										/>
									</div>
								</div>
								<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
									<div className="text-2xl font-semibold">
										{model.completion.filledRequired}/
										{model.completion.required}
									</div>
									<div className="mt-1 text-xs text-slate-400">
										обязательные параметры
									</div>
								</div>
								<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
									<div className="text-2xl font-semibold">{files.length}</div>
									<div className="mt-1 text-xs text-slate-400">
										прикрепленные файлы
									</div>
								</div>
							</div>
						</div>
						<aside className="flex flex-col items-start gap-3 lg:items-end">
							<RequestQr url={url} />
							<div className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-300 lg:w-64">
								<div className="font-medium text-white">Публичная ссылка</div>
								<div className="mt-2 break-all text-slate-400">{url}</div>
							</div>
						</aside>
					</div>
				</header>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
					<main className="flex min-w-0 flex-col gap-5">
						<AnalysisSection
							estimates={analysisEstimates}
							errors={analysisErrors}
							files={files}
							fileMetadata={fileMetadata}
						/>
						{grouped.map(([group, fields]) => (
							<section
								key={group}
								className="rounded-3xl border border-white/10 bg-[#0b0d11] p-4 shadow-xl shadow-black/20 sm:p-5"
							>
								<div className="mb-4 flex items-center justify-between gap-3">
									<h2 className="text-lg font-semibold text-white">
										{groupLabels[group] ?? group}
									</h2>
									<span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
										{
											fields.filter((field) => field.status !== "missing")
												.length
										}
										/{fields.length}
									</span>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{fields.map((field) => (
										<FieldCard key={field.key} field={field} />
									))}
								</div>
							</section>
						))}
					</main>

					<aside className="flex flex-col gap-5">
						<section className="rounded-3xl border border-white/10 bg-[#0b0d11] p-5 shadow-xl shadow-black/20">
							<h2 className="text-lg font-semibold text-white">Состояние</h2>
							<div className="mt-4 space-y-3 text-sm">
								<div className="flex justify-between gap-3 border-b border-white/10 pb-3">
									<span className="text-slate-400">ID</span>
									<span className="max-w-44 truncate text-right text-slate-100">
										{model.id}
									</span>
								</div>
								<div className="flex justify-between gap-3 border-b border-white/10 pb-3">
									<span className="text-slate-400">Создана</span>
									<span className="text-right text-slate-100">
										{formatDate(model.createdAt)}
									</span>
								</div>
								<div className="flex justify-between gap-3 border-b border-white/10 pb-3">
									<span className="text-slate-400">Обновлена</span>
									<span className="text-right text-slate-100">
										{formatDate(model.updatedAt)}
									</span>
								</div>
								<div className="flex justify-between gap-3">
									<span className="text-slate-400">Источник</span>
									<span className="text-right text-slate-100">
										{model.source ?? "—"}
									</span>
								</div>
							</div>
						</section>

						<section className="rounded-3xl border border-white/10 bg-[#0b0d11] p-5 shadow-xl shadow-black/20">
							<h2 className="text-lg font-semibold text-white">Файлы</h2>
							{files.length > 0 ? (
								<div className="mt-4 space-y-3">
									{sortedFiles.map(([label, fileId]) => {
										const isModel = isModelFile(label, fileMetadata[fileId]?.fileType);
										const showFilePreview = isModel && analysisEstimates.length === 0;
										return (
											<div
												key={`${label}:${fileId}`}
												className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.045]"
											>
												{showFilePreview ? (
													<ModelViewer
														fileId={fileId}
														alt={label}
														style={{ height: 280 }}
													/>
												) : null}
												<div className="p-3">
													<div className="text-sm font-medium text-white">
														{label}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="mt-3 text-sm leading-6 text-slate-400">
									Файлы пока не прикреплены.
								</p>
							)}
						</section>

						{model.missingRequired.length > 0 ? (
							<section className="rounded-3xl border border-amber-300/30 bg-amber-300/8 p-5">
								<h2 className="text-lg font-semibold text-amber-100">
									Нужно уточнить
								</h2>
								<div className="mt-3 flex flex-wrap gap-2">
									{model.missingRequired.map((key) => (
										<span
											key={key}
											className="rounded-full border border-amber-200/30 px-2.5 py-1 text-xs text-amber-100"
										>
											{model.fields[key]?.label ?? key}
										</span>
									))}
								</div>
							</section>
						) : null}
					</aside>
				</div>
				</div>
			</div>
		</div>
	);
}

export function RequestDetailView({
	requestId,
	model,
}: {
	requestId?: string;
	model?: RequestModel | null;
}) {
	const state = useUnit({
		storeModel: $requestModel,
		loading: $requestLoading,
		error: $requestError,
	});
	const activeRequestId = requestId ?? model?.id ?? state.storeModel?.id;
	const activeModel =
		state.storeModel?.id === activeRequestId
			? state.storeModel
			: (model ?? null);

	useEffect(() => {
		if (!activeRequestId) return;
		requestDetailOpened({ requestId: activeRequestId });

		let cancelled = false;
		(async () => {
			try {
				for await (const updated of chatRuntimeClient.subscribeToRequestModel(activeRequestId)) {
					if (cancelled) break;
					requestModelReceived(updated as unknown as RequestModel);
				}
			} catch {
				// SSE closed on unmount — normal
			}
		})();

		return () => { cancelled = true; };
	}, [activeRequestId]);

	if (state.error) {
		return (
			<div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-[#050608] p-6 text-white">
				<div className="max-w-lg rounded-3xl border border-red-300/30 bg-red-400/10 p-6">
					<div className="text-lg font-semibold">Заявка не открылась</div>
					<div className="mt-2 text-sm text-red-100">{state.error}</div>
				</div>
			</div>
		);
	}

	if (!activeModel) {
		return (
			<div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-[#050608] p-6 text-white">
				<div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm text-slate-300">
					{state.loading ? "Загрузка заявки..." : "Заявка не выбрана"}
				</div>
			</div>
		);
	}

	return <RequestPageBody model={activeModel} />;
}
