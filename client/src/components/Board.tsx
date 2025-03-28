import { useState, useEffect, useCallback, MouseEvent } from 'react';
import { useCurrentGameContext } from '../components/useCurrentGameContext';

import {
  pieceSVGs,
  allFiles,
  allFilesReversed,
  allRanks,
  allRanksReversed,
  getSquarePiece,
  makeMove,
  validateMove,
  promptUserIfPromotionMove,
  board,
  isAITurn,
  chessAiEngineApi_getAIMove,
  boardReplayStepMove,
  BasicMove,
  DebugOn,
  internalSettings,
  isOpponentsTurn,
} from '../lib';
import { Color, PieceSymbol, WHITE, type Piece, type Square } from 'chess.js';

function renderOccupyingPiece(piece?: Piece) {
  if (!piece) return null;
  const color = piece.color;
  const type = piece.type;
  const pieceName = 'Icon_' + (color + type);
  return (
    <img
      src={pieceSVGs[pieceName]}
      className="piece"
      alt={pieceName}
      draggable="false"
    />
  );
}

type Props = {
  currGameId: number;
  currReplayModeOn: boolean;
  currReplayStepMove: number;
  currPrevMoveFromSq: Square | null;
  currPrevMoveToSq: Square | null;
  currUserPlaysColor: Color;
  currShouldTriggerAITurn: boolean;
  currIsMovingDisabled: boolean;
  containerOnMove: () => void;
  containerOnAlertDiceRoll: () => void;
};

let makeMoveDelayTimeoutId: NodeJS.Timeout | undefined = undefined;
let AIMoveDelayTimeoutId: NodeJS.Timeout | undefined = undefined;

export function Board({
  currGameId,
  currReplayModeOn,
  currReplayStepMove,
  currPrevMoveFromSq,
  currPrevMoveToSq,
  currUserPlaysColor,
  currShouldTriggerAITurn,
  currIsMovingDisabled,
  containerOnMove,
  containerOnAlertDiceRoll,
}: Props) {
  const { currentGameSettings, currentBoardData, user } =
    useCurrentGameContext();
  const [gameId, setGameId] = useState<number>(currGameId);
  const [replayModeOn, setReplayModeOn] = useState<boolean>(currReplayModeOn);
  const [replayStepMove, setReplayStepMove] =
    useState<number>(currReplayStepMove);
  const [replayStepMoveTriggered, setReplayStepMoveTriggered] =
    useState<boolean>(false);
  const [userPlaysColor, setUserPlaysColor] =
    useState<Color>(currUserPlaysColor);
  const [shouldTriggerAITurn, setShouldTriggerAITurn] = useState<boolean>(
    currShouldTriggerAITurn
  );
  const [movingFromSq, setMovingFromSq] = useState<Square | null>(null);
  const [movingToSq, setMovingToSq] = useState<Square | null>(null);
  const [pawnPromotion, setPawnPromotion] = useState<PieceSymbol | undefined>(
    undefined
  );
  const [prevMoveFromSq, setPrevMoveFromSq] = useState<Square | null>(
    currPrevMoveFromSq
  );
  const [prevMoveToSq, setPrevMoveToSq] = useState<Square | null>(
    currPrevMoveToSq
  );
  const [isMovingDisabled, setIsMovingDisabled] =
    useState<boolean>(currIsMovingDisabled);

  const handleMove = useCallback(() => {
    setPrevMoveFromSq(movingFromSq);
    setPrevMoveToSq(movingToSq);
    setMovingFromSq(null);
    setMovingToSq(null);
    if (replayModeOn) {
      setReplayStepMoveTriggered(false);
    } else {
      makeMove(
        currentGameSettings,
        currentBoardData,
        user,
        movingFromSq!,
        movingToSq!,
        pawnPromotion,
        false
      );
      setShouldTriggerAITurn(false);
    }
    containerOnMove();
  }, [
    movingFromSq,
    movingToSq,
    replayModeOn,
    containerOnMove,
    currentGameSettings,
    currentBoardData,
    user,
    pawnPromotion,
  ]);

  const triggerAIMove = useCallback(() => {
    const run = async () => {
      const gameIdBeforeCall = currentGameSettings.gameId;
      const move: BasicMove = await chessAiEngineApi_getAIMove(
        currentBoardData.numMovesInTurn === 1
      );
      // If game has been reset since we called the api, just ignore the response:
      if (gameIdBeforeCall !== currentGameSettings.gameId) return;
      //console.log('getAIMove got', move);
      setMovingFromSq(move.from);
      setMovingToSq(move.to);
      setPawnPromotion(move.promotion);
    };
    run();
  }, [currentBoardData.numMovesInTurn, currentGameSettings.gameId]);

  // Move to next/prev move during game replay:
  const triggerReplayStepMove = useCallback(
    (step: number) => {
      const run = async () => {
        const move = boardReplayStepMove(currentBoardData, step);
        if (move) {
          setMovingFromSq(move.from);
          setMovingToSq(move.to);
          setPawnPromotion(move.promotion);
        } else {
          setPrevMoveFromSq(null);
          setPrevMoveToSq(null);
          setMovingFromSq(null);
          setMovingToSq(null);
          setPawnPromotion(undefined);
        }
        setReplayStepMove(0);
      };
      run();
    },
    [currentBoardData]
  );

  useEffect(() => {
    const run = async () => {
      if (DebugOn) {
        const smh = board.flatSquareMoveHistory;
        const fmh = board.flatBoardFenHistory;
        board.flatSquareMoveHistory = [];
        board.flatBoardFenHistory = [];
        console.log(
          'rendered Board',
          'currentGameSettings',
          currentGameSettings,
          'currentBoardData',
          currentBoardData,
          'currGameId',
          currGameId,
          'gameId',
          gameId,
          'movingFromSq',
          movingFromSq,
          'movingToSq',
          movingToSq,
          'prevMoveFromSq',
          prevMoveFromSq,
          'prevMoveToSq',
          prevMoveToSq,
          'currShouldTriggerAITurn',
          currShouldTriggerAITurn,
          'shouldTriggerAITurn',
          shouldTriggerAITurn,
          'isOpponentsTurn()',
          isOpponentsTurn(currentGameSettings, currentBoardData),
          'replayModeOn',
          replayModeOn,
          'replayStepMove',
          replayStepMove,
          'currReplayStepMove',
          currReplayStepMove,
          'replayStepMoveTriggered',
          replayStepMoveTriggered,
          JSON.stringify(board)
        );
        board.flatSquareMoveHistory = smh;
        board.flatBoardFenHistory = fmh;
      }

      // if the 'from' and 'to' of a move were just determined, ready to execute the move:
      if (movingFromSq && movingToSq) {
        if (replayModeOn) handleMove();
        else
          makeMoveDelayTimeoutId = setTimeout(
            handleMove,
            internalSettings.makeMoveDelay
          );
        return;
      }

      if (replayModeOn) {
        if (replayStepMove !== 0) {
          if (!replayStepMoveTriggered) {
            //console.log('replay trigger move', replayStepMove);
            setReplayStepMoveTriggered(true);
            triggerReplayStepMove(replayStepMove);
          }
          return;
        }
      } else {
        // mechanism to trigger AI move automatically, if needed (part two):
        if (shouldTriggerAITurn) {
          //console.log('triggering move');
          AIMoveDelayTimeoutId = setTimeout(
            triggerAIMove,
            internalSettings.AIMoveDelay
          );
          return;
        }
        // mechanism to trigger AI move automatically, if needed (part one)
        if (
          isAITurn(currentGameSettings, currentBoardData) &&
          !board.gameOver
        ) {
          setShouldTriggerAITurn(currShouldTriggerAITurn);
          return;
        }
      }
      // we're resetting the game:
      if (currGameId !== gameId) {
        // cancel any delayed moves:
        if (makeMoveDelayTimeoutId !== undefined) {
          clearTimeout(makeMoveDelayTimeoutId);
          makeMoveDelayTimeoutId = undefined;
        }
        if (AIMoveDelayTimeoutId !== undefined) {
          clearTimeout(AIMoveDelayTimeoutId);
          AIMoveDelayTimeoutId = undefined;
        }
        setPrevMoveFromSq(null);
        setPrevMoveToSq(null);
      }
      setGameId(currGameId);
      setReplayModeOn(currReplayModeOn);
      setReplayStepMove(currReplayStepMove);
      if (replayModeOn || currPrevMoveFromSq)
        setPrevMoveFromSq(currPrevMoveFromSq);
      if (replayModeOn || currPrevMoveToSq) setPrevMoveToSq(currPrevMoveToSq);
      setUserPlaysColor(currUserPlaysColor);
      setIsMovingDisabled(currIsMovingDisabled);
    };
    run();
  }, [
    movingFromSq,
    movingToSq,
    handleMove,
    currGameId,
    currUserPlaysColor,
    currShouldTriggerAITurn,
    shouldTriggerAITurn,
    gameId,
    triggerAIMove,
    currentGameSettings,
    currReplayModeOn,
    replayModeOn,
    currReplayStepMove,
    replayStepMove,
    replayStepMoveTriggered,
    triggerReplayStepMove,
    currPrevMoveFromSq,
    currPrevMoveToSq,
    prevMoveFromSq,
    prevMoveToSq,
    currIsMovingDisabled,
    currentBoardData,
  ]);

  const squareClicked = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // if board move is disabled, clicking is not allowed:
      if (isMovingDisabled) return;
      // if the game is over or we're in replay mode, clicking is not allowed:
      if (board.gameOver) return;
      // if dice isn't rolled yet clicking is not allowed:
      if (currentBoardData.diceRoll === -1) {
        // alert user they need to roll dice first:
        containerOnAlertDiceRoll();
        return;
      }
      // if in 1-player mode and it's not player's turn, clicking is not allowed:
      if (isOpponentsTurn(currentGameSettings, currentBoardData)) return;
      // find the square element which was clicked on so we can get the square coords:
      let $clickedSq = e.target as HTMLElement;
      if ($clickedSq.tagName === 'IMG')
        $clickedSq = $clickedSq!.closest('.square') ?? $clickedSq;
      const square = $clickedSq.id as Square;
      const clickedPiece = getSquarePiece(square);
      const promotion = movingFromSq
        ? promptUserIfPromotionMove(movingFromSq, square, currentBoardData.turn)
        : undefined;
      if (clickedPiece && clickedPiece.color === currentBoardData.turn)
        setMovingFromSq(square);
      else if (
        movingFromSq &&
        validateMove(
          movingFromSq,
          square,
          currentBoardData.numMovesInTurn === 1,
          promotion
        )
      ) {
        setMovingToSq(square);
        setPawnPromotion(promotion);
      }
    },
    [
      isMovingDisabled,
      currentBoardData,
      currentGameSettings,
      movingFromSq,
      containerOnAlertDiceRoll,
    ]
  );

  // Draw the chess board:
  const ranks = userPlaysColor === WHITE ? allRanks : allRanksReversed;
  const files = userPlaysColor === WHITE ? allFiles : allFilesReversed;
  return (
    <div className="chessboard" onClick={(e) => squareClicked(e)}>
      {ranks.map((r) => (
        <div className="chessboard-row" key={String(r)}>
          {files.map((f) => {
            const sq = (f + allRanks[8 - r]) as Square;
            let squareClasses = 'square';
            if (movingFromSq === sq)
              squareClasses +=
                ' border-highlighted-square highlighted-square-from';
            else if (movingToSq === sq)
              squareClasses +=
                ' border-highlighted-square highlighted-square-to';
            else if (prevMoveFromSq === sq || prevMoveToSq === sq)
              squareClasses += ' highlighted-square-prev-move';
            return (
              <div id={sq} className={squareClasses} key={sq}>
                {renderOccupyingPiece(getSquarePiece(sq))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
