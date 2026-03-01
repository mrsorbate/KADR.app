export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const API_URL = import.meta.env.VITE_API_URL || '';

export function resolveAssetUrl(assetPath?: string | null) {
  if (!assetPath) return undefined;

  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:')) {
    return assetPath;
  }

  if (API_URL) {
    return `${API_URL}${assetPath}`;
  }

  if (typeof window !== 'undefined' && assetPath.startsWith('/uploads/')) {
    const { protocol, hostname, port } = window.location;
    const isLocalFrontend = hostname === 'localhost' || hostname === '127.0.0.1';
    const isViteDevPort = port === '5173' || port === '5174';

    if (isLocalFrontend && isViteDevPort) {
      return `${protocol}//${hostname}:3000${assetPath}`;
    }
  }

  return assetPath;
}

export type NumberFieldConfig = {
  min: number;
  max?: number;
  step?: number;
};

export function clampNumber(value: number, min: number, max?: number): number {
  if (Number.isNaN(value)) return min;
  if (max === undefined) return Math.max(min, value);
  return Math.min(max, Math.max(min, value));
}

export function normalizeNumberFieldValue(value: unknown, config: NumberFieldConfig): number | null {
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const stepped = config.step && config.step > 0
    ? config.min + Math.round((parsed - config.min) / config.step) * config.step
    : parsed;

  return clampNumber(stepped, config.min, config.max);
}

export function stepNumberFieldValue(currentValue: unknown, delta: number, config: NumberFieldConfig): number {
  const normalizedCurrent = normalizeNumberFieldValue(currentValue, config);
  const fallback = config.min;
  const baseValue = normalizedCurrent === null ? fallback : normalizedCurrent;
  const next = baseValue + delta;

  if (config.step && config.step > 0) {
    const stepped = config.min + Math.round((next - config.min) / config.step) * config.step;
    return clampNumber(stepped, config.min, config.max);
  }

  return clampNumber(next, config.min, config.max);
}
