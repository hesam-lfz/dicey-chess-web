import {
  type BasicMove,
  boardEngine,
  getPossibleMoves,
  getPossibleSanMoves,
  settings,
  DebugOn,
  internalSettings,
  gameGlobals,
} from './boardEngineApi';

interface AIEngineParams {
  fen: string;
  maxThinkingTime: number;
  depth: number;
  searchmoves?: string;
}

// chess AI player engine (socket version):
export let chessAiEngine_socket: WebSocket;
// Will set to true when AI engine API cannot be used due to network failures/restrictions:
export let chessAiEngine_fallbackActivated = false;
export const chessAiEngine_fallbackMessage =
  'Network disallowed calling the game AI engine API. Falling back to random/stupid move AI...';

let chessAiEngineUrl: string;
let chessAiEngineBusy_socket: boolean = false;
let chessAiEngineResponseMove: BasicMove | null = null;

export async function chessAiEngineApi_getAIMove(
  isLastMoveInTurn: boolean
): Promise<BasicMove> {
  return settings.AIPlayerIsSmart
    ? getAISmartMove(isLastMoveInTurn)
    : chessAiEngineApi_getAIRandomMove(isLastMoveInTurn);
}

// Stupid AI mode: Makes a random move with a bit of delay:
async function chessAiEngineApi_getAIRandomMove(
  isLastMoveInTurn: boolean
): Promise<BasicMove> {
  const seconds = (internalSettings.AIMoveDelay * 5 * Math.random()) / 1000;
  return new Promise((resolve) => {
    setTimeout(() => {
      const possibleMoves = getPossibleMoves(isLastMoveInTurn);
      const move =
        possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      resolve(move as BasicMove);
    }, seconds * 1000);
  });
}

// Smart AI mode: Calls a chess engine API:
async function getAISmartMove(isLastMoveInTurn: boolean): Promise<BasicMove> {
  return internalSettings.AIEngineUsesSocket
    ? getAISmartMove_socket(isLastMoveInTurn)
    : getAISmartMove_fetch(isLastMoveInTurn);
}

// Calls a chess engine API using fetch method:
async function getAISmartMove_fetch(
  isLastMoveInTurn: boolean
): Promise<BasicMove> {
  const params: AIEngineParams = {
    fen: boardEngine.fen(),
    maxThinkingTime: 100,
    depth: 18,
  };
  let possibleMoves;
  // If a check move is disallowed (not last move in current turn's move-set)
  // ensure the ai engine will exclude such check moves:
  if (!isLastMoveInTurn) {
    possibleMoves = getPossibleSanMoves(isLastMoveInTurn);
    if (possibleMoves) params.searchmoves = possibleMoves;
    if (DebugOn) console.log('added searchmoves:', possibleMoves);
  }
  const response = await fetch(chessAiEngineUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  // Ensure the response status indicates success:
  if (!response.ok) {
    // If the status code is not in the successful range, throw an error:
    throw new Error(`AI engine API fetch error: ${response.status}`);
  }
  const chessApiMessage = await response.json();
  // The chess AI engine may not return a move. It also has a bug that it ignores the
  // 'searchmoves' param and returns a move that wasn't in the allowed move set.
  // If that happens, fallback to random move here:
  if (
    !chessApiMessage.san ||
    (possibleMoves && !possibleMoves.includes(chessApiMessage.san))
  ) {
    if (DebugOn)
      console.log(
        `oops. AI engine returned an invalid move. ${chessApiMessage.san} Falling back to a random move...`
      );
    return await chessAiEngineApi_getAIRandomMove(isLastMoveInTurn);
  }
  chessAiEngineResponseMove = {
    from: chessApiMessage.from,
    to: chessApiMessage.to,
    promotion: chessApiMessage.promotion || undefined,
  };
  return chessAiEngineResponseMove;
}

// Calls a chess engine API using web socket method
// (API will send moves progressively as it thinks and finds better moves):
async function getAISmartMove_socket(
  isLastMoveInTurn: boolean
): Promise<BasicMove> {
  return new Promise((resolve) => {
    if (chessAiEngineBusy_socket) throw Error('Chess AI engine is busy');
    chessAiEngineBusy_socket = true;
    chessAiEngine_socket.send(
      JSON.stringify({
        fen: boardEngine.fen(),
        maxThinkingTime: 100,
        depth: 18,
      })
    );
    return resolve(awaitChessAiEngineMove_socket(isLastMoveInTurn));
  });
}

// Frequently checks to see if response from chess engine AI has arrived yet.
// Once it is here, it returns the move:
async function awaitChessAiEngineMove_socket(
  isLastMoveInTurn: boolean
): Promise<BasicMove> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (chessAiEngineResponseMove) {
        const move = chessAiEngineResponseMove;
        chessAiEngineResponseMove = null;
        chessAiEngineBusy_socket = false;
        resolve(move);
      } else return resolve(awaitChessAiEngineMove_socket(isLastMoveInTurn));
    }, 1000);
  });
}

// Sets up proper URLs and preparations for AI engine API communication:
export async function chessAiEngineApi_initChessAiEngine(): Promise<void> {
  chessAiEngine_fallbackActivated = false;
  if (internalSettings.AIEngineUsesSocket) {
    // AI Engine API uses: socket
    chessAiEngineUrl = 'wss:' + import.meta.env.VITE_APP_CHESS_ENGINE_API_URL;
    // Set up socket communication:
    chessAiEngine_socket = new WebSocket(chessAiEngineUrl);
    chessAiEngine_socket.onmessage = (event) => {
      const chessApiMessage = JSON.parse(event.data);
      if (chessApiMessage.type === 'move') {
        //console.log('chess ai response arrived', chessApiMessage);
        chessAiEngineResponseMove = {
          from: chessApiMessage.from,
          to: chessApiMessage.to,
          promotion: chessApiMessage.promotion || undefined,
        };
      }
    };
  } else {
    // AI Engine API uses: fetch
    chessAiEngineUrl = 'https:' + import.meta.env.VITE_APP_CHESS_ENGINE_API_URL;
    // Run a one-time test to see we can talk to the API through fetch call
    // If we get an error (due to CORS proxy limitations), update the API
    // URL to use a CORS proxy server...
    // If fetch still fails fall back to random move stupid AI mode...
    try {
      const move = await getAISmartMove_fetch(true);
      if (DebugOn) console.log('Test of AI engine API fetch succeeded', move);
    } catch (error) {
      console.error('Test of AI engine API fetch encountered error):', error);
      if (await reattemptInitChessAiEngine()) {
        if (DebugOn)
          console.log(
            'Test of AI engine API fetch succeeded after 2nd attempt'
          );
        return;
      }
      console.log('Enabling use of proxy CORS server for fetching...');
      chessAiEngineUrl =
        import.meta.env.VITE_APP_FETCH_CORS_PROXY_SERVER + chessAiEngineUrl;
      try {
        const move = await getAISmartMove_fetch(true);
        console.log(
          'Test of AI engine API with proxy CORS fetch succeeded',
          move
        );
      } catch (error) {
        console.error(
          'Test of AI engine API with proxy CORS fetch encountered error:',
          error
        );
        console.error(chessAiEngine_fallbackMessage);
        gameGlobals.dialogMessagesToShow.push(chessAiEngine_fallbackMessage);
        chessAiEngine_fallbackActivated = true;
        settings.AIPlayerIsSmart = false;
      }
    }
  }
}

// Reattempts a connection test to AI engine API
async function reattemptInitChessAiEngine(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        await getAISmartMove_fetch(true);
        resolve(true);
      } catch (error) {
        resolve(false);
      }
    }, 1000);
  });
}

export function chessAiEngineApi_closeChessAiEngine_socket(): void {
  if (internalSettings.AIEngineUsesSocket)
    (chessAiEngine_socket as WebSocket).close();
}
