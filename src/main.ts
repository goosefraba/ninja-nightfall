import './styles.css';
import { NinjaNightfallGame } from './game/NinjaNightfallGame';

const root = document.getElementById('game-root');
const viewport = document.getElementById('game-viewport');

if (!root || !viewport) {
  throw new Error('Game root is missing from the document.');
}

const game = new NinjaNightfallGame(root, viewport);

game.start().catch((error: unknown) => {
  console.error('Failed to start Ninja Nightfall', error);
  root.dataset.phase = 'error';
});
