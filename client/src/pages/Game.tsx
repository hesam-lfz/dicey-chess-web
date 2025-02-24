import { useState } from 'react';

import './Game.css';
import { GamePanel } from '../components/GamePanel';
import { FooterPanel } from '../components/FooterPanel';
import { Modal } from '../components/Modal';
import { board, resetBoard } from '../lib';
import { database_loadGames, database_saveGame } from '../lib/storageApi';

export function Game() {
  const [isGameSaveModalOpen, setIsGameSaveModalOpen] =
    useState<boolean>(false);
  const [isResetGameModalOpen, setIsResetGameModalOpen] =
    useState<boolean>(false);
  const [isLoadGameModalOpen, setIsLoadGameModalOpen] =
    useState<boolean>(false);
  const [isInfoMessageModalOpen, setIsInfoMessageModalOpen] =
    useState<boolean>(false);
  const [gameId, setGameId] = useState<number>(0);
  const [replayModeOn, setReplayModeOn] = useState<boolean>(false);
  const [history, setHistory] = useState<string[][]>(board.history);

  async function handleSaveGame(): Promise<void> {
    console.log('Saving game!');
    handleGameOverModalClose();
    onSaveGame();
    await database_saveGame(board);
    console.log('Saved!');
    setIsInfoMessageModalOpen(true);
  }

  function handleGameOverModalClose(): void {
    setIsGameSaveModalOpen(false);
  }

  function onGameOver(): void {
    setReplayModeOn(true);
    setIsGameSaveModalOpen(true);
  }

  function handleResetGameModalClose(): void {
    setIsResetGameModalOpen(false);
  }

  function onResetGame(): void {
    setIsResetGameModalOpen(true);
  }

  function handleResetGame(): void {
    resetGame();
    handleResetGameModalClose();
  }

  function resetGame(): void {
    console.log('Resetting game!');
    resetBoard();
    setGameId((id) => id + 1);
    setReplayModeOn(false);
    setHistory([...board.history]);
  }

  function handleInfoMessageDone() {
    setIsInfoMessageModalOpen(false);
  }

  function onSaveGame(): void {
    setIsGameSaveModalOpen(false);
  }

  async function onLoadGame(): Promise<void> {
    console.log('Loading games!');
    const allSavedGames = await database_loadGames();
    console.log('saved games', allSavedGames);
    setIsLoadGameModalOpen(true);
  }

  function handleLoadGameModalClose(): void {
    setIsLoadGameModalOpen(false);
  }

  return (
    <>
      <GamePanel
        currGameId={gameId}
        currHistory={history}
        currReplayModeOn={replayModeOn}
        onGameOver={onGameOver}
        onNewGame={onResetGame}
        onLoadGame={onLoadGame}
      />
      <FooterPanel />
      <Modal isOpen={isGameSaveModalOpen} onClose={() => {}}>
        <p>{board.outcome}!</p>
        <p>Would you like to save this game?</p>
        <div>
          <span className="rainbow-colored-border">
            <button onClick={handleGameOverModalClose}>No</button>
          </span>
          <span className="rainbow-colored-border">
            <button onClick={handleSaveGame} autoFocus>
              Yes
            </button>
          </span>
        </div>
      </Modal>
      <Modal
        isOpen={isResetGameModalOpen}
        onClose={() => {
          setIsResetGameModalOpen(false);
        }}>
        <p>Start a new game?</p>
        <div>
          <span className="rainbow-colored-border">
            <button onClick={handleResetGameModalClose}>No</button>
          </span>
          <span className="rainbow-colored-border">
            <button onClick={handleResetGame} autoFocus>
              Yes
            </button>
          </span>
        </div>
      </Modal>
      <Modal isOpen={isLoadGameModalOpen} onClose={() => {}}>
        <p>Click on a saved game to load:</p>
        <div>
          <span className="rainbow-colored-border">
            <button onClick={handleLoadGameModalClose}>Cancel</button>
          </span>
        </div>
      </Modal>
      <Modal isOpen={isInfoMessageModalOpen} onClose={() => {}}>
        <p>Game saved.</p>
        <div>
          <span className="rainbow-colored-border">
            <button onClick={handleInfoMessageDone} autoFocus>
              OK
            </button>
          </span>
        </div>
      </Modal>
    </>
  );
}
