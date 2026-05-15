import React from 'react';
import { useTranslation } from 'react-i18next';

interface TimelineTabProps {
    ticket: any;
    formatDateTime: (d: string) => string;
}

const TimelineTab: React.FC<TimelineTabProps> = ({ ticket, formatDateTime }) => {
    const { t } = useTranslation();

    const getIconColor = (action: string) => {
        if (action.includes('CLOSED')) return { bg: 'bg-emerald-100', dot: 'bg-emerald-600' };
        if (action.includes('ESCALAT')) return { bg: 'bg-amber-100', dot: 'bg-amber-600' };
        if (action.includes('RETURN')) return { bg: 'bg-red-100', dot: 'bg-red-600' };
        if (action.includes('HR')) return { bg: 'bg-teal-100', dot: 'bg-teal-600' };
        if (action.includes('DEPT') || action.includes('ASSIGNED')) return { bg: 'bg-purple-100', dot: 'bg-purple-600' };
        return { bg: 'bg-blue-100', dot: 'bg-blue-600' };
    };

    return (
        <div className="bg-white border rounded-xl p-6">
            <div className="space-y-6">
                {ticket.activityLogs?.map((log: any) => {
                    const color = getIconColor(log.action);
                    return (
                        <div key={log.id} className="relative pl-6 border-l-2 border-gray-100 last:border-0 pb-6 last:pb-0">
                            <span className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${color.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                            </span>
                            <p className="text-sm font-bold text-gray-800">
                                {t(`timeline.${log.action}`, log.action.replace(/^STAGE_/, '').replace(/_/g, ' '))}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {formatDateTime(log.createdAt)} • {log.actor?.name} ({log.actor?.role})
                            </p>
                            {log.details && (
                                <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                                    {log.details}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TimelineTab;
