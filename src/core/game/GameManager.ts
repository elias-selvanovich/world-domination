import { noise } from '../../utils/random';
import { Position, Player, GameState, City, Unit, UnitType, GameAction, ActionType, UNIT_STATS } from './types';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private state: GameState;
  private readonly MAP_ROWS: number = 50;
  private readonly MAP_COLS: number = 80;
  private readonly CITY_GOLD_INCOME: number = 10;
  private readonly MIN_CAPITAL_DISTANCE: number = 10;

  constructor() {
    this.state = {
      players: [],
      currentMonth: 0,
      currentPlayerIndex: 0,
      actionsRemaining: 2,
      gameOver: false,
      winner: null
    };
  }

  private findStartingPositions(): Position[] {
    const positions: Position[] = [];
    const usedPositions = new Set<string>();

    while (positions.length < 6) {
      // Try to find a suitable position
      let attempts = 0;
      let found = false;

      while (!found && attempts < 1000) {
        const row = Math.floor(Math.random() * (this.MAP_ROWS - 10)) + 5;
        const col = Math.floor(Math.random() * (this.MAP_COLS - 10)) + 5;

        // Check if it's land (noise > 0)
        if (noise(col * 0.08, row * 0.08) <= 0) {
          attempts++;
          continue;
        }

        // Check minimum distance from other capitals
        let tooClose = false;
        for (const pos of positions) {
          const distance = Math.sqrt(
            Math.pow(pos.row - row, 2) + Math.pow(pos.col - col, 2)
          );
          if (distance < this.MIN_CAPITAL_DISTANCE) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose && !usedPositions.has(`${row},${col}`)) {
          positions.push({ row, col });
          usedPositions.add(`${row},${col}`);
          found = true;
        }

        attempts++;
      }

      if (!found) {
        throw new Error("Could not find suitable starting positions");
      }
    }

    return positions;
  }

  initializeGame(): void {
    const startingPositions = this.findStartingPositions();
    
    // Create players
    this.state.players = startingPositions.map((pos, index) => {
      const capital: City = {
        id: uuidv4(),
        position: pos,
        playerId: index,
        isCapital: true
      };

      const startingExplorer: Unit = {
        id: uuidv4(),
        type: UnitType.Explorer,
        position: pos,
        playerId: index,
        hasMoved: false
      };

      return {
        id: index,
        isAI: index !== 0,
        gold: 20, // Starting gold
        cities: [capital],
        units: [startingExplorer],
        ownedCells: [pos]
      };
    });

    this.state.currentPlayerIndex = 0;
    this.state.actionsRemaining = 2;
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  getPlayers(): Player[] {
    return this.state.players;
  }

  getActionsRemaining(): number {
    return this.state.actionsRemaining;
  }

  isValidAction(action: GameAction): boolean {
    const player = this.state.players[action.playerId];
    if (!player || this.state.actionsRemaining <= 0) return false;

    switch (action.type) {
      case ActionType.MoveUnit: {
        if (!action.unitId || !action.targetPosition) return false;
        const unit = player.units.find(u => u.id === action.unitId);
        if (!unit || unit.hasMoved) return false;
        // TODO: Add movement validation
        return true;
      }
      case ActionType.ProduceUnit: {
        if (!action.unitType || !action.cityId) return false;
        const city = player.cities.find(c => c.id === action.cityId);
        if (!city) return false;
        return player.gold >= UNIT_STATS[action.unitType].cost;
      }
      case ActionType.FoundCity: {
        if (!action.explorerId) return false;
        const explorer = player.units.find(u => u.id === action.explorerId);
        if (!explorer || explorer.type !== UnitType.Explorer) return false;
        return player.gold >= 20;
      }
    }
  }

  getUnitCost(type: UnitType): number {
    return UNIT_STATS[type].cost;
  }

  getUnitAtPosition(position: Position): Unit | null {
    for (const player of this.state.players) {
      const unit = player.units.find(u => 
        u.position.row === position.row && u.position.col === position.col
      );
      if (unit) return unit;
    }
    return null;
  }

  getCityAtPosition(position: Position): City | null {
    for (const player of this.state.players) {
      const city = player.cities.find(c => 
        c.position.row === position.row && c.position.col === position.col
      );
      if (city) return city;
    }
    return null;
  }

  private isCellOwnedByAnyPlayer(position: Position): boolean {
    return this.state.players.some(player => 
      player.ownedCells.some(cell => 
        cell.row === position.row && cell.col === position.col
      )
    );
  }

  isLandCell(position: Position): boolean {
    return noise(position.col * 0.08, position.row * 0.08) > 0;
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos1.row - pos2.row, 2) + Math.pow(pos1.col - pos2.col, 2)
    );
  }

  private resolveCombat(attacker: Unit, defender: Unit): boolean {
    // Returns true if attacker wins
    return Math.random() <= 0.6;
  }

  private resolveCityAttack(attacker: Unit): boolean {
    // Returns true if attacker succeeds
    return Math.random() <= 0.5;
  }

  performAction(action: GameAction): boolean {
    if (!this.isValidAction(action)) return false;

    const player = this.state.players[action.playerId];

    switch (action.type) {
      case ActionType.MoveUnit: {
        const unit = player.units.find(u => u.id === action.unitId)!;
        const targetPos = action.targetPosition!;

        // Check movement range
        const distance = this.calculateDistance(unit.position, targetPos);
        if (distance > UNIT_STATS[unit.type].moveRange) return false;

        // Check if the cell is appropriate for the unit type
        const isWater = !this.isLandCell(targetPos);
        if (UNIT_STATS[unit.type].isNaval !== isWater) return false;

        // Check for enemy unit at target position
        const enemyUnit = this.getUnitAtPosition(targetPos);
        if (enemyUnit) {
          // Combat!
          const attackerWins = this.resolveCombat(unit, enemyUnit);
          if (attackerWins) {
            // Remove defender
            const defenderPlayer = this.state.players[enemyUnit.playerId];
            defenderPlayer.units = defenderPlayer.units.filter(u => u.id !== enemyUnit.id);
            // Move attacker
            unit.position = targetPos;
          } else {
            // Remove attacker
            player.units = player.units.filter(u => u.id !== unit.id);
          }
        } else {
          // Check for enemy city
          const enemyCity = this.getCityAtPosition(targetPos);
          if (enemyCity && enemyCity.playerId !== player.id) {
            if (unit.type === UnitType.Soldier || unit.type === UnitType.Explorer) {
              const attackSucceeds = this.resolveCityAttack(unit);
              if (attackSucceeds) {
                // Capture the city
                const defenderPlayer = this.state.players[enemyCity.playerId];
                defenderPlayer.cities = defenderPlayer.cities.filter(c => c.id !== enemyCity.id);
                enemyCity.playerId = player.id;
                player.cities.push(enemyCity);
                // Transfer owned cells around the city
                const capturedCells = defenderPlayer.ownedCells.filter(cell =>
                  this.calculateDistance(cell, enemyCity.position) <= 1
                );
                defenderPlayer.ownedCells = defenderPlayer.ownedCells.filter(cell =>
                  !capturedCells.some(captured => 
                    captured.row === cell.row && captured.col === cell.col
                  )
                );
                player.ownedCells.push(...capturedCells);
                // Move attacker
                unit.position = targetPos;
              } else {
                // Attacker dies
                player.units = player.units.filter(u => u.id !== unit.id);
              }
            }
          } else {
            // Simple movement
            unit.position = targetPos;
          }
        }

        unit.hasMoved = true;
        break;
      }

      case ActionType.ProduceUnit: {
        const city = player.cities.find(c => c.id === action.cityId)!;
        const unitType = action.unitType!;
        const cost = UNIT_STATS[unitType].cost;

        // Deduct cost
        player.gold -= cost;

        // Create new unit
        const newUnit: Unit = {
          id: uuidv4(),
          type: unitType,
          position: { ...city.position },
          playerId: player.id,
          hasMoved: false
        };

        player.units.push(newUnit);
        break;
      }

      case ActionType.FoundCity: {
        const explorer = player.units.find(u => u.id === action.explorerId)!;
        const position = explorer.position;

        // Check if the position is valid for a new city
        if (!this.isLandCell(position) || this.isCellOwnedByAnyPlayer(position)) {
          return false;
        }

        // Deduct cost
        player.gold -= 20;

        // Create new city
        const newCity: City = {
          id: uuidv4(),
          position: { ...position },
          playerId: player.id,
          isCapital: false
        };

        player.cities.push(newCity);
        player.ownedCells.push({ ...position });

        // Remove the explorer
        player.units = player.units.filter(u => u.id !== explorer.id);
        break;
      }
    }

    this.state.actionsRemaining--;
    return true;
  }

  private getAdjacentCells(position: Position): Position[] {
    // For hex grid, odd rows are offset by +0.5 columns
    const directions = [
      [-1, 0], [1, 0],  // Above and below
      [0, -1], [0, 1],  // Left and right
    ];
    
    // Diagonal directions depend on whether we're on an odd or even row
    const diagonals = position.row % 2 === 0 
      ? [[-1, -1], [-1, 0], [1, -1], [1, 0]]  // Even row
      : [[-1, 0], [-1, 1], [1, 0], [1, 1]];   // Odd row
    
    return [...directions, ...diagonals]
      .map(([dr, dc]) => ({
        row: position.row + dr,
        col: position.col + dc
      }))
      .filter(pos => 
        pos.row >= 0 && pos.row < this.MAP_ROWS &&
        pos.col >= 0 && pos.col < this.MAP_COLS
      );
  }

  private findCheapestAdjacentCell(city: City): Position | null {
    const adjacentCells = this.getAdjacentCells(city.position);
    let bestCell: Position | null = null;
    let lowestNoise = Infinity;

    for (const cell of adjacentCells) {
      // Skip if cell is already owned or is water
      if (this.isCellOwnedByAnyPlayer(cell) || !this.isLandCell(cell)) {
        continue;
      }

      // Use noise value as "cost" - lower noise means easier to expand into
      const noiseValue = Math.abs(noise(cell.col * 0.08, cell.row * 0.08));
      if (noiseValue < lowestNoise) {
        lowestNoise = noiseValue;
        bestCell = cell;
      }
    }

    return bestCell;
  }

  private expandCity(city: City): void {
    const newCell = this.findCheapestAdjacentCell(city);
    if (newCell) {
      const player = this.state.players[city.playerId];
      player.ownedCells.push(newCell);
    }
  }

  endTurn(): void {
    // Reset units' movement for the current player
    const currentPlayer = this.getCurrentPlayer();
    currentPlayer.units.forEach(unit => unit.hasMoved = false);

    // Move to next player
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    
    // If we've completed a full round, process month end
    if (this.state.currentPlayerIndex === 0) {
      this.processMonthEnd();
    }

    // Reset actions for the new player's turn
    this.state.actionsRemaining = 2;
  }

  processMonthEnd(): void {
    this.state.currentMonth++;

    // Process each player
    for (const player of this.state.players) {
      // Add gold income from cities
      player.gold += player.cities.length * this.CITY_GOLD_INCOME;

      // Expand each city into adjacent territory
      for (const city of player.cities) {
        this.expandCity(city);
      }
    }

    // Check victory conditions after processing month end
    this.checkVictoryConditions();
  }

  isGameOver(): boolean {
    return this.state.gameOver;
  }

  private countLandCells(): number {
    let count = 0;
    for (let r = 0; r < this.MAP_ROWS; r++) {
      for (let c = 0; c < this.MAP_COLS; c++) {
        if (this.isLandCell({ row: r, col: c })) {
          count++;
        }
      }
    }
    return count;
  }

  private checkVictoryConditions(): void {
    // Count total land cells for domination victory
    const totalLandCells = this.countLandCells();

    for (const player of this.state.players) {
      // Check for domination victory (90% of land cells)
      const controlledLandCells = player.ownedCells.filter(cell => this.isLandCell(cell)).length;
      if (controlledLandCells >= totalLandCells * 0.9) {
        this.state.gameOver = true;
        this.state.winner = player.id;
        return;
      }

      // Check for elimination victory
      const otherPlayersExist = this.state.players.some(p => 
        p.id !== player.id && p.cities.length > 0
      );
      if (!otherPlayersExist) {
        this.state.gameOver = true;
        this.state.winner = player.id;
        return;
      }
    }

    // Check for game length limit (200 months)
    if (this.state.currentMonth >= 200) {
      // Find player with most land cells
      let maxLandCells = 0;
      let winner = null;
      for (const player of this.state.players) {
        const landCells = player.ownedCells.filter(cell => this.isLandCell(cell)).length;
        if (landCells > maxLandCells) {
          maxLandCells = landCells;
          winner = player.id;
        }
      }
      this.state.gameOver = true;
      this.state.winner = winner;
    }
  }

  // More methods to be added:
  // - endTurn(): void
  // - processMonthEnd(): void
  // - checkVictoryConditions(): void
  // - getValidMoves(unitId: string): Position[]
  // - etc.
} 