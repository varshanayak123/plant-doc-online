CREATE TABLE public.scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  guest_key text NOT NULL,
  image_path text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  crop_name jsonb NOT NULL,
  disease_name jsonb NOT NULL,
  confidence integer NOT NULL,
  symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  prevention_tips jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_step jsonb NOT NULL,
  is_conclusive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scan_history TO service_role;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX scan_history_guest_idx ON public.scan_history (guest_key, created_at DESC);
-- No policies: guest records are only reachable through server functions that verify the guest token.