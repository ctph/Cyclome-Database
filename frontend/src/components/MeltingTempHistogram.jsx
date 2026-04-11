import React, { useMemo, useState } from "react";

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
        background: "linear-gradient(160deg, #ffffff 0%, #ffffff 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 16px 12px",
        width: "100%",
        boxSizing: "border-box",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.4)",
        fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
      }}
    >
      {/* header */}
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
            fontSize: 9.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#000000",
            opacity: 0.75,
          }}
        >
          CyMelt Distribution
        </span>
        <span style={{ fontSize: 9.5, color: "#000000" }}>
          Cyclome {allTemps.length.toLocaleString()}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {hasData ? (
          <>
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: "#1677ff",
                textShadow: "0 0 20px rgba(255,107,107,0.35)",
              }}
            >
              {tempK}
            </span>
            <span style={{ fontSize: 14, color: "#1565c0", opacity: 0.65 }}>
              K
            </span>
            {/* <span style={{ fontSize: 12, color: "#3a4550", margin: "0 2px" }}>
              /
            </span> */}
            {/* <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#1677ff",
                opacity: 0.8,
              }}
            >
              {tempC}
            </span>
            <span style={{ fontSize: 12, color: "#1677ff", opacity: 0.55 }}>
              °C
            </span> */}
            {percentile != null && (
              <span
                style={{
                  fontSize: 10,
                  color: "#8b949e",
                  marginLeft: 6,
                  background: "rgba(255,107,107,0.07)",
                  border: "1px solid rgba(255,107,107,0.18)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              >
                {percentile}th pct
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 16, color: "#3a4550" }}>No Tm data</span>
        )}
      </div>

      {/* SVG */}
      <svg
        width="100%"
        viewBox={`0 0 ${W_SVG} ${H_SVG}`}
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="cymBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a3d6e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2f6eb5" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="cymBarHov" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2f6eb5" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#58a0ef" stopOpacity="1" />
          </linearGradient>
          <filter id="cymGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
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
              stroke="#1677ff"
              strokeWidth={1}
            />
          ))}

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
                style={{ cursor: "crosshair", transition: "fill 0.1s" }}
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
              const tw = label.length * 5.2 + 8;
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
                    stroke="#2a3545"
                    strokeWidth={0.8}
                  />
                  <text
                    x={tx + tw / 2}
                    y={cy + 2.5}
                    textAnchor="middle"
                    fill="#c9d1d9"
                    fontSize={8.5}
                    fontFamily="'DM Mono', monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })()}

          {/* horizontal marker line for this protein */}
          {markerY !== null && (
            <g filter="url(#cymGlow)">
              <line
                x1={0}
                y1={markerY}
                x2={W}
                y2={markerY}
                stroke="#ff1616"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <rect
                x={W - 52}
                y={markerY - 10}
                width={52}
                height={18}
                rx={3}
                fill="#1a0a0a"
                stroke="#ff1616"
                strokeWidth={1}
              />
              <text
                x={W - 26}
                y={markerY + 3.5}
                textAnchor="middle"
                fill="#1677ff"
                fontSize={8.5}
                fontWeight="700"
                fontFamily="'DM Mono', monospace"
              >
                {tempK} K
              </text>
              {/* left tick */}
              <line
                x1={-4}
                y1={markerY}
                x2={0}
                y2={markerY}
                stroke="#ff1616"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* left axis */}
          <line x1={0} y1={0} x2={0} y2={H} stroke="#1e2937" strokeWidth={1} />
          {/* bottom axis */}
          <line x1={0} y1={H} x2={W} y2={H} stroke="#1e2937" strokeWidth={1} />

          {/* y-axis ticks + labels */}
          {yTicks.map((t) => (
            <g key={t} transform={`translate(0, ${toY(t)})`}>
              <line
                x1={-3}
                y1={0}
                x2={0}
                y2={0}
                stroke="#2a3545"
                strokeWidth={0.8}
              />
              <text
                x={-6}
                y={3.5}
                textAnchor="end"
                fill="#3a4a5a"
                fontSize={8}
                fontFamily="'DM Mono', monospace"
              >
                {t}
              </text>
            </g>
          ))}

          {/* y-axis label */}
          <text
            transform={`translate(${-PAD_LEFT + 8}, ${H / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="#2a3a4a"
            fontSize={7.5}
            fontFamily="'DM Mono', monospace"
            letterSpacing="0.1em"
          >
            CyMelt (K)
          </text>

          {/* x-axis label */}
          <text
            x={W / 2}
            y={H + 22}
            textAnchor="middle"
            fill="#2a3a4a"
            fontSize={7.5}
            fontFamily="'DM Mono', monospace"
            letterSpacing="0.1em"
          >
            Cyclome {allTemps.length.toLocaleString()}
          </text>
        </g>
      </svg>
    </div>
  );
}
