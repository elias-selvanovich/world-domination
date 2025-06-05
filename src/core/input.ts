import { GameManager } from './game/GameManager';
import { drawGameState, offset, ctx, hexToPixel } from '../graphics/renderer';
import { Position, Unit, City, UnitType, ActionType } from './game/types';

// Make these available globally for the renderer
window.selectedUnit = null;
window.selectedCity = null;
let hoveredCell: Position | null = null;

function processAITurns(gameManager: GameManager) {
  // Keep processing turns until it's the human player's turn again
  while (!gameManager.isGameOver() && gameManager.getCurrentPlayer().isAI) {
    // For now, AI just ends their turn immediately
    // TODO: Implement actual AI logic
    gameManager.endTurn();
  }
  drawGameState(gameManager);
}

export function setupControls(gameManager: GameManager) {
  const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;

  // Map panning with arrow keys
  window.onkeydown = (e) => {
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  offset.x += 20; break;
      case 'ArrowRight': offset.x -= 20; break;
      case 'ArrowUp':    offset.y += 20; break;
      case 'ArrowDown':  offset.y -= 20; break;
      case 'Escape':     // Clear selection
        window.selectedUnit = null;
        window.selectedCity = null;
        break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      drawGameState(gameManager);
    }
  };

  // Mouse move for hover effects
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find hovered cell
    hoveredCell = null;
    for (let r = 0; r < 50; r++) {
      for (let c = 0; c < 80; c++) {
        const { x, y } = hexToPixel(c, r);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI/180) * (60 * i - 30);
          ctx[i === 0 ? 'moveTo' : 'lineTo'](
            x + 12 * Math.cos(a),
            y + 12 * Math.sin(a)
          );
        }
        ctx.closePath();
        if (ctx.isPointInPath(mx, my)) {
          hoveredCell = { row: r, col: c };
          break;
        }
      }
      if (hoveredCell) break;
    }

    drawGameState(gameManager);
    
    // Draw hover effects
    if (hoveredCell) {
      const { x, y } = hexToPixel(hoveredCell.col, hoveredCell.row);
      
      // Draw hex outline
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI/180) * (60 * i - 30);
        const xi = x + 12 * Math.cos(a);
        const yi = y + 12 * Math.sin(a);
        i === 0 ? ctx.moveTo(xi, yi) : ctx.lineTo(xi, yi);
      }
      ctx.closePath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Show cell info
      const infoElement = document.getElementById('tileInfo');
      if (infoElement) {
        const currentPlayer = gameManager.getCurrentPlayer();
        const unit = gameManager.getUnitAtPosition(hoveredCell);
        const city = gameManager.getCityAtPosition(hoveredCell);
        
        let info = `Position: (${hoveredCell.col}, ${hoveredCell.row})<br>`;
        info += `Terrain: ${gameManager.isLandCell(hoveredCell) ? 'Land' : 'Water'}<br>`;
        
        if (unit) {
          info += `Unit: ${unit.type} (Player ${unit.playerId + 1})<br>`;
        }
        if (city) {
          info += `City: ${city.isCapital ? 'Capital ' : ''}(Player ${city.playerId + 1})<br>`;
        }

        if (window.selectedUnit) {
          info += '<br>Selected Unit: ' + window.selectedUnit.type;
        }
        if (window.selectedCity) {
          info += '<br>Selected City: ' + (window.selectedCity.isCapital ? 'Capital' : 'City');
        }

        infoElement.innerHTML = info;
      }
    }
  };

  // Mouse click for selection and actions
  canvas.onclick = (e) => {
    if (!hoveredCell) return;

    const currentPlayer = gameManager.getCurrentPlayer();
    const clickedUnit = gameManager.getUnitAtPosition(hoveredCell);
    const clickedCity = gameManager.getCityAtPosition(hoveredCell);

    // If we have a selected unit, try to move it
    if (window.selectedUnit && currentPlayer.units.includes(window.selectedUnit)) {
      gameManager.performAction({
        type: ActionType.MoveUnit,
        playerId: currentPlayer.id,
        unitId: window.selectedUnit.id,
        targetPosition: hoveredCell
      });
      window.selectedUnit = null;
    }
    // If we have a selected city, try to produce a unit
    else if (window.selectedCity && currentPlayer.cities.includes(window.selectedCity)) {
      // Show unit production menu
      showUnitProductionMenu(gameManager, window.selectedCity, hoveredCell);
      window.selectedCity = null;
    }
    // Select a unit or city
    else if (clickedUnit && clickedUnit.playerId === currentPlayer.id) {
      window.selectedUnit = clickedUnit;
      window.selectedCity = null;
    }
    else if (clickedCity && clickedCity.playerId === currentPlayer.id) {
      window.selectedCity = clickedCity;
      window.selectedUnit = null;
    }
    // Try to found a city with an explorer
    else if (clickedUnit && 
             clickedUnit.playerId === currentPlayer.id && 
             clickedUnit.type === UnitType.Explorer) {
      gameManager.performAction({
        type: ActionType.FoundCity,
        playerId: currentPlayer.id,
        explorerId: clickedUnit.id
      });
    }

    drawGameState(gameManager);
  };

  // End turn button
  const endTurnButton = document.getElementById('endTurn');
  if (endTurnButton) {
    endTurnButton.onclick = () => {
      gameManager.endTurn();
      window.selectedUnit = null;
      window.selectedCity = null;
      
      // Process AI turns automatically
      processAITurns(gameManager);
      
      // Update display
      drawGameState(gameManager);
    };
  }
}

function showUnitProductionMenu(gameManager: GameManager, city: City, position: Position) {
  const currentPlayer = gameManager.getCurrentPlayer();
  const menu = document.createElement('div');
  menu.className = 'production-menu';
  
  const title = document.createElement('h3');
  title.textContent = 'Produce Unit';
  menu.appendChild(title);

  [UnitType.Explorer, UnitType.Soldier, UnitType.Naval].forEach(unitType => {
    const button = document.createElement('button');
    const cost = gameManager.getUnitCost(unitType);
    button.innerHTML = `
      ${unitType}
      <span class="cost">${cost} gold</span>
    `;
    
    if (cost > currentPlayer.gold) {
      button.disabled = true;
    }

    button.onclick = () => {
      gameManager.performAction({
        type: ActionType.ProduceUnit,
        playerId: currentPlayer.id,
        cityId: city.id,
        unitType: unitType
      });
      menu.remove();
      drawGameState(gameManager);
    };

    menu.appendChild(button);
  });

  const container = document.getElementById('viewport-container');
  if (container) {
    const { x, y } = hexToPixel(position.col, position.row);
    menu.style.left = `${x + 20}px`;
    menu.style.top = `${y}px`;
    container.appendChild(menu);
  }

  // Close menu when clicking outside
  const closeMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
} 