import React from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * Full-page loading fallback displayed while lazy-loaded route chunks are
 * being fetched. Uses a simple shimmer animation to communicate progress
 * and avoids layout shift by matching the overall app shell dimensions.
 */
const LoadingFallback: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 p-6">
    {/* Branded spinner */}
    <div className="relative">
      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
        <ShieldCheck size={26} className="text-white" />
      </div>
      {/* Orbiting ring */}
      <div className="absolute -inset-2.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
    </div>

    {/* Skeleton bars */}
    <div className="w-full max-w-sm space-y-3 mt-4">
      <div className="h-3 bg-slate-200 rounded-full w-3/4 mx-auto animate-pulse" />
      <div className="h-3 bg-slate-100 rounded-full w-1/2 mx-auto animate-pulse delay-75" />
    </div>
  </div>
);

export default LoadingFallback;
