// Approved change: remove CSV export; Save's test hook becomes data-testid="save-button".
export function render() {
  return '<button data-testid="save-button">Save</button><button data-test="share">Share</button>';
}
export const actions = { save: () => 'saved', share: () => 'shared' };
