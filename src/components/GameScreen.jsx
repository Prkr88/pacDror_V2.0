import { useEffect, useRef } from 'react';
import Hud from './Hud';
import DPad from './DPad';

export default function GameScreen({ game }) {
  const { canvasRef, hud, phase, startGame, setDirection } = game;
  const started = useRef(false);

  // Touch swipe on canvas
  const touchStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startGame();
  }, [startGame]);

  function handleTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy))
      setDirection(dx > 0 ? 2 : 1);
    else
      setDirection(dy > 0 ? 4 : 3);
  }

  return (
    <div className="game-screen">
      <Hud hud={hud} phase={phase} onRestart={startGame} />

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <DPad setDirection={setDirection} />
    </div>
  );
}
