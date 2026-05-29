const Heart = () => <span className="life-heart">❤</span>;

export default function Hud({ hud, phase, onRestart }) {
  const { score, lives, time } = hud;

  return (
    <header className="hud">
      <div className="hud-group">
        <span className="hud-label">LIVES</span>
        <span className="hud-lives">
          {[...Array(3)].map((_, i) => (
            <Heart key={i} style={{ opacity: i < lives ? 1 : 0.15 }} />
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

      {(phase === 'victory' || phase === 'gameover') && (
        <span className="hud-phase-tag" data-phase={phase}>
          {phase === 'victory' ? '🏆 Victory!' : '💀 Game Over'}
        </span>
      )}

      <button className="hud-restart" onClick={onRestart}>
        ↺ Play Again
      </button>
    </header>
  );
}
