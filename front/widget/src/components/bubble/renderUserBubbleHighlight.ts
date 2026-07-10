type BubbleVariant = 'default' | 'transcript';

interface BubbleOverlayConfig {
  radius: number;
  tailSize: number;
  tailOffset: number;
  tailInset: number;
  fillOpacity: number;
}

const DEFAULT_OVERLAY_CONFIG: Record<BubbleVariant, BubbleOverlayConfig> = {
  default: {
    radius: 12,
    tailSize: 14,
    tailOffset: 0,
    tailInset: 16,
    fillOpacity: 0.12,
  },
  transcript: {
    radius: 10,
    tailSize: 12,
    tailOffset: -2,
    tailInset: 18,
    fillOpacity: 0.08,
  },
};

const FALLBACK_SPACE = 8;

export function renderUserBubbleHighlight(
  canvas: HTMLCanvasElement,
  target: HTMLElement,
  variant: BubbleVariant,
) {
  const width = target.offsetWidth;
  const height = target.offsetHeight;

  if (!width || !height) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const config = DEFAULT_OVERLAY_CONFIG[variant];
  const computedStyle = getComputedStyle(target);
  const baseSpace = parseFloat(computedStyle.getPropertyValue('--cvg-space-sm')) || FALLBACK_SPACE;

  const { radius, tailSize, tailOffset, tailInset } = config;
  const tailHalfWidth = tailSize / 2;
  const tailDepth = Math.max(0, tailSize);
  const effectiveSpace = baseSpace + tailOffset;

  const canvasWidth = width;
  const canvasHeight = height + tailDepth;

  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.top = `${-tailDepth}px`;
  canvas.style.left = '0px';

  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);

  const left = 0;
  const right = width;
  const top = tailDepth;
  const bottom = tailDepth + height;
  const maxTailCenter = right - radius - tailHalfWidth;
  const minTailCenter = left + radius + tailHalfWidth;
  const preferredTailCenter = right - tailInset - tailHalfWidth;
  const tailBaseCenter = Math.min(maxTailCenter, Math.max(minTailCenter, preferredTailCenter));
  const tailBaseLeft = tailBaseCenter - tailHalfWidth;
  const tailBaseRight = tailBaseCenter + tailHalfWidth;
  const tailTipX = tailBaseCenter;
  const tailTipY = 0;

  context.beginPath();
  context.moveTo(right - radius, top);
  context.quadraticCurveTo(right, top, right, top + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(left + radius, bottom);
  context.quadraticCurveTo(left, bottom, left, bottom - radius);
  context.lineTo(left, top + radius);
  context.quadraticCurveTo(left, top, left + radius, top);
  context.lineTo(tailBaseLeft, top);
  context.lineTo(tailTipX, tailTipY);
  context.lineTo(tailBaseRight, top);
  context.lineTo(right - radius, top);
  context.closePath();

  context.fillStyle = `rgba(255, 255, 255, ${config.fillOpacity})`;
  context.fill();
}
