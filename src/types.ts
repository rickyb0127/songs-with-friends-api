export interface ServerToClientEvents {
  userJoinedRoom: (users: User[]) => void;
  pendingGameDeleted: () => void;
  gameCreated: (gameId: string) => void;
  gameUpdated: (gameState: CurrentGameState) => void;
  updatePlayerGuessing: (user: User) => void;
  updatePlayerGuessResult: (user: User, isGuessCorrect: boolean) => void;
  socketError: (errorMessage: string) => void;
  leaveCurrentGameAndJoinPendingGame: (pendingGameId: string) => void;
}

export interface ClientToServerEvents {
  joinRoom: (roomCode: string) => void;
  createRoom: (roomCode: string) => void;
  createUser: (user: User) => void;
  createGameData: (gameData: GameData) => void;
  hostDidDeletePendingGame: (roomCode: string) => void;
  hostDidCreateGame: (roomCode: string, gameId: string) => void;
  clientUpdatedRoundStatus: (gameId: string, roomCode: string, roundStatus: RoundStatus) => void;
  playerBuzzedIn: (gameId: string, roomCode: string, userId: string) => void;
  clientAdvancedRound: (gameId: string, roomCode: string) => void;
  scoreGuess: (gameId: string, roomCode: string, user: User, guessString: string) => void;
  pendingGameCreated: (roomCode: string, pendingGameId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface User {
  id: string,
  displayName: string,
  isHost: boolean
}

export interface GameData {
  gameId: string,
  roomCode: string
}

export interface SocketData {
  user: User,
  currentGame: GameData
}

export interface PendingGame {
  id: string,
  roomCode: string,
  players: User[]
}

export interface CreatePendingGameInput {
  roomCode: string,
  hostPlayer: User
}

export interface JoinPendingGameInput {
  roomCode: string,
  player: User
}

export interface FindPendingGameInput {
  id: string,
  playerId: string,
  roomCode: string
}

export interface Game {
  id: string,
  roomCode: string,
  musicGenre: string,
  userScores: UserScore[],
  numRounds: number,
  currentRound: number | null,
  rounds: Round[],
  roundStatus: RoundStatus,
  playlist: SongData[],
  isGameOver: boolean
}

export interface CurrentGameState {
  gameId: string,
  roomCode: string,
  musicGenre: string,
  userScores: UserScore[],
  currentRound: number | null,
  currentRoundStatus: RoundStatus,
  currentAudioSrc: string | null,
  isGameOver: boolean
}

export interface Round {
  roundNum: number,
  currentGuessPhase: number,
  playerIdsGuessed: string[],
  correctGuessPlayerId: string | null,
  isRoundOver: boolean
}

export interface CreateGameInput {
  roomCode: string,
  genre: string,
  users: User[],
  numRounds: number
}

export interface GuessInputFields {
  gameId: string,
  playerId: string,
  guessString: string
}

export interface UserScore {
  userId: string,
  userName: string,
  isHost: boolean,
  totalScore: number,
  buzzedInTimestamp: number | null
}

export interface SongData {
  name: string,
  albumName: string,
  artistName: string,
  releaseDate: string,
  acceptedArtistNames: string[],
  acceptedSongNames: string[],
  img: string,
  musicSample: string
}

export enum RoundStatus {
  WAITING_START = "WAITING_START",
  STARTED = "STARTED",
  PAUSED = "PAUSED",
  RESUMED = "RESUMED",
  PHASE_ENDED = "PHASE_ENDED",
  ENDED = "ENDED"
}