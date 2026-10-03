// MamaHQ — Loading ≠ Empty ≠ Failed (PR6). Pure + deterministic.
//
// Every data-backed list surface resolves its render state through this ONE helper so
// the invariant is defined once and testable without React:
//   * a FAILED read never renders as EMPTY (no "Nothing here" after an error);
//   * a LOADING read never renders as EMPTY (no zero/empty flash before data);
//   * only a successfully loaded, genuinely empty read renders EMPTY.
// A failure wins over loading: once a read has failed we say so (with Retry) rather
// than spinning forever.

export type LoadState = 'loading' | 'failed' | 'empty' | 'ready'

export function loadState(input: { hydrated: boolean; loadError?: boolean; count: number }): LoadState {
  if (input.loadError) return 'failed'
  if (!input.hydrated) return 'loading'
  return input.count > 0 ? 'ready' : 'empty'
}

/** May a surface claim reassuringly that "nothing needs attention"? Only when every
 *  contributing read has genuinely loaded (none loading, none failed). */
export function mayClaimAllClear(states: LoadState[]): boolean {
  return states.every((s) => s === 'empty' || s === 'ready')
}
