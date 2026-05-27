import { useUnit } from "effector-react";
import { downloadRequested, services } from "files-state";
import { createFilesServiceClient, type FileMetadata } from "g-files";
import type { RequestFieldState, RequestModel } from "g-requests";
import { createStoreServiceClient } from "g-store";
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

const requestDetailCss = `
.request-detail {
	min-height: 100%;
	background: #050607;
	color: #f7f7f5;
	overflow: auto;
}

.request-detail__wrap {
	width: 100%;
	padding: 12px;
}

.request-bento {
	display: grid;
	grid-template-columns: repeat(12, minmax(0, 1fr));
	grid-auto-flow: dense;
	gap: 10px;
	align-items: stretch;
}

.request-card {
	grid-column: span 4;
	box-sizing: border-box;
	min-width: 0;
	min-height: 0;
	height: 100%;
	padding: 14px;
	border-radius: 12px;
	background: #0b0c0d;
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
}

.request-hero {
	grid-column: span 8;
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-height: 154px;
	padding: 18px 20px;
	background: #0b0c0d;
}

.request-hero__main {
	min-width: 0;
}

.request-pills {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-bottom: 12px;
}

.request-pill {
	display: inline-flex;
	align-items: center;
	min-height: 22px;
	padding: 0 9px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.055);
	color: #aeb4bd;
	font-size: 11px;
	font-weight: 650;
}

.request-pill--status {
	background: rgba(255, 255, 255, 0.095);
	color: #f1f1ee;
}

.request-title {
	margin: 0;
	max-width: 980px;
	color: #fff;
	font-size: clamp(30px, 3.2vw, 44px);
	font-weight: 760;
	letter-spacing: 0;
	line-height: 1.02;
}

.request-summary {
	margin: 9px 0 0;
	max-width: 860px;
	color: #a9b0bb;
	font-size: 14px;
	line-height: 1.35;
}

.request-progress {
	grid-column: span 4;
	display: grid;
	gap: 14px;
	min-height: 154px;
}

.request-progress__main strong {
	display: block;
	color: #fff;
	font-size: 44px;
	font-weight: 790;
	letter-spacing: 0;
	line-height: 0.95;
}

.request-progress__main span {
	display: block;
	margin-top: 7px;
	color: #8d97a8;
	font-size: 12px;
	font-weight: 620;
	line-height: 1.35;
}

.request-progress__bar {
	height: 4px;
	margin-top: 12px;
	overflow: hidden;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.09);
}

.request-progress__bar i {
	display: block;
	height: 100%;
	border-radius: inherit;
	background: #f2f2ef;
}

.request-progress__meta {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0;
	margin-top: 0;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	padding-top: 12px;
}

.request-progress__meta strong {
	display: block;
	color: #fff;
	font-size: 17px;
	font-weight: 760;
	line-height: 1;
}

.request-progress__meta span {
	display: block;
	margin-top: 5px;
	color: #7f8da0;
	font-size: 11px;
	font-weight: 600;
	line-height: 1.25;
}

.request-share-card {
	grid-column: span 4;
	display: grid;
	grid-template-columns: 112px minmax(0, 1fr);
	gap: 12px;
	align-items: center;
}

.request-share__link {
	width: 100%;
	color: #8995a7;
	font-size: 12px;
	line-height: 1.5;
	overflow-wrap: anywhere;
}

.request-share__link strong {
	display: block;
	margin-bottom: 5px;
	color: #e8ebe8;
	font-size: 13px;
}

.request-card--wide {
	grid-column: span 8;
}

.request-card--full {
	grid-column: 1 / -1;
}

.request-card--missing {
	grid-column: span 4;
	background: #0d0e0f;
}

.request-card__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 12px;
}

.request-card__head h2 {
	margin: 0;
	color: #f3f4f2;
	font-size: 15px;
	font-weight: 720;
	line-height: 1.15;
}

.request-count {
	display: inline-flex;
	align-items: center;
	min-height: 22px;
	padding: 0 8px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.055);
	color: #8f9aad;
	font-size: 11px;
	font-weight: 650;
}

.request-card--fields {
	grid-column: span 4;
}

.request-field-grid {
	display: grid;
	grid-template-columns: 1fr;
}

.request-field {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 10px;
	align-items: start;
	min-height: 38px;
	padding: 9px 0;
	border-top: 1px solid rgba(255, 255, 255, 0.075);
}

.request-field[data-state="missing"] {
	color: #d8d8d4;
}

.request-field__label {
	min-width: 0;
	color: #e4e6e3;
	font-size: 12px;
	font-weight: 690;
	line-height: 1.25;
}

.request-field__description {
	margin-top: 4px;
	color: #778395;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.35;
}

.request-field__value {
	min-width: 0;
	color: #cdd2d8;
	font-size: 12px;
	line-height: 1.35;
	overflow-wrap: anywhere;
	text-align: right;
}

.request-field[data-state="missing"] .request-field__value {
	color: #aeb4bd;
}

.request-analysis-section {
	align-self: start;
	grid-column: 1 / -1;
	display: grid;
	gap: 14px;
	min-width: 0;
}

.request-analysis-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	padding: 2px 2px 0;
}

.request-analysis-head h2 {
	margin: 0;
	color: #f4f4f1;
	font-size: 22px;
	font-weight: 760;
	line-height: 1.1;
}

.request-estimates {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(340px, 380px));
	grid-auto-flow: dense;
	gap: 14px;
	align-items: start;
	justify-content: start;
}

.request-estimate {
	grid-column: auto;
	align-self: start;
	display: flex;
	flex-direction: column;
	padding: 0;
	min-height: 258px;
	overflow: hidden;
}

.request-estimate__media {
	height: 188px;
	min-height: 188px;
	background: radial-gradient(circle at center, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.32) 68%);
	overflow: hidden;
}

.request-estimate__media > * {
	width: 100%;
	height: 100%;
}

.request-estimate__empty {
	display: grid;
	place-items: center;
	height: 100%;
	padding: 18px;
	color: #687386;
	font-size: 13px;
	text-align: center;
}

.request-estimate__body {
	display: block;
	flex: 1;
	min-width: 0;
	padding: 0;
}

.request-estimate__details {
	margin: 0;
}

.request-estimate__summary {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto auto 24px;
	gap: 10px;
	align-items: center;
	min-height: 70px;
	padding: 12px 14px 12px 16px;
	cursor: pointer;
	list-style: none;
}

.request-estimate__summary--static {
	cursor: default;
	grid-template-columns: minmax(0, 1fr) auto auto auto;
}

.request-estimate__summary::-webkit-details-marker {
	display: none;
}

.request-estimate__identity {
	display: flex;
	align-items: center;
	gap: 9px;
	min-width: 0;
}

.request-estimate__title {
	min-width: 0;
	color: #f3f4f2;
	font-size: 16px;
	font-weight: 760;
	line-height: 1.1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.request-estimate__type {
	flex: 0 0 auto;
	min-height: 22px;
	padding: 4px 8px 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.07);
	color: #9aa4b2;
	font-size: 11px;
	font-weight: 650;
}

.request-estimate__primary {
	display: flex;
	align-items: baseline;
	gap: 8px;
	white-space: nowrap;
}

.request-estimate__primary span {
	color: #8793a5;
	font-size: 12px;
	font-weight: 650;
	line-height: 1.2;
}

.request-estimate__primary strong {
	color: #f4f4f1;
	font-size: 24px;
	font-weight: 790;
	letter-spacing: -0.02em;
	line-height: 1;
	text-align: right;
	white-space: nowrap;
}

.request-estimate__secondary {
	color: #858f9f;
	font-size: 12px;
	font-weight: 690;
	line-height: 1;
	white-space: nowrap;
}

.request-estimate__download {
	min-height: 28px;
	padding: 0 10px;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.09);
	color: #f4f4f1;
	cursor: pointer;
	font-size: 11px;
	font-weight: 740;
	line-height: 1;
	white-space: nowrap;
}

.request-estimate__download:hover {
	background: rgba(255, 255, 255, 0.14);
}

.request-estimate__more {
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.07);
	color: #f1f1ee;
	font-size: 15px;
	font-weight: 720;
}

.request-estimate__more::before {
	content: "+";
}

.request-estimate__details[open] .request-estimate__summary {
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.request-estimate__details[open] .request-estimate__more::before {
	content: "−";
}

.request-metric-list {
	display: grid;
	gap: 0;
	margin: 0;
	padding: 6px 16px 12px;
}

.request-metric-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 14px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	font-size: 13px;
	line-height: 1.25;
}

.request-metric-row span:first-child {
	color: #8090a4;
}

.request-metric-row span:last-child {
	color: #d8dce0;
	text-align: right;
	overflow-wrap: anywhere;
}

.request-note {
	margin: 0 16px 16px;
	padding: 10px 12px;
	border-radius: 9px;
	background: rgba(255, 255, 255, 0.06);
	color: #b7bec8;
	font-size: 12px;
	line-height: 1.4;
}

.request-analysis-error {
	padding: 14px 16px;
	color: #d5d8dc;
	font-size: 13px;
	line-height: 1.4;
}

.request-status-list {
	display: grid;
	gap: 0;
	font-size: 12px;
}

.request-card--status {
	grid-column: span 3;
}

.request-status-row {
	display: grid;
	grid-template-columns: 92px minmax(0, 1fr);
	gap: 10px;
	padding-top: 9px;
	border-top: 1px solid rgba(255, 255, 255, 0.075);
}

.request-status-row span:first-child {
	color: #8793a6;
}

.request-status-row span:last-child {
	color: #e5e7e4;
	text-align: right;
	overflow-wrap: anywhere;
}

.request-files {
	display: grid;
	gap: 0;
}

.request-card--files {
	grid-column: span 5;
}

.request-file-stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
	gap: 8px;
}

.request-file-stat {
	min-width: 0;
	padding: 9px 10px;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.045);
}

.request-file-stat strong {
	display: block;
	color: #f4f4f1;
	font-size: 18px;
	font-weight: 760;
	line-height: 1;
}

.request-file-stat span {
	display: block;
	margin-top: 5px;
	color: #838d9f;
	font-size: 11px;
	font-weight: 650;
	line-height: 1.2;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.request-files-details {
	margin-top: 12px;
}

.request-files-details > summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 34px;
	cursor: pointer;
	list-style: none;
	color: #d9dcd9;
	font-size: 12px;
	font-weight: 700;
}

.request-files-details > summary::-webkit-details-marker {
	display: none;
}

.request-files-details > summary::after {
	content: "+";
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.07);
	color: #f1f1ee;
}

.request-files-details[open] > summary::after {
	content: "−";
}

.request-files-list {
	max-height: 390px;
	overflow: auto;
	border-top: 1px solid rgba(255, 255, 255, 0.075);
}

.request-file {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 7px;
	align-items: center;
	padding: 9px 0;
	border-top: 1px solid rgba(255, 255, 255, 0.075);
}

.request-file:first-child {
	border-top: 0;
}

.request-file__name {
	color: #f1f2ef;
	font-size: 13px;
	font-weight: 660;
	overflow-wrap: anywhere;
}

.request-file__meta {
	margin-top: 3px;
	color: #778395;
	font-size: 11px;
	font-weight: 620;
}

.request-file__download {
	min-height: 28px;
	padding: 0 10px;
	border: 0;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.085);
	color: #f4f4f1;
	cursor: pointer;
	font-size: 11px;
	font-weight: 720;
}

.request-file__download:hover {
	background: rgba(255, 255, 255, 0.14);
}

.request-file__preview {
	grid-column: 1 / -1;
	height: 128px;
	overflow: hidden;
	border-radius: 8px;
	background: rgba(0, 0, 0, 0.22);
}

.request-empty-text {
	margin: 10px 0 0;
	color: #8b96a8;
	font-size: 14px;
	line-height: 1.45;
}

.request-missing {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 6px;
}

.request-missing span {
	padding: 8px 9px;
	border-radius: 7px;
	background: rgba(255, 255, 255, 0.065);
	color: #d7dad8;
	font-size: 12px;
	font-weight: 650;
}

@media (max-width: 1180px) {
	.request-bento {
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}

	.request-card,
	.request-progress,
	.request-card--missing,
	.request-share-card,
	.request-card--fields,
	.request-card--files,
	.request-card--status {
		grid-column: span 3;
	}

	.request-hero,
	.request-card--wide,
	.request-card--full,
	.request-analysis-section {
		grid-column: 1 / -1;
	}

	.request-progress {
		min-height: auto;
	}
}

@media (max-width: 780px) {
	.request-detail__wrap {
		padding: 12px;
	}

	.request-hero,
	.request-bento {
		grid-template-columns: 1fr;
	}

	.request-card,
	.request-progress,
	.request-card--missing,
	.request-share-card,
	.request-card--fields,
	.request-card--files,
	.request-card--status,
	.request-hero,
	.request-card--wide,
	.request-card--full,
	.request-analysis-section {
		grid-column: 1 / -1;
	}

	.request-share-card {
		grid-template-columns: 1fr;
	}

	.request-progress__meta,
	.request-field-grid {
		grid-template-columns: 1fr;
	}

	.request-title {
		font-size: 34px;
	}

	.request-estimates {
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	}

	.request-estimate__media {
		height: 190px;
		min-height: 190px;
	}

	.request-field,
	.request-status-row {
		grid-template-columns: 1fr;
		gap: 6px;
	}

	.request-metric-row {
		align-items: flex-start;
		flex-direction: column;
		gap: 4px;
	}

	.request-status-row span:last-child,
	.request-metric-row span:last-child {
		text-align: left;
	}
}
`;

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

function FieldCard({ field }: { field: RequestFieldState }) {
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
			<div className="request-field__value">{formatValue(field)}</div>
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
		rows.push(["Вес", formatNumber(data.weightGrams, 1)?.concat(" г") ?? null]);
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

function estimateTypeLabel(estimate: AnalysisEstimate): string {
	if (estimate.type === "printing") return "3D печать";
	if (estimate.type === "gcode") return "G-code";
	if (estimate.type === "milling") return "ЧПУ";
	return estimate.type ?? "Расчет";
}

function estimatePrimaryMetric(estimate: AnalysisEstimate): [string, string] {
	const data = estimate.data ?? {};
	const weight = formatNumber(data.weightGrams, 1);
	if (weight) return ["Вес", `${weight} г`];

	const printTime = formatDuration(data.timeSeconds);
	if (printTime) return ["Время печати", printTime];

	const millTime = formatDuration(data.totalTimeSec);
	if (millTime) return ["Время обработки", millTime];

	const materialVolume = formatNumber(data.materialVolumeMm3, 0);
	if (materialVolume) return ["Объем", `${materialVolume} мм³`];

	return ["Статус", "рассчитано"];
}

function estimateSecondaryMetric(estimate: AnalysisEstimate): string | null {
	const data = estimate.data ?? {};
	const printTime = formatDuration(data.timeSeconds);
	if (printTime && formatNumber(data.weightGrams, 1)) return `Время: ${printTime}`;

	const filament = formatNumber(data.filamentLengthMeters, 2);
	if (filament) return `Филамент: ${filament} м`;

	const cutLength = formatNumber(data.cutLengthMm, 0);
	if (cutLength) return `Рез: ${cutLength} мм`;

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
	renderModelPreview,
}: {
	estimates: AnalysisEstimate[];
	errors: Array<Record<string, any>>;
	files: Array<[string, string]>;
	fileMetadata: Record<string, FileMetadata>;
	renderModelPreview?: ModelPreviewRenderer;
}) {
	if (estimates.length === 0 && errors.length === 0) return null;
	const fileLabels = new Map(files.map(([label, id]) => [id, label]));
	const renderPreview =
		renderModelPreview ??
		(({ alt, fileId }) => <DefaultModelPreview alt={alt} fileId={fileId} />);

	return (
		<section className="request-analysis-section">
			<div className="request-analysis-head">
				<h2>Аналитика</h2>
				<span className="request-count">{estimates.length} расчетов</span>
			</div>
			{estimates.length > 0 ? (
				<div className="request-estimates">
					{estimates.map((estimate, index) => {
						const rows = estimateRows(estimate);
						const primary = estimatePrimaryMetric(estimate);
						const secondary = estimateSecondaryMetric(estimate);
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
								: `Расчет ${index + 1}`);
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
											Preview модели не найден
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
														{estimateTypeLabel(estimate)}
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
														Скачать
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
													Грубая оценка по геометрии STL. Для точного времени нужен
													Cura definition.
												</div>
											) : null}
										</details>
									) : (
										<div className="request-estimate__summary request-estimate__summary--static">
											<span className="request-estimate__identity">
												<span className="request-estimate__title">{title}</span>
												<span className="request-estimate__type">
													{estimateTypeLabel(estimate)}
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
													Скачать
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

function fileExtension(label: string): string {
	const name = label.trim();
	const dot = name.lastIndexOf(".");
	if (dot <= 0 || dot === name.length - 1) return "без расширения";
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
): Array<[string, number]> {
	const counts = new Map<string, number>();
	for (const [label, fileId] of files) {
		const name = fileMetadata[fileId]?.name ?? label;
		const key = fileExtension(name);
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
}: {
	model: RequestModel;
}) {
	return (
		<header className="request-card request-hero">
			<div className="request-hero__main">
				<div className="request-pills">
					<span className="request-pill request-pill--status">
						{statusLabels[model.status] ?? model.status}
					</span>
					<span className="request-pill">Версия {model.revision}</span>
					<span className="request-pill">
						{processLabels[model.processType] ?? model.processType}
					</span>
				</div>
				<h1 className="request-title">
					{model.title || "Производственная заявка"}
				</h1>
				{model.summary ? <p className="request-summary">{model.summary}</p> : null}
			</div>
		</header>
	);
}

function RequestProgressCard({
	fileCount,
	model,
}: {
	fileCount: number;
	model: RequestModel;
}) {
	return (
		<section className="request-card request-progress">
			<div className="request-progress__main">
				<strong>{model.completion.percent}%</strong>
				<span>заполнено по обязательным полям</span>
				<div className="request-progress__bar">
					<i style={{ width: `${model.completion.percent}%` }} />
				</div>
			</div>
			<div className="request-progress__meta">
				<div>
					<strong>
						{model.completion.filledRequired}/{model.completion.required}
					</strong>
					<span>обязательные</span>
				</div>
				<div>
					<strong>
						{model.completion.filledTotal}/{model.completion.total}
					</strong>
					<span>всего полей</span>
				</div>
				<div>
					<strong>{fileCount}</strong>
					<span>файлы</span>
				</div>
			</div>
		</section>
	);
}

function RequestShareCard({ url }: { url: string }) {
	return (
		<section className="request-card request-share-card">
			<RequestQr url={url} />
			<div className="request-share__link">
				<strong>Публичная ссылка</strong>
				{url}
			</div>
		</section>
	);
}

function RequestFieldsSection({
	fields,
	group,
}: {
	fields: RequestFieldState[];
	group: string;
}) {
	if (fields.length === 0) return null;

	return (
		<section className="request-card request-card--fields">
			<div className="request-card__head">
				<h2>{groupLabels[group] ?? group}</h2>
				<span className="request-count">{fields.length}</span>
			</div>
			<div className="request-field-grid">
				{fields.map((field) => (
					<FieldCard key={field.key} field={field} />
				))}
			</div>
		</section>
	);
}

function RequestStatusSection({ model }: { model: RequestModel }) {
	return (
		<section className="request-card request-card--status">
			<div className="request-card__head">
				<h2>Состояние</h2>
			</div>
			<div className="request-status-list">
				<div className="request-status-row">
					<span>ID</span>
					<span>{model.id}</span>
				</div>
				<div className="request-status-row">
					<span>Создана</span>
					<span>{formatDate(model.createdAt)}</span>
				</div>
				<div className="request-status-row">
					<span>Обновлена</span>
					<span>{formatDate(model.updatedAt)}</span>
				</div>
				<div className="request-status-row">
					<span>Источник</span>
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
	renderModelPreview,
}: {
	analysisCount: number;
	fileMetadata: Record<string, FileMetadata>;
	files: Array<[string, string]>;
	renderModelPreview?: ModelPreviewRenderer;
}) {
	const renderPreview =
		renderModelPreview ??
		(({ alt, fileId }) => <DefaultModelPreview alt={alt} fileId={fileId} />);
	const stats = fileStats(files, fileMetadata);

	return (
		<section className="request-card request-card--files">
			<div className="request-card__head">
				<h2>Файлы</h2>
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
						<summary>Показать список и скачать</summary>
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
														fileExtension(fileName)}
												</div>
											</div>
											<button
												type="button"
												className="request-file__download"
												onClick={() => {
													downloadRequested({ fileId, fileName });
												}}
											>
												Скачать
											</button>
										</div>
									);
								})}
							</div>
						</div>
					</details>
				</>
			) : (
				<p className="request-empty-text">Файлы пока не прикреплены.</p>
			)}
		</section>
	);
}

function RequestMissingSection({ model }: { model: RequestModel }) {
	if (model.missingRequired.length === 0) return null;

	return (
		<section className="request-card request-card--missing">
			<div className="request-card__head">
				<h2>Нужно уточнить</h2>
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
			<style>{requestDetailCss}</style>
			<div className="request-detail__wrap">
				<div className="request-bento">
					<RequestHero model={model} />
					<RequestProgressCard fileCount={files.length} model={model} />
					<RequestMissingSection model={model} />
					<RequestShareCard url={url} />
					<AnalysisSection
						estimates={analysisEstimates}
						errors={analysisErrors}
						files={files}
						fileMetadata={fileMetadata}
						renderModelPreview={renderModelPreview}
					/>
					{grouped.map(([group, fields]) => (
						<RequestFieldsSection
							key={group}
							fields={fields}
							group={group}
						/>
					))}
					<RequestFilesSection
						analysisCount={analysisEstimates.length}
						fileMetadata={fileMetadata}
						files={sortedFiles}
						renderModelPreview={renderModelPreview}
					/>
					<RequestStatusSection model={model} />
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

	return <ManufacturingRequestPage model={activeModel} />;
}
