/**
 * Shared Recharts theme — adapts to light/dark via CSS variables.
 * Import these objects and spread them into the corresponding Recharts props.
 */

/** Tooltip container style — use as <Tooltip contentStyle={TOOLTIP_STYLE} /> */
export const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
}

/** Smaller variant for dense charts */
export const TOOLTIP_STYLE_SM: React.CSSProperties = {
  ...TOOLTIP_STYLE,
  fontSize: 11,
}

/** Cursor fill for Bar/Area charts — SVG attrs, not CSS */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CURSOR_STYLE: Record<string, any> = {
  fill: "hsl(var(--muted))",
  opacity: 0.5,
}

/** Common axis tick style */
export const AXIS_TICK: { fontSize: number; fill: string } = {
  fontSize: 10,
  fill: "hsl(var(--muted-foreground))",
}

/** CartesianGrid stroke */
export const GRID_STROKE = "hsl(var(--border))"

/** Legend text style */
export const LEGEND_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: "hsl(var(--muted-foreground))",
}
