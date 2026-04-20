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
  public_id?: string;
  title: string;
  description: string;
  flag: string;
  first_blood_points?: number;
  second_blood_points?: number;
  default_points?: number;
  created_at: string;
}
