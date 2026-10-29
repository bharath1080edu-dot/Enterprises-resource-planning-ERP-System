import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, iconBg = 'bg-navy-100', iconColor = 'text-navy-800', trend, trendLabel, prefix = '', suffix = '', format = false }) => {
  const formattedValue = format && typeof value === 'number'
    ? `${prefix}${value.toLocaleString('en-IN')}${suffix}`
    : `${prefix}${value ?? '—'}${suffix}`;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="card-hover group">
      <div className="flex items-start justify-between mb-3">
        <div className={`stat-icon ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={22} className={iconColor} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={12} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-navy-800 leading-tight">{formattedValue}</p>
        <p className="text-sm text-slate-500 mt-0.5">{title}</p>
        {trendLabel && <p className="text-xs text-slate-400 mt-1">{trendLabel}</p>}
      </div>
    </div>
  );
};

export default StatCard;
