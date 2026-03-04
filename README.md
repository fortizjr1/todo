# Team Task Management Application

A collaborative task management app with personal workspaces and shared folders, featuring image attachments, due dates, and team management.

## Tech Stack

- **Frontend**: Astro + Tailwind CSS
- **Backend**: Self-hosted Supabase (Auth, Database, Storage)
- **Deployment**: Cloudflare Pages

## Features

- **Personal Tasks**: "My Workspace" for individual tasks
- **Shared Folders**: Create folders and invite team members
- **Task Details**: Title, description, due date, image attachments
- **Team Management**: Add/remove members to folders
- **Authentication**: Secure username/password login

## Design

Developer-Focused Minimal Brutalism aesthetic:
- High-contrast black/white with electric blue accent (#0066FF)
- Monospace typography
- Clear borders and structured layout

## Setup Instructions

### 1. Supabase Setup

1. **Start a self-hosted Supabase instance** or use cloud.supabase.com

2. **Run the database schema**:
   ```bash
   psql -h your-supabase-host postgres -U postgres -f supabase-schema.sql
   ```

3. **Create a storage bucket** for images:
   - Go to Storage in Supabase dashboard
   - Create bucket named `task-images` (public)

4. **Get your credentials**:
   - Supabase URL: Found in project settings
   - Supabase Anon Key: Found in project settings (API settings)

### 2. Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Supabase credentials:
   ```
   PUBLIC_SUPABASE_URL=your_supabase_url
   PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. Open http://localhost:4321

### 3. Deployment to Cloudflare Pages

1. **Connect to Cloudflare Pages**:
   - Push your code to GitHub
   - Go to Cloudflare Dashboard > Pages
   - Connect your GitHub repository

2. **Configure build settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`

3. **Add environment variables** in Cloudflare Pages settings:
   - `PUBLIC_SUPABASE_URL`: Your Supabase URL
   - `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

4. **Deploy**

### 4. Wrangler (Optional CLI Deployment)

```bash
npx wrangler pages deploy dist
```

## Project Structure

```
src/
├── layouts/           # Page layouts
├── lib/
│   └── supabase.ts  # Supabase client
├── pages/
│   ├── index.astro   # Root redirect
│   ├── login.astro   # Login/register page
│   ├── dashboard.astro   # Main dashboard
│   └── folder/
│       └── [id].astro    # Folder view
└── styles/
    └── global.css   # Tailwind + custom styles
```

## Security Notes

- Supabase anon key is safe to expose (used for client-side auth)
- RLS (Row Level Security) policies enforce data isolation
- Image uploads are validated for type and size
- All sensitive operations happen server-side
