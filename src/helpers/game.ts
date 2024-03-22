import {
  CreateGameInput,
  CreatePendingGameInput,
  FindPendingGameInput,
  Game,
  JoinPendingGameInput,
  Round,
  RoundStatus,
} from "../types";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  deleteDoc,
} from "firebase/firestore/lite";
import { createRandomPlaylist, getErrorMessage } from "./utils";
import { db } from "./db";
import crypto from "crypto";

export const createPendingGame = async (
  pendingGameInput: CreatePendingGameInput
) => {
  try {
    const id = crypto.randomUUID();

    const pendingGame = {
      id,
      roomCode: pendingGameInput.roomCode,
      players: [pendingGameInput.hostPlayer],
    };

    await setDoc(doc(db, "pendingGames", id), {
      ...pendingGame,
    });

    return pendingGame;
  } catch (err) {
    console.log(err);
  }
};

export const joinPendingGame = async (
  pendingGameInput: JoinPendingGameInput
) => {
  try {
    const q = query(
      collection(db, "pendingGames"),
      where("roomCode", "==", pendingGameInput.roomCode)
    );
    const querySnapshot = await getDocs(q);
    const pendingGame = querySnapshot.docs[0].data();

    if (pendingGame) {
      const pendingGamePlayerIds: string[] = pendingGame.players.map(
        (player: { id: any }) => player.id
      );
      const maxPlayers = 4;

      // only update and return pending game if room code matches and the player doesnt exist in it yet and pending game has less than 4 players
      if (
        pendingGamePlayerIds.length < maxPlayers &&
        pendingGame.roomCode === pendingGameInput.roomCode &&
        !pendingGamePlayerIds.includes(pendingGameInput.player.id)
      ) {
        const updatedGame = {
          ...pendingGame,
          players: [...pendingGame.players, pendingGameInput.player],
        };

        await setDoc(doc(db, "pendingGames", pendingGame.id), {
          ...updatedGame,
        });

        return updatedGame;
      }
    } else {
      console.log("No such document!");
    }
  } catch (err) {
    console.log(err);
  }
};

export const findPendingGameById = async (
  pendingGameInput: FindPendingGameInput
) => {
  const docRef = doc(db, "pendingGames", pendingGameInput.id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const pendingGame = docSnap.data();
    const pendingGamePlayerIds: string[] = pendingGame.players.map(
      (player: { id: any }) => player.id
    );

    if (
      pendingGame.roomCode === pendingGameInput.roomCode &&
      !pendingGamePlayerIds.includes(pendingGameInput.playerId)
    ) {
      return pendingGame;
    } else {
      console.log("not part of pending game or pending game is inactive");
    }
  } else {
    console.log("No such document!");
  }
};

export const deletePendingGame = async (id: string) => {
  await deleteDoc(doc(db, "pendingGames", id));
};

export const createGame = async (gameInput: CreateGameInput) => {
  try {
    const id = crypto.randomUUID();
    const playlist = await createRandomPlaylist(
      gameInput.genre,
      gameInput.numRounds
    );
    const numRounds = Math.min(gameInput.numRounds, playlist.length);
    const userScores = gameInput.users.map((user) => {
      return {
        userId: user.id,
        userName: user.displayName,
        isHost: user.isHost,
        totalScore: 0,
        buzzedInTimestamp: null,
      };
    });

    let rounds: Round[] = [];
    for (let i = 0; i < numRounds; i++) {
      const round = {
        roundNum: i + 1,
        currentGuessPhase: 1,
        playerIdsGuessed: [],
        correctGuessPlayerId: null,
        isRoundOver: false,
      };

      rounds.push(round);
    }

    const newGame = {
      id,
      roomCode: gameInput.roomCode,
      musicGenre: gameInput.genre,
      userScores,
      numRounds,
      currentRound: 1,
      rounds,
      roundStatus: RoundStatus.WAITING_START,
      playlist,
      isGameOver: false,
    };

    await setDoc(doc(db, "games", id), {
      ...newGame,
    });

    const gameState = {
      gameId: newGame.id,
      roomCode: newGame.roomCode,
      musicGenre: newGame.musicGenre,
      userScores: newGame.userScores,
      currentRound: newGame.currentRound,
      currentRoundStatus: newGame.roundStatus,
      currentAudioSrc: newGame.playlist[0].musicSample,
      isGameOver: newGame.isGameOver,
    };

    return gameState;
  } catch (err) {
    console.log(err);
  }
};

export const findGameById = async (gameId: string) => {
  const docRef = doc(db, "games", gameId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    throw new Error("Game not found");
  }
};

export const updateGame = async (updatedGame: Game) => {
  console.log("updating game");
  try {
    await findGameById(updatedGame.id);

    await setDoc(doc(db, "games", updatedGame.id), {
      ...updatedGame,
    });

    return updatedGame;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};

export const updateRoundStatus = async (
  gameId: string,
  roundStatus: RoundStatus
) => {
  console.log("updating round status");
  try {
    const currentGame = (await findGameById(gameId)) as Game;

    const updatedGame = {
      ...currentGame,
      roundStatus,
    };

    await setDoc(doc(db, "games", gameId), {
      ...updatedGame,
    });

    const currentAudioSrc = updatedGame.currentRound
      ? updatedGame.playlist[updatedGame.currentRound - 1].musicSample
      : null;

    const gameState = {
      gameId: updatedGame.id,
      roomCode: updatedGame.roomCode,
      musicGenre: updatedGame.musicGenre,
      userScores: updatedGame.userScores,
      currentRound: updatedGame.currentRound,
      currentRoundStatus: updatedGame.roundStatus,
      currentAudioSrc,
      isGameOver: updatedGame.isGameOver,
    };

    return gameState;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};

export const setPlayerBuzzedIn = async (gameId: string, userId: string) => {
  console.log("setting player buzzed in");
  try {
    const currentGame = (await findGameById(gameId)) as Game;
    const updatedUserScores = [...currentGame.userScores];
    const buzzedInStatuses = updatedUserScores.map(
      (userScore) => userScore.buzzedInTimestamp
    );
    console.log(buzzedInStatuses);
    for (let i = 0; i < buzzedInStatuses.length; i++) {
      if (buzzedInStatuses[i]) {
        throw new Error("someone has already buzzed in");
      }
    }
    const userIndex = updatedUserScores.findIndex(
      (userScore) => userScore.userId === userId
    );

    if (userIndex >= 0) {
      const updatedBuzzedInTimestamp = Date.now();

      updatedUserScores[userIndex] = {
        ...updatedUserScores[userIndex],
        buzzedInTimestamp: updatedBuzzedInTimestamp,
      };

      const updatedGame = {
        ...currentGame,
        roundStatus: RoundStatus.PAUSED,
        userScores: updatedUserScores,
      };

      await setDoc(doc(db, "games", gameId), {
        ...updatedGame,
      });

      const currentAudioSrc = updatedGame.currentRound
        ? updatedGame.playlist[updatedGame.currentRound - 1].musicSample
        : null;

      const gameState = {
        gameId: updatedGame.id,
        roomCode: updatedGame.roomCode,
        musicGenre: updatedGame.musicGenre,
        userScores: updatedGame.userScores,
        currentRound: updatedGame.currentRound,
        currentRoundStatus: updatedGame.roundStatus,
        currentAudioSrc,
        isGameOver: updatedGame.isGameOver,
      };

      return gameState;
    } else {
      throw new Error(`userId: ${userId} not found in game: ${gameId}`);
    }
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};

export const unSetPlayerBuzzedIn = async (gameId: string) => {
  console.log("unsetting player buzzed in");
  try {
    const currentGame = (await findGameById(gameId)) as Game;
    const updatedUserScores = [...currentGame.userScores].map((userScore) => {
      return {
        ...userScore,
        buzzedInTimestamp: null,
      };
    });

    const updatedGame = {
      ...currentGame,
      roundStatus: RoundStatus.RESUMED,
      userScores: updatedUserScores,
    };

    await setDoc(doc(db, "games", gameId), {
      ...updatedGame,
    });

    const currentAudioSrc = updatedGame.currentRound
      ? updatedGame.playlist[updatedGame.currentRound - 1].musicSample
      : null;

    const gameState = {
      gameId: updatedGame.id,
      roomCode: updatedGame.roomCode,
      musicGenre: updatedGame.musicGenre,
      userScores: updatedGame.userScores,
      currentRound: updatedGame.currentRound,
      currentRoundStatus: updatedGame.roundStatus,
      currentAudioSrc,
      isGameOver: updatedGame.isGameOver,
    };

    return gameState;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};
