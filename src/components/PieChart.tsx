"use client";

interface Slice {
  label: string;
  value: number;
  color: string;
}

export default function PieChart({ slices, title }: { slices: Slice[]; title: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const radius = 80;
  const cx = 100;
  const cy = 100;
  let cumulative = 0;

  const paths = slices.map((slice, i) => {
    const fraction = slice.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += fraction;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

    // For a full circle (single slice), draw two arcs
    if (fraction >= 1) {
      return (
        <circle key={i} cx={cx} cy={cy} r={radius} fill={slice.color} />
      );
    }

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={slice.color}
      />
    );
  });

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-36 h-36 shrink-0">
          {paths}
        </svg>
        <div className="space-y-2">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span>
                {s.label}: <span className="font-medium">{((s.value / total) * 100).toFixed(0)}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
