import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Reusable shimmer skeleton placeholder. Uses the .skeleton class
 * defined in index.css (handles prefers-reduced-motion).
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'lg',
}) => {
  const roundedCls = {
    sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg',
    xl: 'rounded-xl', '2xl': 'rounded-2xl', full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`skeleton ${roundedCls} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};

/* ── Composite skeletons for common patterns ── */

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white border border-slate-100 rounded-2xl p-4 space-y-3 ${className}`}>
    <div className="flex items-center gap-3">
      <Skeleton width={40} height={40} rounded="xl" />
      <div className="flex-1 space-y-2">
        <Skeleton height={12} width="60%" />
        <Skeleton height={10} width="40%" />
      </div>
    </div>
    <Skeleton height={10} width="100%" />
    <Skeleton height={10} width="80%" />
  </div>
);

export const SkeletonStatCard: React.FC = () => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
    <Skeleton width={40} height={40} rounded="xl" />
    <Skeleton height={28} width="50%" />
    <Skeleton height={10} width="70%" />
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonAnalytics: React.FC = () => (
  <div className="space-y-5">
    {/* Hero */}
    <Skeleton height={92} rounded="2xl" />
    {/* KPI grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
    {/* Sections */}
    <Skeleton height={220} rounded="2xl" />
    <Skeleton height={180} rounded="2xl" />
  </div>
);

export default Skeleton;
