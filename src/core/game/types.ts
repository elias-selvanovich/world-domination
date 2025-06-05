export type Position = {
  row: number;
  col: number;
};

export enum UnitType {
  Explorer = 'Explorer',
  Soldier = 'Soldier',
  Naval = 'Naval'
}

export type UnitStats = {
  cost: number;
  moveRange: number;
  isNaval: boolean;
};

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  [UnitType.Explorer]: { cost: 20, moveRange: 2, isNaval: false },
  [UnitType.Soldier]: { cost: 30, moveRange: 1, isNaval: false },
  [UnitType.Naval]: { cost: 50, moveRange: 2, isNaval: true }
};

export type Unit = {
  id: string;
  type: UnitType;
  position: Position;
  playerId: number;
  hasMoved: boolean;
};

export type City = {
  id: string;
  position: Position;
  playerId: number;
  isCapital: boolean;
};

export type Player = {
  id: number;
  isAI: boolean;
  gold: number;
  cities: City[];
  units: Unit[];
  ownedCells: Position[];
};

export type GameState = {
  players: Player[];
  currentMonth: number;
  currentPlayerIndex: number;
  actionsRemaining: number;
  gameOver: boolean;
  winner: number | null;
};

export enum ActionType {
  MoveUnit,
  ProduceUnit,
  FoundCity
}

export type GameAction = {
  type: ActionType;
  playerId: number;
  // For MoveUnit
  unitId?: string;
  targetPosition?: Position;
  // For ProduceUnit
  unitType?: UnitType;
  cityId?: string;
  // For FoundCity
  explorerId?: string;
}; 