export const STATUS_CONFIG: Record<string, { label: string; accent: string; chip: string }> = {
  // Active backend statuses
  SUBMITTED:              { label: 'Submitted',            accent: '#3b82f6', chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  ASSIGNED:               { label: 'Assigned',             accent: '#f59e0b', chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },

  UNDER_REVIEW:           { label: 'Under Review',         accent: '#6366f1', chip: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' },
  RETURNED_TO_REPORTER:   { label: 'Returned to Reporter', accent: '#f97316', chip: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
  RETURNED_TO_DEPARTMENT: { label: 'Returned to Dept',     accent: '#f97316', chip: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
  PENDING_REMINDER:       { label: 'Pending Reminder',     accent: '#eab308', chip: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' },
  ESCALATED:              { label: 'Escalated',            accent: '#ef4444', chip: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  CLOSED:                 { label: 'Closed',               accent: '#10b981', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  CLOSED_REJECTED:        { label: 'Rejected',             accent: '#f43f5e', chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
};
