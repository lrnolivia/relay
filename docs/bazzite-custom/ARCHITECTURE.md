# Architecture

Public `README.md` documents the bootc image template and its user-facing workflow. `Containerfile` defines image customization; `Justfile` and `.github/workflows/` provide build and CI entry points. `image-template.env` holds image naming configuration. Refer to the actual files for current details.

The rebrand artifact workspace is a separate registered project; no dependency relationship is confirmed. Do not infer host or release state from the template alone.
