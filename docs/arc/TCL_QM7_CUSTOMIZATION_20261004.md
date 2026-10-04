# TCL QM7 / Arc customization: evidence and worker brief

Updated October 4, 2026 UTC. Target: Lauren’s TCL **55QM751G (2024 QM7)**, previously identified through ADB as **G08_4K_US / Smart_TV_Pro / G08**, friendly name lömirror.

## Bottom line

**A successful bootloader-unlock method has not been established for this TV. We also have not established that every requested visual change requires unlocking.** Earlier work identified the TV and proposed diagnostics, but did not preserve the actual firmware/build fingerprint, unlock-property results, or package ownership needed to make those conclusions.

Arc’s live HDMI background already worked with dimming/vignette according to Lauren’s later project report. The blur attempt failed. Do not restart the project as though HDMI support does not exist.

## Requested surfaces and current verdict

| Surface | What can be said now | Evidence needed for a definite implementation decision |
|---|---|---|
| Arc menus/cards/own settings | App-owned UI can be redesigned in Arc source. This is different from TCL’s system Settings. | Inspect current Arc checkout, installed package/version and Android/Flutter embedding. |
| TCL settings-menu theme | Not established as editable by an ordinary app. Resource overlays might expose some colors; replacing behavior or protected resources is different. | Identify actual owning APK, its overlayable resources/policies, installed overlays and signatures. |
| HDMI/input screen and no-signal background | Ownership is unresolved. It may involve TCL input service, overlay window, or vendor composition rather than Arc. | Capture active activity/window/input-service identity during live HDMI and no-signal states. |
| Corner input popup | No verified package owner in retained evidence. Do not assume it is part of the launcher. | Capture window owner/UID while popup is visible; map UID to package and inspect that package. |
| Live HDMI blur behind Arc | Still unverified. A Flutter blur widget cannot be assumed to filter an independently composited native/video surface. Root alone would not prove it works. | Trace current HDMI surface, composition mode, OS blur support and protected-content behavior. Test only after a separate reversible app-test plan is approved. |
| OEM unlock / root | Toggle was reported grey despite Developer options/internet/no known admin restriction. No captured values or successful method. | Exact firmware and read-only boot properties. Separate supported unlock from rooting and system modification. |

## What primary documentation establishes

Android 12+ provides public cross-window blur APIs. Availability depends on device graphics support and runtime state; some video playback can disable it. The API being available is therefore **not proof of QM7 HDMI blur**. Query availability and inspect the actual composition path. [Android window-blur documentation](https://source.android.com/docs/core/display/window-blurs)

Flutter has distinct native-view composition paths; SurfaceView integration and Flutter-rendered textures have different behavior. Inspect Arc’s actual implementation before changing its composition mode. A general platform-view transformation capability is not a guarantee that BackdropFilter can sample live HDMI. [Flutter Android platform views](https://docs.flutter.dev/platform-integration/android/platform-views)

Android runtime resource overlays can change eligible resources, but target overlayability and policy/signature restrictions matter. They are not a general way to rewrite system-app behavior, and ordinary ADB access does not grant a vendor signing identity. [Android resource-overlay documentation](https://source.android.com/docs/core/runtime/rros)

Android’s OEM-unlock setting permits an unlock operation on implementations that support it; it is not root access. Unlock support is a build/device capability. A standard unlock operation entails a data reset. Firmware update files or a related chipset’s flashing instructions do not establish retail unlockability for this exact model/build. **Do not unlock, flash or reboot into a service mode during discovery.** [Android bootloader documentation](https://source.android.com/docs/core/architecture/bootloader/locking_unlocking)

## Read-only discovery packet

Use an already authorized, currently discovered ADB connection. Do not hardcode the old wireless address/port. If pairing or new debugging access is needed, have Lauren approve it normally. Do not scan the network or change device settings to acquire access.

Collect individually, retaining errors/empty values as unknowns:

```sh
adb devices -l
# Select the verified TV serial for every following command.
adb -s "$TV_SERIAL" shell getprop ro.product.model
adb -s "$TV_SERIAL" shell getprop ro.product.device
adb -s "$TV_SERIAL" shell getprop ro.product.name
adb -s "$TV_SERIAL" shell getprop ro.build.version.release
adb -s "$TV_SERIAL" shell getprop ro.build.version.sdk
adb -s "$TV_SERIAL" shell getprop ro.build.fingerprint
adb -s "$TV_SERIAL" shell getprop ro.oem_unlock_supported
adb -s "$TV_SERIAL" shell getprop sys.oem_unlock_allowed
adb -s "$TV_SERIAL" shell getprop ro.boot.flash.locked
adb -s "$TV_SERIAL" shell getprop ro.boot.verifiedbootstate
adb -s "$TV_SERIAL" shell getprop ro.boot.vbmeta.device_state
adb -s "$TV_SERIAL" shell getprop ro.surface_flinger.supports_background_blur
adb -s "$TV_SERIAL" shell settings get global disable_window_blurs
adb -s "$TV_SERIAL" shell cmd overlay list --user 0
adb -s "$TV_SERIAL" shell pm list packages -f -U
adb -s "$TV_SERIAL" shell dumpsys tv_input
adb -s "$TV_SERIAL" shell dumpsys activity activities
adb -s "$TV_SERIAL" shell dumpsys window windows
adb -s "$TV_SERIAL" shell dumpsys SurfaceFlinger --list
```

Have Lauren show, using her remote, each of: Arc on live HDMI; TCL Settings; input chooser; corner input popup; no-signal screen. Repeat the last four dumps for each state. If a short-lived popup is missed, repeat observation rather than infer its owner. Keep raw captures private; redact account names, network identifiers or viewing history before sharing beyond this work.

Then inspect only the **observed** package IDs with `dumpsys package` and `pm path`. Read relevant APK manifests/resources from permitted copies. Earlier names such as `com.tcl.tv`, `com.tcl.tvinput`, and `com.tcl.settings` were hypotheses, not observed ownership. Do not use them as a deletion list.

Inspect Arc’s current code and retained changes. Record: Flutter version; Android SDK/min SDK; TvView/SurfaceView/TextureView usage; window flags; platform-view composition; native methods; input service IDs; whether HDMI comes from an app surface or external hardware plane. Device blur-capability queries may require a small diagnostic app; proposing/building it is distinct from permission to install/run it on the TV.

## Stop conditions and acceptance

- No root, unlock/lock, flash, factory reset, `adb root`, remount, system/vendor writes, package disable/uninstall, permission grants, overlay enable/disable or bootloader reboot in this discovery stage.
- No generic MediaTek/TCL-phone exploit instructions applied to this TV, and no DRM/protected-video capture bypass.
- A blank property is not proof of support or lack of support. A locked state is not proof that a supported unlock exists.
- Return one evidence row per requested surface: exact owner, exact artifact/build, available mechanism, privilege requirement, reversible test plan, and confidence.
- Classify each as **supported without root**, **requires specific privileged access**, **unsupported on this firmware**, or **not established**. “For sure” requires device evidence, not optimistic extrapolation.
- If privileged modification is necessary, stop and present the exact supported method, recovery path and consequences for Lauren’s separate decision. Preserve Arc and Projectivy fallback.

This is an investigation handoff, not evidence that the television has been modified or that a new worker has been started.
