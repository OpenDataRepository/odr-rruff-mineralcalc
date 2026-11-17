// Fills a formula's comma sites (e.g. '(Ca,Na)_19_(Al,Mg,Fe)_13_') with
// amounts that are charge balanced and as close as possible to a target
// composition: the average of the mineral's cited analyses when there are
// any, otherwise each site's first-listed (dominant) occupant.
//
// sites: [{ count, valences: [occupant valence, ...] }]
// targets: [[target amount per occupant], ...], same shape (each site's
//   targets should add up to its count)
// charge: the net charge the sites must add up to (minus the charge of the
//   rest of the formula)
//
// Minimizes the sum of (x - target)^2 subject to each site adding up to its
// count, the charge adding up to `charge` and every x >= 0. Equality
// constrained least squares has a closed form (x = target - A'λ, with
// A·A'·λ = A·target - b); an occupant that comes out negative is pinned at 0
// and the rest re-solved, until none is negative. Returns the amounts in the
// same shape as targets, or null when no fill balances.
export function solveSiteFill(sites, targets, charge) {
  const vars = sites.flatMap((site, s) => site.valences.map((v, k) => ({ s, k, v, t: targets[s][k] })));
  const n = vars.length;
  const m = sites.length + 1;
  // Constraint rows: one per site (its occupants sum to its count), then
  // the charge row.
  const a = (row, j) => (row < sites.length ? (vars[j].s === row ? 1 : 0) : vars[j].v);
  const b = [...sites.map((site) => site.count), charge];
  const pinned = new Set();

  for (let iter = 0; iter <= n; iter++) {
    const free = [...Array(n).keys()].filter((j) => !pinned.has(j));
    // M = A_F A_F', r = A_F t_F - b
    const M = [...Array(m)].map((_, r) => [...Array(m)].map((_, c) => free.reduce((s, j) => s + a(r, j) * a(c, j), 0)));
    const rhs = [...Array(m)].map((_, r) => free.reduce((s, j) => s + a(r, j) * vars[j].t, 0) - b[r]);
    const lambda = solveLinear(M, rhs);
    if (!lambda) return null;
    const x = new Array(n).fill(0);
    for (const j of free) x[j] = vars[j].t - lambda.reduce((s, l, r) => s + l * a(r, j), 0);
    // Check the constraints actually hold (a dependent row is dropped by
    // solveLinear, which can leave an impossible charge unmet).
    for (let r = 0; r < m; r++) {
      const got = x.reduce((s, xj, j) => s + a(r, j) * xj, 0);
      if (Math.abs(got - b[r]) > 1e-6) return null;
    }
    let worst = -1;
    for (const j of free) if (x[j] < -1e-9 && (worst < 0 || x[j] < x[worst])) worst = j;
    if (worst < 0) return roundFill(sites, vars, x);
    pinned.add(worst);
  }
  return null;
}

// Gaussian elimination with partial pivoting; a row that comes out all zero
// (a constraint already implied by the others) is skipped. Returns the
// solution, or null when the rows contradict each other.
function solveLinear(M, rhs) {
  const m = M.length;
  const A = M.map((row, i) => [...row, rhs[i]]);
  const pivotCols = [];
  let row = 0;
  for (let col = 0; col < m && row < m; col++) {
    let p = row;
    for (let i = row + 1; i < m; i++) if (Math.abs(A[i][col]) > Math.abs(A[p][col])) p = i;
    if (Math.abs(A[p][col]) < 1e-12) continue;
    [A[row], A[p]] = [A[p], A[row]];
    for (let i = 0; i < m; i++) {
      if (i === row) continue;
      const f = A[i][col] / A[row][col];
      for (let c = col; c <= m; c++) A[i][c] -= f * A[row][c];
    }
    pivotCols.push(col);
    row++;
  }
  for (let i = row; i < m; i++) if (Math.abs(A[i][m]) > 1e-9) return null;
  const x = new Array(m).fill(0);
  pivotCols.forEach((col, i) => {
    x[col] = A[i][m] / A[i][col];
  });
  return x;
}

// Rounds to 3 decimals, then puts the rounding error back so each site still
// adds up to its count and the charge still balances: a site's leftover goes
// on its largest occupant, and a charge leftover is moved between two
// occupants of a site whose valences differ by 1, when there are any.
function roundFill(sites, vars, x) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const out = sites.map((site) => site.valences.map(() => 0));
  vars.forEach((vj, j) => {
    out[vj.s][vj.k] = r3(Math.max(0, x[j]));
  });
  sites.forEach((site, s) => {
    const diff = r3(site.count - out[s].reduce((t, v) => t + v, 0));
    if (diff) {
      const big = out[s].indexOf(Math.max(...out[s]));
      out[s][big] = r3(out[s][big] + diff);
    }
  });
  const target = vars.reduce((t, vj, j) => t + vj.v * x[j], 0);
  const got = sites.reduce((t, site, s) => t + site.valences.reduce((u, v, k) => u + v * out[s][k], 0), 0);
  const left = r3(target - got);
  if (left) {
    for (let s = 0; s < sites.length; s++) {
      const vs = sites[s].valences;
      for (let hi = 0; hi < vs.length; hi++) {
        for (let lo = 0; lo < vs.length; lo++) {
          if (vs[hi] - vs[lo] !== 1) continue;
          // +left charge: move `left` from lo to hi (or back when negative).
          const from = left > 0 ? lo : hi;
          const to = left > 0 ? hi : lo;
          if (out[s][from] < Math.abs(left)) continue;
          out[s][from] = r3(out[s][from] - Math.abs(left));
          out[s][to] = r3(out[s][to] + Math.abs(left));
          return out;
        }
      }
    }
  }
  return out;
}
