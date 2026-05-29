import { useState } from 'react';
import { useGame } from './game/useGame';
import WelcomeScreen from './components/WelcomeScreen';
import GameScreen    from './components/GameScreen';

export default function App() {
  const [screen, setScreen] = useState('welcome'); // 'welcome' | 'game'
  const game = useGame();

  function handlePlay() {
    setScreen('game');
  }

  return (
    <div className="app">
      {screen === 'welcome'
        ? <WelcomeScreen onPlay={handlePlay} />
        : <GameScreen game={game} />}
    </div>
  );
}
