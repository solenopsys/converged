import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  GridPattern,
  MagicCard,
  Separator,
  ShimmerButton,
} from "front-core/components";
import { Box, Clock3, Download, QrCode, Smartphone } from "lucide-preact";

type ProcessType = "printing" | "cnc";

interface FileMeta {
  name: string;
  sizeKb: number;
  kind: "stl" | "step" | "gcode" | "glb" | "other";
}

interface PrintMetrics {
  filamentType: string;
  layerHeightMm: number;
  infillPercent: number;
  estimatedTimeMin: number;
  materialGrams: number;
  supportVolumeMm3: number;
}

interface CncMetrics {
  stockMaterial: string;
  stockSizeMm: [number, number, number];
  setups: number;
  toolChanges: number;
  machiningTimeMin: number;
  toleranceMm: number;
}

export interface PartAnalysis {
  id: string;
  name: string;
  process: ProcessType;
  quantity: number;
  thumbnailUrl?: string;
  boundingBoxMm: [number, number, number];
  volumeMm3: number;
  surfaceAreaMm2: number;
  massGrams?: number;
  files: FileMeta[];
  print?: PrintMetrics;
  cnc?: CncMetrics;
}

export interface ManufacturingRequest {
  id: string;
  createdAtISO: string;
  companyName: string;
  contactName: string;
  status: "draft" | "ready" | "sent";
  deadlineISO?: string;
  publicUrl: string;
  pwaInstallUrl: string;
  notes?: string;
}

export interface ManufacturingRequestPageProps {
  request: ManufacturingRequest;
  parts: PartAnalysis[];
}

const numberFmt = new Intl.NumberFormat("ru-RU");
const decimalFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const minutesToText = (value: number) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${h}ч ${m}м`;
};

const sizeText = ([x, y, z]: [number, number, number]) => `${x} x ${y} x ${z} мм`;

const statusText: Record<ManufacturingRequest["status"], string> = {
  draft: "Черновик",
  ready: "Готова к отправке",
  sent: "Отправлена",
};

const processText: Record<ProcessType, string> = {
  printing: "3D печать",
  cnc: "ЧПУ",
};

const MetricRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
};

const PartPreview = ({ thumbnailUrl, name }: { thumbnailUrl?: string; name: string }) => {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-200/50 via-zinc-200/40 to-emerald-200/50 dark:from-slate-900 dark:via-zinc-900 dark:to-emerald-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.7),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.2),transparent_40%)]" />
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`3D preview ${name}`}
          className="relative z-10 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Box className="size-3.5" />
            3D preview
          </div>
        </div>
      )}
    </div>
  );
};

export function ManufacturingRequestPage({ request, parts }: ManufacturingRequestPageProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let disposed = false;

    void QRCode.toDataURL(request.publicUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!disposed) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!disposed) setQrDataUrl("");
      });

    return () => {
      disposed = true;
    };
  }, [request.publicUrl]);

  const printingParts = useMemo(
    () => parts.filter((part) => part.process === "printing"),
    [parts]
  );
  const cncParts = useMemo(() => parts.filter((part) => part.process === "cnc"), [parts]);

  const totals = useMemo(() => {
    const totalQty = parts.reduce((sum, part) => sum + part.quantity, 0);
    const printMinutes = printingParts.reduce(
      (sum, part) => sum + (part.print?.estimatedTimeMin ?? 0) * part.quantity,
      0
    );
    const materialGr = printingParts.reduce(
      (sum, part) => sum + (part.print?.materialGrams ?? 0) * part.quantity,
      0
    );
    const cncMinutes = cncParts.reduce(
      (sum, part) => sum + (part.cnc?.machiningTimeMin ?? 0) * part.quantity,
      0
    );

    return {
      totalQty,
      printMinutes,
      materialGr,
      cncMinutes,
    };
  }, [parts, printingParts, cncParts]);

  const renderPartCard = (part: PartAnalysis) => {
    const fileLabel = part.files
      .map((file) => `${file.name} (${numberFmt.format(file.sizeKb)} KB)`)
      .join(", ");

    return (
      <MagicCard key={part.id} className="part-card h-full bg-card/90 p-0 backdrop-blur">
        <Card className="h-full border-0 shadow-none bg-transparent py-0">
          <CardHeader className="pt-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{part.name}</CardTitle>
                <CardDescription>ID: {part.id}</CardDescription>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <Badge variant="outline">{processText[part.process]}</Badge>
                <Badge>Qty {part.quantity}</Badge>
              </div>
            </div>
            <PartPreview thumbnailUrl={part.thumbnailUrl} name={part.name} />
          </CardHeader>
          <CardContent className="space-y-3 pb-2">
            <MetricRow label="Габариты" value={sizeText(part.boundingBoxMm)} />
            <MetricRow
              label="Объем модели"
              value={`${numberFmt.format(Math.round(part.volumeMm3))} мм3`}
            />
            <MetricRow
              label="Площадь поверхности"
              value={`${numberFmt.format(Math.round(part.surfaceAreaMm2))} мм2`}
            />
            {typeof part.massGrams === "number" ? (
              <MetricRow label="Масса" value={`${decimalFmt.format(part.massGrams)} г`} />
            ) : null}

            {part.process === "printing" && part.print ? (
              <>
                <Separator />
                <MetricRow label="Материал" value={part.print.filamentType} />
                <MetricRow label="Слой" value={`${part.print.layerHeightMm} мм`} />
                <MetricRow label="Infill" value={`${part.print.infillPercent}%`} />
                <MetricRow
                  label="Пластик"
                  value={`${decimalFmt.format(part.print.materialGrams * part.quantity)} г`}
                />
                <MetricRow
                  label="Время печати"
                  value={minutesToText(part.print.estimatedTimeMin * part.quantity)}
                />
              </>
            ) : null}

            {part.process === "cnc" && part.cnc ? (
              <>
                <Separator />
                <MetricRow label="Заготовка" value={part.cnc.stockMaterial} />
                <MetricRow label="Размер заготовки" value={sizeText(part.cnc.stockSizeMm)} />
                <MetricRow label="Наладки" value={String(part.cnc.setups)} />
                <MetricRow label="Смена инструмента" value={String(part.cnc.toolChanges)} />
                <MetricRow
                  label="Время обработки"
                  value={minutesToText(part.cnc.machiningTimeMin * part.quantity)}
                />
                <MetricRow label="Точность" value={`+/- ${part.cnc.toleranceMm} мм`} />
              </>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
            <div className="line-clamp-2">Файлы: {fileLabel}</div>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              Скачать исходники
            </Button>
          </CardFooter>
        </Card>
      </MagicCard>
    );
  };

  return (
    <div className="manufacturing-request-root relative min-h-screen overflow-x-hidden bg-[linear-gradient(130deg,#dbeafe_0%,#fef9c3_45%,#dcfce7_100%)] px-4 py-6 text-foreground sm:px-8 sm:py-8 dark:bg-[linear-gradient(130deg,#020617_0%,#111827_45%,#052e16_100%)]">
      <style>{`
        @media print {
          @page {
            margin: 10mm;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .manufacturing-request-root {
            min-height: auto !important;
            overflow: visible !important;
            background: #fff !important;
            padding: 0 !important;
          }
          .manufacturing-request-root .no-print {
            display: none !important;
          }
          .manufacturing-request-root .print-hidden {
            display: none !important;
          }
          .manufacturing-request-root .print-compact {
            box-shadow: none !important;
            backdrop-filter: none !important;
          }
          .manufacturing-request-root .section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .manufacturing-request-root h1,
          .manufacturing-request-root h2,
          .manufacturing-request-root h3 {
            break-after: avoid;
            page-break-after: avoid;
          }
          .manufacturing-request-root .table,
          .manufacturing-request-root .print-table {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .manufacturing-request-root .part-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 8mm;
          }
          .manufacturing-request-root .print-stack {
            position: static !important;
          }
        }
      `}</style>
      <GridPattern
        width={46}
        height={46}
        x={-1}
        y={-1}
        className="no-print print-hidden opacity-35 [mask-image:radial-gradient(ellipse_at_center,white_35%,transparent_80%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="section grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="print-compact border-border/70 bg-background/85 py-0 backdrop-blur-md">
            <CardHeader className="pt-5">
              <div className="space-y-3">
                <Badge variant="secondary">Прототип заявки</Badge>
                <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Заявка #{request.id}</h1>
                <CardDescription className="max-w-3xl text-sm sm:text-base">
                  Статическая ссылка для отправки подрядчикам. Карточки ниже уже содержат
                  рассчитанные параметры по загруженным STL/STEP файлам.
                </CardDescription>
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <Badge variant="outline">Компания: {request.companyName}</Badge>
                  <Badge variant="outline">Контакт: {request.contactName}</Badge>
                  <Badge variant="outline">Статус: {statusText[request.status]}</Badge>
                  <Badge variant="outline">Создано: {new Date(request.createdAtISO).toLocaleString("ru-RU")}</Badge>
                  {request.deadlineISO ? (
                    <Badge variant="outline">
                      Дедлайн: {new Date(request.deadlineISO).toLocaleDateString("ru-RU")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-5">
              <div className="print-table grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="bg-card/70 py-0">
                  <CardHeader className="pt-3 pb-1">
                    <CardDescription>Всего деталей</CardDescription>
                    <CardTitle className="text-xl">{totals.totalQty}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-card/70 py-0">
                  <CardHeader className="pt-3 pb-1">
                    <CardDescription>Пластик (итого)</CardDescription>
                    <CardTitle className="text-xl">{decimalFmt.format(totals.materialGr)} г</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-card/70 py-0">
                  <CardHeader className="pt-3 pb-1">
                    <CardDescription>Время печати</CardDescription>
                    <CardTitle className="text-xl">{minutesToText(totals.printMinutes)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-card/70 py-0">
                  <CardHeader className="pt-3 pb-1">
                    <CardDescription>Время ЧПУ</CardDescription>
                    <CardTitle className="text-xl">{minutesToText(totals.cncMinutes)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="no-print flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Открыть с телефона / установить приложение</p>
                  <p className="text-xs text-muted-foreground">
                    После установки подрядчик сможет офлайн открывать карточки и скачивать файлы для расчета.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ShimmerButton className="h-9 px-4 text-sm" background="#111827" shimmerColor="#ffffff">
                    <Smartphone className="size-4" />
                    Install PWA
                  </ShimmerButton>
                  <Button variant="outline" className="h-9 px-4 text-sm" asChild>
                    <a href={request.pwaInstallUrl} target="_blank" rel="noreferrer">
                      Открыть URL
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>

            {request.notes ? (
              <CardFooter className="border-t bg-muted/20 py-3 text-sm text-muted-foreground">{request.notes}</CardFooter>
            ) : null}
          </Card>

          <Card className="print-stack print-compact border-dashed bg-background/95 py-0 lg:sticky lg:top-4">
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4" />
                QR для печатной версии
              </CardTitle>
              <CardDescription>
                Скан откроет страницу заявки и предложит установить PWA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="mx-auto flex w-fit items-center justify-center rounded-lg border bg-white p-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Request QR" className="h-44 w-44" />
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center bg-slate-100 text-xs text-slate-500">
                    QR loading
                  </div>
                )}
              </div>
              <p className="break-all rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
                {request.publicUrl}
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="section space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold leading-tight">3D печать</h2>
            <Badge variant="outline">{printingParts.length} деталей</Badge>
          </div>
          {printingParts.length > 0 ? (
            <div className="print-table grid grid-cols-1 gap-4 lg:grid-cols-2">
              {printingParts.map(renderPartCard)}
            </div>
          ) : (
            <Card className="py-0">
              <CardContent className="py-6 text-sm text-muted-foreground">
                Деталей для 3D печати нет.
              </CardContent>
            </Card>
          )}
        </section>

        <section className="section space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold leading-tight">ЧПУ</h2>
            <Badge variant="outline">{cncParts.length} деталей</Badge>
          </div>
          {cncParts.length > 0 ? (
            <div className="print-table grid grid-cols-1 gap-4 lg:grid-cols-2">
              {cncParts.map(renderPartCard)}
            </div>
          ) : (
            <Card className="py-0">
              <CardContent className="py-6 text-sm text-muted-foreground">
                Деталей для ЧПУ нет.
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <div className="no-print print-hidden fixed bottom-4 right-4 z-20 hidden md:block">
        <Button size="sm" className="gap-2 shadow-lg" asChild>
          <a href={request.publicUrl} target="_blank" rel="noreferrer">
            <Clock3 className="size-4" />
            Shareable Link
          </a>
        </Button>
      </div>
    </div>
  );
}
