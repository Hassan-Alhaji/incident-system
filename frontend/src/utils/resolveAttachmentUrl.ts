import api from './api';

/**
 * Resolves an attachment URL (relative or absolute) to a fully qualified URL
 * suitable for direct browser use (img src, anchor href, etc.).
 *
 * Handles three URL shapes:
 *   - "http(s)://..."  → returned as-is
 *   - "/api/..."       → prefixed with the API root (without /api suffix)
 *   - "/uploads/..."   → prefixed with the API root
 */
export const resolveAttachmentUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const cleanUrl = url.replace(/\\/g, '/');
  const apiBase  = api.defaults.baseURL || '';
  const rootUrl  = apiBase.replace(/\/api\/?$/, '');
  return `${rootUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
};

export default resolveAttachmentUrl;
