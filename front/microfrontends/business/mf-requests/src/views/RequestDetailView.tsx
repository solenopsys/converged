import { useUnit } from "effector-react";
import { downloadRequested, services } from "files-state";
import { createFilesServiceClient, type FileMetadata } from "g-files";
import type { RequestFieldState, RequestModel } from "g-requests";
import { createStoreServiceClient } from "g-store";
import { $activeLocale, useMicrofrontendTranslation } from "front-core";
import { ModelViewer } from "model3d";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { RequestQr } from "../components/RequestQr";
import {
	$requestError,
	$requestLoading,
	$requestModel,
	requestDetailOpened,
	requestModelReceived,
} from "../domain-requests";
import { createRuntimeAssistantServiceClient } from "g-rt-assistant";
import "./RequestDetailView.css";

const chatRuntimeClient = createRuntimeAssistantServiceClient({ baseUrl: "/runtime" });

if (typeof window !== "undefined" && !services.getFilesService()) {
	services.setFilesService(createFilesServiceClient({ baseUrl: "/services" }));
	services.setStoreService(createStoreServiceClient({ baseUrl: "/services" }));
}

type Translate = (key: string) => string;
type I18n = { t: Translate; locale: string };

/** Replace `{name}` placeholders in a translated template. */
function interpolate(
	template: string,
	vars: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (_, key) =>
		key in vars ? String(vars[key]) : `{${key}}`,
	);
}

/** Translate with an explicit fallback for dynamic keys that may be absent. */
function tr(t: Translate, key: string, fallback: string): string {
	const value = t(key);
	return value === key ? fallback : value;
}

const analysisFieldKeys = new Set([
	"file_analysis_estimates",
	"file_analysis_errors",
]);

function publicRequestUrl(requestId: string): string {
	if (typeof window === "undefined") return `/request/${requestId}`;
	return `${window.location.origin}/request/${requestId}`;
}

function formatDate(value: string | undefined, locale: string): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(locale, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatValue(field: RequestFieldState, i18n: I18n): string {
	const value = field.value;
	if (value === undefined || value === null || value === "")
		return i18n.t("detail.notFilled");
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	const text = String(value);
	return field.unit ? `${text} ${field.unit}` : text;
}

function hasFieldValue(field: RequestFieldState): boolean {
	const value = field.value;
	if (value === undefined || value === null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function groupFields(
	model: RequestModel,
): Array<[string, RequestFieldState[]]> {
	const groups = new Map<string, RequestFieldState[]>();
	for (const key of model.fieldOrder) {
		if (analysisFieldKeys.has(key)) continue;
		const field = model.fields[key];
		if (!field) continue;
		if (!hasFieldValue(field) && field.status === "missing") continue;
		const group = field.group || "request";
		const list = groups.get(group) ?? [];
		list.push(field);
		groups.set(group, list);
	}
	return Array.from(groups.entries());
}

function FieldCard({ field, i18n }: { field: RequestFieldState; i18n: I18n }) {
	const isMissing = field.status === "missing" && field.required;
	const isReview = field.status === "needs_review";
	return (
		<div className="request-field" data-state={isMissing ? "missing" : isReview ? "review" : "filled"}>
			<div className="request-field__label">
				{field.label}
				{field.description ? (
					<div className="request-field__description">{field.description}</div>
				) : null}
			</div>
			<div className="request-field__value">{formatValue(field, i18n)}</div>
		</div>
	);
}

type AnalysisEstimate = {
	sourceFileId?: string;
	type?: string;
	data?: Record<string, any>;
};

type ModelPreviewRenderer = (payload: {
	alt: string;
	fileId: string;
}) => ReactNode;

function DefaultModelPreview({ alt, fileId }: { alt: string; fileId: string }) {
	return (
		<ModelViewer
			fileId={fileId}
			alt={alt}
			style={{ height: "100%" }}
		/>
	);
}

function asNumber(value: unknown): number | undefined {
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function formatNumber(value: unknown, digits: number, locale: string): string | null {
	const number = asNumber(value);
	if (number === undefined) return null;
	return number.toLocaleString(locale, {
		maximumFractionDigits: digits,
	});
}

function withUnit(value: string | null, unit: string): string | null {
	return value === null ? null : `${value} ${unit}`;
}

function formatDuration(seconds: unknown, i18n: I18n): string | null {
	const value = asNumber(seconds);
	if (value === undefined) return null;
	const min = i18n.t("analysis.units.minutes");
	const hr = i18n.t("analysis.units.hours");
	const minutes = Math.round(value / 60);
	if (minutes < 60) return `${minutes} ${min}`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest > 0 ? `${hours} ${hr} ${rest} ${min}` : `${hours} ${hr}`;
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

function estimateRows(estimate: AnalysisEstimate, i18n: I18n): Array<[string, string]> {
	const { t, locale } = i18n;
	const data = estimate.data ?? {};
	const mm = t("analysis.units.mm");
	const rows: Array<[string, string | null]> = [];
	if (estimate.type === "printing" || estimate.type === "gcode") {
		rows.push([t("analysis.rows.printTime"), formatDuration(data.timeSeconds, i18n)]);
		rows.push([
			t("analysis.rows.weight"),
			withUnit(formatNumber(data.weightGrams, 1, locale), t("analysis.units.grams")),
		]);
		rows.push([
			t("analysis.rows.filament"),
			withUnit(formatNumber(data.filamentLengthMeters, 2, locale), t("analysis.units.meters")),
		]);
		rows.push([
			t("analysis.rows.materialVolume"),
			withUnit(formatNumber(data.materialVolumeMm3, 0, locale), t("analysis.units.mm3")),
		]);
	}
	if (estimate.type === "milling") {
		rows.push([t("analysis.rows.machiningTime"), formatDuration(data.totalTimeSec, i18n)]);
		rows.push([t("analysis.rows.passes"), formatNumber(data.passes, 0, locale)]);
		rows.push([
			t("analysis.rows.cut"),
			withUnit(formatNumber(data.cutLengthMm, 0, locale), mm),
		]);
		rows.push([
			t("analysis.rows.rapid"),
			withUnit(formatNumber(data.rapidLengthMm, 0, locale), mm),
		]);
	}
	if (data.dimensionsMm && typeof data.dimensionsMm === "object") {
		const x = formatNumber(data.dimensionsMm.x, 1, locale);
		const y = formatNumber(data.dimensionsMm.y, 1, locale);
		const z = formatNumber(data.dimensionsMm.z, 1, locale);
		if (x && y && z) rows.push([t("analysis.rows.dimensions"), `${x} × ${y} × ${z} ${mm}`]);
	} else if (
		asNumber(data.maxX) !== undefined &&
		asNumber(data.minX) !== undefined &&
		asNumber(data.maxY) !== undefined &&
		asNumber(data.minY) !== undefined &&
		asNumber(data.maxZ) !== undefined &&
		asNumber(data.minZ) !== undefined
	) {
		rows.push([
			t("analysis.rows.dimensions"),
			`${formatNumber(asNumber(data.maxX)! - asNumber(data.minX)!, 1, locale)} × ${formatNumber(asNumber(data.maxY)! - asNumber(data.minY)!, 1, locale)} × ${formatNumber(asNumber(data.maxZ)! - asNumber(data.minZ)!, 1, locale)} ${mm}`,
		]);
	}
	rows.push([t("analysis.rows.source"), typeof data.estimator === "string" ? data.estimator : null]);
	return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

function estimateTypeLabel(estimate: AnalysisEstimate, t: Translate): string {
	if (estimate.type === "printing") return t("analysis.type.printing");
	if (estimate.type === "gcode") return t("analysis.type.gcode");
	if (estimate.type === "milling") return t("analysis.type.milling");
	return estimate.type ?? t("analysis.type.fallback");
}

function estimatePrimaryMetric(estimate: AnalysisEstimate, i18n: I18n): [string, string] {
	const { t, locale } = i18n;
	const data = estimate.data ?? {};
	const weight = formatNumber(data.weightGrams, 1, locale);
	if (weight) return [t("analysis.metric.weight"), `${weight} ${t("analysis.units.grams")}`];

	const printTime = formatDuration(data.timeSeconds, i18n);
	if (printTime) return [t("analysis.metric.printTime"), printTime];

	const millTime = formatDuration(data.totalTimeSec, i18n);
	if (millTime) return [t("analysis.metric.machiningTime"), millTime];

	const materialVolume = formatNumber(data.materialVolumeMm3, 0, locale);
	if (materialVolume) return [t("analysis.metric.volume"), `${materialVolume} ${t("analysis.units.mm3")}`];

	return [t("analysis.metric.status"), t("analysis.metric.calculated")];
}

function estimateSecondaryMetric(estimate: AnalysisEstimate, i18n: I18n): string | null {
	const { t, locale } = i18n;
	const data = estimate.data ?? {};
	const printTime = formatDuration(data.timeSeconds, i18n);
	if (printTime && formatNumber(data.weightGrams, 1, locale))
		return interpolate(t("analysis.metric.timePrefix"), { value: printTime });

	const filament = formatNumber(data.filamentLengthMeters, 2, locale);
	if (filament) return interpolate(t("analysis.metric.filamentPrefix"), { value: filament });

	const cutLength = formatNumber(data.cutLengthMm, 0, locale);
	if (cutLength) return interpolate(t("analysis.metric.cutPrefix"), { value: cutLength });

	return null;
}

function fileLeafName(name: string): string {
	return name
		.replace(/\\/g, "/")
		.split("/")
		.pop()!;
}

function fileBaseName(name: string): string {
	return fileLeafName(name)
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

function findEstimateDownloadTarget(
	estimate: AnalysisEstimate,
	sourceLabel: string | undefined,
	files: Array<[string, string]>,
	fileMetadata: Record<string, FileMetadata>,
): [string, string] | undefined {
	const sourceName =
		typeof estimate.data?.sourceName === "string"
			? estimate.data.sourceName
			: sourceLabel;
	const sourceLeaf = sourceName ? fileLeafName(sourceName).toLowerCase() : undefined;

	if (sourceLeaf) {
		const exactSource = files.find(([label, fileId]) => {
			const metadataName = fileMetadata[fileId]?.name;
			return [label, metadataName].some(
				(name) => name && fileLeafName(name).toLowerCase() === sourceLeaf,
			);
		});
		if (exactSource) {
			const [label, fileId] = exactSource;
			return [fileMetadata[fileId]?.name ?? label, fileId];
		}
	}

	if (estimate.sourceFileId) {
		const label =
			files.find(([, fileId]) => fileId === estimate.sourceFileId)?.[0] ??
			sourceLabel ??
			sourceName ??
			"source-file";
		return [fileMetadata[estimate.sourceFileId]?.name ?? label, estimate.sourceFileId];
	}

	if (sourceName) {
		const sourceBase = fileBaseName(sourceName);
		const sameBase = files.find(([label, fileId]) => {
			const metadataName = fileMetadata[fileId]?.name;
			return [label, metadataName].some(
				(name) => name && fileBaseName(name) === sourceBase,
			);
		});
		if (sameBase) {
			const [label, fileId] = sameBase;
			return [fileMetadata[fileId]?.name ?? label, fileId];
		}
	}

	return undefined;
}

function AnalysisSection({
	estimates,
	errors,
	files,
	fileMetadata,
	i18n,
	renderModelPreview,
}: {
	estimates: AnalysisEstimate[];
	errors: Array<Record<string, any>>;
	files: Array<[string, string]>;
	fileMetadata: Record<string, FileMetadata>;
	i18n: I18n;
	renderModelPreview?: ModelPreviewRenderer;
}) {
	if (estimates.length === 0 && errors.length === 0) return null;
	const { t } = i18n;
	const fileLabels = new Map(files.map(([label, id]) => [id, label]));
	const renderPreview =
		renderModelPreview ??
		(({ alt, fileId }) => <DefaultModelPreview alt={alt} fileId={fileId} />);

	return (
		<section className="request-analysis-section">
			<div className="request-analysis-head">
				<h2>{t("analysis.title")}</h2>
				<span className="request-count">
					{interpolate(t("analysis.count"), { count: estimates.length })}
				</span>
			</div>
			{estimates.length > 0 ? (
				<div className="request-estimates">
					{estimates.map((estimate, index) => {
						const rows = estimateRows(estimate, i18n);
						const primary = estimatePrimaryMetric(estimate, i18n);
						const secondary = estimateSecondaryMetric(estimate, i18n);
						const detailRows = rows.filter(([label]) => label !== primary[0]);
						const sourceLabel = estimate.sourceFileId
							? fileLabels.get(estimate.sourceFileId)
							: undefined;
						const preview = findEstimatePreview(
							estimate,
							sourceLabel,
							files,
							fileMetadata,
						);
						const downloadTarget = findEstimateDownloadTarget(
							estimate,
							sourceLabel,
							files,
							fileMetadata,
						);
						const title =
							sourceLabel ||
							(typeof estimate.data?.sourceName === "string"
								? estimate.data.sourceName
								: interpolate(t("analysis.estimateFallback"), { index: index + 1 }));
						return (
							<div
								key={`${estimate.sourceFileId ?? "estimate"}:${index}`}
								className="request-card request-estimate"
							>
								<div className="request-estimate__media">
									{preview ? (
										renderPreview({ alt: preview[0], fileId: preview[1] })
									) : (
										<div className="request-estimate__empty">
											{t("analysis.previewNotFound")}
										</div>
									)}
								</div>
								<div className="request-estimate__body">
									{detailRows.length > 0 || estimate.data?.assumptions ? (
										<details className="request-estimate__details">
											<summary className="request-estimate__summary">
												<span className="request-estimate__identity">
													<span className="request-estimate__title">{title}</span>
													<span className="request-estimate__type">
														{estimateTypeLabel(estimate, t)}
													</span>
												</span>
												<span className="request-estimate__primary">
													<span>{primary[0]}</span>
													<strong>{primary[1]}</strong>
												</span>
												<span className="request-estimate__secondary">
													{secondary ?? ""}
												</span>
												{downloadTarget ? (
													<button
														type="button"
														className="request-estimate__download"
														onClick={(event) => {
															event.preventDefault();
															event.stopPropagation();
															downloadRequested({
																fileId: downloadTarget[1],
																fileName: downloadTarget[0],
															});
														}}
													>
														{t("analysis.download")}
													</button>
												) : null}
												<span className="request-estimate__more" aria-hidden="true" />
											</summary>
											{detailRows.length > 0 ? (
												<div className="request-metric-list">
													{detailRows.map(([label, value]) => (
														<div key={label} className="request-metric-row">
															<span>{label}</span>
															<span>{value}</span>
														</div>
													))}
												</div>
											) : null}
											{estimate.data?.assumptions ? (
												<div className="request-note">
													{t("analysis.assumptionsNote")}
												</div>
											) : null}
										</details>
									) : (
										<div className="request-estimate__summary request-estimate__summary--static">
											<span className="request-estimate__identity">
												<span className="request-estimate__title">{title}</span>
												<span className="request-estimate__type">
													{estimateTypeLabel(estimate, t)}
												</span>
											</span>
											<span className="request-estimate__primary">
												<span>{primary[0]}</span>
												<strong>{primary[1]}</strong>
											</span>
											<span className="request-estimate__secondary">
												{secondary ?? ""}
											</span>
											{downloadTarget ? (
												<button
													type="button"
													className="request-estimate__download"
													onClick={() => {
														downloadRequested({
															fileId: downloadTarget[1],
															fileName: downloadTarget[0],
														});
													}}
												>
													{t("analysis.download")}
												</button>
											) : null}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			) : null}
			{errors.length > 0 ? (
				<div className="request-card request-analysis-error">
					{interpolate(t("analysis.errorsNotice"), { count: errors.length })}
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

function fileExtension(label: string, i18n: I18n): string {
	const name = label.trim();
	const dot = name.lastIndexOf(".");
	if (dot <= 0 || dot === name.length - 1) return i18n.t("detail.noExtension");
	return name.slice(dot + 1).toUpperCase();
}

function formatFileSize(bytes?: number): string | null {
	if (!Number.isFinite(bytes) || bytes === undefined) return null;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileStats(
	files: Array<[string, string]>,
	fileMetadata: Record<string, FileMetadata>,
	i18n: I18n,
): Array<[string, number]> {
	const counts = new Map<string, number>();
	for (const [label, fileId] of files) {
		const name = fileMetadata[fileId]?.name ?? label;
		const key = fileExtension(name, i18n);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return Array.from(counts.entries()).sort((left, right) => {
		if (right[1] !== left[1]) return right[1] - left[1];
		return left[0].localeCompare(right[0]);
	});
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

function RequestHero({
	model,
	i18n,
}: {
	model: RequestModel;
	i18n: I18n;
}) {
	const { t } = i18n;
	return (
		<header className="request-card request-hero">
			<div className="request-hero__main">
				<div className="request-pills">
					<span className="request-pill request-pill--status">
						{tr(t, `status.${model.status}`, model.status)}
					</span>
					<span className="request-pill">
						{interpolate(t("detail.revision"), { revision: model.revision })}
					</span>
					<span className="request-pill">
						{tr(t, `process.${model.processType}`, model.processType)}
					</span>
				</div>
				<h1 className="request-title">
					{model.title || t("detail.defaultTitle")}
				</h1>
				{model.summary ? <p className="request-summary">{model.summary}</p> : null}
			</div>
		</header>
	);
}

function RequestProgressCard({
	fileCount,
	model,
	i18n,
}: {
	fileCount: number;
	model: RequestModel;
	i18n: I18n;
}) {
	const { t } = i18n;
	return (
		<section className="request-card request-progress">
			<div className="request-progress__main">
				<strong>{model.completion.percent}%</strong>
				<span>{t("progress.byRequiredFields")}</span>
				<div className="request-progress__bar">
					<i style={{ width: `${model.completion.percent}%` }} />
				</div>
			</div>
			<div className="request-progress__meta">
				<div>
					<strong>
						{model.completion.filledRequired}/{model.completion.required}
					</strong>
					<span>{t("progress.required")}</span>
				</div>
				<div>
					<strong>
						{model.completion.filledTotal}/{model.completion.total}
					</strong>
					<span>{t("progress.total")}</span>
				</div>
				<div>
					<strong>{fileCount}</strong>
					<span>{t("progress.files")}</span>
				</div>
			</div>
		</section>
	);
}

function RequestShareCard({ url, i18n }: { url: string; i18n: I18n }) {
	return (
		<section className="request-card request-share-card">
			<RequestQr url={url} />
			<div className="request-share__link">
				<strong>{i18n.t("share.publicLink")}</strong>
				{url}
			</div>
		</section>
	);
}

function RequestFieldsSection({
	fields,
	group,
	i18n,
}: {
	fields: RequestFieldState[];
	group: string;
	i18n: I18n;
}) {
	if (fields.length === 0) return null;

	return (
		<section className="request-card request-card--fields">
			<div className="request-card__head">
				<h2>{tr(i18n.t, `groups.${group}`, group)}</h2>
				<span className="request-count">{fields.length}</span>
			</div>
			<div className="request-field-grid">
				{fields.map((field) => (
					<FieldCard key={field.key} field={field} i18n={i18n} />
				))}
			</div>
		</section>
	);
}

function RequestStatusSection({ model, i18n }: { model: RequestModel; i18n: I18n }) {
	const { t, locale } = i18n;
	return (
		<section className="request-card request-card--status">
			<div className="request-card__head">
				<h2>{t("stateSection.title")}</h2>
			</div>
			<div className="request-status-list">
				<div className="request-status-row">
					<span>{t("stateSection.id")}</span>
					<span>{model.id}</span>
				</div>
				<div className="request-status-row">
					<span>{t("stateSection.createdAt")}</span>
					<span>{formatDate(model.createdAt, locale)}</span>
				</div>
				<div className="request-status-row">
					<span>{t("stateSection.updatedAt")}</span>
					<span>{formatDate(model.updatedAt, locale)}</span>
				</div>
				<div className="request-status-row">
					<span>{t("stateSection.source")}</span>
					<span>{model.source ?? "—"}</span>
				</div>
			</div>
		</section>
	);
}

function RequestFilesSection({
	analysisCount,
	fileMetadata,
	files,
	i18n,
	renderModelPreview,
}: {
	analysisCount: number;
	fileMetadata: Record<string, FileMetadata>;
	files: Array<[string, string]>;
	i18n: I18n;
	renderModelPreview?: ModelPreviewRenderer;
}) {
	const { t } = i18n;
	const renderPreview =
		renderModelPreview ??
		(({ alt, fileId }) => <DefaultModelPreview alt={alt} fileId={fileId} />);
	const stats = fileStats(files, fileMetadata, i18n);

	return (
		<section className="request-card request-card--files">
			<div className="request-card__head">
				<h2>{t("files.title")}</h2>
				<span className="request-count">{files.length}</span>
			</div>
			{files.length > 0 ? (
				<>
					<div className="request-file-stats">
						{stats.slice(0, 5).map(([label, count]) => (
							<div key={label} className="request-file-stat">
								<strong>{count}</strong>
								<span>{label}</span>
							</div>
						))}
					</div>
					<details className="request-files-details">
						<summary>{t("files.showList")}</summary>
						<div className="request-files-list">
							<div className="request-files">
								{files.map(([label, fileId]) => {
									const metadata = fileMetadata[fileId];
									const fileName = metadata?.name ?? label;
									const fileType = metadata?.fileType;
									const size = formatFileSize(metadata?.fileSize);
									const isModel = isModelFile(label, fileType);
									const showFilePreview = isModel && analysisCount === 0;
									return (
										<div key={`${label}:${fileId}`} className="request-file">
											{showFilePreview ? (
												<div className="request-file__preview">
													{renderPreview({ alt: label, fileId })}
												</div>
											) : null}
											<div>
												<div className="request-file__name">{fileName}</div>
												<div className="request-file__meta">
													{[fileType, size].filter(Boolean).join(" · ") ||
														fileExtension(fileName, i18n)}
												</div>
											</div>
											<button
												type="button"
												className="request-file__download"
												onClick={() => {
													downloadRequested({ fileId, fileName });
												}}
											>
												{t("files.download")}
											</button>
										</div>
									);
								})}
							</div>
						</div>
					</details>
				</>
			) : (
				<p className="request-empty-text">{t("files.empty")}</p>
			)}
		</section>
	);
}

function RequestMissingSection({ model, i18n }: { model: RequestModel; i18n: I18n }) {
	if (model.missingRequired.length === 0) return null;

	return (
		<section className="request-card request-card--missing">
			<div className="request-card__head">
				<h2>{i18n.t("missing.title")}</h2>
				<span className="request-count">{model.missingRequired.length}</span>
			</div>
			<div className="request-missing">
				{model.missingRequired.map((key) => (
					<span key={key}>{model.fields[key]?.label ?? key}</span>
				))}
			</div>
		</section>
	);
}

export function ManufacturingRequestPage({
	fileMetadata: providedFileMetadata,
	model,
	renderModelPreview,
}: {
	fileMetadata?: Record<string, FileMetadata>;
	model: RequestModel;
	renderModelPreview?: ModelPreviewRenderer;
}) {
	const { t } = useMicrofrontendTranslation("requests-mf");
	const locale = useUnit($activeLocale);
	const i18n = useMemo<I18n>(() => ({ t, locale }), [t, locale]);
	const url = publicRequestUrl(model.id);
	const grouped = useMemo(() => groupFields(model), [model]);
	const analysisEstimates = useMemo(() => getAnalysisEstimates(model), [model]);
	const analysisErrors = useMemo(() => getAnalysisErrors(model), [model]);
	const baseFiles = Object.entries(model.files);
	const loadedFileMetadata = useFileMetadata(
		providedFileMetadata ? [] : baseFiles.map(([, id]) => id),
	);
	const baseFileMetadata = providedFileMetadata ?? loadedFileMetadata;
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
		<div className="request-detail">
			<div className="request-detail__wrap">
				<div className="request-bento">
					<RequestHero model={model} i18n={i18n} />
					<RequestProgressCard fileCount={files.length} model={model} i18n={i18n} />
					<RequestMissingSection model={model} i18n={i18n} />
					<RequestShareCard url={url} i18n={i18n} />
					<AnalysisSection
						estimates={analysisEstimates}
						errors={analysisErrors}
						files={files}
						fileMetadata={fileMetadata}
						i18n={i18n}
						renderModelPreview={renderModelPreview}
					/>
					{grouped.map(([group, fields]) => (
						<RequestFieldsSection
							key={group}
							fields={fields}
							group={group}
							i18n={i18n}
						/>
					))}
					<RequestFilesSection
						analysisCount={analysisEstimates.length}
						fileMetadata={fileMetadata}
						files={sortedFiles}
						i18n={i18n}
						renderModelPreview={renderModelPreview}
					/>
					<RequestStatusSection model={model} i18n={i18n} />
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
	const { t } = useMicrofrontendTranslation("requests-mf");
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
					<div className="text-lg font-semibold">{t("errors.title")}</div>
					<div className="mt-2 text-sm text-red-100">{state.error}</div>
				</div>
			</div>
		);
	}

	if (!activeModel) {
		return (
			<div className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-[#050608] p-6 text-white">
				<div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm text-slate-300">
					{state.loading ? t("errors.loading") : t("errors.notSelected")}
				</div>
			</div>
		);
	}

	return <ManufacturingRequestPage model={activeModel} />;
}
