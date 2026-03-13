-- Hackathon Evaluator: Initial schema for evaluations and projects
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Evaluations: one row per uploaded CSV session
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  name TEXT NOT NULL DEFAULT 'Untitled Evaluation',
  criteria_json JSONB NOT NULL DEFAULT '[]',
  share_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evaluated projects: projects within an evaluation
CREATE TABLE IF NOT EXISTS evaluated_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  project_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
  evaluation_json JSONB,
  error TEXT,
  cannot_evaluate BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_share_slug ON evaluations(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluated_projects_evaluation_id ON evaluated_projects(evaluation_id);

-- RLS: evaluations - all authenticated users can read, only owner can insert/update/delete
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read evaluations" ON evaluations;
CREATE POLICY "Anyone can read evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own evaluations" ON evaluations;
CREATE POLICY "Users can insert own evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own evaluations" ON evaluations;
CREATE POLICY "Users can update own evaluations"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own evaluations" ON evaluations;
CREATE POLICY "Users can delete own evaluations"
  ON evaluations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: evaluated_projects - read/update via evaluation ownership
ALTER TABLE evaluated_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read evaluated_projects via evaluation" ON evaluated_projects;
CREATE POLICY "Read evaluated_projects via evaluation"
  ON evaluated_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id
    )
  );

DROP POLICY IF EXISTS "Insert evaluated_projects via evaluation" ON evaluated_projects;
CREATE POLICY "Insert evaluated_projects via evaluation"
  ON evaluated_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Update evaluated_projects via evaluation" ON evaluated_projects;
CREATE POLICY "Update evaluated_projects via evaluation"
  ON evaluated_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Delete evaluated_projects via evaluation" ON evaluated_projects;
CREATE POLICY "Delete evaluated_projects via evaluation"
  ON evaluated_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_id AND e.user_id = auth.uid()
    )
  );

-- Function to allow public read by share_slug (for share page - no auth)
-- We use a SECURITY DEFINER function so the API can fetch by slug without RLS blocking
CREATE OR REPLACE FUNCTION get_evaluation_by_share_slug(slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  criteria_json JSONB,
  user_email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.criteria_json, e.user_email, e.created_at
  FROM evaluations e
  WHERE e.share_slug = slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get projects for a shared evaluation
CREATE OR REPLACE FUNCTION get_projects_by_share_slug(slug TEXT)
RETURNS TABLE (
  id UUID,
  project_json JSONB,
  status TEXT,
  evaluation_json JSONB,
  error TEXT,
  cannot_evaluate BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT ep.id, ep.project_json, ep.status, ep.evaluation_json, ep.error, ep.cannot_evaluate
  FROM evaluated_projects ep
  JOIN evaluations e ON e.id = ep.evaluation_id
  WHERE e.share_slug = slug
  ORDER BY ep.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
