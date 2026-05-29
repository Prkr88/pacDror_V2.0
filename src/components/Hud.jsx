export default function Hud({ hud, phase, onRestart }) {
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
        <span className="hud-phase-tag" data-phase="gameover">💀 Game Over</span>
      )}

      <button className="hud-restart" onClick={onRestart}>↺ Restart</button>
    </header>
  );
}
