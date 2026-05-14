import { useUnit } from "effector-react";
import { services } from "files-state";
import { createFilesServiceClient } from "g-files";
import type { RequestFieldState, RequestModel } from "g-requests";
import { createStoreServiceClient } from "g-store";
import { ModelViewer } from "model3d";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

declare global {
	var __REQUEST_SSR_DATA__: Record<string, RequestModel> | undefined;
}

if (typeof window !== "undefined" && !services.getFilesService()) {
	services.setFilesService(createFilesServiceClient({ baseUrl: "/services" }));
	services.setStoreService(createStoreServiceClient({ baseUrl: "/services" }));
}

import {
	$requestError,
	$requestLoading,
	$requestModel,
	requestModelReceived,
	requestRefreshRequested,
	requestRouteOpened,
} from "../request/request-store";

const groupLabels: Record<string, string> = {
	basic: "Основное",
	geometry: "Геометрия",
	quality: "Качество",
	logistics: "Сроки и доставка",
	contact: "Контакт",
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
	if (value === undefined || value === null || value === "") return "Не заполнено";
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	const text = String(value);
	return field.unit ? `${text} ${field.unit}` : text;
}

function groupFields(model: RequestModel): Array<[string, RequestFieldState[]]> {
	const groups = new Map<string, RequestFieldState[]>();
	for (const key of model.fieldOrder) {
		const field = model.fields[key];
		if (!field) continue;
		const group = field.group || "request";
		const list = groups.get(group) ?? [];
		list.push(field);
		groups.set(group, list);
	}
	return Array.from(groups.entries());
}

function RequestQr({ url }: { url: string }) {
	const [dataUrl, setDataUrl] = useState("");

	useEffect(() => {
		let active = true;
		void QRCode.toDataURL(url, {
			width: 220,
			margin: 1,
			errorCorrectionLevel: "M",
			color: { dark: "#101827", light: "#ffffff" },
		})
			.then((next) => { if (active) setDataUrl(next); })
			.catch(() => { if (active) setDataUrl(""); });
		return () => { active = false; };
	}, [url]);

	return (
		<div className="rounded-2xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/30">
			{dataUrl ? (
				<img src={dataUrl} alt="Request QR" className="h-44 w-44" />
			) : (
				<div className="flex h-44 w-44 items-center justify-center bg-slate-100 text-xs text-slate-500">
					QR
				</div>
			)}
		</div>
	);
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

function RequestPageBody({ model }: { model: RequestModel }) {
	const url = publicRequestUrl(model.id);
	const grouped = useMemo(() => groupFields(model), [model]);
	const files = Object.entries(model.files);

	return (
		<div className="min-h-screen bg-[#050608] text-white">
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
									<div className="text-2xl font-semibold">{model.completion.percent}%</div>
									<div className="mt-1 text-xs text-slate-400">заполнено по обязательным полям</div>
									<div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
										<div className="h-full rounded-full bg-emerald-300" style={{ width: `${model.completion.percent}%` }} />
									</div>
								</div>
								<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
									<div className="text-2xl font-semibold">{model.completion.filledRequired}/{model.completion.required}</div>
									<div className="mt-1 text-xs text-slate-400">обязательные параметры</div>
								</div>
								<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
									<div className="text-2xl font-semibold">{files.length}</div>
									<div className="mt-1 text-xs text-slate-400">прикрепленные файлы</div>
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
						{grouped.map(([group, fields]) => (
							<section key={group} className="rounded-3xl border border-white/10 bg-[#0b0d11] p-4 shadow-xl shadow-black/20 sm:p-5">
								<div className="mb-4 flex items-center justify-between gap-3">
									<h2 className="text-lg font-semibold text-white">{groupLabels[group] ?? group}</h2>
									<span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
										{fields.filter((f) => f.status !== "missing").length}/{fields.length}
									</span>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{fields.map((field) => <FieldCard key={field.key} field={field} />)}
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
									<span className="max-w-44 truncate text-right text-slate-100">{model.id}</span>
								</div>
								<div className="flex justify-between gap-3 border-b border-white/10 pb-3">
									<span className="text-slate-400">Создана</span>
									<span className="text-right text-slate-100">{formatDate(model.createdAt)}</span>
								</div>
								<div className="flex justify-between gap-3 border-b border-white/10 pb-3">
									<span className="text-slate-400">Обновлена</span>
									<span className="text-right text-slate-100">{formatDate(model.updatedAt)}</span>
								</div>
								<div className="flex justify-between gap-3">
									<span className="text-slate-400">Источник</span>
									<span className="text-right text-slate-100">{model.source ?? "—"}</span>
								</div>
							</div>
						</section>

						<section className="rounded-3xl border border-white/10 bg-[#0b0d11] p-5 shadow-xl shadow-black/20">
							<h2 className="text-lg font-semibold text-white">Файлы</h2>
							{files.length > 0 ? (
								<div className="mt-4 space-y-3">
									{files.map(([label, fileId]) => {
										const isModel = /\.(glb|gltf)$/i.test(label);
										return (
											<div key={`${label}:${fileId}`} className="rounded-xl border border-white/10 bg-white/[0.045] overflow-hidden">
												{isModel ? <ModelViewer fileId={fileId} alt={label} style={{ height: 280 }} /> : null}
												<div className="p-3">
													<div className="text-sm font-medium text-white">{label}</div>
													<div className="mt-1 break-all text-xs text-slate-400">{fileId}</div>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="mt-3 text-sm leading-6 text-slate-400">Файлы пока не прикреплены.</p>
							)}
						</section>

						{model.missingRequired.length > 0 ? (
							<section className="rounded-3xl border border-amber-300/30 bg-amber-300/8 p-5">
								<h2 className="text-lg font-semibold text-amber-100">Нужно уточнить</h2>
								<div className="mt-3 flex flex-wrap gap-2">
									{model.missingRequired.map((key) => (
										<span key={key} className="rounded-full border border-amber-200/30 px-2.5 py-1 text-xs text-amber-100">
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
	);
}

export function RequestPage() {
	const { requestId } = useParams<{ requestId: string }>();
	const { model, loading, error } = useUnit({
		model: $requestModel,
		loading: $requestLoading,
		error: $requestError,
	});

	// Модель из history.state (передаётся при SPA-навигации) или из SSR-данных
	const stateModel: RequestModel | null =
		typeof window !== "undefined" && window.history.state?.model?.id === requestId
			? window.history.state.model
			: requestId && globalThis.__REQUEST_SSR_DATA__?.[requestId]
				? globalThis.__REQUEST_SSR_DATA__[requestId]
				: null;

	const activeModel = model?.id === requestId ? model : stateModel;

	useEffect(() => {
		if (!requestId) return;
		// Сразу заливаем модель из state в стор, не ждём сетевого запроса
		if (stateModel?.id === requestId) {
			requestModelReceived(stateModel);
		}
		requestRouteOpened({ requestId });
		const timer = window.setInterval(() => { requestRefreshRequested(); }, 2500);
		return () => window.clearInterval(timer);
	}, [requestId, stateModel]);

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#050608] p-6 text-white">
				<div className="max-w-lg rounded-3xl border border-red-300/30 bg-red-400/10 p-6">
					<div className="text-lg font-semibold">Заявка не открылась</div>
					<div className="mt-2 text-sm text-red-100">{error}</div>
				</div>
			</div>
		);
	}

	if (!activeModel) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#050608] p-6 text-white">
				<div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm text-slate-300">
					{loading ? "Загрузка заявки..." : "Заявка не выбрана"}
				</div>
			</div>
		);
	}

	return <RequestPageBody model={activeModel} />;
}
