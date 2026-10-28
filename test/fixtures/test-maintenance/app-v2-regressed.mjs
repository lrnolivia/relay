// Same approved change plus an unintended regression: Share no longer works.
export function render() {
  return '<button data-testid="save-button">Save</button><button data-test="share">Share</button>';
}
export const actions = { save: () => 'saved', share: () => undefined };
