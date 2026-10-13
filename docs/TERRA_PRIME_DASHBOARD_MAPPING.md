# loew-runner — Terra Prime dashboard mapping

The production dashboard uses the live **loew.fi — Terra Prime Design System** Figma file as its visual and component authority.

Figma file key: `JTVGofxepeU4EBb2sCdX0T`

## Component mapping

| Figma component | Node | loew-runner implementation |
| --- | --- | --- |
| Terra Prime Accent Bar | `17:2` / instance `182:1160` | `.terra-accent` with equal Photo / Design / Software thirds |
| App / Toolbar | `341:872` | `.app-toolbar` |
| App / Sidebar Item — Default / Active | `341:853`, `341:856` | `.sidebar-item`, `.sidebar-item.active` |
| App / Tab — Default / Active | `341:860`, `341:862` | `.app-tab`, `.app-tab.active` |
| App / Save Status — Saved / Error | `349:988`, `349:997` | `.status-pill` semantic variants |
| App / Table Header | `341:888` | `.data-header` |
| Button — Primary / Secondary / Disabled / Danger | `9:5`, `9:7`, `237:1477`, `348:970` | `.tp-button` variants |

## Canonical tokens

```text
Canvas       #151412
Surface      #211F1D
Raised       #2D2A27
Interactive  #393531
Border       #514A45
Neutral      #8D827A
Text Primary #F1ECE4
Text Second. #C9C1B8
Photo / Focus / Success #1C8C93
Design / Error          #B5471F
Software / Warning      #FFBF00
```

The dashboard uses IBM Plex Sans for dense application UI. Momo Trust Display is reserved for the branded `runner` heading rather than labels, controls, or data.

## Translation rule

Figma components are not flattened into screenshot mimicry. Their geometry and semantic variants are translated into reusable HTML/CSS primitives so the dashboard remains a small zero-runtime-dependency application while staying aligned with Terra Prime.

No temporary Figma asset URLs are used in production code. The accent bar and status dots are deterministic CSS geometry from the source component definitions.
