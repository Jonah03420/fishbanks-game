export const TEAM_COLOR_MAP = { '🔴': '#ef4444', '🟡': '#eab308', '🟢': '#22c55e', '🔵': '#3b82f6' }

export function teamHex(farbe) {
    return TEAM_COLOR_MAP[farbe] ?? '#6b7280'
}
