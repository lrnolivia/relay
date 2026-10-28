// Before the approved change: CSV export exists and Save uses data-test="save".
export function render() {
  return '<button data-test="save">Save</button><button data-test="share">Share</button><button data-test="export-csv">Export CSV</button>';
}
export const actions = { save: () => 'saved', share: () => 'shared', exportCsv: () => 'a,b\n1,2' };
