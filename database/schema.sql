
-- Hackathon Registration and Team Management Portal

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Hackathon Events Table
CREATE TABLE IF NOT EXISTS public.hackathon_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Campus Hackathon',
    description TEXT NOT NULL DEFAULT 'Build, collaborate, and present your ideas.',
    event_date DATE,
    registration_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.hackathon_events(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    college TEXT NOT NULL,
    project_idea TEXT NOT NULL,
    lead_name TEXT NOT NULL,
    lead_email TEXT NOT NULL,
    member_limit INTEGER NOT NULL DEFAULT 4
        CHECK (member_limit BETWEEN 2 AND 6),
    status TEXT NOT NULL DEFAULT 'registered'
        CHECK (status IN ('registered', 'submitted', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add event_id if the teams table already exists
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS event_id UUID
REFERENCES public.hackathon_events(id) ON DELETE SET NULL;

-- 3. Team Members Table
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL
        REFERENCES public.teams(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('lead', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, email)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS teams_created_at_idx
ON public.teams(created_at DESC);

CREATE INDEX IF NOT EXISTS teams_college_idx
ON public.teams(college);

CREATE INDEX IF NOT EXISTS teams_event_id_idx
ON public.teams(event_id);

CREATE INDEX IF NOT EXISTS team_members_team_id_idx
ON public.team_members(team_id);

CREATE INDEX IF NOT EXISTS team_members_email_idx
ON public.team_members(email);

-- 5. Enable Row Level Security
ALTER TABLE public.hackathon_events
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teams
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.team_members
ENABLE ROW LEVEL SECURITY;

-- 6. Insert a sample hackathon event
INSERT INTO public.hackathon_events (
    name,
    description,
    event_date
)
SELECT
    'Campus Hackathon',
    'Bring an idea, build a prototype, and present it to the judges.',
    CURRENT_DATE + 30
WHERE NOT EXISTS (
    SELECT 1
    FROM public.hackathon_events
);
