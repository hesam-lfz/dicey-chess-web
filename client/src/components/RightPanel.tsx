import { useState, useEffect, useCallback } from 'react';
import { DicePanel } from './DicePanel';
import { board, playerIconSVGs } from '../lib';
import { type Color } from 'chess.js';
import Icon_dice from '../assets/dice.svg';
import './DicePanel.css';

type Props = {
  currGameId: number;
  currTurn: Color;
  currNumMovesInTurn: number;
  containerOnDiceRoll: (n: number) => void;
};

export function RightPanel({
  currGameId,
  currTurn,
  currNumMovesInTurn,
  containerOnDiceRoll,
}: Props) {
  const [gameId, setGameId] = useState<number>(currGameId);
  const [turn, setTurn] = useState<Color>(board.turn);
  const [numMovesInTurn, setNumMovesInTurn] =
    useState<number>(currNumMovesInTurn);
  const handleRollButtonClick = useCallback(() => {
    const roll = Math.floor(Math.random() * 6);
    setNumMovesInTurn(roll);
    containerOnDiceRoll(roll);
  }, [containerOnDiceRoll]);

  useEffect(() => {
    setTurn(board.turn);
    setGameId(currGameId);
    setNumMovesInTurn(currNumMovesInTurn);
  }, [currNumMovesInTurn, currGameId, gameId, currTurn, turn]);

  return (
    <div className="right-panel side-panel">
      <div className="player-turn-title-box flex flex-align-center">
        {
          <div className={'square player-icon-container'}>
            <img
              src={playerIconSVGs[turn]}
              className="piece play-icon"
              alt={'player-icon-' + turn}
            />
          </div>
        }
        <span>'s Move</span>
      </div>
      {board.diceRoll === -1 ? (
        <span className="roll-dice-button-border rainbow-colored-border">
          <button className="roll-dice-button " onClick={handleRollButtonClick}>
            <img src={Icon_dice} className="dice-icon" alt={'dice-icon'} />
          </button>
        </span>
      ) : null}
      {board.diceRoll === -1 ? null : (
        <span>
          {numMovesInTurn +
            ' move' +
            (numMovesInTurn > 1 ? 's' : '') +
            ' left.'}{' '}
        </span>
      )}
      <DicePanel />
    </div>
  );
}
