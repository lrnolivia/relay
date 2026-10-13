# RTXForge 0.4.3 — Library polish

This release retains the compiled Proton MFG fork and pinned NR layer from 0.4.2.

- Restores the simple green F icon.
- Removes the hero background gutters and uses the game's accent in the profile panel.
- Moves artwork credits into a small popover button.
- Adds Open folder and Play for Steam-installed games. No games are launched automatically.
- Centers the install profile controls, places NR + MFG first, and gives MFG/NR/unavailable distinct consistent colors.
- Shrinks the library-view icons and replaces the full-width progress bar with a compact activity pill.
- Collapses the hero header while scrolling long libraries and uses a smaller default poster size. Saved user sizes are retained.
- Displays detected MFG route information on installed cards.

This is the first Forge notes UI pass. Automatic launch/test logging, Game Mode transitions, game notes/bench/reports, and non-Steam metadata matching remain outstanding. The combined NR/MFG runtime still needs a controlled cold-start game check. Python compilation and a native demo startup/interaction check passed; no installed game was changed for verification.
