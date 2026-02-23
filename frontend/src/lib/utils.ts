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
