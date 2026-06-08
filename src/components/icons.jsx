// Shared SVG icon set — replaces emoji throughout the UI for a consistent, professional look.
// Style convention: viewBox 0 0 16 16, stroke="currentColor", strokeWidth 1.5, no fill (unless noted).

const base = {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
}

export function IconGear({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 2.2v1.6M8 12.2v1.6M13.8 8h-1.6M3.8 8H2.2M11.8 4.2l-1.1 1.1M5.3 10.7l-1.1 1.1M11.8 11.8l-1.1-1.1M5.3 5.3 4.2 4.2" />
        </svg>
    )
}

export function IconTrophy({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M5 3h6v3a3 3 0 0 1-3 3 3 3 0 0 1-3-3V3z" />
            <path d="M5 4H3.2C3.2 5.8 4 7 5 7M11 4h1.8c0 1.8-.8 3-1.8 3" />
            <path d="M8 9v2.5M6 13.5h4M6.5 13.5l.3-2M9.5 13.5l-.3-2" />
        </svg>
    )
}

export function IconAlertTriangle({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M8 2.5l6 10.5H2z" />
            <line x1="8" y1="6.5" x2="8" y2="9.5" />
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
    )
}

export function IconCheck({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M3 8.5l3.2 3.2L13 4.5" />
        </svg>
    )
}

export function IconCross({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
    )
}

export function IconPlug({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M6 2v3.5M10 2v3.5" />
            <path d="M4.5 5.5h7v2.5a3.5 3.5 0 0 1-7 0V5.5z" />
            <path d="M8 11v3" />
        </svg>
    )
}

export function IconFishingRod({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M2.5 3.5L12 9" />
            <path d="M12 9c1.4.4 2.6-.3 3-1.6" />
            <path d="M12 9c.6 1.8.1 3.6-1.8 5.5" />
            <circle cx="10.4" cy="14" r="0.6" fill="currentColor" stroke="none" />
        </svg>
    )
}

export function IconFish({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M2 8c2-2.5 5-3.5 7.5-2.5C12 6.5 13.5 8 14 8c-.5 0-2 1.5-4.5 2.5C7 11.5 4 10.5 2 8z" />
            <path d="M2 8L.8 6.3M2 8l-1.2 1.7" />
            <circle cx="9.5" cy="7.3" r="0.5" fill="currentColor" stroke="none" />
        </svg>
    )
}

export function IconShip({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M3 8h10l-1.3 4H4.3L3 8z" />
            <path d="M5 8V3.5h3L9.5 8" />
            <path d="M2 13c1 .8 2 .8 3 0 1 .8 2 .8 3 0 1 .8 2 .8 3 0 1 .8 2 .8 3 0" />
        </svg>
    )
}

export function IconRobot({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <rect x="3.5" y="5.5" width="9" height="7" rx="1.5" />
            <path d="M8 5.5V3.3" />
            <circle cx="8" cy="2.6" r="0.6" fill="currentColor" stroke="none" />
            <circle cx="6" cy="9" r="0.7" fill="currentColor" stroke="none" />
            <circle cx="10" cy="9" r="0.7" fill="currentColor" stroke="none" />
            <path d="M6 11h4" />
            <path d="M3.5 8H2M14 8h-1.5" />
        </svg>
    )
}

export function IconHourglass({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M4 2.5h8M4 13.5h8" />
            <path d="M4.5 2.5v1.8c0 1 .6 1.9 1.5 2.4l1 .6 1-.6c.9-.5 1.5-1.4 1.5-2.4V2.5" />
            <path d="M4.5 13.5v-1.8c0-1 .6-1.9 1.5-2.4l1-.6 1 .6c.9.5 1.5 1.4 1.5 2.4v1.8" />
        </svg>
    )
}

export function IconClipboard({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <rect x="4" y="3" width="8" height="11" rx="1.2" />
            <rect x="6" y="2" width="4" height="2" rx="0.6" />
            <path d="M6 7.5h4M6 10h4M6 12.5h2.5" />
        </svg>
    )
}

export function IconNewspaper({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <rect x="2.5" y="3.5" width="8" height="9.5" rx="1" />
            <path d="M10.5 6h2.2a.8.8 0 0 1 .8.8v5.4a1.3 1.3 0 0 1-1.3 1.3h-1.7" />
            <path d="M4.5 5.8h4M4.5 7.6h4M4.5 9.4h2.5M4.5 11.2h4" />
        </svg>
    )
}

export function IconMedal({ className = 'w-3.5 h-3.5', tier = 1 }) {
    const fillByTier = { 1: '#facc15', 2: '#cbd5e1', 3: '#d97706' }
    return (
        <svg viewBox="0 0 16 16" className={`${className} shrink-0`}>
            <circle cx="8" cy="9.5" r="4.5" fill={fillByTier[tier] || fillByTier[1]} />
            <circle cx="8" cy="9.5" r="2.6" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
            <path d="M6 2.5h4l-1.4 4h-1.2z" fill={fillByTier[tier] || fillByTier[1]} opacity="0.85" />
        </svg>
    )
}

export function IconTag({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <path d="M2 2h5l7 7-5 5-7-7z" />
            <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
        </svg>
    )
}

export function IconGavel({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg {...base} className={`${className} shrink-0`}>
            <rect x="2.5" y="3" width="3" height="6" rx="0.8" transform="rotate(-45 4 6)" />
            <line x1="6.5" y1="8" x2="3" y2="11.5" />
            <line x1="2" y1="13" x2="6" y2="13" />
        </svg>
    )
}
