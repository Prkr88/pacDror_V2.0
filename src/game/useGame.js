import { useRef, useState, useEffect, useCallback } from 'react';
import { BOARD_TEMPLATE, GHOST_SCAN_INIT, BOARD_WIDTH, BOARD_HEIGHT, DEFAULT_CONFIG } from './constants';
import { ghostBFS, getPossibleMoves } from './ghostAI';
import * as A from './assets';

/* ============================================================
   Board helpers
   ============================================================ */
const copy = src => src.map(row => [...row]);

function randomEmptyCell(board) {
  let r, c;
  do {
    r = Math.floor(Math.random() * (BOARD_HEIGHT - 2)) + 1;
    c = Math.floor(Math.random() * (BOARD_WIDTH  - 2)) + 1;
  } while (board[r][c] !== 1);
  return [r, c];
}

function buildBoard({ numBalls }) {
  const board = copy(BOARD_TEMPLATE);

  // Remove balls until target count reached
  let toRemove = 186 - numBalls;
  while (toRemove > 0) {
    const r = Math.floor(Math.random() * (BOARD_HEIGHT - 2)) + 1;
    const c = Math.floor(Math.random() * (BOARD_WIDTH  - 2)) + 1;
    if (board[r][c] === 1) { board[r][c] = 0; toRemove--; }
  }

  // Randomize food types
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++)
      if (board[i][j] === 1) {
        const rnd = Math.random() * 100;
        if (rnd > 90) board[i][j] = 9;
        else if (rnd > 60) board[i][j] = 8;
      }

  return board;
}

function countFood(board) {
  let n = 0;
  for (let i = 0; i < BOARD_HEIGHT; i++)
    for (let j = 0; j < BOARD_WIDTH; j++)
      if ([1,8,9].includes(board[i][j])) n++;
  return n;
}

/* ============================================================
   Canvas helpers
   ============================================================ */
function calcSize(canvasRef) {
  const wrap = canvasRef.current?.parentElement;
  if (!wrap) return 30;
  const { width, height } = wrap.getBoundingClientRect();
  const isMobile = window.innerWidth <= 768;
  const dpadH = isMobile ? 210 : 0;
  return Math.max(14, Math.min(
    Math.floor(width  / BOARD_WIDTH),
    Math.floor((height - dpadH) / BOARD_HEIGHT),
  ));
}

function resizeCanvas(canvasRef, size) {
  const cnv = canvasRef.current;
  if (!cnv) return;
  cnv.width  = size * BOARD_WIDTH;
  cnv.height = size * BOARD_HEIGHT;
}

/* ============================================================
   Drawing
   ============================================================ */
function drawFrame(canvasRef, s) {
  const cnv = canvasRef.current;
  if (!cnv) return;
  const ctx = cnv.getContext('2d');
  const { SIZE, board } = s;

  ctx.clearRect(0, 0, cnv.width, cnv.height);

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
        case 1:  ctx.drawImage(A.imgFood,      x, y, SIZE, SIZE); break;
        case 8:  ctx.drawImage(A.imgDiamond,   x, y, SIZE, SIZE); break;
        case 9:  ctx.drawImage(A.imgFoodSp,    x, y, SIZE, SIZE); break;
        case 5:  ctx.drawImage(A.ghosts[0],    x, y, SIZE, SIZE); break;
        case 6:  ctx.drawImage(A.ghosts[1],    x, y, SIZE, SIZE); break;
        case 7:  ctx.drawImage(A.ghosts[2],    x, y, SIZE, SIZE); break;
        case 10: ctx.drawImage(A.imgSkull,     x, y, SIZE, SIZE); break;
        default: break;
      }
    }
  }

  s.animSpeed++;

  // Overlay (victory / game-over / countdown)
  const m  = SIZE * 2;
  const ov = { x: m, y: m, w: cnv.width - m * 2, h: cnv.height - m * 2 };
  if (s.gameCompleted) {
    ctx.drawImage(A.imgVictory, ov.x, ov.y, ov.w, ov.h);
  } else if (s.gameOverFinal) {
    ctx.drawImage(s.score < 150 ? A.imgCanDoBttr : A.imgGameOver, ov.x, ov.y, ov.w, ov.h);
  }
  if (s.starter > 0) {
    const numImg = s.starter === 3 ? A.imgNum3 : s.starter === 2 ? A.imgNum2 : A.imgNum1;
    ctx.drawImage(numImg, ov.x, ov.y, ov.w, ov.h);
  }
}

/* ============================================================
   Game-logic helpers (pure mutations on state object)
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
    { id: 5, loc: s.ghost1Loc },
    { id: 6, loc: s.ghost2Loc },
    { id: 7, loc: s.ghost3Loc },
  ].slice(0, s.ghostNum);

  for (const g of defs) {
    const path = ghostBFS(g.loc[0], g.loc[1], s.ghostScan);
    let dr, dc;

    if (Math.random() < 0.2 || path.length === 0) {
      const moves = getPossibleMoves(g.loc[0], g.loc[1], s.ghostScan);
      if (!moves.length) continue;
      const ri = Math.floor(Math.random() * moves.length);
      [dr, dc] = moves[ri];
    } else {
      const next = path[path.length - 1];
      dr = next.r; dc = next.c;
    }

    const [or, oc] = g.loc;
    s.board[or][oc] = s.foodMap[or][oc];
    g.loc[0] = dr; g.loc[1] = dc;
    s.board[dr][dc] = g.id;
  }
}

function moveSkull(s) {
  if (!s.skullVisible) {
    s.skullVisible = 1;
    const [r, c] = randomEmptyCell(s.board);
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
  if (s.ghostNum > 1) { s.ghost2Loc = [10,9];  s.board[10][9]  = 6; }
  if (s.ghostNum > 2) { s.ghost3Loc = [10,10]; s.board[10][10] = 7; }
  s.ghostScan[s.shape.i][s.shape.j] = 2;
}

/* ============================================================
   useGame hook
   ============================================================ */
export function useGame() {
  const canvasRef   = useRef(null);
  const stateRef    = useRef(null);
  const intervalRef = useRef(null);

  const [hud,   setHud]   = useState({ score: 0, lives: 3, time: 0 });
  const [phase, setPhase] = useState('idle'); // idle | playing | victory | gameover

  // ── Tick ──────────────────────────────────────────────────
  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;

    // Countdown phase
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

    // Ghost move (every 6 ticks ≈ 300ms)
    s.ghostTick++;
    if (s.ghostTick === 6) { s.ghostTick = 0; moveGhosts(s); }

    // Ghost collision
    if (
      (s.ghost1Loc[0] === s.shape.i && s.ghost1Loc[1] === s.shape.j) ||
      (s.ghost2Loc[0] === s.shape.i && s.ghost2Loc[1] === s.shape.j) ||
      (s.ghost3Loc[0] === s.shape.i && s.ghost3Loc[1] === s.shape.j)
    ) s.gameOverFlag = 1;

    // Key input
    const kd = s.keysDown;
    if (kd['ArrowLeft']  || kd['KeyA']) { s.direction = 1; s.drorMotionIndex = 1; }
    if (kd['ArrowRight'] || kd['KeyD']) { s.direction = 2; s.drorMotionIndex = 2; }
    if (kd['ArrowUp']    || kd['KeyW']) { s.direction = 3; s.drorMotionIndex = 3; }
    if (kd['ArrowDown']  || kd['KeyS']) { s.direction = 4; s.drorMotionIndex = 4; }

    // Move player
    s.board[s.shape.i][s.shape.j]       = 0;
    s.foodMap[s.shape.i][s.shape.j]     = 0;
    s.ghostScan[s.shape.i][s.shape.j]   = 0;

    s.drorSpeedCtrl++;
    if (s.drorSpeedCtrl >= 2) { s.drorSpeedCtrl = 0; movePacman(s); }

    // Eat
    const cell = s.board[s.shape.i][s.shape.j];
    if (cell === 1)  { s.score += 5;  A.sounds.eatSimple.play(); s.foodCounter--; }
    if (cell === 8)  { s.score += 15; s.foodCounter--; }
    if (cell === 9)  { s.score += 25; A.sounds.eatSpec.play();   s.foodCounter--; }
    if (s.caughtSkullFlag || cell === 10) {
      s.caughtSkullFlag = 0;
      A.sounds.skull.play();
      s.score += 50;
      s.skullVisible = 0;
      s.board[s.skull.x][s.skull.y] = s.foodMap[s.skull.x][s.skull.y];
    }

    s.board[s.shape.i][s.shape.j]     = 2;
    s.ghostScan[s.shape.i][s.shape.j] = 2;

    // Time
    s.timeElapsed = (Date.now() - s.startTime) / 1000 - 3 * (4 - s.lives);

    // ── Win ────────────────────────────────────────────────
    if (s.foodCounter <= 0) {
      s.gameCompleted = true;
      clearInterval(intervalRef.current);
      A.sounds.bg.stop();
      A.sounds.complete.play();
      drawFrame(canvasRef, s);
      setHud({ score: s.score, lives: s.lives, time: Math.max(0, Math.floor(s.timeElapsed)) });
      setPhase('victory');
      return;
    }

    // ── Lose a life ────────────────────────────────────────
    if (s.gameOverFlag && s.lives > 1) {
      A.sounds.bg.stop();
      A.sounds.killed.play();
      s.gameOverFlag = 0;
      s.lives--;
      s.score = Math.max(0, s.score - 10);
      const [ei, ej] = randomEmptyCell(s.board);
      s.shape.i = ei; s.shape.j = ej;
      s.direction = 0;
      respawnPlayer(s);
      s.starter     = 3;
      s.respawnTime = Date.now();
    }

    // ── Final game over ────────────────────────────────────
    if (s.gameOverFlag && s.lives <= 1) {
      s.lives = 0;
      s.gameOverFinal = true;
      clearInterval(intervalRef.current);
      A.sounds.bg.stop();
      A.sounds.gameOver.play();
      drawFrame(canvasRef, s);
      setHud({ score: s.score, lives: 0, time: Math.max(0, Math.floor(s.timeElapsed)) });
      setPhase('gameover');
      return;
    }

    setHud({ score: s.score, lives: Math.max(0, s.lives), time: Math.max(0, Math.floor(s.timeElapsed)) });
    drawFrame(canvasRef, s);
  }, []);

  // ── Start ─────────────────────────────────────────────────
  const startGame = useCallback(() => {
    clearInterval(intervalRef.current);
    A.sounds.bg.stop();

    const board    = buildBoard(DEFAULT_CONFIG);
    const foodMap  = copy(board);
    const ghostScan= copy(GHOST_SCAN_INIT);

    const [pi, pj] = randomEmptyCell(board);
    board[pi][pj]  = 2;
    ghostScan[pi][pj] = 2;
    board[10][8] = 5; board[10][9] = 6; board[10][10] = 7;

    const size = calcSize(canvasRef);
    resizeCanvas(canvasRef, size);

    stateRef.current = {
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
      keysDown:        {},
      lives:           3,
      score:           0,
      timeElapsed:     0,
      startTime:       Date.now(),
      respawnTime:     Date.now(),
      starter:         3,
      foodCounter:     countFood(board),
      ghostNum:        DEFAULT_CONFIG.ghostNum,
      gameOverFlag:    0,
      gameCompleted:   false,
      gameOverFinal:   false,
      SIZE:            size,
    };

    setHud({ score: 0, lives: 3, time: 0 });
    setPhase('playing');
    A.sounds.bg.play();
    intervalRef.current = setInterval(tick, 50);
  }, [tick]);

  // ── Keyboard ──────────────────────────────────────────────
  useEffect(() => {
    const down = e => { if (stateRef.current) stateRef.current.keysDown[e.code] = true; };
    const up   = e => { if (stateRef.current) stateRef.current.keysDown[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Resize ────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = stateRef.current;
        if (!s || !intervalRef.current) return;
        s.SIZE = calcSize(canvasRef);
        resizeCanvas(canvasRef, s.SIZE);
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
