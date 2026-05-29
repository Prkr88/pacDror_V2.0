import { useRef, useState, useEffect, useCallback } from 'react';
import { MAZES, BOARD_WIDTH, BOARD_HEIGHT, getLevelConfig, buildGhostScan } from './constants';
import { ghostBFS, ghostBFSToTarget, getPossibleMoves } from './ghostAI';
import * as A from './assets';

/* ============================================================
   Board helpers
   ============================================================ */
const copy = src => src.map(row => [...row]);

function countFood(board) {
  let n = 0;
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++)
      if (board[i][j] === 1 || board[i][j] === 8 || board[i][j] === 9) n++;
  return n;
}

// Find a truly empty cell (value 0) for player spawn — no food is discarded.
function findSpawnCell(board) {
  const candidates = [];
  for (let r = 1; r < BOARD_HEIGHT - 1; r++)
    for (let c = 1; c < BOARD_WIDTH - 1; c++)
      if (board[r][c] === 0) candidates.push([r, c]);
  if (candidates.length)
    return candidates[Math.floor(Math.random() * candidates.length)];
  // Fallback: any passable cell
  return findPassableCell(board);
}

// Find any non-wall, non-ghost cell (for skull & respawn after all food eaten).
// Bug-fix: original looked for value===1 only → infinite loop once all food was 8/9.
function findPassableCell(board) {
  let r, c, attempts = 0;
  do {
    r = Math.floor(Math.random() * (BOARD_HEIGHT - 2)) + 1;
    c = Math.floor(Math.random() * (BOARD_WIDTH  - 2)) + 1;
    attempts++;
  } while (![0,1,8,9].includes(board[r][c]) && attempts < 2000);
  return [r, c];
}

function buildBoard(maze, numBalls) {
  const board = copy(maze);

  // Count original food cells
  let total = 0;
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++)
      if (board[i][j] === 1) total++;

  // Remove cells to reach numBalls target
  let toRemove = Math.max(0, total - numBalls);
  let safety = total * 3;
  while (toRemove > 0 && safety-- > 0) {
    const r = Math.floor(Math.random() * (BOARD_HEIGHT - 2)) + 1;
    const c = Math.floor(Math.random() * (BOARD_WIDTH  - 2)) + 1;
    if (board[r][c] === 1) { board[r][c] = 0; toRemove--; }
  }

  // Randomise food types (1→8 diamond, 1→9 special)
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++)
      if (board[i][j] === 1) {
        const rnd = Math.random() * 100;
        if (rnd > 90)      board[i][j] = 9;
        else if (rnd > 60) board[i][j] = 8;
      }

  return board;
}

/* ============================================================
   Canvas helpers — DPR-aware for crisp rendering on HiDPI screens
   ============================================================ */
function calcSize(canvasRef) {
  const wrap = canvasRef.current?.parentElement;
  if (!wrap) return 28;
  const { width, height } = wrap.getBoundingClientRect();
  const isMobile = window.innerWidth <= 768;
  const dpadH    = isMobile ? 215 : 0;
  return Math.max(14, Math.min(
    Math.floor(width  / BOARD_WIDTH),
    Math.floor((height - dpadH) / BOARD_HEIGHT),
  ));
}

function applyCanvasSize(canvasRef, size) {
  const cnv = canvasRef.current;
  if (!cnv) return;
  const dpr  = window.devicePixelRatio || 1;
  const logW = size * BOARD_WIDTH;
  const logH = size * BOARD_HEIGHT;
  cnv.width        = Math.round(logW * dpr);
  cnv.height       = Math.round(logH * dpr);
  cnv.style.width  = `${logW}px`;
  cnv.style.height = `${logH}px`;
}

/* ============================================================
   Drawing — transforms account for DPR so SVGs are pixel-sharp
   ============================================================ */
function drawFrame(canvasRef, s) {
  const cnv = canvasRef.current;
  if (!cnv) return;
  const ctx  = cnv.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const { SIZE, board } = s;

  // Scale to logical pixels so all draw calls use SIZE-based coords
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE * BOARD_WIDTH, SIZE * BOARD_HEIGHT);

  for (let i = 0; i < BOARD_HEIGHT; i++) {
    for (let j = 0; j < BOARD_WIDTH; j++) {
      const x    = j * SIZE;
      const y    = i * SIZE;
      const cell = board[i][j];

      if (cell === 4) { ctx.drawImage(A.imgWall, x, y, SIZE, SIZE); continue; }

      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, SIZE, SIZE);
      ctx.drawImage(A.imgFloor, x, y, SIZE, SIZE);

      switch (cell) {
        case 2: {
          if (s.drorSpeedCtrl === 0) {
            const frames = s.drorMotionIndex === 1 ? A.DrorLeft
                         : s.drorMotionIndex === 3 ? A.DrorUp
                         : s.drorMotionIndex === 4 ? A.DrorDown
                         : A.DrorRight;
            s.drorToDraw = frames[s.animCounter % 4];
            if (s.animSpeed % 2 === 0) s.animCounter++;
          }
          ctx.drawImage(s.drorToDraw, x, y, SIZE, SIZE);
          break;
        }
        case 1:  ctx.drawImage(A.imgFood,     x, y, SIZE, SIZE); break;
        case 8:  ctx.drawImage(A.imgDiamond,  x, y, SIZE, SIZE); break;
        case 9:  ctx.drawImage(A.imgFoodSp,   x, y, SIZE, SIZE); break;
        case 5: case 6: case 7: {
          const idx = cell - 5;
          if (s.frightenedTicks > 0) {
            ctx.globalAlpha = (s.frightenedTicks <= 60 && s.animSpeed % 10 < 5) ? 0.85 : 0.3;
          }
          ctx.drawImage(A.ghosts[idx], x, y, SIZE, SIZE);
          ctx.globalAlpha = 1;
          break;
        }
        case 10: ctx.drawImage(A.imgSkull,    x, y, SIZE, SIZE); break;
        default: break;
      }
    }
  }
  s.animSpeed++;

  // Overlays
  const m  = SIZE * 2;
  const ov = { x: m, y: m, w: SIZE * BOARD_WIDTH - m * 2, h: SIZE * BOARD_HEIGHT - m * 2 };

  if (s.gameOverFinal)
    ctx.drawImage(s.score < 150 ? A.imgCanDoBttr : A.imgGameOver, ov.x, ov.y, ov.w, ov.h);

  if (s.starter > 0) {
    const numImg = s.starter === 3 ? A.imgNum3 : s.starter === 2 ? A.imgNum2 : A.imgNum1;
    ctx.drawImage(numImg, ov.x, ov.y, ov.w, ov.h);
  }
}

/* ============================================================
   Game-logic helpers
   ============================================================ */
function movePacman(s) {
  const { board, shape } = s;
  if (s.direction === 1) {
    if (shape.j > 0 && board[shape.i][shape.j - 1] !== 4) shape.j--;
    else if (shape.j === 0) shape.j = BOARD_WIDTH - 1;
  } else if (s.direction === 2) {
    if (shape.j < BOARD_WIDTH - 1 && board[shape.i][shape.j + 1] !== 4) shape.j++;
    else if (shape.j === BOARD_WIDTH - 1) shape.j = 0;
  } else if (s.direction === 3) {
    if (shape.i > 0 && board[shape.i - 1][shape.j] !== 4) shape.i--;
  } else if (s.direction === 4) {
    if (shape.i < BOARD_HEIGHT - 1 && board[shape.i + 1][shape.j] !== 4) shape.i++;
  }
}

function moveGhosts(s) {
  const defs = [
    { id: 5, loc: s.ghost1Loc, home: [10, 8] },
    { id: 6, loc: s.ghost2Loc, home: [10, 9] },
    { id: 7, loc: s.ghost3Loc, home: [10, 10] },
  ];

  const committed = new Set();
  for (const g of defs) committed.add(`${g.loc[0]},${g.loc[1]}`);

  for (const g of defs) {
    committed.delete(`${g.loc[0]},${g.loc[1]}`);

    const path = s.frightenedTicks > 0
      ? ghostBFSToTarget(g.loc[0], g.loc[1], s.ghostScan, g.home[0], g.home[1])
      : ghostBFS(g.loc[0], g.loc[1], s.ghostScan);

    let dr = g.loc[0], dc = g.loc[1];

    const tryMove = (candidates) => {
      const free = candidates.filter(([r,c]) => !committed.has(`${r},${c}`));
      if (!free.length) return false;
      const pick = free[Math.floor(Math.random() * free.length)];
      [dr, dc] = pick;
      return true;
    };

    if (path.length > 0 && (s.frightenedTicks > 0 || Math.random() >= 0.2)) {
      const next = path[path.length - 1];
      if (!committed.has(`${next.r},${next.c}`)) {
        dr = next.r; dc = next.c;
      } else {
        tryMove(getPossibleMoves(g.loc[0], g.loc[1], s.ghostScan));
      }
    } else {
      tryMove(getPossibleMoves(g.loc[0], g.loc[1], s.ghostScan));
    }

    const [or, oc] = g.loc;
    s.board[or][oc] = s.foodMap[or][oc];
    g.loc[0] = dr; g.loc[1] = dc;
    s.board[dr][dc] = g.id;
    committed.add(`${dr},${dc}`);
  }
}

function moveSkull(s) {
  if (!s.skullVisible) {
    s.skullVisible = 1;
    const [r, c] = findPassableCell(s.board);
    s.skull.x = r; s.skull.y = c;
  }
  const moves = getPossibleMoves(s.skull.x, s.skull.y, s.board);
  s.board[s.skull.x][s.skull.y] = s.foodMap[s.skull.x][s.skull.y];
  if (!moves.length) return;
  const [nr, nc] = moves[Math.floor(Math.random() * moves.length)];
  s.board[nr][nc] = 10;
  s.skull.x = nr; s.skull.y = nc;
  if (nr === s.shape.i && nc === s.shape.j) s.caughtSkullFlag = 1;
}

function respawnPlayer(s) {
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++) {
      if ([5,6,7,2].includes(s.board[i][j])) s.board[i][j] = s.foodMap[i][j];
      if (s.ghostScan[i][j] === 2) s.ghostScan[i][j] = 0;
    }
  s.ghost1Loc = [10,8];  s.board[10][8]  = 5;
  s.ghost2Loc = [10,9];  s.board[10][9]  = 6;
  s.ghost3Loc = [10,10]; s.board[10][10] = 7;
  s.ghostScan[s.shape.i][s.shape.j] = 2;
  s.frightenedTicks = 0;
}

/* ============================================================
   Initialise one level's state object
   ============================================================ */
function initLevelState(level, score, lives, SIZE) {
  const cfg  = getLevelConfig(level);
  const maze = MAZES[cfg.mazeIndex];

  const board    = buildBoard(maze, cfg.numBalls);
  const foodMap  = copy(board);
  const ghostScan= buildGhostScan(maze);

  // Count food BEFORE placing player (player spawns on a 0-cell, no food lost)
  const foodCount = countFood(board);

  const [pi, pj] = findSpawnCell(board);
  board[pi][pj]  = 2;
  ghostScan[pi][pj] = 2;

  board[10][8]  = 5;
  board[10][9]  = 6;
  board[10][10] = 7;

  return {
    board, foodMap, ghostScan,
    shape:      { i: pi, j: pj },
    ghost1Loc:  [10, 8],
    ghost2Loc:  [10, 9],
    ghost3Loc:  [10, 10],
    skull:      { x: 0, y: 0 },
    direction:  0,
    drorMotionIndex: 2,
    drorSpeedCtrl:   0,
    drorToDraw:      A.DrorRight[0],
    animCounter:     0,
    animSpeed:       0,
    skullVisible:    0,
    skullSpeed:      0,
    skullAppearTime: 0,
    caughtSkullFlag: 0,
    ghostTick:       0,
    ghostTickRate:   cfg.ghostTickRate,
    ghostNum:        cfg.ghostNum,
    frightenedTicks: 0,
    keysDown:        {},
    level,
    lives,
    score,
    timeElapsed:     0,
    startTime:       Date.now(),
    respawnTime:     Date.now(),
    starter:         3,
    foodCounter:     foodCount,
    gameOverFlag:    0,
    gameOverFinal:   false,
    SIZE,
  };
}

/* ============================================================
   useGame hook
   ============================================================ */
export function useGame() {
  const canvasRef   = useRef(null);
  const stateRef    = useRef(null);
  const intervalRef = useRef(null);

  const [hud,   setHud]   = useState({ score: 0, lives: 3, time: 0, level: 1 });
  const [phase, setPhase] = useState('idle'); // idle | playing | levelup | gameover

  // ── Start (or restart) from level 1 ───────────────────────
  const startGame = useCallback(() => {
    clearInterval(intervalRef.current);
    A.sounds.bg.stop();

    const size = calcSize(canvasRef);
    applyCanvasSize(canvasRef, size);

    stateRef.current = initLevelState(1, 0, 3, size);
    setHud({ score: 0, lives: 3, time: 0, level: 1 });
    setPhase('playing');
    A.sounds.bg.play();
    intervalRef.current = setInterval(tick, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Advance to next level (preserves score + lives) ───────
  const advanceLevel = useCallback((prevScore, prevLives, prevLevel) => {
    clearInterval(intervalRef.current);

    const nextLevel = prevLevel + 1;
    const size      = calcSize(canvasRef);
    applyCanvasSize(canvasRef, size);

    stateRef.current = initLevelState(nextLevel, prevScore, prevLives, size);
    setHud({ score: prevScore, lives: prevLives, time: 0, level: nextLevel });
    setPhase('playing');
    A.sounds.bg.play();
    intervalRef.current = setInterval(tick, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game tick (runs every 50 ms) ──────────────────────────
  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;

    // Countdown (3-2-1 before play)
    if (s.starter > 0) {
      if (Date.now() - s.respawnTime > 1000) { s.starter--; s.respawnTime = Date.now(); }
      drawFrame(canvasRef, s);
      return;
    }

    A.sounds.bg.play();

    // Skull
    if (s.skullVisible) {
      s.skullSpeed++;
      if (s.skullSpeed === 3) { s.skullSpeed = 0; moveSkull(s); }
      if (Date.now() - s.skullAppearTime > 5000) {
        s.skullVisible = 0;
        s.board[s.skull.x][s.skull.y] = s.foodMap[s.skull.x][s.skull.y];
      }
    }
    if (Math.floor(Math.random() * 200) === 0) { s.skullAppearTime = Date.now(); moveSkull(s); }

    // Ghosts (speed from level config)
    s.ghostTick++;
    if (s.ghostTick >= s.ghostTickRate) { s.ghostTick = 0; moveGhosts(s); }

    // Frightened timer
    if (s.frightenedTicks > 0) s.frightenedTicks--;

    // Ghost collision
    const ghostCollDefs = [
      { loc: s.ghost1Loc, id: 5, home: [10, 8] },
      { loc: s.ghost2Loc, id: 6, home: [10, 9] },
      { loc: s.ghost3Loc, id: 7, home: [10, 10] },
    ];
    for (const g of ghostCollDefs) {
      if (g.loc[0] === s.shape.i && g.loc[1] === s.shape.j) {
        if (s.frightenedTicks > 0) {
          s.score += 200;
          A.sounds.skull.play();
          s.board[g.loc[0]][g.loc[1]] = s.foodMap[g.loc[0]][g.loc[1]];
          g.loc[0] = g.home[0];
          g.loc[1] = g.home[1];
          s.board[g.home[0]][g.home[1]] = g.id;
        } else {
          s.gameOverFlag = 1;
        }
      }
    }

    // Keyboard
    const kd = s.keysDown;
    if (kd['ArrowLeft']  || kd['KeyA']) { s.direction = 1; s.drorMotionIndex = 1; }
    if (kd['ArrowRight'] || kd['KeyD']) { s.direction = 2; s.drorMotionIndex = 2; }
    if (kd['ArrowUp']    || kd['KeyW']) { s.direction = 3; s.drorMotionIndex = 3; }
    if (kd['ArrowDown']  || kd['KeyS']) { s.direction = 4; s.drorMotionIndex = 4; }

    // Clear player from old position
    s.board[s.shape.i][s.shape.j]     = 0;
    s.foodMap[s.shape.i][s.shape.j]   = 0;
    s.ghostScan[s.shape.i][s.shape.j] = 0;

    s.drorSpeedCtrl++;
    if (s.drorSpeedCtrl >= 2) { s.drorSpeedCtrl = 0; movePacman(s); }

    // Eat
    const cell = s.board[s.shape.i][s.shape.j];
    if (cell === 1)  { s.score += 5;  A.sounds.eatSimple.play(); s.foodCounter--; }
    if (cell === 8)  { s.score += 15;                            s.foodCounter--; }
    if (cell === 9)  { s.score += 25; A.sounds.eatSpec.play();   s.foodCounter--; }
    if (s.caughtSkullFlag || cell === 10) {
      s.caughtSkullFlag = 0;
      A.sounds.skull.play();
      s.score += 50;
      s.skullVisible = 0;
      s.board[s.skull.x][s.skull.y] = s.foodMap[s.skull.x][s.skull.y];
      s.frightenedTicks = 200;
    }

    s.board[s.shape.i][s.shape.j]     = 2;
    s.ghostScan[s.shape.i][s.shape.j] = 2;

    s.timeElapsed = (Date.now() - s.startTime) / 1000 - 3 * (4 - s.lives);

    // ── Level complete — advance instead of ending ─────────
    if (s.foodCounter <= 0) {
      A.sounds.bg.stop();
      A.sounds.complete.play();
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      const { score, lives, level } = s;
      drawFrame(canvasRef, s);
      setHud({ score, lives, time: Math.max(0, Math.floor(s.timeElapsed)), level });
      setPhase('levelup');
      // Auto-advance after 2.5 s
      setTimeout(() => advanceLevel(score, lives, level), 2500);
      return;
    }

    // ── Lose a life ────────────────────────────────────────
    if (s.gameOverFlag && s.lives > 1) {
      A.sounds.bg.stop();
      A.sounds.killed.play();
      s.gameOverFlag = 0;
      s.lives--;
      s.score = Math.max(0, s.score - 10);
      const [ei, ej] = findPassableCell(s.board);
      s.shape.i = ei; s.shape.j = ej;
      s.direction = 0;
      respawnPlayer(s);
      s.starter     = 3;
      s.respawnTime = Date.now();
    }

    // ── Game over ──────────────────────────────────────────
    if (s.gameOverFlag && s.lives <= 1) {
      s.lives = 0;
      s.gameOverFinal = true;
      clearInterval(intervalRef.current);
      A.sounds.bg.stop();
      A.sounds.gameOver.play();
      drawFrame(canvasRef, s);
      setHud({ score: s.score, lives: 0, time: Math.max(0, Math.floor(s.timeElapsed)), level: s.level });
      setPhase('gameover');
      return;
    }

    setHud({ score: s.score, lives: Math.max(0, s.lives), time: Math.max(0, Math.floor(s.timeElapsed)), level: s.level });
    drawFrame(canvasRef, s);
  }, [advanceLevel]);

  // ── Keyboard listeners ────────────────────────────────────
  useEffect(() => {
    const dn = e => { if (stateRef.current) stateRef.current.keysDown[e.code] = true; };
    const up = e => { if (stateRef.current) stateRef.current.keysDown[e.code] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ── Resize ────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = stateRef.current;
        if (!s) return;
        s.SIZE = calcSize(canvasRef);
        applyCanvasSize(canvasRef, s.SIZE);
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => () => clearInterval(intervalRef.current), []);

  const setDirection = useCallback(dir => {
    const s = stateRef.current;
    if (!s) return;
    s.direction = dir;
    s.drorMotionIndex = dir;
  }, []);

  return { canvasRef, hud, phase, startGame, setDirection };
}
