# field product language

## status

This document is the current product-language and UI-string contract for **field**.

It exists to prepare text-string sweeps and future feature naming without turning every implementation detail into a branded concept.

The rule is restraint:

> **name what users recognize; describe what they merely benefit from; reserve `field.SOMETHING` for real architecture.**

field is the product. Revyme is the technical origin.

---

## 1. naming hierarchy

### 1.1 structural product language

Structural parts of the product should use the clearest useful lowercase word.

These are permanent places, modes, tools, objects, and states that are imperative to understanding field.

Examples:

- `home`
- `design`
- `content`
- `code`
- `preview`
- `pages`
- `layers`
- `media`
- `inspector`
- `gallery`
- `scale`

Do not invent a feature brand when the ordinary word is already good.

Preserve deliberate technical casing inside the lowercase voice. Initialisms and functional terms such as `AI`, `SEO`, `CMS`, `API`, and `A/B` stay uppercase; lowercase the surrounding editorial words instead.

### case management

field exposes casing as a single **case management** switch, on by default.

When on, eligible field-owned chrome uses the loew.fi lowercase editorial voice across headings, panel labels, menus, buttons, tabs, tooltips, placeholders, and contextual actions while preserving technical terms such as `AI`, `SEO`, `CMS`, `API`, `A/B`, and `field.RUNTIME`.

When off, eligible chrome renders exactly as authored.

The UI does not present named casing modes. It is one on/off switch. Internally this is a boolean preference; the existing storage key is retained for compatibility.

Casing is presentation, not content mutation. Project names, page names, filenames, user-authored text, code, and website content must keep their own casing.

### 1.2 interaction and QoL features

A user action or interaction-quality feature may earn a verb or a more editorial lowercase name when:

- the behavior is recognizable in use;
- it groups several small behaviors into one coherent experience;
- it could reasonably appear in a feature list or release note heading;
- the name helps the feature feel authored rather than merely technical.

This is where field may have more temperature.

Examples currently adopted:

- `locate`
- `close read`
- `drop in`
- `quick swap`

These names do not need to appear everywhere the underlying behavior occurs. They are product-language names, not mandatory labels for every control.

### 1.3 unnamed improvements

Most improvements do **not** get names.

If the change would read naturally as a sentence such as “better Finder search performance,” field should describe it plainly instead of creating vocabulary.

Examples:

- smoother canvas panning
- more reliable project switching
- improved Inspector alignment
- better Safari trackpad support
- faster project loading
- more accurate group bounds
- improved thumbnail reliability

These belong in release notes, changelogs, QA notes, or ordinary UI copy.

### 1.4 architecture

Use `field.SOMETHING` only for a durable, coherent, cross-cutting field system with a real architectural contract.

Do not create `field.SOMETHING` names for ordinary modules, implementation details, utilities, stores, or one-off behavior.

Current architectural vocabulary:

- `field.GLYPH`
- `field.MOTION`
- `field.RUNTIME`
- `field.BUILD`

Future/reserved architecture:

- `field.GRAPH`

---

## 2. current canonical UI strings

These are the preferred human-facing strings for the product as it exists now.

### product modes

| concept | canonical string |
| --- | --- |
| visual editor | `design` |
| content/site management | `content` |
| source environment | `code` |
| runtime view | `preview` |

### product places and surfaces

| current/legacy wording | canonical field string | notes |
| --- | --- | --- |
| Dashboard / project dashboard | `home` | field's project starting surface |
| Pages | `pages` | structural |
| Layers | `layers` | structural |
| Media Library / assets surface | `media` | use the shorter product noun |
| Properties / property panel | `inspector` | professional design-tool language |
| Components / component library | `components` | use when the surface is specifically component-oriented |
| Comments | `comments` | no branded replacement needed |
| Settings | `settings` | no branded replacement needed |
| user profile | `profile` | no branded replacement needed |
| About / version information | `about field` | field identity remains lowercase |

### native objects and tools

| concept | canonical string |
| --- | --- |
| Gallery object | `gallery` |
| Group object/action | `group` |
| Ungroup action | `ungroup` |
| proportional Scale tool | `scale` |
| font browsing | `fonts` |
| appearance controls | `appearance` |
| explicit project refresh | `refresh` |
| publishing | `publish` |

### workspace language

| concept | canonical string |
| --- | --- |
| complete workspace | `full` |
| focused workspace | `focus` |
| floating workspace | `float` |
| persistent pane close | `collapse` |
| restore collapsed pane | `expand` |
| temporary edge reveal | `auto-hide` |

Do not replace established interaction terms such as `collapse` or `auto-hide` merely to make them sound more branded.

### mobile workspace language

Mobile is a presentation and interaction state of the same field editor, not a separate product mode or document model.

On phone-sized touch layouts:

- `float` is the default mobile workspace: Canvas remains primary, the canonical tool control stays available, and secondary surfaces appear temporarily.
- `focus` is the reduced-chrome mobile workspace for direct Canvas manipulation.
- `full` is not exposed as a mobile layout option.
- `collapse`, `expand`, and `auto-hide` remain valid workspace terms, but their controls should not occupy persistent phone chrome. If they are exposed on mobile, place them under `settings` or a workspace/view settings surface.

Mobile tool and surface vocabulary:

| concept | canonical string | notes |
| --- | --- | --- |
| primary floating mobile tool control | `tool button` | stable anchor; it does not morph into a docked toolbar |
| expanded chooser opened from the tool button | `tool palette` | temporary floating choice surface |
| temporary mobile panel surface | `sheet` | Layers, Insert, Media, Inspector, and similar mobile surfaces share one top-level stacking model |

Do not use `FAB` as the user-facing field string. It may remain implementation/design shorthand. Prefer `tool button`, `tool palette`, and `sheet` in product copy and handoffs.

---

## 3. current named interaction features

These are current field behaviors that are distinctive enough to carry product-language names.

### locate

**locate** is the action of finding the corresponding object on the live Canvas from another field surface.

Current behavior includes selection-color/object location and temporary Canvas emphasis/framing.

Use `locate` when an explicit action label, tooltip, menu item, or feature description is needed.

Do not split each locating source into a separate named feature.

### close read

**close read** is field's text-editing focus experience.

It groups the text-specific QoL work that makes editing type feel intentional rather than like editing a generic DOM box:

- direct/nested text entry;
- smart camera framing while editing;
- grow-to-fit text framing;
- caret-aware following for oversized text;
- direct text-to-text handoff;
- restoring the prior Canvas view when the temporary text focus ends.

The ordinary action remains editing text. `close read` is the feature name for the experience around it.

### drop in

**drop in** is the direct Gallery-media add interaction.

Dragging media onto an existing Gallery can add it directly without routing through a separate creation flow.

Use the name for feature/release language where useful. The drag target itself does not need to display “drop in” constantly.

### quick swap

**quick swap** is the direct Gallery replacement/swap interaction.

Dragging media onto an existing Gallery item can replace or swap that media in place while preserving the surrounding Gallery behavior/treatment where appropriate.

This is a QoL feature name, not a new Gallery object type.

---

## 4. current capabilities that stay descriptive

The following are meaningful field divergences from Revyme, but they do not currently need branded names.

Use clear lowercase/descriptive language:

- project previews
- project creation
- realtime project updates
- reliable project switching
- persistent projects
- save conflict protection
- responsive values
- native groups
- native galleries
- gallery views
- gallery media editing
- auto layout
- hug contents
- frame padding
- direct text editing
- smooth canvas navigation
- camera restore
- canvas eyedropper
- full Google Fonts
- direct media insertion
- page appearance
- editor appearance
- component-aware commands
- animated workspace transitions
- runtime preview parity
- branch preview builds
- authenticated profiles
- profile avatars
- build diagnostics

These can appear as feature-list or release-note language without becoming permanent named concepts.

---

## 5. current architectural names

### field.GLYPH

The shared field icon/glyph system.

It covers the thin icon language, semantic state response, morphing glyph transitions, and shared glyph behavior across field chrome.

### field.MOTION

The shared semantic motion system.

It covers reusable motion behavior for controls, panels, workspace transitions, editor entrances, and other field-owned interaction choreography.

### field.RUNTIME

The runtime architecture connecting field's editor, Canvas, Preview, production-equivalent rendering, Cloudflare routing, and environment-specific host behavior.

Use this name for architectural documentation, not user-facing UI.

### field.BUILD

The build-identity system.

It covers build metadata, commit identity, environment identity, deployment/version truth, the build diagnostics endpoint, and the data shown by `about field`.

Use this name for architecture/diagnostics documentation, not as a visible product feature.

---

## 6. future product language

Future field work should follow the same hierarchy instead of pre-branding every roadmap item.

### structural future features

Use simple, established product language unless a stronger reason emerges:

- `variables`
- `variants`
- `components`
- `libraries`
- `prototyping`
- `interactions`
- `constraints`

These are core design-tool concepts. Their clarity is more valuable than novelty.

### Figma integration

Until the user experience is mature enough to justify a named feature, use direct language:

- `import from Figma`
- `sync with Figma`

Do not invent a branded bridge name merely because the integration is strategically important.

If a future Figma workflow becomes a recognizable interaction with its own authored experience, it may earn an editorial feature name later.

### field.GRAPH

`field.GRAPH` is reserved for the future canonical design/document graph described by field architecture.

It should represent durable design semantics across source, Design, Code, Preview, and external design-system relationships.

Do not use `field.GRAPH` as a label for today's JSX/DOM inference simply to make the future architecture appear implemented.

### future interaction names

Future QoL features may receive verbs or editorial multi-word names only after the actual interaction is defined.

The test is:

> Would a user recognize this as a distinct thing they can do, and could it plausibly receive its own sentence or heading in a serious product feature list?

If not, describe the improvement plainly.

---

## 7. text-string sweep rules

When performing a field UI string pass:

1. prefer lowercase human-facing names;
2. replace inherited Revyme terminology when field has a settled product term;
3. use the canonical structural strings in this document;
4. use named interaction features only where the feature identity adds meaning;
5. do not inject `field.SOMETHING` into user-facing copy;
6. do not capitalize ordinary field concepts merely because they are menu items or headings;
7. keep conventional interaction terms conventional when clarity wins;
8. remove unnecessary words such as “Library” when the shorter field noun already communicates the surface;
9. do not turn tiny improvements into named features;
10. do not claim future architecture as current product behavior.

---

## 8. immediate sweep targets

The next text-string pass should specifically audit for inherited or inconsistent strings around:

- Dashboard → `home`
- Media Library → `media`
- Properties / Properties panel → `inspector` where it refers to field's right-side property surface
- About Field / About → `about field`
- Full / Focus / Float → `full` / `focus` / `float` on desktop; phone layouts expose only `focus` / `float`
- FAB / mobile toolbar wording → `tool button` / `tool palette`; mobile temporary panels → `sheet`
- Locate → `locate`
- Design / Content / Code / Preview → `design` / `content` / `code` / `preview`
- Pages / Layers → `pages` / `layers`
- Gallery / Group / Scale → `gallery` / `group` / `scale`
- Collapse / Expand / Auto-hide → `collapse` / `expand` / `auto-hide`
- Media-, Gallery-, and text-editing descriptions that could appropriately reference `drop in`, `quick swap`, or `close read`

The sweep should change strings, not redesign behavior.

---

## 9. restraint rule

field should not sound like every behavior was invented in a branding workshop.

The intended contrast is:

**structural**
`home` · `media` · `layers` · `gallery` · `preview`

**authored interaction**
`locate` · `close read` · `drop in` · `quick swap`

**architecture**
`field.GLYPH` · `field.MOTION` · `field.RUNTIME` · `field.BUILD` · future `field.GRAPH`

Everything else can simply be good product language.
