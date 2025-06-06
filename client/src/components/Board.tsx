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
  isValidMove,
  board,
  isAITurn,
  chessAiEngineApi_getAIMove,
  boardReplayStepMove,
  BasicMove,
  DebugOn,
  internalSettings,
  isOpponentsTurn,
  setNewMoveOnBoard,
  isPromotionMove,
  getPossiblePromotions,
} from '../lib';
import {
  Color,
  PAWN,
  PieceSymbol,
  WHITE,
  type Piece,
  type Square,
} from 'chess.js';

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
  containerOnPromotionPromptRequested: (pieceTypes: PieceSymbol[]) => void;
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
  containerOnPromotionPromptRequested,
}: Props) {
  const {
    currentGameSettings,
    currentBoardData,
    getCurrentBoardData,
    setNewCurrentBoardData,
    user,
  } = useCurrentGameContext();
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
  const [prevMoveFromSq, setPrevMoveFromSq] = useState<Square | null>(
    currPrevMoveFromSq
  );
  const [prevMoveToSq, setPrevMoveToSq] = useState<Square | null>(
    currPrevMoveToSq
  );
  const [isMovingDisabled, setIsMovingDisabled] =
    useState<boolean>(currIsMovingDisabled);

  const handleMove = useCallback(() => {
    // Mark game board busy as it processes the move being made (this is being
    // checked for incoming online game messages to make sure they wait until
    // we can receive new game events):
    board.busyBoardWaiting = true;
    if (replayModeOn) {
      setReplayStepMoveTriggered(false);
    } else {
      makeMove(
        currentGameSettings,
        getCurrentBoardData,
        setNewCurrentBoardData,
        user,
        currentBoardData.currMoveFromSq!,
        currentBoardData.currMoveToSq!,
        currentBoardData.currMovePromotion || undefined,
        false
      );
      setShouldTriggerAITurn(false);
    }
    containerOnMove();
    setPrevMoveFromSq(currentBoardData.currMoveFromSq);
    setPrevMoveToSq(currentBoardData.currMoveToSq);
    setNewCurrentBoardData({ currMoveFromSq: null, currMoveToSq: null }, true);
  }, [
    currentBoardData,
    replayModeOn,
    containerOnMove,
    setNewCurrentBoardData,
    currentGameSettings,
    getCurrentBoardData,
    user,
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
      setNewMoveOnBoard(
        setNewCurrentBoardData,
        move.from,
        move.to,
        move.promotion
      );
    };
    run();
  }, [currentBoardData, currentGameSettings.gameId, setNewCurrentBoardData]);

  // Move to next/prev move during game replay:
  const triggerReplayStepMove = useCallback(
    (step: number) => {
      const run = async () => {
        const move = boardReplayStepMove(setNewCurrentBoardData, step);
        if (move) {
          setNewCurrentBoardData(
            {
              currMoveFromSq: move.from,
              currMoveToSq: move.to,
              currMovePromotion: move.promotion || null,
            },
            true
          );
        } else {
          setPrevMoveFromSq(null);
          setPrevMoveToSq(null);
          setNewCurrentBoardData(
            {
              currMoveFromSq: null,
              currMoveToSq: null,
              currMovePromotion: null,
            },
            true
          );
        }
        setReplayStepMove(0);
      };
      run();
    },
    [setNewCurrentBoardData]
  );

  useEffect(() => {
    const run = async () => {
      if (DebugOn) {
        const smh = board.flatSquareMoveHistory;
        board.flatSquareMoveHistory = [];
        console.log(
          'rendered Board',
          'currentGameSettings',
          currentGameSettings,
          'currentBoardData',
          JSON.stringify(currentBoardData),
          'currGameId',
          currGameId,
          'gameId',
          gameId,
          'movingFromSq',
          currentBoardData.currMoveFromSq,
          'movingToSq',
          currentBoardData.currMoveToSq,
          'currMovePromotion',
          currentBoardData.currMovePromotion,
          'currPrevMoveFromSq',
          currPrevMoveFromSq,
          'currPrevMoveToSq',
          currPrevMoveToSq,
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
      }

      // if the 'from' and 'to' of a move were just determined, ready to execute the move:
      if (currentBoardData.currMoveFromSq && currentBoardData.currMoveToSq) {
        if (replayModeOn) handleMove();
        else if (
          // we're only ready to do the move if not a promotion or it is and user already chosen:
          !(
            currentBoardData.currMovePromotion &&
            currentBoardData.currMovePromotion === PAWN
          )
        ) {
          makeMoveDelayTimeoutId = setTimeout(
            handleMove,
            internalSettings.makeMoveDelay
          );
        }
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
      //if (replayModeOn || currPrevMoveFromSq)
      setPrevMoveFromSq(currPrevMoveFromSq);
      //if (replayModeOn || currPrevMoveToSq)
      setPrevMoveToSq(currPrevMoveToSq);
      setUserPlaysColor(currUserPlaysColor);
      setIsMovingDisabled(currIsMovingDisabled);
    };
    run();
  }, [
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
      if (clickedPiece && clickedPiece.color === currentBoardData.turn)
        setNewCurrentBoardData({ currMoveFromSq: square }, true);
      else if (currentBoardData.currMoveFromSq) {
        const isLastMoveInTurn = currentBoardData.numMovesInTurn === 1;
        const isPromotion = currentBoardData.currMoveFromSq
          ? isPromotionMove(
              currentBoardData.currMoveFromSq,
              square,
              currentBoardData.turn,
              isLastMoveInTurn
            )
          : undefined;
        if (isPromotion) {
          const possiblePromotions = getPossiblePromotions(
            isLastMoveInTurn,
            square,
            currentBoardData.currMoveFromSq
          );
          containerOnPromotionPromptRequested(possiblePromotions);
          setNewCurrentBoardData(
            // "p" piece as promotion is just a flag that we will be waiting to prompt
            // user for the choice for promotion:
            { currMoveToSq: square, currMovePromotion: PAWN },
            true
          );
        } else if (
          isValidMove(
            currentBoardData.currMoveFromSq,
            square,
            isLastMoveInTurn,
            false,
            undefined
          )
        )
          setNewCurrentBoardData(
            { currMoveToSq: square, currMovePromotion: null },
            true
          );
      }
    },
    [
      isMovingDisabled,
      currentBoardData,
      currentGameSettings,
      setNewCurrentBoardData,
      containerOnAlertDiceRoll,
      containerOnPromotionPromptRequested,
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
            if (currentBoardData.currMoveFromSq === sq)
              squareClasses +=
                ' border-highlighted-square highlighted-square-from';
            else if (currentBoardData.currMoveToSq === sq)
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
