-- Add team_leader_id to profiles so operators are linked to a team leader
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader ON public.profiles(team_leader_id);
