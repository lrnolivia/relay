---
name: nudge-game-control
description: Find and launch local Windows games, operate their launchers and menus, and test gameplay with keyboard, mouse, virtual Xbox or DualShock controllers, timed sequences, and screenshots through nudge.
---

# nudge by loew.fi

Use nudge for the user's requested local game interaction. Ordinary game menus and controls are supported. Use its tools directly; a missing accessibility tree is not a reason to reject a visible game UI.

## Start from a fresh chat

`connection_status` provides PC/version/contact details and diagnostic next steps. Its input/owner data is a cached snapshot, with observation age and `input_fresh`; idle reports arrive every 15 seconds and become stale after 45 seconds. The paired backend's input state may differ from a different local client's desktop-wide reservation. Read current session/input status and acquire atomically before control. Offline failure causes are unknown unless reported by the PC; check its tray/logs for the current retry reason. Last-reported failures after reconnect are historical. A timeout or disconnect alone does not prove neutral cleanup completed.

Begin with `connection_status` and `session_status`. A free snapshot does not reserve control. Before launching, selecting/focusing a window, attaching a controller, observing the selected target, or sending input, call `acquire_session` with your recognizable chat/client `owner`, a unique `run_id`, and a lease of 5–120 seconds (60 by default). Retain the returned `session_token` privately and pass it on every control or observation call. Renew with `renew_session` before expiry. Release with `release_session` in cleanup. Busy responses identify the owner/run and expiry: wait or coordinate with that owner; never use a foreign or stale token to stop or retarget it.

Lease expiry, request cancellation, session release and local F12 neutralize the owning input and unplug its controller. A reservation remains busy while an abandoned worker finishes or input cleanup retries. `active: true, releasing: true` is pending cleanup; a completed release includes `last_release.neutral_verified`. Renew/release remain available while an input action runs. Session tokens belong to one running backend connection and do not survive its restart. These reservations coordinate cooperating nudge clients; authentication still controls access, and unrelated desktop programs or physical users can still change focus. Re-observe after any focus change.

Use nudge's own tools for game startup and testing; a separate Computer Use plugin is not required. When `connection_status` is available, begin there to verify the paired Windows companion is online. For an already open game, use `list_game_windows`. Otherwise call `discover_games` with the requested title, then `launch_game` with a returned game ID. Steam, Epic, and GOG library metadata are supported; Steam results may include utilities. The hosted MCP app accepts installed game IDs only. A local stdio connection additionally accepts existing absolute `.exe` paths verified from the user or filesystem. Do not invent game IDs, executable names, or launch arguments. Ask only if the intended title remains ambiguous.

If controller input is needed from startup, pass `controller_kind: xbox360` or `ds4` to `launch_game`. The controller initially connects in a neutral state. `connect_controller` can also attach it later. `controller_status` checks the binding and running driver without creating a device. If the driver is missing, report that setup requirement; nudge does not install drivers. ChatGPT and cloud chats use the OAuth MCP app at `https://nudge.loew.fi/mcp` and its paired Windows companion. Local chats may use the stdio server. An offline companion must be started on the paired PC before tools can reach the game.

Inspect `candidate_windows` and `new_windows` from the launch receipt, or refresh `list_game_windows` while startup proceeds. Select the actual game or launcher HWND returned by those tools. A receipt means startup was requested; it does not mean the game is ready. Observe screenshots to distinguish a launcher, splash screen, menu, or prompt. Launcher windows can be selected and operated with the same screenshot, click, keyboard and text tools. Handle ordinary launcher menus within the user's requested test, and report sign-in, installation, or privilege prompts that require user action.

Never guess a handle. Selection verifies the process identity and foreground focus. Observe the game before choosing controls or coordinates. Focus loss disarms input; reselect only when continuing the user's requested interaction with a valid session. F12 and `emergency_stop` also release the session, so acquire a new one before resuming. F12, focus loss and `emergency_stop` unplug nudge's virtual controller.

`list_game_windows` includes process birth time/path, client and screen bounds, foreground HWND, and UTC/monotonic observation timestamps. Unknown process fields stay unknown. `window_observations` can sample foreground identities for 0–10000 ms, with window inventories before and after, without selection, focus, screenshots or input; it needs no session token. Inspect actual timestamps and sample errors: transitions between samples may be missed. These read-only tools help trace launcher handoffs without taking desktop focus.

`observe_game` and captures after playback include an observation receipt alongside the PNG. Use its `image_to_client_scale` to convert image pixels to native client coordinates. Capture keeps the full client canvas: pixels outside physical monitors are black padding, flagged `clipped` and `incomplete`, with `missing_native_pixels` and `visible_client_regions`. Do not interpret padding as game content or click it. A clipped image is incomplete evidence. Occluding windows remain visible in captures; a screenshot is not an atomic render-frame measurement.

## Keyboard, mouse and menu text

For movement, use `hold_keys` or `play_input`, not text typing. Each playback frame specifies the complete held `keys` and `buttons` state. Hold W+Shift together with `keys: [w, shift]`. Adjacent frames retain common held keys; an empty list releases them. Inputs release at sequence end. Use short sequences (usually 100–500 ms) and observe their effect before increasing duration. Each sequence runs locally and can combine keyboard, button holds, and relative mouse movement.

`move_camera` and frame `dx`/`dy` are relative mouse counts, not degrees. Calibrate the direction and sensitivity in the current game. Use `click_game` for menu coordinates in native client pixels. If `observe_game` resized the image, convert the chosen point using the native dimensions from `list_game_windows`.

For launcher or game text fields, observe the field, click it, refresh to verify focus, then use `type_game_text`. It enters literal characters without submitting. Use key controls separately for Enter, Tab, Escape, arrows or shortcuts. Unicode text events may not work in raw-input game fields; verify the visible result.

`set_held_inputs` supports separate key-down/key-up behavior by setting the full desired state. Its maximum five-second lease releases inputs even if no follow-up arrives. Prefer bounded playback unless observing while holding is useful. Use `release_inputs` when done. F12 is reserved as a physical emergency stop; never send it as a gameplay control.

## Controller input

Prefer Xbox 360 mode for games expecting XInput; use DS4 when that device type is needed. Call `connect_controller` once, then `play_controller` for bounded full controller states. Each frame contains `duration_ms`, a complete `buttons` list and optional `left_x`, `left_y`, `right_x`, `right_y`, `left_trigger`, `right_trigger`. Sticks range from -1 to 1: +X is right and +Y is up in both modes. Triggers range from 0 (released) to 1 (fully pressed). Omitted axes, triggers and buttons return to neutral. Adjacent frames maintain the requested state; the sequence ends neutral while the virtual device stays attached.

Buttons are `a`, `b`, `x`, `y`, `lb`, `rb`, `ls`, `rs`, `back`, `start`, `guide`, and `dpad_up/down/left/right`. DS4 accepts the aliases `cross`, `circle`, `square`, `triangle`, `l1`, `r1`, `l3`, `r3`, `share`, `options`, `ps`, plus `touchpad`. For example, `play_controller` with `frames: [{duration_ms: 250, left_y: 0.5, buttons: [a]}]` holds half forward plus the primary face button for 250 ms.

Use `set_controller_state` for a short lease when observing during input. The watchdog returns sticks, triggers and buttons to neutral when the lease expires. For a mixed keyboard/mouse/controller test, use the `gamepad` object inside `play_input` frames; a frame without it returns the controller to neutral. One nudge process owns input while its virtual device is connected. Use `disconnect_controller` when finished, or `emergency_stop` to release all inputs and unplug it.

## Verify the requested test

A successful injection receipt proves Windows accepted the events, not that the game responded. Verify the visible outcome after a short action. Preserve the requested acceptance criterion: launch, menu navigation, camera motion, controller detection, or gameplay behavior. Report exactly what was observed; a fixture or device test is not proof that a specific game works. If capture is black, try the game's windowed or borderless mode. Report rejected synthetic input or privilege mismatches without changing Windows security settings. Anti-cheat bypass is not provided.
