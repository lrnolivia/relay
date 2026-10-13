import { openIssues, repositoryFile, repositoryMetadata } from "./github.mjs";

const MAX_FILE_CHARS = 50_000;

export async function buildContext(config) {
  const { repository, branch } = config.target;
  const files = [];

  for (const filePath of config.context?.files ?? []) {
    const file = await repositoryFile(repository, branch, filePath);
    if (file.ok && file.text.length > MAX_FILE_CHARS) {
      file.text = `${file.text.slice(0, MAX_FILE_CHARS)}\n\n[runner truncated this file]`;
    }
    files.push(file);
  }

  return {
    metadata: await repositoryMetadata(repository),
    files,
    issues: config.context?.include_open_issues ? await openIssues(repository) : []
  };
}

export function renderContext(packet) {
  const sections = [
    `## Repository metadata\n\n${JSON.stringify(packet.metadata, null, 2)}`
  ];

  for (const file of packet.files) {
    sections.push(
      file.ok
        ? `## ${file.path}\n\n\`\`\`\n${file.text}\n\`\`\``
        : `## ${file.path}\n\nUnavailable: ${file.error}`
    );
  }

  if (packet.issues.length) {
    sections.push(`## Open issues\n\n${JSON.stringify(packet.issues, null, 2)}`);
  }

  return sections.join("\n\n");
}
