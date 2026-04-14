export interface JwtUser {
  id: number;
  name: string;
  email?: string;
}

export interface TeamRow {
  id: number;
  name: string;
  email: string;
  password: string;
  score: number;
  member_count: number;
  is_admin: number;
  created_at: string;
}

export interface TeamMemberRow {
  id: number;
  team_id: number;
  username: string;
  is_primary: number;
  created_at: string;
}

export interface ChallengeRow {
  id: number;
  title: string;
  description: string;
  category: string;
  points: number;
  flag: string;
  created_at: string;
}
