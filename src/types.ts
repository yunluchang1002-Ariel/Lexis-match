
export interface WordPair {
  word: string;
  synonym: string;
}

export interface ReviewItem extends WordPair {
  phonetic: string;
  meaning: string;
}

export interface GameState {
  pairs: WordPair[];
  selectedLeft: string | null;
  selectedRight: string | null;
  matchedPairs: string[];
  score: number;
  isGameOver: boolean;
  startTime: number | null;
  endTime: number | null;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
