export function ghostBFSToTarget(sr, sc, scan, targetR, targetC) {
  const gScan = scan.map(row => [...row]);
  const queue = [{ r: sr, c: sc, pred: null }];
  gScan[sr][sc] = 4;
  let found = null;

  while (queue.length > 0 && !found) {
    const node = queue.shift();
    for (const [mr, mc] of getPossibleMoves(node.r, node.c, gScan)) {
      if (mr === targetR && mc === targetC) {
        found = { r: mr, c: mc, pred: node };
        break;
      }
      gScan[mr][mc] = 4;
      queue.push({ r: mr, c: mc, pred: node });
    }
  }

  const path = [];
  let cur = found;
  while (cur?.pred) { path.push(cur); cur = cur.pred; }
  return path;
}

export function getPossibleMoves(r, c, board) {
  const moves = [];
  const H = board.length;
  const W = board[0].length;
  if (r > 0     && board[r-1][c] !== 4) moves.push([r-1, c]);
  if (r < H - 1 && board[r+1][c] !== 4) moves.push([r+1, c]);
  if (c > 0     && board[r][c-1] !== 4) moves.push([r, c-1]);
  if (c < W - 1 && board[r][c+1] !== 4) moves.push([r, c+1]);
  return moves;
}

// BFS toward cell value 2 (player). Returns path from ghost to player (popped end = next step).
export function ghostBFS(sr, sc, scan) {
  const gScan = scan.map(row => [...row]);
  const queue = [{ r: sr, c: sc, pred: null }];
  gScan[sr][sc] = 4;
  let found = null;

  while (queue.length > 0 && !found) {
    const node = queue.shift();
    for (const [mr, mc] of getPossibleMoves(node.r, node.c, gScan)) {
      if (gScan[mr][mc] === 2) {
        found = { r: mr, c: mc, pred: node };
        break;
      }
      gScan[mr][mc] = 4;
      queue.push({ r: mr, c: mc, pred: node });
    }
  }

  const path = [];
  let cur = found;
  while (cur?.pred) { path.push(cur); cur = cur.pred; }
  return path; // pop() gives the next step toward player
}
