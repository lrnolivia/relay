# Windows startup repair — 2026-10-29

Lauren authorized registering Puck & Play in Relay, starting it hidden in both Windows desktop and Xbox modes, and repairing brief console windows from other startup helpers. No product update, hardware recovery, reboot or session switch was requested.

## Registration

`projects/puck-and-play.json` identifies `lrnolivia/puck-and-play`, with an initially empty `coordination/puck-and-play.json`. Live inventory found only `main` at `6260546c7168028cb8d6f20cb24933d8a850c1ed` and no open PRs. Registration adds no cloud Worker or cloud publication authority. Native build/package validation remains owned by the product README and workflows. The central coordination workflow is available; a product PR admission check has not been installed by this repair and must not be described as enforced.

## Installed startup

The installed application is version **1.2.2.0** in `%LOCALAPPDATA%\Programs\Puck & Play`. An existing HKCU Run value already used `PuckAndPlay.exe --tray`; the initial CIM startup inventory omitted it. The user-level scheduled task **Puck & Play** now launches that same executable directly with `--tray` at this user's logon, independently of Explorer's deferred startup-app processing. The task uses an interactive token, limited privileges, no battery restriction and no execution time limit. The existing single-instance mutex prevents duplicate monitors when the desktop Run entry is also processed.

The task was started successfully in the current session. The monitor and its `--warm` interface process were running, and the native window inventory contained no visible Puck & Play window. Task result `0x41301` means the long-running tray process is still running. This verifies the launch action, not a cold Xbox-mode boot.

## Other startup helpers

PE inspection identified two console-subsystem startup targets: **SteamGridDB Desktop Repair** (`powershell.exe`) and **UWD2** (`uwd2.exe inject`). Decky's shortcut and running plugin processes already use the GUI-subsystem `PluginLoader_noconsole.exe`; they were left unchanged.

The two affected shortcuts now target a small GUI-subsystem launcher at `%LOCALAPPDATA%\loew.fi\Startup\StartHidden.exe`. Its fixed profiles preserve the original executable, arguments and working directory, setting `UseShellExecute=false`, `CreateNoWindow=true` and `WindowStyle=Hidden` before process creation. Existing startup enable/disable choices are preserved. Source is retained beside the launcher. SHA-256: `11DDEE24876D4628CEF21598F90A763C51BCAE4A037693A4EF6173B0EDF15000`.

A console probe compiled against the same launch code confirmed that the child was created with no console. An unknown profile returned exit code 2. Original shortcuts and the previous Puck Run command are retained under `%LOCALAPPDATA%\loew.fi\Startup\backup-20261029-191741`. The task definition is retained in `PuckAndPlay.task.xml` beside the launcher.

## Verification limits and recovery

No reboot, logoff or Xbox-mode transition was performed during this repair. A fresh sign-in into each mode remains the final end-to-end observation. Neither Decky's internal subprocess behavior nor unrelated vendor startup windows were proven to cause the reported flash. If a flash remains, capture the new process identity before changing another helper.

To undo the local configuration, unregister only the **Puck & Play** task and restore the two backed-up shortcuts. The existing Puck Run value was preserved. Removing the application with its current uninstaller may leave this locally added task behind; unregister it when uninstalling. These are local machine repairs, not an upstream installer release.
