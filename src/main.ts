import { initNoise } from './utils/random';
import { GameManager } from './core/game/GameManager';
import { drawGameState } from './graphics/renderer';
import { setupControls } from './core/input';
import './styles/style.css';

// Initialize game
const gameManager = new GameManager();

// Set up event listeners
const seedInput = document.getElementById('seedInput') as HTMLInputElement;
const regenButton = document.getElementById('regen') as HTMLButtonElement;

function startNewGame() {
  const seed = parseInt(seedInput.value, 10) || Math.floor(Math.random() * 1000000);
  seedInput.value = seed.toString();
  initNoise(seed);
  gameManager.initializeGame();
  drawGameState(gameManager);
}

regenButton.onclick = startNewGame;

// Set up game controls
setupControls(gameManager);

// Start initial game
startNewGame();