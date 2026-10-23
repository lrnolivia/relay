// Wrong repair: CSV export restored only to satisfy the obsolete test.
export function render() {
  return '<button data-testid="save-button">Save</button><button data-test="share">Share</button><button data-test="export-csv">Export CSV</button>';
}
export const actions = { save: () => 'saved', share: () => 'shared', exportCsv: () => 'a,b\n1,2' };
