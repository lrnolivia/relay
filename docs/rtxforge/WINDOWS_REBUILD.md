# rtxForge Windows rebuild plan

Status: planned. Canonical planning home: Runner. Product implementation truth remains in `lrnolivia/rtxForge`.

## Direction

The Windows version is a native **WinUI 3 / Windows App SDK** rebuild, not a GTK port and not a wrapper around another mod manager.

rtxForge owns:

- game discovery and capability detection
- per-game compatibility recipes
- Neural Rendering, DLSS, RR, FG and MFG product controls
- injection selection
- versioned runtime management
- transactional backup/install/verify/update/restore
- logs and diagnostics

Upstream projects are replaceable engines. Their installers and UIs are not product dependencies.

## Initial engine stack

### Neural Rendering / injection

Use **OptiScaler-DLSSNR / Pre-SR Multipass** as the initial NR substrate and supported proxy/injection layer.

Auto injection may resolve per recipe to routes such as:

- `dxgi.dll`
- `version.dll`
- `winmm.dll`
- `d3d12.dll`
- ASI or another supported loader route

### RTX 40 Multi Frame Generation

Use **Universal RTXMFG** as the initial Ada MFG engine.

Normal UI exposes:

- Native / game-controlled FG
- Multi Frame Generation
- Fixed
- Follow Game
- Dynamic
- 2x / 3x / 4x
- target FPS when supported

Higher experimental multipliers stay behind Advanced until validated.

### NVIDIA / Streamline runtimes

Treat DLSS SR, DLSS-G, Ray Reconstruction, Streamline, NR forwarders and related components as versioned dependencies in a machine-readable manifest.

Do not hard-code one Streamline version into UI code.

## Architecture

```text
rtxForge for Windows
│
├── WinUI 3 application
│   ├── Library
│   ├── Game detail
│   ├── Settings
│   └── Advanced
├── Game discovery
│   ├── Steam
│   ├── manual EXE
│   ├── GOG
│   ├── Epic
│   └── other launchers where reliable
├── Capability detector
├── Compatibility database
│   └── per-game recipes
├── NR engine
│   └── OptiScaler-DLSSNR / Pre-SR Multipass
├── MFG engine
│   └── Universal RTXMFG
├── Injection engine
├── Runtime manager
│   ├── DLSS
│   ├── DLSS-G
│   ├── Ray Reconstruction
│   └── Streamline
└── Transaction manager
    ├── inspect
    ├── backup
    ├── install
    ├── verify
    ├── update
    └── restore
```

## Capability-aware UX

rtxForge must not display unsupported controls as if they will work.

A normal supported game page should feel like:

```text
Neural Rendering        On
DLSS Super Resolution   Latest
Ray Reconstruction      Latest

Frame Generation        Multi Frame Generation
Mode                    Fixed
Multiplier              4x
Target FPS              120

Injection               Auto

[ Install ]
```

Advanced reveals the resolved recipe, engine versions, proxy route, runtime versions, generated config and changed files.

## Per-game recipes

Game-specific behavior belongs in declarative data, not scattered conditionals.

Recipes define:

- graphics API
- detected/native DLSS and Streamline features
- NR/RR/FG/MFG support
- preferred and fallback injection routes
- runtime pins
- MFG limits/defaults
- ReShade/coexistence rules
- anti-cheat or protected-executable blocks

Unknown games may use an explicit Experimental flow with mandatory backup and reduced assumptions.

## Transaction law

Every install is reversible:

1. inspect exact target state
2. detect existing proxy DLLs, ReShade, OptiScaler, Streamline and related mods
3. compute exact changes
4. back up originals and record a manifest
5. fetch versioned assets and verify hashes
6. stage before mutating the game directory
7. install and generate config
8. verify files, hashes, config and duplicate-proxy conflicts
9. restore only rtxForge-owned changes, preserving unrelated user files

Ambiguous drift blocks destructive restore.

## WinUI 3 layers

Keep three layers separate:

- **Presentation:** WinUI 3 views/view-models; knows product concepts, not DLL rituals.
- **Core:** game model, capabilities, recipes, install plans, manifests, transaction state and verification.
- **Adapters:** launcher discovery, filesystem/process work, OptiScaler config, RTXMFG config, runtime fetch, proxy selection, backup/restore.

## Phases

1. contracts: recipe schema, runtime manifest, transaction format, engine adapters
2. WinUI 3 shell against fixture-backed state
3. Steam + manual discovery and transactional install/restore
4. OptiScaler-DLSSNR integration
5. Universal RTXMFG integration with Fixed/Follow Game/Dynamic and 2x/3x/4x
6. compatibility database, conflict handling and ReShade coexistence
7. broader launchers, diagnostics, packaging and release hardening

The architectural requirement is replaceability: a future NR, MFG or injection engine must be swappable without rewriting the product.
