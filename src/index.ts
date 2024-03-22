import express from "express";
import type { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  Game,
  GuessInputFields,
  PendingGame,
  RoundStatus,
  User,
  CurrentGameState,
} from "./types";
import {
  createGame,
  createPendingGame,
  deletePendingGame,
  findGameById,
  findPendingGameById,
  joinPendingGame,
  setPlayerBuzzedIn,
  updateGame,
  updateRoundStatus,
} from "./helpers/game";
import {
  addPlaylistToDB,
  advanceRound,
  fetchGameAnswers,
  getErrorMessage,
  scoreGuess,
} from "./helpers/utils";
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN_URL,
  },
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("disconnect", async () => {
    const user = socket.data.user;
    const roomCode = socket.data.currentGame?.roomCode;
    const gameId = socket.data.currentGame?.gameId;

    if (user && roomCode && gameId) {
      try {
        const game = (await findGameById(gameId)) as Game;
        const userIndex = game.userScores.findIndex(
          (userScore) => userScore.userId === user.id
        );
        const currentUserScore = game.userScores[userIndex];

        if (currentUserScore.buzzedInTimestamp) {
          const updatedUserScores = [...game.userScores];
          updatedUserScores[userIndex].buzzedInTimestamp = null;

          const pendingUpdatedGame = {
            ...game,
            userScores: updatedUserScores,
            roundStatus: RoundStatus.RESUMED,
          };

          const updatedGame = await updateGame(pendingUpdatedGame);

          const currentAudioSrc = updatedGame.currentRound
            ? updatedGame.playlist[updatedGame.currentRound - 1].musicSample
            : null;

          const updatedGameState = {
            gameId: updatedGame.id,
            roomCode: updatedGame.roomCode,
            musicGenre: updatedGame.musicGenre,
            userScores: updatedGame.userScores,
            currentRound: updatedGame.currentRound,
            currentRoundStatus: updatedGame.roundStatus,
            currentAudioSrc,
            isGameOver: updatedGame.isGameOver,
          };

          io.to(roomCode).emit("gameUpdated", updatedGameState);
        }
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.log(errorMessage);
        io.to(roomCode).emit("socketError", errorMessage);
      }
    }
  });

  socket.on("createUser", (user) => {
    socket.data.user = user;
  });

  socket.on("createGameData", (gameData) => {
    socket.data.currentGame = gameData;
  });

  socket.on("createRoom", (roomCode) => {
    socket.join(roomCode);
    console.log(`created room: ${roomCode}`);
  });

  socket.on("joinRoom", (roomCode) => {
    console.log("joining room");
    console.log(`user: ${JSON.stringify(socket.data.user)} joining room: ${roomCode}`);

    socket.join(roomCode);
    const clientIds = io.sockets.adapter.rooms.get(roomCode);
    let clients: any[] = [];
    for (const clientId of clientIds!) {
      const client = io.sockets.sockets.get(clientId);
      clients.push(client);
    }

    const users = clients.map((client) => {
      return client.data.user;
    });

    io.to(roomCode).emit("userJoinedRoom", users);
  });

  socket.on("hostDidDeletePendingGame", (roomCode) => {
    io.to(roomCode).emit("pendingGameDeleted");
  });

  socket.on("hostDidCreateGame", (roomCode, gameId) => {
    io.to(roomCode).emit("gameCreated", gameId);
  });

  socket.on(
    "clientUpdatedRoundStatus",
    async (gameId: string, roomCode: string, roundStatus: RoundStatus) => {
      try {
        const updatedGameState = await updateRoundStatus(gameId, roundStatus);
        io.to(roomCode).emit("gameUpdated", updatedGameState);
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.log(errorMessage);
        io.to(roomCode).emit("socketError", errorMessage);
      }
    }
  );

  socket.on(
    "playerBuzzedIn",
    async (gameId: string, roomCode: string, userId: string) => {
      try {
        const updatedGameState = await setPlayerBuzzedIn(gameId, userId);
        io.to(roomCode).emit("gameUpdated", updatedGameState);
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.log(errorMessage);
        io.to(roomCode).emit("socketError", errorMessage);
      }
    }
  );

  socket.on(
    "scoreGuess",
    async (
      gameId: string,
      roomCode: string,
      user: User,
      guessString: string
    ) => {
      try {
        const guessInputFields: GuessInputFields = {
          gameId,
          playerId: user.id,
          guessString,
        };

        const results = await scoreGuess(guessInputFields);
        const updatedGameState = results?.updatedGameState;
        const isGuessCorrect = results?.isGuessCorrect;

        io.to(roomCode).emit("gameUpdated", updatedGameState);

        if (isGuessCorrect !== null) {
          io.to(roomCode).emit("updatePlayerGuessResult", user, isGuessCorrect);
        }
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.log(errorMessage);
        io.to(roomCode).emit("socketError", errorMessage);
      }
    }
  );

  socket.on("clientAdvancedRound", async (gameId: string, roomCode: string) => {
    try {
      const updatedGameState = await advanceRound(gameId);
      io.to(roomCode).emit("gameUpdated", updatedGameState);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.log(errorMessage);
      io.to(roomCode).emit("socketError", errorMessage);
    }
  });

  socket.on(
    "pendingGameCreated",
    async (roomCode: string, pendingGameId: string) => {
      try {
        io.to(roomCode).emit(
          "leaveCurrentGameAndJoinPendingGame",
          pendingGameId
        );
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        console.log(errorMessage);
        io.to(roomCode).emit("socketError", errorMessage);
      }
    }
  );
});

// CREATE pending game
app.post("/api/v1/pending-games", async (req: Request, res: Response) => {
  const { hostPlayer, roomCode } = req.body;

  try {
    const pendingGameInput = {
      hostPlayer,
      roomCode,
    };

    const pendingGame = await createPendingGame(pendingGameInput);

    res.status(200).send({
      pendingGame: pendingGame as PendingGame,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});

app.put("/api/v1/pending-games", async (req: Request, res: Response) => {
  const { player, roomCode } = req.body;

  try {
    const pendingGameInput = {
      player,
      roomCode,
    };

    const pendingGame = await joinPendingGame(pendingGameInput);

    res.status(200).send({
      pendingGame: pendingGame as PendingGame,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});

app.delete(
  "/api/v1/pending-games/:gameId",
  async (req: Request, res: Response) => {
    const gameId = req.params.gameId;

    try {
      await deletePendingGame(gameId);

      res.status(200).send();
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.log(errorMessage);
      res.status(500).send({ error: errorMessage });
    }
  }
);

app.get(
  "/api/v1/pending-games/:gameId/:playerId/:roomCode",
  async (req: Request, res: Response) => {
    const { gameId, playerId, roomCode } = req.params;

    try {
      const pendingGameInput = {
        id: gameId,
        playerId,
        roomCode,
      };

      const pendingGame = await findPendingGameById(pendingGameInput);

      res.status(200).send({
        pendingGame: pendingGame as PendingGame,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.log(errorMessage);
      res.status(500).send({ error: errorMessage });
    }
  }
);

// Create game
app.post("/api/v1/games", async (req: Request, res: Response) => {
  const { genre, numRounds, roomCode, usersInGame } = req.body;

  try {
    const gameInput = {
      roomCode,
      genre,
      users: usersInGame,
      numRounds,
    };

    const newGame = await createGame(gameInput);

    res.status(200).send({
      gameState: newGame as CurrentGameState,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});

// Update game
app.put("/api/v1/games/:gameId", async (req: Request, res: Response) => {
  try {
    const gameInput = req.body;
    const updatedGame = await updateGame(gameInput);

    res.status(200).send({
      updatedGame,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});

// Get game
app.get("/api/v1/games/:gameId", async (req: Request, res: Response) => {
  try {
    const gameId = req.params.gameId;
    const game = await findGameById(gameId);

    const currentAudioSrc = game.currentRound
      ? game.playlist[game.currentRound - 1].musicSample
      : null;

    const gameState = {
      gameId: game.id,
      roomCode: game.roomCode,
      musicGenre: game.musicGenre,
      userScores: game.userScores,
      currentRound: game.currentRound,
      currentRoundStatus: game.roundStatus,
      currentAudioSrc,
      isGameOver: game.isGameOver,
    } as CurrentGameState;

    res.status(200).send({ gameState });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});

// Get answers for game round
app.get(
  "/api/v1/games/:gameId/answers/:gameRound",
  async (req: Request, res: Response) => {
    try {
      const gameId = req.params.gameId;
      const roundIndex = parseInt(req.params.gameRound) - 1;

      const roundAnswers = await fetchGameAnswers(gameId, roundIndex);

      res.status(200).send({ ...roundAnswers });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.log(errorMessage);
      res.status(500).send({ error: errorMessage });
    }
  }
);

app.post("/api/v1/playlist", async (req: Request, res: Response) => {
  try {
    await addPlaylistToDB();

    res.status(200).send();
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.log(errorMessage);
    res.status(500).send({ error: errorMessage });
  }
});
