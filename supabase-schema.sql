-- ============================================
-- Supabase Database Schema for Team Task Manager
-- ============================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. FOLDERS TABLE (user-created workspaces)
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. FOLDER_MEMBERS TABLE (collaboration)
CREATE TABLE IF NOT EXISTS folder_members (
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (folder_id, user_id)
);

-- 4. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    image_url TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read all profiles, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- FOLDERS: Owners can do everything, members can read
CREATE POLICY "Owners can manage folders" ON folders FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Members can view folders" ON folders FOR SELECT 
    USING (id IN (SELECT folder_id FROM folder_members WHERE user_id = auth.uid()));

-- FOLDER_MEMBERS: Owners can manage, members can read
CREATE POLICY "Owners can manage members" ON folder_members FOR ALL 
    USING (folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()));
CREATE POLICY "Members can view folder members" ON folder_members FOR SELECT
    USING (folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = auth.uid()));

-- TASKS: Owners can manage, folder members can view
CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL 
    USING (auth.uid() = user_id);
CREATE POLICY "Folder members can view tasks" ON tasks FOR SELECT 
    USING (folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = auth.uid()) 
           OR folder_id IS NULL);

-- ============================================
-- STORAGE BUCKET FOR TASK IMAGES
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('task-images', 'task-images', true);

-- Storage policies for task-images
CREATE POLICY "Anyone can view task images" ON storage.objects FOR SELECT 
    USING (bucket_id = 'task-images');
CREATE POLICY "Authenticated users can upload task images" ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'task-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own task images" ON storage.objects FOR DELETE 
    USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
