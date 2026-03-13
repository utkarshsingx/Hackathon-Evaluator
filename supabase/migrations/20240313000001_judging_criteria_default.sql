-- Store default judging criteria (100 points total)
-- Used when creating new evaluations with no criteria specified

CREATE TABLE IF NOT EXISTS judging_criteria_default (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Insert default row with fixed ID so we always have exactly one row
INSERT INTO judging_criteria_default (id, criteria_json)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '[
    {"name": "Problem Definition & Clarity", "points": 12, "description": "How well-defined and specific is the problem? Vague or generic statements score 0-3. Must have clear target audience, scope, and concrete problem statement for high scores."},
    {"name": "Innovation & Uniqueness", "points": 14, "description": "How original and differentiated? Copycat or obvious ideas score 0-4. Novel approaches with clear differentiation score high. Be strict—most ideas are incremental."},
    {"name": "Technical Execution", "points": 18, "description": "How well is the solution built? Vague architecture or no implementation details = 0-5. Require concrete tech stack, feasibility, and architecture for high scores."},
    {"name": "AI Integration", "points": 18, "description": "Depth and meaningful use of AI. Generic ''we use AI'' without named tools/models = 0-4. Require specific models, workflows, and clear AI impact for high scores."},
    {"name": "User Impact & Value", "points": 14, "description": "Tangible benefit to users. Vague benefits = 0-4. Require quantifiable outcomes (time/cost saved) or clear metrics for high scores."},
    {"name": "Completeness & Polish", "points": 2, "description": "How demo-ready and polished? Incomplete or rushed work scores 0. Only fully polished submissions get full marks."},
    {"name": "Demo Presentation (drive link)", "points": 8, "description": "No Drive link = 0. Link not accessible = max 2. Link accessible + content aligns with project = full marks. Content must substantiate the solution. Be strict."},
    {"name": "Presentation & Communication", "points": 8, "description": "Clarity of explanation, structure, and articulation. Vague or poorly explained = 0-3. Require clear structure and specifics for high scores."},
    {"name": "Scalability & Viability", "points": 6, "description": "Real-world viability and potential to scale. Hand-wavy claims = 0-2. Require concrete deployment or business considerations for high scores."}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated users to read and update
ALTER TABLE judging_criteria_default ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read default criteria" ON judging_criteria_default;
CREATE POLICY "Authenticated users can read default criteria"
  ON judging_criteria_default FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update default criteria" ON judging_criteria_default;
CREATE POLICY "Authenticated users can update default criteria"
  ON judging_criteria_default FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
