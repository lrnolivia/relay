import fs from "node:fs/promises";

const RULES = [
  ["lockfile", /npm ci can only install|package\.json.*package-lock|lock file.*out of date|EUSAGE/i],
  ["peer-dependency", /ERESOLVE|peer dep|peer dependency/i],
  ["node-version", /EBADENGINE|unsupported engine|wanted.*node|requires node/i],
  ["native-build", /node-gyp|gyp ERR|prebuild-install|make:.*Error|CXX/i],
  ["registry-network", /ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENETUNREACH|registry\.npmjs\.org.*5\d\d/i],
  ["permissions", /EACCES|EPERM|permission denied/i],
  ["missing-package", /E404|not found.*registry|No matching version found/i]
];

export function classifyInstallLog(text) {
  for (const [kind, pattern] of RULES) {
    if (pattern.test(text)) return kind;
  }
  return "unclassified";
}

export function diagnoseInstallLog(text) {
  const classification = classifyInstallLog(text);
  const lines = text.split(/\r?\n/)
    .map((line) => line.replace(/^.*?npm (?:error|ERR!)\s*/i, "").trim())
    .filter(Boolean);

  const missing = lines
    .filter((line) => /^Missing:/i.test(line))
    .map((line) => line.replace(/^Missing:\s*/i, ""))
    .filter(Boolean);

  const preferred = [
    ...lines.filter((line) => /^Missing:/i.test(line)),
    ...lines.filter((line) => /can only install packages when your package\.json and package-lock\.json/i.test(line)),
    ...lines.filter((line) => /ERESOLVE|EBADENGINE|unsupported engine|No matching version found|EAI_AGAIN|ECONNRESET|ETIMEDOUT|EACCES|EPERM/i.test(line))
  ];

  return {
    classification,
    reason: preferred[0] || "Install failed; see workflow log for the first failing npm diagnostic.",
    missing
  };
}

if (process.argv[1]?.endsWith("classify-install.mjs") && process.argv[2]) {
  const text = await fs.readFile(process.argv[2], "utf8");
  const diagnosis = diagnoseInstallLog(text);
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(diagnosis, null, 2));
  } else {
    process.stdout.write([
      "# Dependency Doctor",
      "",
      `**Classification:** ${diagnosis.classification}`,
      "",
      `**Reason:** ${diagnosis.reason}`,
      ...(diagnosis.missing.length
        ? ["", "**Missing lockfile entries:**", ...diagnosis.missing.map((item) => `- ${item}`)]
        : []),
      "",
      "The complete install log is attached to the workflow run."
    ].join("\n"));
  }
}
