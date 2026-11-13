// dsh-balance-chip — host half: nothing to do.
// The whole feature lives in the browser half (lib/client.js): a chip mounted in
// the `conversation.input.right` slot that reuses the bottom info bar's
// `getBalanceSnapshot` route for data. No host routes, no state, no tools.
export const name = 'dsh-balance-chip'
export const inject = []
export function apply() {}
