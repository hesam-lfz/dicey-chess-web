import React, { useCallback, useState } from 'react';

import './Game.css';
import { GamePanel } from '../components/GamePanel';
import { FooterPanel } from '../components/FooterPanel';
import { Modal } from '../components/Modal';
import {
  board,
  calculateAndStorePlayerNewRank,
  DebugOn,
  displayGameDuration,
  gameAffectsPlayerRank,
  initBoardForGameReplay,
  internalSettings,
  isGameAgainstOnlineFriend,
  onlineGameApi_close,
  outcomes,
  pieceSVGs,
  resetBoard,
  resetSettings,
  type SavedGame,
} from '../lib';
import { useCurrentGameContext } from '../components/useCurrentGameContext';
import {
  storageApi_deleteGame,
  storageApi_loadGames,
  storageApi_saveGame,
} from '../lib/storageApi';
import { Color, PieceSymbol } from 'chess.js';

const infoMessageModalMessageDefault = 'Game saved.';
let infoMessageModalMessage: string = infoMessageModalMessageDefault;
const resetGameModalMessageDefault = 'Start a new game?';
const resetGameModalMessageGameAffectsRank =
  'Resign from current game & start a new game?';
let resetGameModalMessage: string = resetGameModalMessageDefault;
const chooseGameToLoadModalMessageGameAffectsRank =
  'Resign from current game & load a saved game?';
let chooseGameToLoadModalMessageIncludesResignWarning = false;

function renderPiece(
  color: Color,
  type: PieceSymbol,
  key: string,
  onClick: () => void
) {
  const pieceName = 'Icon_' + (color + type);
  return (
    <img
      src={pieceSVGs[pieceName]}
      className="piece off-board-piece"
      alt={pieceName}
      draggable="false"
      key={key}
      onClick={onClick}
    />
  );
}

export function Game() {
  const {
    currentGameSettings,
    setNewCurrentGameSettings,
    currentBoardData,
    setNewCurrentBoardData,
    user,
  } = useCurrentGameContext();
  const [savedGames, setSavedGames] = useState<SavedGame[]>();
  const [isGameSaveModalOpen, setIsGameSaveModalOpen] =
    useState<boolean>(false);
  const [isResetGameModalOpen, setIsResetGameModalOpen] =
    useState<boolean>(false);
  const [isLoadGameModalOpen, setIsLoadGameModalOpen] =
    useState<boolean>(false);
  const [isChooseGameToLoadModalOpen, setIsChooseGameToLoadModalOpen] =
    useState<boolean>(false);
  const [isGameDeleteModalOpen, setIsGameDeleteModalOpen] =
    useState<boolean>(false);
  const [isPromotionChoiceModalOpen, setIsPromotionChoiceModalOpen] =
    useState<boolean>(false);
  const [isInfoMessageModalOpen, setIsInfoMessageModalOpen] =
    useState<boolean>(false);
  const [gameId, setGameId] = useState<number>(currentGameSettings.gameId);
  const [gameIdToDelete, setGameIdToDelete] = useState<number>(0);
  const [replayModeOn, setReplayModeOn] = useState<boolean>(board.gameOver);
  const [validPromotionPieceTypes, setValidPromotionPieceTypes] = useState<
    PieceSymbol[] | undefined
  >(undefined);

  const openInfoMessageModal = useCallback((delay: boolean, msg?: string) => {
    if (msg) infoMessageModalMessage = msg;
    if (delay)
      setTimeout(async () => {
        setIsInfoMessageModalOpen(true);
      }, internalSettings.dialogOpenDelay);
    else setIsInfoMessageModalOpen(true);
  }, []);

  async function handleSaveGame(): Promise<void> {
    handleGameOverModalClose();
    onSaveGame();
    setTimeout(async () => {
      const savedOnDatabase = await storageApi_saveGame(
        currentGameSettings,
        user,
        board
      );
      setIsInfoMessageModalOpen(false);
      openInfoMessageModal(
        true,
        'Game saved.' +
          (savedOnDatabase
            ? ''
            : ' Sign in to save your games across all your devices.')
      );
    }, internalSettings.dialogOpenDelay);
    openInfoMessageModal(false, 'Saving game...');
  }

  function handleGameOverModalClose(): void {
    // If we're currently in a game with an online friend, close the web socket
    // connection:
    if (isGameAgainstOnlineFriend(currentGameSettings)) onlineGameApi_close();
    setIsGameSaveModalOpen(false);
  }

  // Handles gameover:
  function onGameOver(): void {
    setReplayModeOn(true);
    setIsGameSaveModalOpen(true);
  }

  function handleResetGameModalClose(): void {
    setIsResetGameModalOpen(false);
  }

  function onResetGame(): void {
    resetGameModalMessage = gameAffectsPlayerRank(
      currentGameSettings,
      user,
      false
    )
      ? resetGameModalMessageGameAffectsRank
      : resetGameModalMessageDefault;
    setIsResetGameModalOpen(true);
  }

  function handleResetGame(): void {
    resetGame();
    handleResetGameModalClose();
  }

  const resetGame = useCallback(() => {
    if (DebugOn) console.log('Resetting game!');
    // if user in session, update player rank due to resign:
    if (gameAffectsPlayerRank(currentGameSettings, user, false))
      calculateAndStorePlayerNewRank(currentGameSettings, user!);
    resetSettings(currentGameSettings, setNewCurrentGameSettings, false, false);
    resetBoard(
      currentGameSettings,
      setNewCurrentGameSettings,
      setNewCurrentBoardData
    );
    setGameId(currentGameSettings.gameId);
    setReplayModeOn(false);
  }, [
    currentGameSettings,
    setNewCurrentBoardData,
    setNewCurrentGameSettings,
    user,
  ]);

  function handleInfoMessageDone() {
    infoMessageModalMessage = infoMessageModalMessageDefault;
    setIsInfoMessageModalOpen(false);
  }

  function onSaveGame(): void {
    setIsGameSaveModalOpen(false);
  }

  async function onLoadGame(): Promise<void> {
    setIsLoadGameModalOpen(true);
    setTimeout(async () => {
      const allSavedGames = await storageApi_loadGames(user);
      //console.log('saved games', allSavedGames);
      if (allSavedGames.length === 0) {
        openInfoMessageModal(false, 'No saved games found!');
      } else {
        setSavedGames(allSavedGames);
        chooseGameToLoadModalMessageIncludesResignWarning =
          gameAffectsPlayerRank(currentGameSettings, user, false);
        setIsChooseGameToLoadModalOpen(true);
      }
      handleLoadGameModalClose();
    }, internalSettings.dialogOpenDelay);
  }

  function handleLoadGameModalClose(): void {
    setIsLoadGameModalOpen(false);
  }

  function handleChooseGameToLoadModalClose(): void {
    setIsChooseGameToLoadModalOpen(false);
  }

  function handleGameDeleteModalClose(): void {
    setIsGameDeleteModalOpen(false);
  }

  async function handleDeleteGame(): Promise<void> {
    if (DebugOn) console.log('deleting game...');
    await storageApi_deleteGame(user, gameIdToDelete);
    openInfoMessageModal(true, 'Game deleted.');
    handleGameDeleteModalClose();
  }

  function onPromotionPromptRequested(pieceTypes: PieceSymbol[]): void {
    setValidPromotionPieceTypes(pieceTypes);
    setIsPromotionChoiceModalOpen(true);
  }

  async function handleChoosePromotion(type: PieceSymbol): Promise<void> {
    setValidPromotionPieceTypes(undefined);
    setIsPromotionChoiceModalOpen(false);
    setNewCurrentBoardData({ currMovePromotion: type }, true);
  }

  // A saved game is clicked either to load or delete:
  function onGameToLoadOrDeleteClicked(
    e: React.MouseEvent<HTMLDivElement>
  ): void {
    const target = e.target as HTMLElement;
    // Make sure we clicked on a saved game component to load:
    if (target.tagName === 'P') {
      if (DebugOn) console.log('Loading game...');
      // Loading a game....
      const $e = target as HTMLParagraphElement;
      const gameId = +$e.dataset.at!;
      let loadedGame = false,
        loadSuccess = false;
      // Find the id of the saved game to load:
      for (const g of savedGames!) {
        if (gameId === g.at) {
          // if user in session, update player rank due to resign:
          if (gameAffectsPlayerRank(currentGameSettings, user, false))
            calculateAndStorePlayerNewRank(currentGameSettings, user!);
          // Prepare the board for replay of this saved game:
          loadSuccess = initBoardForGameReplay(
            currentGameSettings,
            setNewCurrentGameSettings,
            setNewCurrentBoardData,
            g
          );
          loadedGame = true;
          break;
        }
      }
      if (loadedGame && loadSuccess) {
        setGameId(currentGameSettings.gameId);
        setReplayModeOn(true);
      } else resetGame();
      handleChooseGameToLoadModalClose();
      if (!loadSuccess) {
        infoMessageModalMessage =
          'Loading game failed! The game was not saved properly and will be deleted.';
        setTimeout(async () => {
          setIsInfoMessageModalOpen(true);
          await storageApi_deleteGame(user, gameId);
        }, internalSettings.dialogOpenDelay);
      }
    } else if (target.tagName === 'DIV') {
      // Deleting a game....
      const $e = target as HTMLSpanElement;
      const gameId = +$e.dataset.at!;
      // Find the id of the saved game to delete:
      for (const g of savedGames!) {
        if (gameId === g.at) {
          // Prepare the board for replay of this saved game:
          setGameIdToDelete(gameId);
          setIsGameDeleteModalOpen(true);
          break;
        }
      }
      handleChooseGameToLoadModalClose();
    }
  }

  return (
    <>
      <GamePanel
        currGameId={gameId}
        currReplayModeOn={replayModeOn}
        onPromotionPromptRequested={onPromotionPromptRequested}
        onGameOver={onGameOver}
        onNewGame={onResetGame}
        onLoadGame={onLoadGame}
        onGameMessageToShow={openInfoMessageModal}
      />
      <FooterPanel />
      <Modal isOpen={isGameSaveModalOpen} onClose={() => {}}>
        <div className="modal-box">
          <p>{board.outcome}!</p>
          <p>Would you like to save this game?</p>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleGameOverModalClose}>No</button>
            </span>
            <span className="rainbow-colored-border">
              <button onClick={handleSaveGame} autoFocus>
                Yes
              </button>
            </span>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isResetGameModalOpen}
        onClose={() => {
          setIsResetGameModalOpen(false);
        }}>
        <div className="modal-box">
          <p>{resetGameModalMessage}</p>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleResetGameModalClose}>No</button>
            </span>
            <span className="rainbow-colored-border">
              <button onClick={handleResetGame} autoFocus>
                Yes
              </button>
            </span>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isLoadGameModalOpen} onClose={() => {}}>
        <div className="modal-box">
          <p>Loading saved games...</p>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleLoadGameModalClose}>Cancel</button>
            </span>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isChooseGameToLoadModalOpen} onClose={() => {}}>
        <div className="modal-box compact-p">
          {chooseGameToLoadModalMessageIncludesResignWarning ? (
            <p>{chooseGameToLoadModalMessageGameAffectsRank}</p>
          ) : null}
          <p>Click on a saved game to load:</p>
          <div
            className="loaded-games-box"
            onClick={onGameToLoadOrDeleteClicked}>
            {savedGames
              ? savedGames!.map((g: SavedGame) => (
                  <div className="loaded-game-box flex" key={'box-' + g.at}>
                    <p
                      className="loaded-game-title dotted-border"
                      data-at={g.at}
                      key={g.at}>
                      {outcomes[g.outcome].replace('$OPPONENT', g.opponent) +
                        ' ♟ (' +
                        displayGameDuration(g.duration) +
                        ') ♟ ' +
                        new Date(g.at * 1000).toLocaleString()}
                    </p>
                    <div
                      className="delete-button"
                      data-at={g.at}
                      key={'delete-' + g.at}>
                      ✕
                    </div>
                  </div>
                ))
              : null}
          </div>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleChooseGameToLoadModalClose}>Cancel</button>
            </span>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isGameDeleteModalOpen} onClose={() => {}}>
        <div className="modal-box">
          <p>Do you want to delete this game?</p>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleGameDeleteModalClose}>No</button>
            </span>
            <span className="rainbow-colored-border">
              <button onClick={handleDeleteGame} autoFocus>
                Yes
              </button>
            </span>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isPromotionChoiceModalOpen} onClose={() => {}}>
        <div className="modal-box">
          <p>Choose your promotion:</p>
          <div className="modal-actions">
            {validPromotionPieceTypes?.map((t) => (
              <span
                className="rainbow-colored-border"
                key={'promotion-choice-span-' + t}>
                {renderPiece(
                  currentBoardData.turn,
                  t,
                  'promotion-choice-img-' + t,
                  () => handleChoosePromotion(t)
                )}
              </span>
            ))}
          </div>
        </div>
      </Modal>
      <Modal isOpen={isInfoMessageModalOpen} onClose={() => {}}>
        <div className="modal-box">
          <p>{infoMessageModalMessage}</p>
          <div className="modal-actions">
            <span className="rainbow-colored-border">
              <button onClick={handleInfoMessageDone} autoFocus>
                OK
              </button>
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}
