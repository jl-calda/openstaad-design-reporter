"use client";

interface Stat {
  label: string;
  value: string | number;
  icon: string;
}

interface Props {
  stats: Stat[];
}

export function StatsBar({ stats }: Props) {
  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{stat.icon}</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
