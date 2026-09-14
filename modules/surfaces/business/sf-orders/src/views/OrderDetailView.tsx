import { useUnit } from "effector-preact";
import { downloadRequested } from "files-state";
import { Button, Download, useSurfaceTranslation } from "front-core";
import { objectRef, presentReference } from "front-core/object-runtime";
import { useEffect } from "preact/compat";
import { methodLabel, SURFACE_ID } from "../config";
import { $orderCard, type AttachedFile, orderOpened } from "../domain-orders";

// One job, opened as a subtab inside the Orders area.
//
// Deliberately a readout and not a form: every field on it is changed by an
// operation — status, machine, the rest through `orders.order.save` — so there is
// one path that writes an order and the card is not a second one.

type Translate = (key: string) => unknown;

const text = (t: Translate, key: string): string => String(t(key));

function formatDate(value: string | undefined, dash: string): string {
	if (!value) return dash;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatWeight(grams: number | undefined, dash: string): string {
	if (!grams || grams <= 0) return dash;
	return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
}

function formatSize(bytes: number | undefined, dash: string): string {
	if (!bytes || bytes <= 0) return dash;
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let size = bytes / 1024;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit += 1;
	}
	return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/**
 * One drawing the job is made from.
 *
 * The name is the customer's, the size is `rp-files`'. Opening it hands the whole
 * file to whichever surface owns `files.file` — `presentReference` loads that
 * surface if it has not been opened yet, so this card does not import it and does
 * not need to know it exists.
 */
function AttachedFileRow({
	file,
	dash,
	openLabel,
	downloadLabel,
}: {
	file: AttachedFile;
	dash: string;
	openLabel: string;
	downloadLabel: string;
}) {
	const missing = !file.metadata;
	return (
		<div class="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
			<button
				type="button"
				class="min-w-0 flex-1 truncate text-left text-sm hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
				title={missing ? dash : openLabel}
				disabled={missing}
				onClick={() => {
					void presentReference(
						objectRef("files.file", file.fileId, { title: file.label }),
					);
				}}
			>
				{file.label}
			</button>
			<span class="shrink-0 text-xs text-muted-foreground">
				{missing ? dash : formatSize(file.metadata?.fileSize, dash)}
			</span>
			<Button
				type="button"
				size="icon"
				variant="ghost"
				class="h-7 w-7 shrink-0"
				title={downloadLabel}
				disabled={missing || file.metadata?.status !== "uploaded"}
				onClick={() =>
					downloadRequested({ fileId: file.fileId, fileName: file.label })
				}
			>
				<Download className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span class="text-sm">{value}</span>
		</div>
	);
}

export function OrderDetailView({ orderId }: { orderId?: string }) {
	const card = useUnit($orderCard);
	const { t } = useSurfaceTranslation(SURFACE_ID);
	const dash = text(t, "detail.empty");

	useEffect(() => {
		if (orderId) orderOpened({ orderId });
	}, [orderId]);

	const order = card.order;
	if (!order) {
		return (
			<div class="p-4 text-sm text-muted-foreground">
				{card.loading
					? text(t, "detail.loading")
					: (card.error ?? text(t, "detail.notFound"))}
			</div>
		);
	}

	return (
		<div class="flex flex-col gap-4 p-4">
			<header class="flex items-start justify-between gap-3">
				<div class="flex flex-col gap-1">
					<h1 class="text-lg font-semibold">{order.modelName}</h1>
					<span class="text-sm text-muted-foreground">
						{methodLabel(order.productionMethod)} · {order.quantity}&nbsp;×
					</span>
				</div>
				<span class="shrink-0 rounded px-2 py-0.5 text-xs font-medium">
					{text(t, `status.${order.status}`)}
				</span>
			</header>

			<section class="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field
					label={text(t, "columns.material")}
					value={order.material ?? dash}
				/>
				<Field
					label={text(t, "columns.weight")}
					value={formatWeight(order.weightGrams, dash)}
				/>
				<Field
					label={text(t, "columns.due")}
					value={formatDate(order.dueAt, dash)}
				/>
				<Field
					label={text(t, "columns.machine")}
					value={order.equipmentId ?? text(t, "detail.unassigned")}
				/>
			</section>

			{/* Where the job came from. This is the link wf-request-to-order writes
			    and nothing else can, so showing it is how the conversion is
			    verifiable from the screen. */}
			<section class="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
				<Field
					label={text(t, "columns.request")}
					value={order.requestId ?? text(t, "detail.noRequest")}
				/>
				<Field
					label={text(t, "detail.customer")}
					value={order.customerName ?? order.customerEmail ?? dash}
				/>
				<Field
					label={text(t, "detail.created")}
					value={formatDate(order.createdAt, dash)}
				/>
				<Field
					label={text(t, "columns.updated")}
					value={formatDate(order.updatedAt, dash)}
				/>
			</section>

			{/* The files the job is made from. They hang off the request, not the
			    order, which is exactly why the conversion had to record `requestId`. */}
			{order.requestId ? (
				<section class="flex flex-col gap-2">
					<h2 class="text-sm font-semibold">{text(t, "detail.files")}</h2>
					{card.filesLoading ? (
						<p class="text-sm text-muted-foreground">
							{text(t, "detail.loading")}
						</p>
					) : card.files.length === 0 ? (
						<p class="text-sm text-muted-foreground">
							{text(t, "detail.noFiles")}
						</p>
					) : (
						<div class="rounded-lg border border-border bg-card px-3 py-1">
							{card.files.map((file) => (
								<AttachedFileRow
									key={file.fileId}
									file={file}
									dash={dash}
									openLabel={text(t, "detail.openFile")}
									downloadLabel={text(t, "detail.downloadFile")}
								/>
							))}
						</div>
					)}
				</section>
			) : null}

			{order.notes ? (
				<section class="flex flex-col gap-2">
					<h2 class="text-sm font-semibold">{text(t, "detail.notes")}</h2>
					<p class="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm">
						{order.notes}
					</p>
				</section>
			) : null}
		</div>
	);
}
