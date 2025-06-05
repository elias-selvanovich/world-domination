import { GameManager } from '../core/game/GameManager';
import { City, Unit, UnitType, Position, UNIT_STATS } from '../core/game/types';

// Add type declarations for global state
declare global {
  interface Window {
    selectedUnit: Unit | null;
    selectedCity: City | null;
  }
}

// Constants
const HEX_SIZE = 24;
const MAP_COLS = 80;
const MAP_ROWS = 50;
export const PAN_STEP_X = HEX_SIZE * Math.sqrt(3);
export const PAN_STEP_Y = HEX_SIZE * 1.5;

const container = document.getElementById('viewport-container') as HTMLDivElement;
const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Player colors
const PLAYER_COLORS = [
  '#3498db', // Blue
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#f1c40f', // Yellow
  '#9b59b6', // Purple
  '#e67e22', // Orange
];

// Resize canvas to fill its container
function setCanvasSize() {
  const width = MAP_COLS * HEX_SIZE * Math.sqrt(3);
  const height = MAP_ROWS * HEX_SIZE * 1.5;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
}
setCanvasSize();
window.addEventListener('resize', setCanvasSize);

export let offset = { x: 0, y: 0 };

export function hexToPixel(c: number, r: number) {
  const x = HEX_SIZE * Math.sqrt(3) * c + (r % 2) * HEX_SIZE * Math.sqrt(3) / 2 + offset.x;
  const y = HEX_SIZE * (3 / 2 * r) + offset.y;
  return { x, y };
}

function drawHex(x: number, y: number, fillStyle: string, strokeStyle?: string) {
  const points: [number, number][] = [];
  
  // Calculate hex points
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push([
      x + HEX_SIZE * Math.cos(angle),
      y + HEX_SIZE * Math.sin(angle)
    ]);
  }

  // Fill hex
  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point[0], point[1]);
    else ctx.lineTo(point[0], point[1]);
  });
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();

  // Draw edges if specified
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }

  return points;
}

function isCoastline(game: GameManager, pos1: Position, pos2: Position): boolean {
  if (!isValidPosition(pos1) || !isValidPosition(pos2)) return false;
  return game.isLandCell(pos1) !== game.isLandCell(pos2);
}

function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < MAP_ROWS && pos.col >= 0 && pos.col < MAP_COLS;
}

function getNeighborPositions(pos: Position): Position[] {
  // For hexagonal grid, we need to account for the offset of odd rows
  // The neighbor pattern is different for even and odd rows
  const isOddRow = pos.row % 2 === 1;
  
  // These directions work for a pointy-top hexagon grid
  const directions = [
    [-1, isOddRow ? 0 : -1],  // top-left
    [-1, isOddRow ? 1 : 0],   // top-right
    [0, 1],                   // right
    [1, isOddRow ? 1 : 0],    // bottom-right
    [1, isOddRow ? 0 : -1],   // bottom-left
    [0, -1],                  // left
  ];

  return directions.map(([dr, dc]) => ({
    row: pos.row + dr,
    col: pos.col + dc
  }));
}

function drawHexWithEdges(game: GameManager, pos: Position, x: number, y: number) {
  const isLand = game.isLandCell(pos);
  const baseColor = isLand ? '#2d4' : '#1e90ff';
  
  // Get cell owner if any
  let owner = null;
  for (const player of game.getPlayers()) {
    if (player.ownedCells.some(cell => cell.row === pos.row && cell.col === pos.col)) {
      owner = player;
      break;
    }
  }
  
  // Draw base hex
  const fillColor = owner ? `${PLAYER_COLORS[owner.id]}66` : baseColor;
  const points = drawHex(x, y, fillColor);
  
  // Draw edges
  const neighbors = getNeighborPositions(pos);
  
  for (let i = 0; i < 6; i++) {
    const neighbor = neighbors[i];
    const start = points[i];
    const end = points[(i + 1) % 6];
    
    // Skip invalid edges (outside map)
    if (!isValidPosition(neighbor)) {
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      continue;
    }

    const isCoast = isLand !== game.isLandCell(neighbor);
    
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    
    if (isCoast) {
      // Coastline edge
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      
      // Add inner shadow for depth
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
    } else {
      // Regular edge - very subtle
      ctx.lineWidth = 1;
      ctx.strokeStyle = isLand ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
      ctx.stroke();
    }
  }
}

function drawUnit(unit: Unit, x: number, y: number) {
  const color = PLAYER_COLORS[unit.playerId];
  
  // Draw unit indicator
  ctx.beginPath();
  ctx.arc(x, y, HEX_SIZE * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw unit type indicator
  ctx.fillStyle = 'white';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const symbol = unit.type === UnitType.Explorer ? 'E' :
                 unit.type === UnitType.Soldier ? 'S' : 'N';
  ctx.fillText(symbol, x, y);
}

function drawCity(city: City, x: number, y: number, isCurrentPlayer: boolean) {
  const color = PLAYER_COLORS[city.playerId];
  
  // Draw city walls
  ctx.beginPath();
  ctx.arc(x, y, HEX_SIZE * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = city.isCapital ? 'gold' : 'white';
  ctx.lineWidth = city.isCapital ? 3 : 2;
  ctx.stroke();

  // Draw crown for capital
  if (city.isCapital) {
    ctx.fillStyle = 'gold';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', x, y - HEX_SIZE * 0.6);

    // Highlight current player's capital
    if (isCurrentPlayer) {
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawGameState(game: GameManager) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const currentPlayer = game.getCurrentPlayer();

  // Draw terrain and territory
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const { x, y } = hexToPixel(c, r);
      const pos = { row: r, col: c };
      drawHexWithEdges(game, pos, x, y);
    }
  }

  // Draw cities
  for (const player of game.getPlayers()) {
    for (const city of player.cities) {
      const { x, y } = hexToPixel(city.position.col, city.position.row);
      drawCity(city, x, y, player.id === currentPlayer.id);
    }
  }

  // Draw units
  for (const player of game.getPlayers()) {
    for (const unit of player.units) {
      const { x, y } = hexToPixel(unit.position.col, unit.position.row);
      drawUnit(unit, x, y);
    }
  }

  // Update sidebar info
  updateSidebarInfo(game);
}

function updateSidebarInfo(game: GameManager) {
  const infoElement = document.getElementById('info');
  if (!infoElement) return;

  const currentPlayer = game.getCurrentPlayer();
  const selectedUnit = window.selectedUnit;
  const selectedCity = window.selectedCity;

  let html = `
    <div class="player-info">
      <h2 style="color: ${PLAYER_COLORS[currentPlayer.id]}">
        Player ${currentPlayer.id + 1}'s Turn
      </h2>
      <div class="stats">
        <div class="stat">
          <span class="icon">💰</span>
          <span class="value">${currentPlayer.gold}</span>
        </div>
        <div class="stat">
          <span class="icon">🏰</span>
          <span class="value">${currentPlayer.cities.length}</span>
        </div>
        <div class="stat">
          <span class="icon">⚔️</span>
          <span class="value">${currentPlayer.units.length}</span>
        </div>
        <div class="stat">
          <span class="icon">⚡</span>
          <span class="value">${game.getActionsRemaining()}</span>
        </div>
      </div>
    </div>
  `;

  if (selectedUnit || selectedCity) {
    html += '<div class="selection-info">';
    if (selectedUnit) {
      html += `
        <div class="unit-card">
          <img src="/assets/${selectedUnit.type.toLowerCase()}.svg" alt="${selectedUnit.type}" 
               style="width: 100px; height: 100px; object-fit: contain;">
          <h3>${selectedUnit.type}</h3>
          <div class="unit-stats">
            <div>Move Range: ${UNIT_STATS[selectedUnit.type].moveRange}</div>
            <div>Type: ${UNIT_STATS[selectedUnit.type].isNaval ? 'Naval' : 'Land'}</div>
            ${selectedUnit.hasMoved ? '<div class="used">Already moved</div>' : ''}
          </div>
        </div>
      `;
    }
    if (selectedCity) {
      html += `
        <div class="city-card">
          <img src="/assets/${selectedCity.isCapital ? 'capital' : 'city'}.svg" alt="City" 
               style="width: 100px; height: 100px; object-fit: contain;">
          <h3>${selectedCity.isCapital ? 'Capital City' : 'City'}</h3>
          <div class="city-stats">
            <div>Income: +10 gold/month</div>
            <div>Status: Expanding</div>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  infoElement.innerHTML = html;
}

export { ctx }; 