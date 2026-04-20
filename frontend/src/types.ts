export interface Team {
  id: number;
  name: string;
  email?: string;
  score: number;
  memberCount?: number;
  isAdmin?: boolean;
  created_at?: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  username: string;
  is_primary?: number;
  created_at?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Challenge {
  id: number;
  public_id?: string;
  challenge_code?: string;
  title: string;
  description: string;
  category: string;
  points: number;
  difficulty?: Difficulty;
  first_blood_points?: number;
  second_blood_points?: number;
  default_points?: number;
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
  points: number;
  difficulty?: Difficulty | null;
  submitted_at?: string;
  timestamp?: string;
}

export interface SubmissionHistoryItem {
  id: number;
  challenge_id: number;
  challenge_public_id?: string;
  challenge_difficulty?: Difficulty | null;
  submitted_flag: string;
  is_correct: number;
  submitted_at: string;
  challenge_title?: string;
  awarded_points?: number;
  points?: number;
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

export interface AdminTeamSubmission {
  id: number;
  submitted_flag: string;
  is_correct: number;
  awarded_points: number;
  submitted_at: string;
  challenge_public_id?: string | null;
  challenge_difficulty?: Difficulty | null;
}

export interface AdminTeamDetails {
  team: {
    id: number;
    name: string;
    score: number;
    memberCount: number;
    created_at: string;
  };
  members: TeamMember[];
  submissions: AdminTeamSubmission[];
}
