# Bazzite AppImage

Build with `python3 packaging/build_appimage.py`. Output: `dist/RTXForge-0.5.0-Bazzite-x86_64.AppImage` and its SHA-256 file.

This targets Bazzite 44 GNOME and uses host Python, GTK4 and libadwaita. It is not a universal Linux runtime bundle. KDE support remains secondary.

Run normally for the GUI, with `--install` for persistent desktop integration, or `--cli` for the terminal engine. Installation retains the previous AppImage and registers the existing simple F icon. New application builds do not modify games by themselves.

Provider archives are fetched and hash-verified at preparation. No historical custom OptiScaler DLL is bundled. The GUI and CLI share `engine/rtxengine.py` and `providers/lock.json`.
