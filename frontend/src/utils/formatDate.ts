/**
 * Date/Time formatting utilities
 * Always uses 'en-US' locale to ensure Western Arabic numerals (0-9)
 * regardless of the app language setting.
 */

/** Format a date string or Date object to a localized date string (always English numerals) */
export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US');
}

/** Format a date string or Date object to a full date+time string (always English numerals) */
export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-US');
}

/** Format a date string or Date object to time only (always English numerals) */
export function formatTime(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Format a date for display in a short format like "Apr 13, 2026" */
export function formatDateShort(value: string | Date | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
