import { useEffect, useRef } from 'react';
import Hud from './Hud';
import DPad from './DPad';

export default function GameScreen({ game }) {
  const { canvasRef, hud, phase, startGame, setDirection, togglePause } = game;
  const started    = useRef(false);
  const touchStart = useRef({ x: 0, y: 0 });

  // Start game once after mount so canvas has layout dimensions
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startGame();
  }, [startGame]);

  function onTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 2 : 1);
    else                             setDirection(dy > 0 ? 4 : 3);
  }

  return (
    <div className="game-screen">
      <Hud hud={hud} phase={phase} onRestart={startGame} onPause={togglePause} />

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />

        {phase === 'levelup' && (
          <div className="level-up-overlay">
            <div className="level-up-box">
              <div className="level-up-title">Level {hud.level} Complete!</div>
              <div className="level-up-sub">Get ready for Level {hud.level + 1}…</div>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="level-up-overlay paused-overlay" onClick={togglePause}>
            <div className="level-up-box">
              <div className="level-up-title">⏸ Paused</div>
              <div className="level-up-sub">Tap / press P to resume</div>
            </div>
          </div>
        )}
      </div>

      <DPad setDirection={setDirection} />
    </div>
  );
}
