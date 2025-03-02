import { type BasicMove, boardEngine, settings } from './boardEngineApi';

export let chessAIEngine: WebSocket; // <-- chess AI player engine (socket ver.)
let chessAIEngineUrl: string;
let chessAIEngineBusy: boolean = false;
let chessAIEngineResponseMove: BasicMove | null = null;

export async function getAIMove(): Promise<BasicMove> {
  return settings.AIPlayerIsSmart ? getAISmartMove() : getAIRandomMove();
}

// Stupid AI mode: Makes a random move with a bit of delay:
async function getAIRandomMove(): Promise<BasicMove> {
  const seconds = (settings.AIMoveDelay * 5 * Math.random()) / 1000;
  return new Promise((resolve) => {
    setTimeout(() => {
      const possibleMoves = boardEngine.moves({
        verbose: true,
      });
      const move =
        possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      resolve(move as BasicMove);
    }, seconds * 1000);
  });
}

// Smart AI mode: Calls a chess engine API:
async function getAISmartMove(): Promise<BasicMove> {
  return settings.AIEngineUsesSocket
    ? getAISmartMove_socket()
    : getAISmartMove_fetch();
}

// Calls a chess engine API using fetch method:
async function getAISmartMove_fetch(): Promise<BasicMove> {
  const response = await fetch(chessAIEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fen: boardEngine.fen(),
      maxThinkingTime: 100,
      depth: 18,
    }),
  });
  const chessApiMessage = await response.json();
  chessAIEngineResponseMove = {
    from: chessApiMessage.from,
    to: chessApiMessage.to,
    promotion: chessApiMessage.promotion || undefined,
  };
  return chessAIEngineResponseMove;
}

// Calls a chess engine API using web socket method
// (API will send moves progressively as it thinks and finds better moves):
async function getAISmartMove_socket(): Promise<BasicMove> {
  return new Promise((resolve) => {
    if (chessAIEngineBusy) throw Error('Chess AI engine is busy');
    chessAIEngineBusy = true;
    chessAIEngine.send(
      JSON.stringify({
        fen: boardEngine.fen(),
        maxThinkingTime: 100,
        depth: 18,
      })
    );
    return resolve(awaitChessAIEngineMove_socket());
  });
}

// Frequently checks to see if response from chess engine AI has arrived yet.
// Once it is here, it returns the move:
async function awaitChessAIEngineMove_socket(): Promise<BasicMove> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (chessAIEngineResponseMove) {
        const move = chessAIEngineResponseMove;
        chessAIEngineResponseMove = null;
        chessAIEngineBusy = false;
        resolve(move);
      } else return resolve(awaitChessAIEngineMove_socket());
    }, 1000);
  });
}

export function initChessAIEngine(): void {
  if (settings.AIEngineUsesSocket)
    chessAIEngineUrl = 'wss:' + import.meta.env.VITE_APP_CHESS_ENGINE_API_URL;
  else
    chessAIEngineUrl = 'https:' + import.meta.env.VITE_APP_CHESS_ENGINE_API_URL;
  if (settings.AIEngineUsesSocket) {
    chessAIEngine = new WebSocket(chessAIEngineUrl);
    chessAIEngine.onmessage = (event) => {
      const chessApiMessage = JSON.parse(event.data);
      if (chessApiMessage.type === 'move') {
        //console.log('chess ai response arrived', chessApiMessage);
        chessAIEngineResponseMove = {
          from: chessApiMessage.from,
          to: chessApiMessage.to,
          promotion: chessApiMessage.promotion || undefined,
        };
      }
    };
  }
}

export function closeChessAIEngine(): void {
  if (settings.AIEngineUsesSocket) (chessAIEngine as WebSocket).close();
}
