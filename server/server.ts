/* eslint-disable @typescript-eslint/no-unused-vars -- Remove when used */
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { isProfane } from 'no-profanity';

import { ClientError, errorMiddleware, authMiddleware } from './lib/index.js';

type User = {
  userId: number;
  username: string;
  hashedPassword: string;
  rank: number;
};

type Auth = {
  username: string;
  password: string;
};

type SavedGame = {
  userId: number;
  at: number;
  duration: number;
  opponent: string;
  outcome: number;
  moveHistory: string;
  diceRollHistory: string;
  userPlaysWhite: boolean;
};

const disallowedUsernames = ['AI', 'ai'];
const pendingGameFriendInviteRequestsFrom: Record<string, string> = {};
const pendingGameFriendInviteRequestsTo: Record<string, string> = {};

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const hashKey = process.env.TOKEN_SECRET;
if (!hashKey) throw new Error('TOKEN_SECRET not found in .env');

// Create paths for static directories
const reactStaticDir = new URL('../client/dist', import.meta.url).pathname;
const uploadsStaticDir = new URL('public', import.meta.url).pathname;

// Removes friend invite request (called after invite timeouts):
const cancelFriendInviteRequest = (userId1: string, userId2: string): void => {
  delete pendingGameFriendInviteRequestsFrom[userId1];
  delete pendingGameFriendInviteRequestsFrom[userId2];
  delete pendingGameFriendInviteRequestsTo[userId1];
  delete pendingGameFriendInviteRequestsTo[userId2];
};

const app = express();

app.use(express.static(reactStaticDir));
// Static directory for file uploads server/public/
app.use(express.static(uploadsStaticDir));
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { username, password, rank } = req.body;
    if (!username || !password)
      throw new ClientError(400, 'username and password are required fields');
    if (disallowedUsernames.includes(username) || isProfane(username))
      throw new ClientError(400, 'username is not allowed');
    const hashedPassword = await argon2.hash(password);
    const sql = `
      insert into "users" ("username", "hashedPassword", "rank")
      values ($1, $2, $3)
      returning "userId", "username", "createdAt"
    `;
    const params = [username, hashedPassword, rank];
    const result = await db.query<User>(sql, params);
    const [user] = result.rows;
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/signin', async (req, res, next) => {
  try {
    const { username, password } = req.body as Partial<Auth>;
    if (!username || !password) throw new ClientError(401, 'invalid login');
    const sql = `
    select "userId",
           "hashedPassword",
           "rank"
      from "users"
     where "username" = $1
  `;
    const params = [username];
    const result = await db.query<User>(sql, params);
    const [user] = result.rows;
    if (!user) throw new ClientError(401, 'invalid login -- User not found!');
    const { userId, hashedPassword, rank } = user;
    if (!(await argon2.verify(hashedPassword, password)))
      throw new ClientError(401, 'invalid login -- Wrong password!');
    const payload = { userId, username, rank };
    const token = jwt.sign(payload, hashKey);
    res.json({ token, user: payload });
  } catch (err) {
    next(err);
  }
});

// Load all games saved by the user (stored in database):
app.get('/api/games', authMiddleware, async (req, res, next) => {
  try {
    const sql = `
      select *
      from "games"
      where "userId" = $1
      order by "at" desc
    `;
    const params = [req.user?.userId];
    const result = await db.query(sql, params);
    if (!result.rows[0])
      throw new ClientError(404, `Cannot find user ${req.user?.userId}!`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Save a game by the user (store on database):
app.post('/api/games', authMiddleware, async (req, res, next) => {
  try {
    const {
      userId,
      at,
      duration,
      opponent,
      outcome,
      moveHistory,
      diceRollHistory,
      userPlaysWhite,
    } = req.body;
    if (
      typeof userId !== 'number' ||
      typeof at !== 'number' ||
      typeof duration !== 'number' ||
      typeof opponent !== 'string' ||
      typeof outcome !== 'number' ||
      !moveHistory ||
      !diceRollHistory ||
      typeof userPlaysWhite !== 'boolean'
    )
      throw new ClientError(
        400,
        'Proper params for userId, at, duration, opponent, outcome, moveHistory, diceRollHistory, and userPlaysWhite are required.'
      );
    if (req.user?.userId !== userId)
      throw new ClientError(
        400,
        'Params userId does not match userId in authentication.'
      );
    const sql = `
      insert into "games" ("userId", "at", "duration", "opponent", "outcome", "moveHistory", "diceRollHistory", "userPlaysWhite")
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
    `;
    const params = [
      req.user?.userId,
      at,
      duration,
      opponent,
      outcome,
      moveHistory,
      diceRollHistory,
      userPlaysWhite,
    ];
    const result = await db.query<SavedGame>(sql, params);
    const [savedGame] = result.rows;
    res.status(201).json(savedGame);
  } catch (err) {
    next(err);
  }
});

// Delete a game by the user (stored on database):
app.delete('/api/games', authMiddleware, async (req, res, next) => {
  try {
    const { userId, at } = req.body;
    if (typeof userId !== 'number' || typeof at !== 'number')
      throw new ClientError(
        400,
        'Proper params for userId and at are required.'
      );
    if (req.user?.userId !== userId)
      throw new ClientError(
        400,
        'Params userId does not match userId in authentication.'
      );
    const sql = `
      delete from "games"
        where "userId" = $1 and "at" = $2
        returning *
    `;
    const params = [req.user?.userId, at];
    const result = await db.query<SavedGame>(sql, params);
    const [deletedGame] = result.rows;
    res.status(201).json(deletedGame);
  } catch (err) {
    next(err);
  }
});

// Update a user's stored rank in the database:
app.put('/api/users/:userId', authMiddleware, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId < 0)
      throw new ClientError(400, 'userId must be a natural number');
    const { rank } = req.body;
    if (typeof rank !== 'number')
      throw new ClientError(400, 'rank (number) is required');
    if (req.user?.userId !== userId)
      throw new ClientError(
        400,
        'Params userId does not match userId in authentication.'
      );
    const sql = `
      update "users"
        set "rank" = $1
        where "userId" = $2
        returning *
    `;
    const params = [rank, req.user?.userId];
    const result = await db.query(sql, params);
    const [user] = result.rows;
    if (!user)
      throw new ClientError(404, `Cannot find user with userId ${userId}`);
    res.json({ userId: user.userId, rank: user.rank });
  } catch (err) {
    next(err);
  }
});

// Receives a request to play an online friend.
// Records the request parties and if both parties have sent the request
// initiates the connection, sends status (1 = waiting, 0 = ready)
// First checks if friend username exists in the database, and fails if not.
app.get('/api/invite/:username', authMiddleware, async (req, res, next) => {
  try {
    const username = req.params.username;
    if (!username || typeof username !== 'string') {
      throw new ClientError(400, 'Proper username is required');
    }
    const sql = `
      select "userId",
             "username"
      from "users"
      where "username" = $1
    `;
    const params = [username];
    const result = await db.query(sql, params);
    const [user] = result.rows;
    if (!user)
      throw new ClientError(404, `Cannot find user with username ${username}`);
    if (user.userId === req.user?.userId)
      throw new ClientError(400, 'Cannot send invitation to self');
    const requestingPlayerId = String(req.user!.userId);
    const requestedPlayerId = String(user.userId);
    // Check if invite request possible:
    if (pendingGameFriendInviteRequestsFrom[requestingPlayerId])
      throw new ClientError(
        400,
        'There is already a pending friend invite request from the requester'
      );
    if (pendingGameFriendInviteRequestsTo[requestedPlayerId])
      throw new ClientError(
        400,
        'There is already a pending friend invite request for the requested'
      );
    // Record the request:
    pendingGameFriendInviteRequestsFrom[requestingPlayerId] = requestedPlayerId;
    pendingGameFriendInviteRequestsTo[requestedPlayerId] = requestingPlayerId;
    const status =
      pendingGameFriendInviteRequestsFrom[requestedPlayerId] &&
      pendingGameFriendInviteRequestsTo[requestingPlayerId]
        ? 0
        : 1;
    // If handshake is complete (both players have invited each other),
    // establish a connection:
    console.log(
      'current requests from',
      JSON.stringify(pendingGameFriendInviteRequestsFrom),
      'current requests to',
      JSON.stringify(pendingGameFriendInviteRequestsTo)
    );
    // timeout request after 5 min:
    setTimeout(
      () => cancelFriendInviteRequest(requestingPlayerId, requestedPlayerId),
      300000
    );
    // return status of request:
    res.json({ status });
  } catch (err) {
    next(err);
  }
});

/*
 * Handles paths that aren't handled by any other route handler.
 * It responds with `index.html` to support page refreshes with React Router.
 * This must be the _last_ route, just before errorMiddleware.
 */
app.get('*', (req, res) => res.sendFile(`${reactStaticDir}/index.html`));

app.use(errorMiddleware);

app.listen(process.env.PORT, () => {
  console.log('Express server listening on port', process.env.PORT);
});
