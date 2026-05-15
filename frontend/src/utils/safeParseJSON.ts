/**
 * Safely parses a JSON string, returning a fallback if input is null/invalid.
 * - If `data` is already an object/array, it is returned as-is (idempotent).
 * - If parsing fails, the provided `fallback` is returned (default: []).
 */
export const safeParseJSON = <T = any>(data: any, fallback: T | any[] = []): T => {
    if (data === null || data === undefined) return fallback as T;
    if (typeof data !== 'string') return data as T;
    try {
        return JSON.parse(data);
    } catch {
        return fallback as T;
    }
};

export default safeParseJSON;
