import { WHITE } from 'chess.js';
import {
  type Board,
  type SavedGame,
  type Settings,
  type CurrentGameSettings,
  DebugOn,
  internalSettings,
} from './boardEngineApi';
import { type User, readToken } from './auth';

export type InviteRequestResponse = {
  status: number;
  pin?: string;
};

const localStorageKeyPrefix = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;

// Cached saved games data retrieved from database:
let cachedSavedGames: SavedGame[] | undefined = undefined;

// Retrieve saved settings from local storage:
export function storageApi_loadSettings(): Settings | null {
  //-- FIXME: REMOVE SOON --
  //TEMP: FORCING CLEARING LOCAL STORAGE CACHE DUE TO CHANGES TO CACHED PROPS:
  if (
    !localStorage.getItem(
      localStorageKeyPrefix + '-cache-flush-done-' + appVersion
    )
  ) {
    localStorage.setItem(
      localStorageKeyPrefix + '-cache-flush-done-' + appVersion,
      'true'
    );
    localStorage.removeItem(localStorageKeyPrefix + '-settings');
    localStorage.removeItem(localStorageKeyPrefix + '-games');
  }

  const retrievedData = localStorage.getItem(
    localStorageKeyPrefix + '-settings'
  );
  return retrievedData ? (JSON.parse(retrievedData) as Settings) : null;
}

// Save current settings to local storage:
export function storageApi_saveSettings(settings: Settings): void {
  const settingsDataJSON = JSON.stringify(settings);
  localStorage.setItem(localStorageKeyPrefix + '-settings', settingsDataJSON);
}

// Load all games saved by the user.
// If user in session and database access possible load from database.
// Otherwise load games stored locally on device:
export async function storageApi_loadGames(
  user: User | undefined
): Promise<SavedGame[]> {
  return new Promise((resolve) => {
    if (cachedSavedGames) {
      resolve(cachedSavedGames);
    } else {
      const run = async (): Promise<SavedGame[]> => {
        if (!user) {
          if (DebugOn)
            console.log(
              'No user session. Retrieving saved game from local storage....'
            );
          return await localStorage_loadGames();
        } else {
          try {
            if (DebugOn) console.log('trying to load games from db...');
            return await database_loadGames();
          } catch (e) {
            if (DebugOn)
              console.log(
                'failed loading games from db. Accessing local storage...'
              );
            return await localStorage_loadGames();
          }
        }
      };
      resolve(run());
    }
  });
}

// Load all games saved by the user (stored locally on device):
async function localStorage_loadGames(): Promise<SavedGame[]> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const retrievedData = localStorage.getItem(
        localStorageKeyPrefix + '-games'
      );
      cachedSavedGames = retrievedData
        ? ((await JSON.parse(retrievedData)) as SavedGame[])
        : [];
      resolve(cachedSavedGames);
    }, internalSettings.localStorageOpDelay);
  });
}

// Load all games saved by the user (stored on database):
async function database_loadGames(): Promise<SavedGame[]> {
  return new Promise((resolve) => {
    const run = async (): Promise<SavedGame[]> => {
      const req = {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${readToken()}`,
        },
      };
      const res = await fetch('/api/games', req);
      if (!res.ok) throw new Error(`fetch Error ${res.status}`);
      const retrievedData = (await res.json()) as SavedGame[];
      cachedSavedGames = retrievedData;
      return cachedSavedGames;
    };
    resolve(run());
  });
}

// Load all games saved by the user as a dictionary of saved game data
// If user in session and database access possible load from database.
// Otherwise load games stored locally on device:
export async function storageApi_loadGamesAsDictionary(
  user: User | undefined
): Promise<{
  [key: number]: SavedGame;
}> {
  const allGamesDict: { [key: number]: SavedGame } = {};
  const allSavedGames = await storageApi_loadGames(user);
  allSavedGames.forEach((g: SavedGame) => (allGamesDict[g.at] = g));
  return allSavedGames;
}

// Save a game by the user
// If user in session and database access possible load from database.
// Otherwise load games stored locally on device:
export async function storageApi_saveGame(
  currentGameSettings: CurrentGameSettings,
  user: User | undefined,
  board: Board
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const savedGameData: SavedGame = {
    userId: user?.userId || 0,
    at: now,
    duration: now - board.gameStartTime,
    opponent: currentGameSettings.opponent,
    outcome: board.outcomeId!,
    moveHistory: board.flatSanMoveHistory.join(','),
    diceRollHistory: board.diceRollHistory.join(','),
    userPlaysWhite: currentGameSettings.userPlaysColor === WHITE,
  };
  if (DebugOn) console.log('game to save', savedGameData);
  return new Promise((resolve) => {
    const run = async (): Promise<boolean> => {
      const allSavedGames =
        cachedSavedGames || (await storageApi_loadGames(user));
      allSavedGames.unshift(savedGameData);
      cachedSavedGames = allSavedGames;
      if (!user) {
        if (DebugOn)
          console.log('No user session. Saving game on local storage....');
        return await localStorage_saveGame(allSavedGames);
      } else {
        try {
          if (DebugOn) console.log('Trying to save game on db...');
          return await database_saveGame(savedGameData);
        } catch (e) {
          if (DebugOn)
            console.error(
              'Failed saving game on db. Trying to save on local storage...'
            );
          return await localStorage_saveGame(allSavedGames);
        }
      }
    };
    resolve(run());
  });
}

// Save a game by the user (stored locally on device):
// Returns false to flag that the game was not saved on the database (rather, on local storage).
export async function localStorage_saveGame(
  allSavedGames: SavedGame[]
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const savedGamesDataJSON = JSON.stringify(allSavedGames);
      localStorage.setItem(
        localStorageKeyPrefix + '-games',
        savedGamesDataJSON
      );
      resolve(false);
    }, internalSettings.localStorageOpDelay);
  });
}

// Save a game by the user (stored on database):
// Returns true to flag that the game was saved on the database (rather than on local storage).
async function database_saveGame(savedGameData: SavedGame): Promise<boolean> {
  return new Promise((resolve) => {
    const run = async (): Promise<boolean> => {
      if (DebugOn) console.log('savedGameData', savedGameData);
      const req = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readToken()}`,
        },
        body: JSON.stringify(savedGameData),
      };
      const res = await fetch('/api/games', req);
      if (!res.ok) throw new Error(`fetch Error ${res.status}`);
      (await res.json()) as SavedGame;
      return true;
    };
    resolve(run());
  });
}

// Delete a game by the user (stored either in database or locally on device):
export async function storageApi_deleteGame(
  user: User | undefined,
  gameId: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const run = async (): Promise<boolean> => {
      const allSavedGames = (
        cachedSavedGames || (await storageApi_loadGames(user))
      ).filter((g) => g.at !== gameId);
      cachedSavedGames = allSavedGames;
      if (!user) {
        if (DebugOn)
          console.log('No user session. Deleting game on local storage...');
        return await localStorage_deleteGame(allSavedGames);
      } else {
        try {
          if (DebugOn) console.log('Trying to delete game on db...');
          return await database_deleteGame(user, gameId);
        } catch (e) {
          if (DebugOn)
            console.error(
              'Failed deleting game on db. Trying to delete on local storage...'
            );
          return await localStorage_deleteGame(allSavedGames);
        }
      }
    };
    resolve(run());
  });
}

// Delete a game by the user (stored locally on device):
async function localStorage_deleteGame(
  allSavedGames: SavedGame[]
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const savedGamesDataJSON = JSON.stringify(allSavedGames);
      localStorage.setItem(
        localStorageKeyPrefix + '-games',
        savedGamesDataJSON
      );
      resolve(true);
    }, internalSettings.localStorageOpDelay);
  });
}

// Delete a game by the user (stored on database):
async function database_deleteGame(
  user: User | undefined,
  gameId: number
): Promise<boolean> {
  const deletedGameData = {
    userId: user?.userId || 0,
    at: gameId,
  };
  return new Promise((resolve) => {
    const run = async (): Promise<boolean> => {
      const req = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readToken()}`,
        },
        body: JSON.stringify(deletedGameData),
      };
      const res = await fetch('/api/games', req);
      if (!res.ok) throw new Error(`fetch Error ${res.status}`);
      return true;
    };
    resolve(run());
  });
}

// Save a game by the user (stored on database):
// Returns true to flag that the game was saved on the database (rather than on local storage).
export async function storageApi_updatePlayerRank(
  user: User
): Promise<boolean> {
  return new Promise((resolve) => {
    const run = async (): Promise<boolean> => {
      if (DebugOn) console.log('updatePlayerRank', user, user.rank);
      const req = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readToken()}`,
        },
        body: JSON.stringify({ rank: user.rank }),
      };
      const res = await fetch(`/api/users/rank/${user.userId}`, req);
      if (!res.ok) throw new Error(`fetch Error ${res.status}`);
      return true;
    };
    resolve(run());
  });
}

// Sends an invite request to play a friend online with username.
// Checks if user with username exists in database (and returns any public
// data on the user -- currently just username):
export async function database_sendInviteFriendRequestByUsername(
  username: string,
  isRecheck: boolean
): Promise<InviteRequestResponse | null> {
  return new Promise((resolve) => {
    const run = async (): Promise<InviteRequestResponse | null> => {
      try {
        const req = {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${readToken()}`,
          },
        };
        const res = await fetch(
          `/api/invite/username/${username}/isRecheck/${isRecheck}`,
          req
        );
        if (!res.ok) return null;
        const retrievedData = (await res.json()) as InviteRequestResponse;
        return retrievedData;
      } catch (e) {
        console.error('Problem sending invite', e);
        return null;
      }
    };
    resolve(run());
  });
}

// Resets cache of saved games on signin and signout:
export const storageApi_handleSignInOut = (): void => {
  cachedSavedGames = undefined;
};
