CREATE TABLE public.fridge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  category text NOT NULL DEFAULT 'Kylskåp',
  added_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fridge_items TO authenticated;
GRANT ALL ON public.fridge_items TO service_role;

ALTER TABLE public.fridge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own items"
  ON public.fridge_items
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own items"
  ON public.fridge_items
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own items"
  ON public.fridge_items
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own items"
  ON public.fridge_items
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fridge_items_updated_at
  BEFORE UPDATE ON public.fridge_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();