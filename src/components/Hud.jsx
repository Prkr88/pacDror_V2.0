export default function Hud({ hud, phase, onRestart, onPause }) {
  const { score, lives, time, level } = hud;

  return (
    <header className="hud">
      <div className="hud-group">
        <span className="hud-label">LVL</span>
        <span className="hud-value hud-level">{level}</span>
      </div>

      <div className="hud-group">
        <span className="hud-label">LIVES</span>
        <span className="hud-lives">
          {[0,1,2].map(i => (
            <span key={i} className="life-heart" style={{ opacity: i < lives ? 1 : 0.15 }}>❤</span>
          ))}
        </span>
      </div>

      <div className="hud-group">
        <span className="hud-label">SCORE</span>
        <span className="hud-value">{score}</span>
      </div>

      <div className="hud-group">
        <span className="hud-label">TIME</span>
        <span className="hud-value">{time}s</span>
      </div>

      {phase === 'gameover' && (
        <span className="hud-phase-tag" data-phase="gameover">Game Over</span>
      )}

      {(phase === 'playing' || phase === 'paused') && (
        <button className="hud-pause" onClick={onPause} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
          {phase === 'paused' ? '▶' : '⏸'}
        </button>
      )}

      <button className="hud-restart" onClick={onRestart}>↺</button>
    </header>
  );
}
