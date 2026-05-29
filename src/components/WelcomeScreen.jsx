export default function WelcomeScreen({ onPlay }) {
  return (
    <div className="welcome">
      <img src="images/img_welcome.png" className="welcome-bg" alt="" aria-hidden />

      <div className="welcome-content">
        <h1 className="welcome-title">BAZORET MAN</h1>
        <p className="welcome-sub">The original PacDror experience</p>

        <button className="welcome-play-btn" onClick={onPlay}>
          PLAY
        </button>

        <div className="welcome-controls">
          <span>🖥 Arrow keys / WASD</span>
          <span>📱 D-pad or swipe</span>
        </div>
      </div>
    </div>
  );
}
