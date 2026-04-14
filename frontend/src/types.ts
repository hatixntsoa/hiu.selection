export interface Team {
  id: number;
  name: string;
  email?: string;
  score: number;
  isAdmin?: boolean;
  created_at?: string;
}

export interface Challenge {
  id: number;
  challenge_code?: string;
  title: string;
  description: string;
  category: string;
  points: number;
  flag?: string;
  created_at?: string;
}

export interface ChallengeCategory {
  id: number;
  name: string;
  created_at?: string;
}

export interface ActivityItem {
  team_name?: string;
  teamName?: string;
  challenge_title?: string;
  challengeTitle?: string;
  points: number;
  submitted_at?: string;
  timestamp?: string;
}

export interface SubmissionHistoryItem {
  id: number;
  challenge_id: number;
  submitted_flag: string;
  is_correct: number;
  submitted_at: string;
  challenge_title: string;
  points: number;
}

export interface ScoreboardTeam {
  id: number;
  name: string;
  score: number;
  created_at: string;
  rank: number;
}

export interface CtfTimerState {
  isActive: boolean;
  isInfinite: boolean;
  durationSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  timeLeftSeconds: number | null;
  isExpired: boolean;
  canSubmit: boolean;
}
