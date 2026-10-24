/**
 * Chart roles -> colors. Hues come from the validated reference data-viz palette
 * (categorical slots 1 and 2). Text never wears a series color.
 */
export const chart = {
  actual: '#2a78d6',
  forecast: '#eb6834',
  band: '#eb6834',
  bandOpacity: 0.14,
  bar: '#2a78d6',
  barMuted: '#9ec5f4',
  grid: '#e1e0d9',
  axis: '#898781',
  ink: '#0b0b0b',
  inkSoft: '#52514e',
  over: '#e34948',
  under: '#2a78d6',
} as const;

export const axisTick = { fill: chart.axis, fontSize: 12 } as const;
