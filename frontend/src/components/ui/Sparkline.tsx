import * as React from "react";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  strokeWidth?: number;
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "var(--color-accent)",
  fill,
  strokeWidth = 1.2,
  className,
}: Props) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const lastX = (data.length - 1) * step;
  const lastY = height - ((last - min) / span) * height;

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="trend"
      preserveAspectRatio="none"
    >
      {fill ? (
        <polygon points={areaPoints} fill={fill} opacity={0.18} />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.6} fill={stroke} />
    </svg>
  );
}
