import Icon_wk from '../assets/king_w.svg';
import Icon_bk from '../assets/king_b.svg';
import Icon_wq from '../assets/queen_w.svg';
import Icon_bq from '../assets/queen_b.svg';
import Icon_wb from '../assets/bishop_w.svg';
import Icon_bb from '../assets/bishop_b.svg';
import Icon_wn from '../assets/knight_w.svg';
import Icon_bn from '../assets/knight_b.svg';
import Icon_wr from '../assets/rook_w.svg';
import Icon_br from '../assets/rook_b.svg';
import Icon_wp from '../assets/pawn_w.svg';
import Icon_bp from '../assets/pawn_b.svg';

import {
  Chess,
  WHITE,
  BLACK,
  PAWN,
  QUEEN,
  KING,
  type Square,
  type PieceSymbol,
  type Color,
  type Move,
} from 'chess.js';

// General settings:
export type Settings = {
  onePlayerMode: boolean;
  AIPlayerIsSmart: boolean;
  humanPlaysColor: Color | null;
  humanPlaysColorRandomly: boolean;
  AIMoveDelay: number;
};

// Settings specific for a given game:
export type CurrentGameSettings = {
  humanPlaysColor: Color;
};

export type Board = {
  initPositionFEN?: string;
  history: string[][];
  flatHistory: string[];
  historyNumMoves: number;
  turn: Color;
  diceRoll: number;
  numMovesInTurn: number;
  firstMoveInTurn: boolean;
  gameOver: boolean;
  outcome?: string;
};

export const pieceSVGs: { [key: string]: any } = {
  Icon_wk,
  Icon_bk,
  Icon_wq,
  Icon_bq,
  Icon_wb,
  Icon_bb,
  Icon_wn,
  Icon_bn,
  Icon_wr,
  Icon_br,
  Icon_wp,
  Icon_bp,
};

export const playerIconSVGs = {
  w: pieceSVGs['Icon_wp'],
  b: pieceSVGs['Icon_bp'],
};

export const allColors: Color[] = [WHITE, BLACK];

export const allFiles: ('a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h')[] = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
];

export const allFilesReversed: (
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
)[] = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

export const allRanks: (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)[] = [
  1, 2, 3, 4, 5, 6, 7, 8,
];

export const allRanksReversed: (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)[] = [
  8, 7, 6, 5, 4, 3, 2, 1,
];

export const getSquareRank: (square: Square) => number = (square: Square) =>
  +square[1];

const initBoard: Board = {
  initPositionFEN: undefined,
  history: [[]],
  flatHistory: [],
  historyNumMoves: 0,
  turn: WHITE,
  diceRoll: -1,
  numMovesInTurn: -1,
  firstMoveInTurn: true,
  gameOver: false,
};

const defaultInitSettings: Settings = {
  onePlayerMode: true,
  AIPlayerIsSmart: false,
  humanPlaysColor: WHITE,
  humanPlaysColorRandomly: false,
  AIMoveDelay: 250,
};

const localStorageKeyPrefix = import.meta.env.VITE_APP_NAME;

let initSettings: Settings;
export let settings: Settings;

export let board: Board;
export let boardEngine: Chess; // <-- board rules engine
export const chessAIEngine: WebSocket | null = null; // <-- chess AI player engine

// Initialize settings and load any saved settings:
export function loadSettings(currentGameSettings: CurrentGameSettings): void {
  const localData = localStorage.getItem(localStorageKeyPrefix + '-settings');
  initSettings = localData
    ? (JSON.parse(localData) as Settings)
    : defaultInitSettings;
  resetSettings(currentGameSettings);
}

// Save the current settings:
export function saveSettings(setNewCurrentGameSettings: () => void): void {
  const settingsDataJSON = JSON.stringify(settings);
  localStorage.setItem(localStorageKeyPrefix + '-settings', settingsDataJSON);
  // trigger resetting the current game settings and board reset:
  setNewCurrentGameSettings();
}

// Reset the current settings:
export const resetSettings = (currentGameSettings: CurrentGameSettings) => {
  settings = { ...initSettings };
  // set which players gets which color:
  currentGameSettings.humanPlaysColor = settings.humanPlaysColorRandomly
    ? allColors[Math.floor(Math.random() * 2)]
    : settings.humanPlaysColor!;
};

// Reset the board to start a new game:
export const resetBoard = () => {
  board = { ...initBoard };
  board.history = [[]];
  board.flatHistory = [];
  board.historyNumMoves = 0;
  boardEngine = new Chess(board.initPositionFEN);
  // close the chess AI engine socket if we have one running currently:
  if (chessAIEngine !== null) (chessAIEngine as WebSocket).close();
  // If we need the chess aI engine (1-player game) set it up:
  if (settings.onePlayerMode) {
    //chessAIEngine = new WebSocket(import.meta.env.VITE_APP_CHESS_ENGINE_API_URL);
  }
};

export const getSquarePiece = (square: Square) => boardEngine.get(square);

// Returns whether or not making move from to square is a valid move based on current board:
export function validateMove(fromSquare: Square, toSquare: Square): boolean {
  // boardEngine accepts a move in which a king is taken! Take care of it manually here:
  const toPiece = getSquarePiece(toSquare);
  if (toPiece && toPiece.type === KING) return false;
  const possibleMoves = boardEngine.moves({
    square: fromSquare,
    verbose: true,
  });
  return possibleMoves.filter((m) => m.to === toSquare).length > 0;
}

// Execute the given move from to square:
export function makeMove(
  fromSquare: Square,
  toSquare: Square,
  promotion?: string
): string[][] {
  const move: Move = boardEngine.move({
    from: fromSquare,
    to: toSquare,
    promotion: promotion,
  });
  board.turn = boardEngine.turn();
  board.history[board.history.length - 1].push(move.san);
  board.flatHistory.push(move.san);
  board.historyNumMoves += 1;
  board.numMovesInTurn -= 1;
  if (board.numMovesInTurn === 0) {
    // The player has played current turn's all the number of moves according to the dice roll:
    board.diceRoll = -1;
    board.numMovesInTurn = -1;
    board.firstMoveInTurn = true;
    board.history.push([]);
  } else {
    // The player still has moves left in the current turn, according to the dice roll:
    board.firstMoveInTurn = false;
    // swap turn back to the player who just moved since there's still more to make:
    swapTurn();
  }
  // After each move we need to check for game over because if player has moves left
  // in the turn but has no valid moves then it's a draw:
  checkForGameOver();
  return board.history;
}

// Returns true if we're in 1-player mode and it's not human player's turn:
export const isAITurn: (currentGameSettings: CurrentGameSettings) => boolean = (
  currentGameSettings: CurrentGameSettings
) =>
  settings.onePlayerMode && board.turn !== currentGameSettings.humanPlaysColor;

// Is the game over based on the current board:
export const checkForGameOver: () => void = () => {
  if (boardEngine.isCheckmate()) {
    board.gameOver = true;
    board.outcome = (board.turn === WHITE ? 'Black' : 'White') + ' wins!';
  } else if (boardEngine.isDraw() || isDiceyChessDraw()) {
    board.gameOver = true;
    board.outcome = 'Draw!';
  }
};

// Is this a draw situation for Dicey chess, since player still hasn't played all
// moves in the current turn (based on the dice roll), but has no valid move to make:
const isDiceyChessDraw: () => boolean = () => boardEngine.moves().length === 0;

// Prompt user when promoting a pawn which type of piece they want to promote to:
export function promptUserIfPromotionMove(
  fromSquare: Square,
  toSquare: Square,
  turn: Color
): PieceSymbol | undefined {
  const piece = getSquarePiece(fromSquare)!;
  if (piece.type === PAWN) {
    const toSquareRank = getSquareRank(toSquare);
    if (turn === WHITE ? toSquareRank === 8 : toSquareRank === 1) {
      piece.type = QUEEN;
      return QUEEN;
    }
  }
  return undefined;
}

// Manually manipulate the current board to make it the other player's turn.
// This is needed since we want to make a player make multiple moves in a single
// turn:
export function swapTurn(): void {
  let fen = boardEngine.fen();
  const fenA = fen.split(' ');
  fenA[1] = fenA[1] === 'w' ? 'b' : 'w';
  fen = fenA.join(' ');
  boardEngine = new Chess(fen);
  board.turn = boardEngine.turn();
}
