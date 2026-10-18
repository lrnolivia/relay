# nudge

Precise local game controls by **loew.fi**.

nudge is a ChatGPT MCP app with a paired Windows companion for starting games and testing their menus and gameplay. It discovers installed Steam, Epic and GOG titles, launches them, lists their windows, and provides screenshots, menu clicks, text entry, keyboard/mouse input, and virtual Xbox 360 or DualShock 4 controllers. A local stdio connection is also available.

The server describes the startup workflow and exposes the full operating skill as an MCP resource, so a fresh chat can find a requested game, launch it, handle its launcher, select its window, and test its controls. It does not depend on a separate Computer Use plugin.

## Connect ChatGPT

Add an MCP app named **nudge** using **https://nudge.loew.fi/mcp**, choose **OAuth**, and sign in through loew.fi Access. The endpoint uses the same managed OAuth settings and reusable **Only Me** human policy as Relay. The Windows companion must be running on the paired PC with an unlocked desktop. Start with `connection_status`, then ask nudge to discover and launch a game.

The Cloudflare Worker authenticates the app and forwards bounded tool calls over an outbound WebSocket to the paired companion. The PC opens no inbound port. Pairing credentials are encrypted for the Windows user with DPAPI; Cloudflare stores their SHA-256 verifier. Expired calls are cancelled and are never replayed after reconnect. Disconnecting the companion stops tracked input. F12 remains the physical emergency stop.

`connection_status` reports the PC name, companion/backend versions and process IDs, cloud-received contact time/age, connection state and next steps. It distinguishes an open socket from missing/stale diagnostics. Its input and desktop-wide owner snapshot includes observation time/age and `input_fresh`; it never reserves control. The paired backend's own armed/controller state may differ from another local client's desktop-wide reservation. Use fresh `session_status`/`input_status` and atomic acquisition before control.

Idle cloud diagnostics refresh every 15 seconds, or sooner on observed status changes; 45 seconds without a fresh sample is stale. The local tray still refreshes every three seconds. Only one bounded latest connection record is retained, with no tool arguments, session tokens or pairing credentials. Live samples survive cloud hibernation; disconnect details retain the last reported PC/pause/stop intent. The cloud cannot know a disconnected PC's current startup, pairing or network failure. Check its tray details/logs for the current retry reason. A reported prior retry error after reconnect is labeled historical. Transport failure and cleanup completion are separate facts; verify cleanup receipts before retrying an interrupted action.

The companion is installed from this checkout:

```powershell
.\.venv\Scripts\python.exe -m pip install -e '.[bridge]'
.\.venv\Scripts\python.exe scripts/pair_bridge.py
.\scripts\Start-NudgeBridge.ps1
```

Pairing prints a public verifier, which must match `BRIDGE_TOKEN_SHA256` in the Worker's deployment configuration. Keep the encrypted credential on the PC. `scripts/Install-NudgeStartup.ps1` builds and installs the **native nudge companion** and its Windows logon task for the current user. Building requires the .NET 10 SDK; this installation uses the .NET 10 Desktop Runtime and includes its Windows App SDK runtime. It runs without elevation in the signed-in desktop session, restarts after failure, and has no runtime limit. Keep this checkout and its Python environment in place.

The companion runs in the background with the official nudge icon in the Windows notification area. Right-click it for the native WinUI 3 menu: connection details, reconnect, Stop all input, pause/resume, Start at sign-in, logs, and Quit. Closing the details window leaves the tray app running. Pause and Quit release input before disconnecting; a Windows Job Object removes the backend process tree if the tray process exits unexpectedly. Reconnecting never replays an earlier command. The Start at sign-in switch controls the companion's own logon task. `scripts/Start-NudgeBridge.ps1` starts it manually.

The installed configuration retains only a DPAPI-encrypted recovery copy of the existing pairing, restricted to the same Windows user. Re-run the installer after source changes. When migrating an older shell-based companion, first use `emergency_stop` or F12, then pass `-LegacyInputStopped` to the installer. Runtime logs and current connection snapshots are in `%LOCALAPPDATA%\loew.fi\nudge`; `companion.log` records native supervisor errors, `bridge-stderr.log` records backend errors, and `bridge.log` records connections. The snapshots contain status and PC information, never the pairing credential. Remote launch accepts installed game IDs from `discover_games`; explicit executable paths remain available through the local connection.

The Worker source is in `cloud/`, with deployment configuration in `wrangler.jsonc`. Re-export the catalog after changing tool schemas or the skill, then run the cloud checks before deployment:

```powershell
.\.venv\Scripts\python.exe scripts/export_cloud_catalog.py
.\.venv\Scripts\python.exe scripts/export_brand_assets.py
npm ci
npm test
npm run check
npm run deploy
```

The official icon sources are `assets/nudge.svg` and `assets/nudge.png`. The hosted app publishes them at `/icon.svg` and `/icon.png`, advertises them in MCP server metadata, and uses the SVG as its favicon. Use the PNG when the ChatGPT app setup asks for an icon upload.

## Run locally

Python 3.11+ and an unlocked Windows desktop are required. From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe run.py
```

The local server communicates over stdio; it does not open a network port. `scripts/configure.py` writes local MCP wiring using the current interpreter and the host's plugin-root placeholder. The optional local plugin packages the operating skill. No model API key is needed.

To build and install the local plugin:

```powershell
.\.venv\Scripts\python.exe scripts/configure.py
.\.venv\Scripts\python.exe scripts/package_plugin.py
codex plugin marketplace add .
codex plugin add nudge@loew-local
```

The package uses this checkout's Python environment for dependencies and bundles its own source and skill. Keep the checkout and environment in place. A new chat or app reload may be needed before newly installed tools appear. Existing sessions keep their original tool inventory. To refresh a development install, rebuild the package, remove only `nudge@loew-local`, then add it again.

## Controls

Before any launch, target selection/focus, selected-game observation, controller attachment, or input, call `acquire_session` with a recognizable `owner` and unique `run_id`. Keep its private `session_token` and pass it on control tools. The control lease lasts 5–120 seconds (60 by default); `renew_session` extends it before expiry. `session_status` shows the owner/run, expiry and cleanup state without revealing the token. A Windows kernel mutex and shared owner mapping make acquisition exclusive across cooperating local backend processes and hosted chats in the signed-in user's desktop session, including processes with different filesystem views. A free status snapshot alone is not a reservation.

Call `release_session` when finished. Expiry, cancellation and local F12 stop and neutralize the owning inputs and unplug its virtual controller. Handoff waits for input cleanup and in-flight workers; `active: true, releasing: true` remains busy. A completed release includes `last_release.neutral_verified`. Wrong or stale tokens cannot stop another caller. The physical F12 key and local tray Stop action remain local emergency controls. Session reservations coordinate cooperating nudge clients; existing OAuth/DPAPI pairing still controls access. They cannot prevent physical input or other applications from changing foreground focus. A backend restart invalidates its tokens. Refresh the MCP app's tools after upgrading from 0.3 to discover the session tools and new required parameters.

The tray's Troubleshooting → Check session coordination action temporarily reserves control for 15 seconds without selecting a window, attaching a controller, or sending game input. Other clients should see that owner and receive busy until it expires. A current owner is never displaced by this check. Diagnostic JSON files are mirrors; the kernel reservation and shared mapping arbitrate ownership.

1. `discover_games` searches local Steam, Epic and GOG metadata. Steam results may include utilities.
2. `launch_game` starts a returned game ID, or an existing absolute executable path. Optionally pass `controller_kind` to attach a neutral controller before startup. The receipt includes candidate/new windows; it does not prove readiness.
3. `list_game_windows` lists current windows, PID, process birth time/path, native client and screen bounds, foreground HWND and UTC/monotonic timestamps. Unknown process details are explicit. `window_observations` records inventories before/after and foreground samples for up to ten seconds without selecting, focusing or sending input; it needs no session token. Samples are sequential and may miss transitions between them. `select_game_window` selects a returned HWND, verifies its process identity, and arms input.
4. `observe_game` returns the selected game or launcher image and a timestamped identity/geometry receipt. Client pixels outside real monitors are black padding in their original positions, with `clipped`, `incomplete`, `missing_native_pixels` and `visible_client_regions` describing the missing area. Use the receipt's `image_to_client_scale` for coordinates and click only visible regions. Capture rejects a window that moves/resizes or changes identity during observation. `click_game` and `type_game_text` operate observed menu fields; text entry does not submit.
5. `play_input` executes frames such as:

```json
{"frames": [{"duration_ms": 400, "keys": ["w", "shift"], "dx": 80, "dy": 0}], "capture_after": true}
```

Each frame sets the complete held key/button state. Common keys stay down between frames, and all inputs release when playback ends. Sequences can contain up to 256 frames and last up to 30 seconds. `hold_keys`, `move_camera`, and `click_game` provide simpler calls. `set_held_inputs` returns immediately with a lease of up to five seconds for observation during movement; expired leases release automatically.

**Press F12 to stop and release nudge inputs.** Focus loss, target closure, cancellation and normal server shutdown also release tracked inputs. Emergency stop and focus loss disarm the target; select it again to continue. Concurrent nudge processes share an exclusive input lock. The tool does not suppress physical user input.

## Repeatable camera recipes

`prepare_camera_recipe` builds a recipe without sending input. Supply the target identity and client dimensions from `list_game_windows`, a settings/build/binding `context_id`, and at least two distinct, measured calibration samples in opposite directions for each used axis. Samples identify `yaw` or `pitch`, signed `input_value`, `duration_ms`, signed `observed_degrees`, and a real `evidence_id`. Mouse values are integer counts; right-stick values are deflections and require the calibrated `controller_kind`. Do not invent angular measurements or infer them from screen pixels without a valid projection. The linear model rejects stationary/inconsistent samples and motion outside the measured duration/speed/deflection ranges. Its angles are predictions from caller-supplied measurements.

Phases have unique `phase_id`, `role` (`before`, `motion`, `after`), `duration_ms`, and requested `yaw_degrees`/`pitch_degrees`. Before/after phases are neutral; each motion phase pans one axis. The whole recipe lasts at most30 seconds. Preparation returns `recipe_digest`, resolved commands, and a fresh `next_run_id`. Under a current human game-test request, acquire/select/observe, then pass the exact recipe, digest and run ID to `play_camera_recipe`. Mouse replay requires no virtual controller; stick replay requires its calibrated type connected. The game must map that mouse/right stick to camera. No keys, mouse buttons, left stick, triggers or controller buttons are sent.

Receipts include target/session/run/phase provenance, requested and acknowledged mouse counts, state transition bounds, actual phase/neutral timing, sampled focus/identity/geometry guards, and partial delivery after interruption. Camera scheduling and its `monotonic_ns` receipt fields use `python.time.perf_counter` (this PC reports QueryPerformanceCounter); clock implementation/resolution and an interval correlation to the window-observation `python.time.monotonic` domain are included. Do not directly compare timestamps from different domains. API timings do not prove a game polling time or a rendered frame.

`camera_run_status` can read partial results during replay without taking control. The last eight receipts are retained in that backend's memory; keep a local MCP connection open to retain its history. A repeated retained run ID returns its receipt without replay; another recipe under that ID rejects. Eviction/restart means missing evidence, never successful completion or permission to replay blindly. A recipe repeats inputs; it does not reset the starting camera pose, scene or loading state. `game_motion_verified` and `comparison_ready` remain false, with explicit missing-measurement reasons. External recorder/measurement adapters are still pending.

## Close a requested game

`close_game` requires the owning `session_token` and a `target` copied from a fresh `list_game_windows` result: `hwnd`, `pid`, `process_created_at`, `process_path`, and `class_name`. It verifies the exact process birth/path and window identity, neutralizes nudge input, posts `WM_CLOSE` to that window without activating it, and waits 0–10000 ms (5000 by default). The process handle stays pinned until the call finishes. Unknown identity fields, critical/system processes, another desktop session, or a changed target are rejected.

Inspect `close_requested`, `window_closed`, `process_exited`, `completed`, `timed_out`, `identity_changed`, `cancelled`, and the actual UTC/monotonic boundaries. A request accepted by Windows is not proof the game exited: it may ignore the request or display a save/exit prompt. Window closure with a surviving process is reported separately. No prompt is answered automatically.

`force` defaults to false. Set it true only after the human explicitly requests forced termination of that exact process, accepting possible loss of unsaved data. After the graceful wait it can terminate only the original pinned process, while the original window still matches, then waits up to 2000 ms for exit. It never follows launchers, children or a process tree. A disappeared/replaced window, cancellation, expiry or F12 prevents later force. A close already posted cannot be recalled. Process pinning protects against PID reuse; window checks immediately before dispatch cannot make Windows' separate identity-check and message-post operations atomic against concurrent HWND replacement.

## Recorder interoperability and offline measurements

`prepare_measurement_plan` binds the exact prepared camera recipe/digest, run UUID, target, context and phase IDs to requested sources. It returns a digest and the recorder's prepare/start/phase/stop/cleanup marker contract. It starts no recorder or game. A local `RecorderAdapter` protocol and `RecorderLifecycle` wrapper provide replaceable setup/start/stop/cleanup boundaries outside the input scheduler, including failed starts, cancellation and cleanup receipts. No live recorder launcher is registered in this release.

`analyze_measurement_artifact` reads supplied UTF-8 content and verifies its exact SHA256. Its `artifact.report` declares `source_id`, `format`, `producer` (name/version/optional binary hash), `clock` (domain/unit/optional time column, frequency, timezone and evidenced anchor), `raw_reference`, and `raw_sha256`. Optional `binding` is the exact measurement plan; mismatched bindings reject, missing bindings stay flagged. Supply actual recorder exit/loss/completion, markers and quality flags when known; never invent them. The public session ID may be recorded; private session tokens are not part of this schema. Tool schemas describe the full contract.

Supported offline adapters are `presentmon_csv`, headerless `gpu_csv` (timestamp, used MiB, total MiB, utilization percent), and `legacy_phase_json`. PresentMon keeps raw header identity and separate contiguous PID/swapchain/PresentMode segments. Zero intervals remain zero and NA remains unavailable; application submission cadence is distinct from display-change cadence. An Application frame label does not prove base/generated classification. GPU samples describe total-adapter usage, not per-game allocation, a process budget or OOM. Legacy JSON retains original human stationary/crash classifications and restoration outcomes. Raw artifacts and their hashes remain authoritative.

Inline content is limited to160000 characters and the hosted request remains limited to256KiB including JSON. For larger saved artifacts, write the preparation result to `plan.json` and a `RecorderReport` to `report.json`, then run:

```powershell
.\.venv\Scripts\python.exe scripts/analyze_measurement.py plan.json report.json capture.csv
```

The offline CLI reads up to8MiB and50000 CSV rows without changing files. Neither path executes a command from a report, reads a report's reference path, starts capture, changes focus or sends input. Recorder execution, target continuity and supplied clock anchors remain unverified. The tool joins only a matching camera receipt retained by the same backend; camera delivery does not verify rendered motion. Recorder and camera gates remain separate, and `game_motion_verified` / `comparison_ready` stay false until an independent live evidence verifier exists. Lost events, missing output, partial capture, crash, focus/geometry changes, loading, changed scene and unknown cleanup must remain explicit.

`scripts/smoke_measurement.py --fixtures` checks the retained offline traces through real stdio MCP and the offline parser; `--cloud` uses only the isolated loopback Worker. The tests never launch a game or recorder and send no input. A stationary trace and an interrupted moving/crashed trace remain unsuitable for a completed motion comparison.

## Controller emulation

`connect_controller` attaches a neutral `xbox360` or `ds4` virtual device. `play_controller` executes full timed states, while `set_controller_state` applies a state for a lease of up to five seconds. Sticks range from -1 to 1 (+X right, +Y up for either controller); triggers range from 0 to 1. Sequences end neutral while keeping the device attached. F12, focus loss, emergency stop and shutdown unplug it. `disconnect_controller` explicitly removes it.

```json
{"frames": [{"duration_ms": 250, "left_y": 0.5, "right_trigger": 0.3, "buttons": ["a"]}], "capture_after": true}
```

Xbox buttons use `a`, `b`, `x`, `y`, `lb`, `rb`, `ls`, `rs`, `back`, `start`, `guide`, and `dpad_up/down/left/right`. DS4 accepts `cross`, `circle`, `square`, `triangle`, `l1`, `r1`, `l3`, `r3`, `share`, `options`, `ps`, and `touchpad`. For mixed input, put a controller state in the `gamepad` field of `play_input` frames.

The controller backend requires the existing [ViGEmBus driver](https://docs.nefarius.at/projects/ViGEm/) and a pinned [vgamepad binding](https://github.com/yannbouteiller/vgamepad). `controller_status` checks dependencies without creating a device. ViGEmBus is an end-of-life dependency; this version supports existing installations and does not install or update the driver. Install the optional binding with its driver installer disabled:

```powershell
$env:VGAMEPAD_SKIP_VIGEMBUS_INSTALL = 'true'
.\.venv\Scripts\python.exe -m pip install -e '.[controller]'
Remove-Item Env:VGAMEPAD_SKIP_VIGEMBUS_INSTALL
```

A connected controller reserves nudge's input lock until disconnected. Neutral connection may precede launch, but controller actions require a selected foreground game. The device state is global to Windows, so compatible games and launchers can detect it.

## Compatibility

Keyboard injection uses PyDirectInput scan codes and checked Windows SendInput calls. Relative mouse deltas are mouse counts, not camera degrees. Menu coordinates use native client pixels; screenshots may be resized, so scale coordinates back using the listed native dimensions.

Game compatibility varies. A Windows injection receipt is not proof that a game accepted a control. Capture uses the visible desktop client region, so occluding windows appear in the image. Some exclusive-fullscreen or protected renderers require windowed/borderless mode. nudge does not install drivers, escalate privileges, access game memory, or bypass anti-cheat. Launching a game may still encounter launcher, sign-in, or setup prompts. ChatGPT and cloud chats reach the desktop through the authenticated MCP app and paired companion; local chats can also use stdio.

## Verification

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts/smoke_mcp.py
.\.venv\Scripts\python.exe scripts/smoke_observation.py
.\.venv\Scripts\python.exe scripts/smoke_native.py
.\.venv\Scripts\python.exe scripts/smoke_controller.py
.\.venv\Scripts\python.exe scripts/smoke_launch.py
.\.venv\Scripts\python.exe scripts/smoke_sessions.py
.\.venv\Scripts\python.exe scripts/smoke_tray_sessions.py
.\scripts\Test-NudgeCompanion.ps1
```

`smoke_observation.py` checks process/window metadata and clipped capture of its own temporary no-activate window, verifies foreground is unchanged, and sends no input. The other native smoke tests create their own temporary input window, exercise actual Windows input and capture, and close that window. Controller verification reads real Xbox state through Windows XInput and real DS4 state through SDL; it requires the test-only `pygame-ce` package. These fixtures do not prove compatibility with a particular game.

`smoke_diagnostics.py` uses the isolated loopback Worker fixture at `127.0.0.1:8788` to test HTTP MCP → Durable Object → outbound WebSocket → native MCP identity/status and the retained offline SQLite record. It sends no input and never changes production authentication.
