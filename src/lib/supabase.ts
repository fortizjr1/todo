import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'dummy-key'
);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
      };
      folders: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
      };
      folder_members: {
        Row: {
          folder_id: string;
          user_id: string;
          role: 'member' | 'admin';
          joined_at: string;
        };
        Insert: {
          folder_id: string;
          user_id: string;
          role: 'member' | 'admin';
          joined_at?: string;
        };
        Update: {
          folder_id?: string;
          user_id?: string;
          role?: 'member' | 'admin';
          joined_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          folder_id: string | null;
          user_id: string;
          title: string;
          description: string | null;
          due_date: string;
          image_url: string | null;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          folder_id?: string | null;
          user_id: string;
          title: string;
          description?: string | null;
          due_date: string;
          image_url?: string | null;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          folder_id?: string | null;
          user_id?: string;
          title?: string;
          description?: string | null;
          due_date?: string;
          image_url?: string | null;
          completed?: boolean;
          created_at?: string;
        };
      };
    };
  };
};
