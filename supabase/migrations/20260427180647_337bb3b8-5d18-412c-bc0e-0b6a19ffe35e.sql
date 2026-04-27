
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Paintings (metadata; image stored in Storage)
CREATE TABLE public.paintings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  storage_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paintings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own paintings" ON public.paintings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own paintings" ON public.paintings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own paintings" ON public.paintings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own paintings" ON public.paintings FOR DELETE USING (auth.uid() = user_id);

-- Palettes (saved color schemes including the 5 custom slots)
CREATE TABLE public.palettes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My palette',
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.palettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own palettes" ON public.palettes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own palettes" ON public.palettes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own palettes" ON public.palettes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own palettes" ON public.palettes FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for painting images
INSERT INTO storage.buckets (id, name, public) VALUES ('paintings', 'paintings', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view paintings" ON storage.objects FOR SELECT
  USING (bucket_id = 'paintings');
CREATE POLICY "Users upload own painting files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'paintings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own painting files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'paintings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own painting files" ON storage.objects FOR DELETE
  USING (bucket_id = 'paintings' AND auth.uid()::text = (storage.foldername(name))[1]);
