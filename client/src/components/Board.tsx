import { useState, useEffect, useCallback, MouseEvent } from 'react';
import { useCurrentGameSettings } from '../components/useCurrentGameSettings';
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
  getAIMove,
  settings,
} from '../lib';
import { Color, WHITE, type Piece, type Square } from 'chess.js';

function renderOccupyingPiece(piece?: Piece) {
  if (!piece) return null;
  const color = piece.color;
  const type = piece.type;
  const pieceName = 'Icon_' + (color + type);
  return <img src={pieceSVGs[pieceName]} className="piece" alt={pieceName} />;
}

type Props = {
  currGameId: number;
  currReplayModeOn: boolean;
  currHumanPlaysColor: Color;
  currShouldTriggerAITurn: boolean;
  containerOnMove: () => void;
  containerOnAlertDiceRoll: () => void;
};

export function Board({
  currGameId,
  currReplayModeOn,
  currHumanPlaysColor,
  currShouldTriggerAITurn,
  containerOnMove,
  containerOnAlertDiceRoll,
}: Props) {
  const { currentGameSettings } = useCurrentGameSettings();
  const [gameId, setGameId] = useState<number>(currGameId);
  const [replayModeOn, setReplayModeOn] = useState<boolean>(currReplayModeOn);
  const [humanPlaysColor, setHumanPlaysColor] =
    useState<Color>(currHumanPlaysColor);
  const [shouldTriggerAITurn, setShouldTriggerAITurn] = useState<boolean>(
    currShouldTriggerAITurn
  );
  const [movingFromSq, setMovingFromSq] = useState<Square | null>(null);
  const [movingToSq, setMovingToSq] = useState<Square | null>(null);
  const [pawnPromotion, setPawnPromotion] = useState<string | undefined>(
    undefined
  );
  const [prevMoveFromSq, setPrevMoveFromSq] = useState<Square | null>(null);
  const [prevMoveToSq, setPrevMoveToSq] = useState<Square | null>(null);

  const handleMove = useCallback(() => {
    setPrevMoveFromSq(movingFromSq);
    setPrevMoveToSq(movingToSq);
    setMovingFromSq(null);
    setMovingToSq(null);
    makeMove(movingFromSq!, movingToSq!, pawnPromotion);
    setShouldTriggerAITurn(false);
    containerOnMove();
  }, [movingFromSq, movingToSq, pawnPromotion, containerOnMove]);

  const triggerAIMove = useCallback(() => {
    const run = async () => {
      const move = await getAIMove();
      setMovingFromSq(move.from);
      setMovingToSq(move.to);
      setPawnPromotion(move.promotion);
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      // if the 'from' and 'to' of a move were just determined, ready to execute the move:
      if (movingFromSq && movingToSq) {
        setTimeout(handleMove, 200);
        return;
      }
      /*
      console.log(
        'rendered Board',
        'currShouldTriggerAITurn',
        currShouldTriggerAITurn,
        'shouldTriggerAITurn',
        shouldTriggerAITurn,
        'isAITurn()',
        isAITurn(currentGameSettings),
        JSON.stringify(board)
      );
      */
      // mechanism to trigger AI move automatically, if needed (part two):
      if (shouldTriggerAITurn) {
        //console.log('triggering move');
        setTimeout(triggerAIMove, settings.AIMoveDelay);
        return;
      }
      // mechanism to trigger AI move automatically, if needed (part one)
      if (isAITurn(currentGameSettings) && !board.gameOver) {
        setShouldTriggerAITurn(currShouldTriggerAITurn);
        return;
      }
      // we're resetting the game:
      if (currGameId !== gameId) {
        setPrevMoveFromSq(null);
        setPrevMoveToSq(null);
      }
      setGameId(currGameId);
      setReplayModeOn(currReplayModeOn);
      setHumanPlaysColor(currHumanPlaysColor);
    };
    run();
  }, [
    movingFromSq,
    movingToSq,
    handleMove,
    currGameId,
    currHumanPlaysColor,
    currShouldTriggerAITurn,
    shouldTriggerAITurn,
    gameId,
    triggerAIMove,
    currentGameSettings,
    currReplayModeOn,
  ]);

  const squareClicked = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // if the game is over or we're in replay mode, clicking is not allowed:
      if (board.gameOver || replayModeOn) return;
      // if dice isn't rolled yet clicking is not allowed:
      if (board.diceRoll === -1) {
        // alert user they need to roll dice first:
        containerOnAlertDiceRoll();
        return;
      }
      // if in 1-player mode and it's not player's turn, clicking is not allowed:
      if (isAITurn(currentGameSettings)) return;
      // find the square element which was clicked on so we can get the square coords:
      let $clickedSq = e.target as HTMLElement;
      if ($clickedSq.tagName === 'IMG')
        $clickedSq = $clickedSq!.closest('.square') ?? $clickedSq;
      const square = $clickedSq.id as Square;
      const clickedPiece = getSquarePiece(square);
      if (clickedPiece && clickedPiece.color === board.turn)
        setMovingFromSq(square);
      else if (movingFromSq && validateMove(movingFromSq, square)) {
        setMovingToSq(square);
        setPawnPromotion(
          promptUserIfPromotionMove(movingFromSq, square, board.turn)
        );
      }
    },
    [movingFromSq, currentGameSettings, replayModeOn, containerOnAlertDiceRoll]
  );

  // Draw the chess board:
  const ranks = humanPlaysColor === WHITE ? allRanks : allRanksReversed;
  const files = humanPlaysColor === WHITE ? allFiles : allFilesReversed;
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
