import {fieldIconShapes} from "./field-icons.js";
// A 24px family with deliberately heavy, rounded geometry. Motion is CSS-only.
const shapes = {
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3Z"/><path d="M10 21h4"/>',
  today: '<rect x="4" y="5" width="16" height="16" rx="5"/><path d="M8 3v4m8-4v4M4 11h16"/><circle cx="12" cy="16" r="1.8" fill="currentColor" stroke="none"/>',
  projects: '<rect x="3" y="3" width="7" height="7" rx="2.5"/><rect x="14" y="3" width="7" height="7" rx="2.5"/><rect x="3" y="14" width="7" height="7" rx="2.5"/><rect x="14" y="14" width="7" height="7" rx="2.5"/>',
  review: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle class="glyph-detail" cx="12" cy="12" r="3"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  previous: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  more: '<g class="glyph-detail" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></g>',
  move: '<path d="M3 8h18m-4-4 4 4-4 4M21 16H3m4-4-4 4 4 4"/>',
  minimize: '<path d="M5 12h14"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  repair: '<path d="M14 4a6 6 0 0 0-7 7l-4 4a3 3 0 0 0 6 6l4-4a6 6 0 0 0 7-7l-4 4-4-4Z"/>',
  save: '<path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  neutral: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M9 12h6"/>'
};
const fieldNames={rename:'Pencil',projects:'Grid',moon:'Moon',sun:'Sun',refresh:'Reload',next:'ChevronRight',close:'Close',more:'More',check:'Check',play:'Play',plus:'Plus',search:'Search',layers:'Layers',media:'Image',globe:'Globe',branch:'Branch',code:'Code'};
const behaviors={settings:'gear',review:'eye',next:'chevron',previous:'chevron',more:'ellipsis',plus:'plus',minimize:'minus',layers:'layers',media:'media',globe:'globe',branch:'branch',code:'code',refresh:'globe'};
export function glyph(name) {
  const canonical=fieldIconShapes[fieldNames[name]];
  if(canonical)return '<svg class="relay-glyph glyph-'+name+'" data-loew-glyph="'+(behaviors[name]||'generic')+'" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">'+canonical+'</svg>';
  const kind = Object.hasOwn(shapes, name) ? name : "neutral";
  return '<svg class="relay-glyph glyph-' + kind + '" data-loew-glyph="' + (behaviors[name] || 'generic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.875" stroke-linecap="round" stroke-linejoin="round">' + shapes[kind] + '</svg>';
}

// Summary semantics reuse the existing rounded family. Attention/review is an
// eye; repair is reserved for checks that actually report a blocker or error.
export function telemetryGlyph(id) {
  return ({ needs: "review", moving: "play", automatic: "refresh", freshness: "refresh",
    now: "play", external: "pause", fresh: "refresh", next: "today", projects: "projects",
    attention: "repair", monitoring: "review", "needs-review": "review",
    "visible-captures": "projects", "chat-previews": "more", heartbeat: "refresh",
    activity: "play", status: "neutral", state: "neutral", phase: "play", events: "more" })[id] || "neutral";
}

