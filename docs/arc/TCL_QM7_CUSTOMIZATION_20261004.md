# TCL QM7 / Arc: feasibility findings

Prepared 2026-10-04 UTC for Julian and the existing **TV Overhaul** operator. Research and read-only inspection only. This supersedes the initial assumptions in the [immutable Relay brief](https://github.com/lrnolivia/relay/blob/c4cf5574fb7aa9899679f4261874600544e26397/docs/arc/TCL_QM7_CUSTOMIZATION_20261004.md).

## Decision

**Arc-owned menus, cards, settings screens and no-signal fallback are customizable without root. Actual TCL Settings and TCL Live TV resources cannot be reskinned by an ordinary Arc update or ordinary user-signed resource-overlay APK on the retained artifacts. The existing HDMI rendering path has no demonstrated live-blur solution. A supported unlock/root route for this exact television and firmware is not established.**

This is stronger than the initial brief because historical raw properties, package identities, APK signatures/resources, current Arc source and the previous blur investigation were recovered. It is not a fresh TV certification: `adb devices -l` returned an empty list on this Mac on October 4. No connection, pairing, network sweep, installation, device command beyond listing, or TV mutation was attempted. The sandbox initially blocked the local ADB listener; the authorized outside-sandbox listing succeeded and was empty.

## Existing owner and current registration

- Authoritative operator: **TV Overhaul**, local task `01a0a348-4d7b-7c00-bc67-66bcf0d03b03`, workspace `~/PJM`.
- Existing Relay assignment: `arc-tv-launcher-relay-registration-20261004`, owner same task; observed branch `relay/arc-tv-launcher-register-20261004`. Original claim used `projects/arc-tv-launcher.json`; operator corrected it to `projects/arc.json`.
- Live discovery at **2026-10-04T04:47:44.879Z** lists **arc / Arc TV Launcher**, repository `meddouribadis/arclauncher`, `managed:false`, coordination unavailable. [Registry](https://github.com/lrnolivia/relay/blob/main/projects/arc.json), observed blob SHA `0449b3a8d7853cd525b59e91f333dfe41d1878bf`. It is explicitly tracking-only; upstream is not authorized for Lauren's customization writes.
- The immutable brief and preliminary results were delivered through the supported local task messaging tool, which accepted the target ID. This is delivery acceptance, not operator acknowledgment or implementation acceptance.
- Existing [source ZIP Library handoff](https://chatgpt.com/space/page_68cda3a33f988191b2a2669dd6253cf6) remains the operator's handoff. This investigation created no duplicate worker, registration, branch or implementation.
- Canonical Bible/manifest read: Bible version `2026-09-30.3`, blob `786049e968b7d78a1999b2a553cd8ff1b833c259`; manifest version `2026-09-30.2`, blob `58ea79b6fd11cbcf1502088b756ed64c21df54fa`. No Arc root AGENTS.md was present in the inspected checkout. PJM instructions were read as local historical context; current delegated scope controls this investigation.

## Evidence baseline — historical TV, current files

`~/tv-debloat/PROPERTIES.txt` directly records:

```text
ro.product.model = Smart TV Pro
ro.product.device = G08
ro.product.name = G08_4K_US
ro.build.fingerprint = TCL/G08_4K_US/G08:14/UTT2.250416.001/AU14:user/release-keys
ro.software.version_id = V8-T653T02-LF1V321
ro.build.version.release = 14
ro.build.version.sdk = 34
ro.build.version.security_patch = 2025-12-05
ro.boot.hardware = mt5896
ro.hardware.version_id = MT9653_NA
ro.boot.vbmeta.device_state = locked
ro.boot.verifiedbootstate = green
ro.debuggable = 0
ro.oem_unlock_supported = ABSENT FROM CAPTURE
sys.oem_unlock_allowed = ABSENT FROM CAPTURE
ro.boot.flash.locked = ABSENT FROM CAPTURE
ro.surface_flinger.supports_background_blur = ABSENT FROM CAPTURE
```

Relevant raw lines: fingerprint 535; locked/green 507/514; SDK 557; model/device/name 917/912/918; firmware 970. No hardware serial, old endpoint or network identifier is reproduced here.

The September 26 entry in `DEBLOAT-LOG.md:9–10` independently reports empty OEM-unlock properties, disabled OEM-unlocking UI, earlier production-adbd root refusal, and no successful unlock. September 30 blur reports say OEM-lock/persistent-data-block services absent. These are historical reports, not fresh raw output from this run. Do not interpret `sys.tcl_unlocked=1` as bootloader unlock; its semantics are not established, while AVB explicitly reports locked/green.

## Surface decisions

| Requested surface | Exact evidence and mechanism | Verdict / privilege boundary |
|---|---|---|
| Arc menus/cards/own settings | Current `lib/widgets/appliance_home.dart`; package `com.omeda.arc.inputs`, retained release 1.0.8/code 4117. Flutter owns card, text, color, dimming and both upper-corner vignette layers. | **Supported without root.** Source changes can style these views. Existing Settings button invokes `Settings.ACTION_SETTINGS`; it opens TCL Settings and is not an Arc-owned settings screen. |
| TCL system Settings theme | `TvSettings.apk`: `com.android.tv.settings`, code 33900, version `3.39.00_8b17034_251218_master`; `MainSettings` activity; system shared UID; verified TCL signer; no overlayable entries. Historical Settings overlays are GMS, Google, vendor and MediaTek system overlays. | **Requires specific privileged/system-image or matching-signature access for an RRO resource reskin.** Normal user-signed theme overlay is not an available route. A full behavior/layout replacement remains system-app work, not an Arc theme. Existing night mode is reported already active. |
| Input chooser / no-signal screen | Raw TV input dump observes `com.tcl.tvinput/.TvPassThroughService` HW15–18 (HDMI1–4). Retained `com.tcl.tv` APK owns full-screen `com.tcl.player.TVActivity`. Its `snowview_layout` (`0x7f0d01de`, `res/xN.xml`) has a background, `TclAnimateView`, no-signal views and related drawables. | **Arc's own chooser/fallback: supported without root. Native TCL screen reskin: same privileged RRO/signing boundary as Live TV.** Exact owner/resource of the pattern Lauren sees remains **not established** without a state-matched capture. APK resources prove candidates, not that a specific layer was displayed. |
| Corner HDMI popup | Historical log identifies `com.tcl.tv` secure TVActivity and `right_top_content_view`. Fresh APK inspection confirms `infobar_right_top_dialog` (`0x7f0d0111`, `res/iq.xml`), child `right_top_content_view` (`0x7f0a0560`), background `0x7f0800bf`. | **Requires specific privileged/signing access to restyle the actual TCL banner via its resources.** Owner is historically supported, with matching artifact proof; current window/UID capture remains pending. Drawing an Arc banner would not replace or suppress the TCL popup by itself. |
| Live HDMI blur behind Arc | Current native controller creates `TvView`, adds it below Flutter, tunes TCL passthrough with `isCecDeviceDisable=true`, mutes preview and restores volume on release. Flutter uses transparent `RenderMode.texture`; HDMI is not a Flutter texture. Retained report records ineffective RenderEffect, six PixelCopy result 3 attempts after video available, and `wm disable-blur` reporting unsupported/disabled. | **Current tested public blur routes failed / were unsupported on retained V321.** Flutter BackdropFilter cannot access this separately rendered HDMI image. No supported alternative live-blur route established. Root is not a sampling guarantee. Cross-window blur support and the actual compositor/secure-plane state need fresh raw confirmation if revisited. |

Both system APKs pass `apksigner verify`. Both declare `android.uid.system`; both have zero entries from successful `aapt2 dump overlayable`. Signer certificate SHA-256 for both:

`25606cd9fadf3da6a16e741db6d70c3c5c5ebf1ec58bfc327517dec430ceba98`

Android's documented rule for a target without an overlayable set requires an overlay preinstalled on the system image or signed like the target. An installed vendor overlay is not a public theme extension point. The historical log records certificate-mismatch rejection of the earlier Settings overlay probe and immutable installed Settings overlays; that experiment was not repeated. [AOSP RRO rules](https://source.android.com/docs/core/runtime/rros)

## HDMI and unlock limits

Arc source currently uses **Flutter 3.41.9 / Dart 3.11.5**, compile SDK 36; retained APK min SDK 24 / target 35. Base HEAD is `f2e9e1deecbe5f4e30504a0840506dcb8b4ea17a`, remote `https://github.com/meddouribadis/arclauncher.git`, with substantial pre-existing dirty changes and untracked controller/assets. HEAD alone does not identify the customized app. No rebuild or install was run; the retained release APK is not freshly matched to the TV installation.

`MainActivity.java:86–88` selects transparent Flutter texture rendering. `TvBackgroundController.java` creates a native TvView and adds it at content index 0; it does not return HDMI image data to Flutter. `appliance_home.dart:790` onward draws the dark gradients and vignettes. This explains working transparency/dimming without working blur. [Flutter BackdropFilter](https://api.flutter.dev/flutter/widgets/BackdropFilter-class.html), [Android TvView](https://developer.android.com/reference/android/media/tv/TvView)

PixelCopy result 3 means no queued source frame data; it does **not** establish HDCP as the cause. The six failures are retained research-report evidence; the raw six-result log and original probe artifact were not recovered here. Cross-window blur is a separate compositor capability requiring OEM support, not an arbitrary view filter. [PixelCopy](https://developer.android.com/reference/android/view/PixelCopy#ERROR_SOURCE_NO_DATA), [AOSP window blur](https://source.android.com/docs/core/display/window-blurs)

The earlier report's private TCL `isHideTvViewTune` / `TTvInputManager.setDisplaySurface` SurfaceTexture path remains a research lead only. Its service-owned texture is not evidence of a public frame-return API. The actual input-service APK/framework interface was not retained among the two inspected APKs. `TIF_LiveTV.apk` is **com.tcl.tv**, not the input-service APK. No verified permission-compatible client surface handoff or video-plane blur endpoint is known.

**No supported retail unlock/root route for G08 / US T653T02 V321 was established.** Missing properties are not zero and locked/green does not prove either unlockability or permanent impossibility. No official exact-build procedure or recovery image was verified. Related TCL/iFFALCON UART, Amlogic TV, phone or community firmware-flashing reports do not establish support here. OEM cooperation/signing or a supported system-image route would be needed before treating native system reskinning as implementable; rooting is not itself a solution. [AOSP unlock contract](https://source.android.com/docs/core/architecture/bootloader/locking_unlocking)

## Minimal safe next plan

1. Keep TV Overhaul as owner. Publish this report under an admitted Relay `docs/arc/` path when the parent has scope; this Library artifact avoids competing with the registration assignment. Preserve its existing ZIP, local dirty source, audio-fixed rollback and launcher fallback.
2. Product work can proceed on **Arc-owned** UI only in the existing owner's authorized customization checkout or authorized user-owned fork. Do not modify public upstream through the tracking-only registration. Keep current native preview/audio/CEC lifecycle behavior.
3. When an already authorized TV connection is available, re-run only the brief's read-only packet: fingerprint, firmware, explicit OEM properties with blank values preserved, `wm disable-blur` without a value, package versions/paths, overlay list, and tv_input/activity/window/SurfaceFlinger state. Lauren or the existing operator should display each surface normally. No stale IP, network scan, new pairing, UI automation or input switching was used here.
4. For the remaining input pattern and transient popup, correlate a state-matched window owner/UID and view/resource hierarchy before deciding what to change. If it matches these exact APKs, the resource privilege boundary is already known.
5. Reopen blur only after read-only inspection establishes a real accessible frame/surface-handoff or vendor compositor API, including permissions and protected-content behavior. Inspect the observed input-service/framework artifacts first. Do not repeat PixelCopy/RenderEffect tweaks or install a probe merely to retry the same path. Any later device experiment needs separate bounded authorization and a rollback plan.
6. Native theming remains blocked on privileged access or vendor support. No unlock, root, flash, reboot, resets, remount, package disable/remove, permission grant, system/vendor write, credential change or DRM bypass is authorized by this report. No Mac setting changes were made.

## Artifact provenance

All times below are filesystem **mtime UTC**, not guarantees of collection time. Historical document dates are separately stated above. Hashes identify bytes inspected on October 4.

| File (original location) | Mtime UTC | SHA-256 |
|---|---|---|
| `~/tv-debloat/PROPERTIES.txt` | 2026-09-15 04:20:13 | `aabeee1ea20f23f63ac48e418ba28ed5d5c849e03f2b07d06fcd902610dd894e` |
| `~/tv-debloat/TV-INPUTS.txt` | 2026-09-15 04:20:13 | `46984934774377be327cd8f3d5862696e068495272273747ca510434acf6ed6b` |
| `~/tv-debloat/OVERLAYS.txt` | 2026-09-15 04:20:13 | `caf82befb21e45945ddb724da549594122fab9fec8a4194e6e1c359977530117` |
| `~/tv-debloat/DEBLOAT-LOG.md` | 2026-09-27 00:34:04 | `7f53494aa199e942ca3cd8d019852dc9403608e4f7b7dd29e9ec650964f4bf36` |
| `~/tv-debloat/TvSettings.apk` | 2026-09-27 00:23:44 | `a91259c6c768cd5d9e7e8b190cd3fc0c710b6d6b16a6d5ea7281baf6c2616fc4` |
| `~/tv-debloat/TIF_LiveTV.apk` | 2026-09-27 00:23:47 | `61a7ef1e50855b9e9e0344fb74f68161375dac031439ecbef2d58b76d56f7675` |
| `~/arc-tv-input-port/BLUR-RESEARCH.md` | 2026-09-30 15:22:24 | `4a4deeb6b2bad9850f257eb92b641079522f003eac8d6eabb39e09dcd4b99a92` |
| `~/arc-tv-input-port/BLUR-AND-OEM-STATUS.md` | 2026-09-30 15:10:58 | `181571c3d4645f5dc2edc8878003456d33570f914bf1dfa6e04aa4008377d9bc` |
| Current Arc `MainActivity.java` | 2026-09-30 15:38:16 | `fd74a1146d81b2829be1f2fa9d6539c809f04f3e32fbccf1934dd385cd810cc3` |
| Current Arc `TvBackgroundController.java` | 2026-09-30 15:13:53 | `6689fe73c850baa9f87e371af6d29e7d8dd1b993ee22dc1ebbceebd16112c4ef` |
| Current Arc `appliance_home.dart` | 2026-09-30 15:41:21 | `fd8623d9fc442de864634b8500efbf2a8dec067d892b0b6738371d293143406a` |
| Current Arc `build/app/outputs/flutter-apk/app-github-release.apk` | 2026-09-30 15:41:54 | `77f2d850080fa5939c6b0d3cebe010796524f8f983a61055595bb017266c8c6f` |

Fresh local APK analysis used existing Android build-tools 35.0.0 `aapt2` and `apksigner`, writing decoded evidence only in this task workspace. Raw diagnostics and APK binaries were not uploaded; this report contains selected redacted facts. Current live package versions, current firmware, state-matched no-signal/popup ownership, compositor details, exact input-service API access and supported unlock/recovery remain the explicit unresolved device-dependent evidence.
