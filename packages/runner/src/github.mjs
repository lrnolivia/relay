const API = "https://api.github.com";

function headers() {
  const result = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "relay"
  };
  if (process.env.RUNNER_GITHUB_TOKEN) {
    result.Authorization = `Bearer ${process.env.RUNNER_GITHUB_TOKEN}`;
  }
  return result;
}

async function request(url) {
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

export async function repositoryMetadata(repository) {
  try {
    const data = await request(`${API}/repos/${repository}`);
    return {
      full_name: data.full_name,
      default_branch: data.default_branch,
      pushed_at: data.pushed_at,
      visibility: data.visibility,
      language: data.language,
      open_issues_count: data.open_issues_count
    };
  } catch (error) {
    return { full_name: repository, error: error.message };
  }
}

export async function repositoryFile(repository, branch, filePath) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  try {
    const data = await request(
      `${API}/repos/${repository}/contents/${encoded}?ref=${encodeURIComponent(branch)}`
    );
    if (data.type !== "file" || !data.content) throw new Error("Path is not a normal file");
    return {
      path: filePath,
      ok: true,
      sha: data.sha,
      text: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
    };
  } catch (error) {
    return { path: filePath, ok: false, error: error.message };
  }
}

export async function openIssues(repository) {
  try {
    const data = await request(
      `${API}/repos/${repository}/issues?state=open&sort=updated&direction=desc&per_page=20`
    );
    return data
      .filter((item) => !item.pull_request)
      .map(({ number, title, updated_at, html_url }) => ({
        number,
        title,
        updated_at,
        url: html_url
      }));
  } catch (error) {
    return [{ error: error.message }];
  }
}


export async function dispatchWorkflow(repository, workflow, ref = "main", inputs = {}) {
  if (!process.env.RUNNER_GITHUB_TOKEN) {
    throw new Error("RUNNER_GITHUB_TOKEN is required for workflow dispatch.");
  }

  const response = await fetch(
    `${API}/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref, inputs })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub workflow dispatch ${response.status}: ${body.slice(0, 500)}`);
  }

  return { ok: true };
}
