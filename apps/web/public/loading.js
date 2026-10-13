// Placeholders mirror the structure of their destination content.
export function loadingMarkup(kind = "work", label = "Loading content") {
  const line = width => `<span class="skeleton-block skeleton-line" style="--skeleton-width:${width}%"></span>`;
  const block = name => `<span class="skeleton-block skeleton-${name}"></span>`;
  const identity = block("badge");
  const row = `<div class="skeleton-row"><div class="skeleton-copy">${identity}${line(72)}${line(44)}</div>${["attention", "automation"].includes(kind) ? block("action") : block("state")}</div>`;
  const work = `<div class="skeleton-row">${identity}<div class="skeleton-copy">${line(72)}${line(44)}</div>${block("state")}</div>`;
  const progress = `<div class="skeleton-progress">${block("state")}${line(65)}${line(42)}<div class="skeleton-answers">${block("answer").repeat(3)}</div>${line(84)}</div>`;
  const card = `<div class="skeleton-card">${block("thumbnail")}<div class="skeleton-copy">${identity}${line(80)}${line(60)}${block("state")}</div></div>`;
  const inspector = `<div class="skeleton-heading">${line(28)}${block("state")}</div><div class="skeleton-question">${line(96)}${line(72)}${line(85)}</div><div class="skeleton-answers">${block("answer").repeat(3)}</div>${line(20)}${block("notes")}${line(24)}<div class="skeleton-answers">${block("answer").repeat(3)}</div>`;
  const shapes = kind === "tabs" ? block("tab").repeat(3)
    : kind === "review" ? card.repeat(3)
    : kind === "preview" ? block("preview")
    : kind === "inspector" ? inspector
    : kind === "project" ? `<div class="skeleton-heading">${identity}${line(62)}${line(40)}</div>${progress}${progress}`
    : kind === "work" ? work + work
    : row + row;
  return `<div class="content-skeleton skeleton-${kind}" role="status" aria-label="${label}"><div aria-hidden="true">${shapes}</div></div>`;
}
export function showLoading(target, kind, label) {
  if (target) target.innerHTML = loadingMarkup(kind, label);
}
