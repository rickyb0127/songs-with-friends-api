import {
  addDoc,
  collection,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore/lite";
import { db } from "./db";
import {
  CurrentGameState,
  Game,
  GuessInputFields,
  RoundStatus,
} from "../types";
import { findGameById, updateGame } from "./game";

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const createRandomPlaylist = async (
  genre: string,
  numRounds: number
) => {
  const querySnapshot = await getDocs(
    collection(db, "music", "playlists", genre)
  );
  let fullPlaylist: any[] = [];

  querySnapshot.forEach((doc) => {
    fullPlaylist.push(doc.data());
  });

  const maxNumRounds = Math.min(numRounds, fullPlaylist.length);
  const randomNumbers = getRandomNumbersList(maxNumRounds, fullPlaylist.length);

  const result = randomNumbers.map((index) => fullPlaylist[index]);
  return result;
};

export const getRandomNumbersList = (
  resultLength: number,
  maxIndex: number
) => {
  const resultSet = new Set<number>();
  while (resultSet.size !== resultLength) {
    resultSet.add(Math.floor(Math.random() * maxIndex));
  }

  const resultList = Array.from(resultSet);
  return resultList;
};

export const scoreGuess = async (guessInput: GuessInputFields) => {
  try {
    console.log("scoring guess");
    const currentGame = (await findGameById(guessInput.gameId)) as Game;
    const index = currentGame.currentRound
      ? currentGame.currentRound - 1
      : null;
    if (index === null) {
      throw new Error("current round is null");
    }
    const isRoundOver = currentGame.rounds[index].isRoundOver;

    if (!isRoundOver) {
      const playerGuess = guessInput.guessString.toLowerCase();
      console.log(`player: ${guessInput.playerId} guessed: ${playerGuess}`);

      const acceptedSongNames = currentGame.playlist[index].acceptedSongNames;
      const acceptedArtistNames =
        currentGame.playlist[index].acceptedArtistNames;
      let isSongCorrect = false;
      let isArtistCorrect = false;

      for (let i = 0; i < acceptedSongNames.length; i++) {
        if (playerGuess.includes(acceptedSongNames[i])) {
          const stringLength = acceptedSongNames[i].length;
          const foundStartingIndex = playerGuess.indexOf(acceptedSongNames[i]);

          if (foundStartingIndex >= 0) {
            const foundEndingIndex = foundStartingIndex + stringLength;
            const foundString = playerGuess.substring(
              foundStartingIndex,
              foundEndingIndex
            );
            const preFoundStringChar =
              foundStartingIndex > 0
                ? playerGuess.substring(
                    foundStartingIndex - 1,
                    foundStartingIndex
                  )
                : null;
            const postFoundStringChar =
              foundEndingIndex !== playerGuess.length
                ? playerGuess.substring(foundEndingIndex, foundEndingIndex + 1)
                : null;
            const hasExtraLeadingOrTrailingChars =
              (preFoundStringChar !== null && preFoundStringChar !== " ") ||
              (postFoundStringChar !== null && postFoundStringChar !== " ");

            if (
              !hasExtraLeadingOrTrailingChars &&
              foundString === acceptedSongNames[i]
            ) {
              isSongCorrect = true;
              break;
            }
          }
        }

        isSongCorrect = false;
      }

      if (isSongCorrect) {
        for (let i = 0; i < acceptedArtistNames.length; i++) {
          if (playerGuess.includes(acceptedArtistNames[i])) {
            const stringLength = acceptedArtistNames[i].length;
            const foundStartingIndex = playerGuess.indexOf(
              acceptedArtistNames[i]
            );

            if (foundStartingIndex >= 0) {
              const foundEndingIndex = foundStartingIndex + stringLength;
              const foundString = playerGuess.substring(
                foundStartingIndex,
                foundEndingIndex
              );
              const preFoundStringChar =
                foundStartingIndex > 0
                  ? playerGuess.substring(
                      foundStartingIndex - 1,
                      foundStartingIndex
                    )
                  : null;
              const postFoundStringChar =
                foundEndingIndex !== playerGuess.length
                  ? playerGuess.substring(
                      foundEndingIndex,
                      foundEndingIndex + 1
                    )
                  : null;
              const hasExtraLeadingOrTrailingChars =
                (preFoundStringChar !== null && preFoundStringChar !== " ") ||
                (postFoundStringChar !== null && postFoundStringChar !== " ");

              if (
                !hasExtraLeadingOrTrailingChars &&
                foundString === acceptedArtistNames[i]
              ) {
                isArtistCorrect = true;
                break;
              }
            }
          }

          isArtistCorrect = false;
        }
      }

      const isGuessCorrect = isSongCorrect && isArtistCorrect;
      let updatedGame = currentGame as Game;
      let updatedRounds = currentGame.rounds;
      let updatedRound = currentGame.rounds[index];
      const playerIdsGuessed = [
        ...updatedRound.playerIdsGuessed,
        guessInput.playerId,
      ];
      const userScores = updatedGame.userScores;
      const userIndex = userScores.findIndex(
        (userScore) => userScore.userId === guessInput.playerId
      );

      if (isGuessCorrect) {
        console.log("correct guess");

        // const guessPhase = currentGame.rounds[index].currentGuessPhase;
        const roundScore = 1;
        const updatedScore = userScores[userIndex].totalScore + roundScore;
        userScores[userIndex] = {
          ...userScores[userIndex],
          totalScore: updatedScore,
          buzzedInTimestamp: null,
        };
        // const nextRoundNum = currentGame.currentRound + 1;
        // const currentRound = nextRoundNum <= currentGame.numRounds ? nextRoundNum : null;
        // const isGameOver = currentRound === null;

        updatedRound = {
          ...updatedRound,
          playerIdsGuessed,
          correctGuessPlayerId: guessInput.playerId,
          isRoundOver: true,
        };

        updatedRounds[index] = updatedRound;

        updatedGame = {
          ...updatedGame,
          id: guessInput.gameId,
          userScores,
          roundStatus: RoundStatus.ENDED,
        };
      } else {
        console.log("incorrect guess");

        // const isRoundOver = playerIdsGuessed.length === userScores.length;
        // const nextRoundNum = isRoundOver ? currentGame.currentRound + 1 : currentGame.currentRound;
        // const currentRound = nextRoundNum <= currentGame.numRounds ? nextRoundNum : null;
        // const isGameOver = currentRound === null;

        // updatedRound = {
        //   ...updatedRound,
        //   playerIdsGuessed,
        //   isRoundOver
        // };

        // updatedRounds[index] = updatedRound;

        // updatedGame = {
        //   ...updatedGame,
        //   id: guessInput.gameId,
        //   rounds: updatedRounds,
        //   currentRound,
        //   isGameOver
        // };

        userScores[userIndex] = {
          ...userScores[userIndex],
          buzzedInTimestamp: null,
        };

        updatedGame = {
          ...updatedGame,
          userScores,
          roundStatus: RoundStatus.RESUMED,
        };
      }

      // update Game
      await updateGame(updatedGame);

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
      } as CurrentGameState;

      return {
        updatedGameState,
        isGuessCorrect,
      };
    } else {
      const currentAudioSrc = currentGame.currentRound
        ? currentGame.playlist[currentGame.currentRound - 1].musicSample
        : null;

      const currentGameState = {
        gameId: currentGame.id,
        roomCode: currentGame.roomCode,
        musicGenre: currentGame.musicGenre,
        userScores: currentGame.userScores,
        currentRound: currentGame.currentRound,
        currentRoundStatus: currentGame.roundStatus,
        currentAudioSrc,
        isGameOver: currentGame.isGameOver,
      } as CurrentGameState;

      return {
        updatedGameState: currentGameState,
        isGuessCorrect: null,
      };
    }
  } catch (err) {
    throw new Error(`no game found with id: ${guessInput.gameId}`);
  }
};

export const addPlaylistToDB = async () => {
  const playlist90s = require("../playlists/music90.json");

  for (let entry of playlist90s) {
    await addDoc(collection(db, "music", "playlists", "90s"), {
      ...entry
    });
  }
};

export const advanceRound = async (gameId: string) => {
  try {
    const currentGame = await findGameById(gameId);

    const index = currentGame.currentRound - 1;
    let updatedGame = currentGame as Game;
    let updatedRounds = currentGame.rounds;
    let updatedRound = currentGame.rounds[index];
    const nextRoundNum = currentGame.currentRound + 1;
    const currentRound =
      nextRoundNum <= currentGame.numRounds ? nextRoundNum : null;
    const isGameOver = currentRound === null;

    updatedRound = {
      ...updatedRound,
      isRoundOver: true,
    };

    updatedRounds[index] = updatedRound;

    updatedGame = {
      ...updatedGame,
      currentRound,
      roundStatus: isGameOver ? RoundStatus.ENDED : RoundStatus.WAITING_START,
      isGameOver,
    };

    await setDoc(doc(db, "games", gameId), {
      ...updatedGame,
    });

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

    return updatedGameState;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};

export const fetchGameAnswers = async (gameId: string, roundIndex: number) => {
  try {
    const game = (await findGameById(gameId)) as Game;
    const answers = game.playlist[roundIndex];

    return answers;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    throw new Error(errorMessage);
  }
};
