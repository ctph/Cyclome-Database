import React, { useMemo, useState } from "react";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function MeltingTempHistogram({
  allTemps = [],
  thisTemp = null,
}) {
  const [hovered, setHovered] = useState(null);

  const hasData = allTemps.length > 0 && thisTemp != null;

  // layout
  const W_SVG = 380;
  const H_SVG = 160;
  const PAD_TOP = 16;
  const PAD_RIGHT = 16;
  const PAD_BOTTOM = 32;
  const PAD_LEFT = 44;
  const W = W_SVG - PAD_LEFT - PAD_RIGHT;
  const H = H_SVG - PAD_TOP - PAD_BOTTOM;

  // histogram bins
  const { bins, yMin, yMax, maxCount } = useMemo(() => {
    if (!allTemps.length)
      return { bins: [], yMin: 300, yMax: 500, maxCount: 1 };
    const rawMin = Math.min(...allTemps);
    const rawMax = Math.max(...allTemps);
    const yMin = Math.floor(rawMin / 5) * 5;
    const yMax = Math.ceil(rawMax / 5) * 5;
    const numBins = Math.max(1, Math.round((yMax - yMin) / 5));
    const bins = Array.from({ length: numBins }, (_, i) => ({
      y0: yMin + i * 5,
      y1: yMin + (i + 1) * 5,
      count: 0,
    }));
    allTemps.forEach((t) => {
      const i = Math.min(Math.floor((t - yMin) / 5), numBins - 1);
      if (i >= 0) bins[i].count++;
    });
    const maxCount = Math.max(1, ...bins.map((b) => b.count));
    return { bins, yMin, yMax, maxCount };
  }, [allTemps]);

  // coordinate helpers
  // X: count of proteins in each bin
  // Y: temperature value mapped to vertical position
  const toY = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  const toBarW = (count) => (count / maxCount) * W;

  const markerY = hasData ? toY(thisTemp) : null;

  const percentile = useMemo(() => {
    if (!hasData) return null;
    const below = allTemps.filter((t) => t <= thisTemp).length;
    return Math.round((below / allTemps.length) * 100);
  }, [allTemps, thisTemp, hasData]);

  // y-axis
  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    if (range === 0) return [];
    const step = range <= 80 ? 10 : range <= 160 ? 20 : 50;
    const start = Math.ceil(yMin / step) * step;
    const out = [];
    for (let t = start; t <= yMax; t += step) out.push(t);
    return out;
  }, [yMin, yMax]);

  const tempK = thisTemp != null ? Number(thisTemp).toFixed(1) : null;
  // const tempC = thisTemp != null ? (thisTemp - 273.15).toFixed(1) : null;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        padding: "14px 16px 12px",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: FONT,
      }}
    >
      {/* header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#000000",
            fontFamily: FONT,
          }}
        >
          Predicted melt temperature
        </span>
        <span
          style={{
            fontSize: 12,
            color: "#595959",
            fontFamily: FONT,
          }}
        >
          Cyclome930
        </span>
      </div>

      {/* temperature value */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 5,
          marginBottom: 10,
        }}
      >
        {hasData ? (
          <>
            <span
              style={{
                fontSize: 34,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "#1d4ed8",
                fontFamily: FONT,
              }}
            >
              {tempK}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#1d4ed8",
                fontFamily: FONT,
              }}
            >
              K
            </span>

            {percentile != null && (
              <span
                style={{
                  fontSize: 11,
                  color: "#595959",
                  marginLeft: 8,
                  background: "#fafafa",
                  border: "1px solid #d9d9d9",
                  borderRadius: 4,
                  padding: "1px 7px",
                  fontFamily: FONT,
                }}
              >
                {percentile}th percentile
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 14, color: "#8c8c8c", fontFamily: FONT }}>
            No Tm data
          </span>
        )}
      </div>

      {/* SVG: Y = temperature (K), X = count */}
      <svg
        width="100%"
        viewBox={`0 0 ${W_SVG} ${H_SVG}`}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="cymBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="cymBarHov" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1" />
          </linearGradient>
          <filter id="cymRedGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${PAD_LEFT},${PAD_TOP})`}>
          {/* vertical grid lines */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={f * W}
              y1={0}
              x2={f * W}
              y2={H}
              stroke="#f0f0f0"
              strokeWidth={1}
            />
          ))}

          {/* horizontal bars */}
          {bins.map((bin, i) => {
            const by = toY(bin.y1);
            const bh = Math.max(toY(bin.y0) - by - 0.8, 1);
            const bw = toBarW(bin.count);
            if (bw <= 0) return null;
            return (
              <rect
                key={i}
                x={0}
                y={by}
                width={bw}
                height={bh}
                fill={hovered === i ? "url(#cymBarHov)" : "url(#cymBarGrad)"}
                rx={1.5}
                style={{ cursor: "crosshair", transition: "fill 0.12s" }}
                onMouseEnter={() => setHovered(i)}
              />
            );
          })}

          {/* hover tooltip */}
          {hovered !== null &&
            bins[hovered] != null &&
            (() => {
              const bin = bins[hovered];
              const cy = toY((bin.y0 + bin.y1) / 2);
              const bw = toBarW(bin.count);
              const label = `${bin.y0}–${bin.y1} K: ${bin.count}`;
              const tw = label.length * 5.4 + 10;
              const tx = Math.min(bw + 4, W - tw);
              return (
                <g pointerEvents="none">
                  <rect
                    x={tx}
                    y={cy - 8}
                    width={tw}
                    height={14}
                    rx={3}
                    fill="#ffffff"
                    stroke="#d9d9d9"
                    strokeWidth={0.8}
                  />
                  <text
                    x={tx + tw / 2}
                    y={cy + 2.5}
                    textAnchor="middle"
                    fill="#000000"
                    fontSize={8.5}
                    fontFamily={FONT}
                  >
                    {label}
                  </text>
                </g>
              );
            })()}

          {/* ── red marker line for this protein ── */}
          {markerY !== null && (
            <g filter="url(#cymRedGlow)">
              {/* dashed red line */}
              <line
                x1={0}
                y1={markerY}
                x2={W}
                y2={markerY}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              {/* label box — right end */}
              <rect
                x={W - 54}
                y={markerY - 10}
                width={54}
                height={18}
                rx={3}
                fill="#fff1f0"
                stroke="#ef4444"
                strokeWidth={1}
              />
              <text
                x={W - 27}
                y={markerY + 4.4}
                textAnchor="middle"
                fill="#dc2626"
                fontSize={12}
                fontWeight="700"
                fontFamily={FONT}
              >
                {tempK} K
              </text>
              {/* left tick */}
              <line
                x1={-4}
                y1={markerY}
                x2={0}
                y2={markerY}
                stroke="#ef4444"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* axes */}
          <line x1={0} y1={0} x2={0} y2={H} stroke="#d9d9d9" strokeWidth={1} />
          <line x1={0} y1={H} x2={W} y2={H} stroke="#d9d9d9" strokeWidth={1} />

          {/* y-axis ticks + labels */}
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0, ${toY(t)})`}>
              <line
                x1={-3}
                y1={0}
                x2={0}
                y2={0}
                stroke="#d9d9d9"
                strokeWidth={0.8}
              />
              <text
                x={-6}
                y={3.5}
                textAnchor="end"
                fill="#595959"
                fontSize={8}
                fontFamily={FONT}
              >
                {t}
              </text>
            </g>
          ))}

          {/* y-axis label */}
          <text
            transform={`translate(${-PAD_LEFT + 8}, ${H / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="#595959"
            fontSize={8}
            fontFamily={FONT}
            letterSpacing="0.05em"
          >
            CyMelt (K)
          </text>

          {/* x-axis label */}
          <text
            x={W / 2}
            y={H + 22}
            textAnchor="middle"
            fill="#595959"
            fontSize={8}
            fontFamily={FONT}
            letterSpacing="0.05em"
          >
            Cyclome930
          </text>
        </g>
      </svg>
    </div>
  );
}
