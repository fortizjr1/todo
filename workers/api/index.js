export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Auth routes
    if (path === '/api/auth/register' && method === 'POST') {
      return handleRegister(request, env, corsHeaders);
    }
    if (path === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env, corsHeaders);
    }
    if (path === '/api/auth/me' && method === 'GET') {
      return handleMe(request, env, corsHeaders);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return handleLogout(request, env, corsHeaders);
    }

    // Folder routes
    if (path === '/api/folders' && method === 'GET') {
      return handleGetFolders(request, env, corsHeaders);
    }
    if (path === '/api/folders' && method === 'POST') {
      return handleCreateFolder(request, env, corsHeaders);
    }

    // Folder members
    const folderMembersMatch = path.match(/^\/api\/folders\/([\w-]+)\/members$/);
    if (folderMembersMatch) {
      const folderId = folderMembersMatch[1];
      if (method === 'POST') {
        return handleAddMember(request, env, corsHeaders, folderId);
      }
      if (method === 'GET') {
        return handleGetMembers(request, env, corsHeaders, folderId);
      }
    }

    // Task routes
    if (path === '/api/tasks' && method === 'GET') {
      return handleGetTasks(request, env, corsHeaders);
    }
    if (path === '/api/tasks' && method === 'POST') {
      return handleCreateTask(request, env, corsHeaders);
    }

    // Single task
    const taskMatch = path.match(/^\/api\/tasks\/([\w-]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (method === 'PUT') {
        return handleUpdateTask(request, env, corsHeaders, taskId);
      }
      if (method === 'DELETE') {
        return handleDeleteTask(request, env, corsHeaders, taskId);
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};

async function handleRegister(request, env, corsHeaders) {
  const { email, password, username } = await request.json();
  
  if (!email || !password || !username) {
    return json({ error: 'Missing required fields' }, 400, corsHeaders);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  try {
    await env.DB.prepare(`
      INSERT INTO users (id, email, username, password_hash)
      VALUES (?, ?, ?, ?)
    `).bind(userId, email, username, passwordHash).run();

    const token = generateToken();
    await env.SESSIONS.put(token, userId, { expirationTtl: 86400 });
    
    return json({ 
      user: { id: userId, email, username },
      token 
    }, 201, corsHeaders);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return json({ error: 'Email or username already exists' }, 400, corsHeaders);
    }
    throw error;
  }
}

async function handleLogin(request, env, corsHeaders) {
  const { email, password } = await request.json();
  
  if (!email || !password) {
    return json({ error: 'Missing email or password' }, 400, corsHeaders);
  }

  const user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();

  if (!user) {
    return json({ error: 'Invalid credentials' }, 401, corsHeaders);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: 'Invalid credentials' }, 401, corsHeaders);
  }

  const token = generateToken();
  await env.SESSIONS.put(token, user.id, { expirationTtl: 86400 });
  
  return json({ 
    user: { id: user.id, email: user.email, username: user.username },
    token 
  }, 200, corsHeaders);
}

async function handleLogout(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (userId) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.slice(7);
    if (token) {
      await env.SESSIONS.delete(token);
    }
  }
  return json({ success: true }, 200, corsHeaders);
}

async function handleMe(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const user = await env.DB.prepare(`SELECT id, email, username FROM users WHERE id = ?`).bind(userId).first();

  return json({ user }, 200, corsHeaders);
}

async function handleGetFolders(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const folders = await env.DB.prepare(`
    SELECT f.*, 
      CASE WHEN f.owner_id = ? THEN 1 ELSE 0 END as is_owner
    FROM folders f
    LEFT JOIN folder_members fm ON f.id = fm.folder_id
    WHERE f.owner_id = ? OR fm.user_id = ?
    GROUP BY f.id
    ORDER BY f.created_at DESC
  `).bind(userId, userId, userId).all();

  return json({ folders: folders.results || [] }, 200, corsHeaders);
}

async function handleCreateFolder(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { name } = await request.json();
  const folderId = crypto.randomUUID();

  await env.DB.prepare(`INSERT INTO folders (id, name, owner_id) VALUES (?, ?, ?)`)
    .bind(folderId, name, userId).run();

  await env.DB.prepare(`INSERT INTO folder_members (folder_id, user_id, role) VALUES (?, ?, 'admin')`)
    .bind(folderId, userId).run();

  return json({ 
    folder: { id: folderId, name, owner_id: userId, is_owner: 1 }
  }, 201, corsHeaders);
}

async function handleAddMember(request, env, corsHeaders, folderId) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { email } = await request.json();

  const folder = await env.DB.prepare(`SELECT * FROM folders WHERE id = ? AND owner_id = ?`)
    .bind(folderId, userId).first();

  if (!folder) {
    return json({ error: 'Not authorized' }, 403, corsHeaders);
  }

  const targetUser = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first();

  if (!targetUser) {
    return json({ error: 'User not found' }, 404, corsHeaders);
  }

  try {
    await env.DB.prepare(`INSERT INTO folder_members (folder_id, user_id, role) VALUES (?, ?, 'member')`)
      .bind(folderId, targetUser.id).run();
  } catch (e) {
    // Already a member
  }

  return json({ success: true }, 200, corsHeaders);
}

async function handleGetMembers(request, env, corsHeaders, folderId) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const members = await env.DB.prepare(`
    SELECT u.id, u.username, u.email, fm.role
    FROM folder_members fm
    JOIN users u ON fm.user_id = u.id
    WHERE fm.folder_id = ?
  `).bind(folderId).all();

  const owner = await env.DB.prepare(`SELECT owner_id FROM folders WHERE id = ?`).bind(folderId).first();
  const ownerUser = await env.DB.prepare(`SELECT id, username, email FROM users WHERE id = ?`)
    .bind(owner.owner_id).first();

  const allMembers = [
    { ...ownerUser, role: 'owner', is_owner: true },
    ...(members.results || []).map(m => ({ ...m, is_owner: false }))
  ];

  return json({ members: allMembers }, 200, corsHeaders);
}

async function handleGetTasks(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const url = new URL(request.url);
  const folderId = url.searchParams.get('folder_id');

  let tasks;
  if (folderId === 'null' || folderId === '' || !folderId) {
    tasks = await env.DB.prepare(`
      SELECT * FROM tasks WHERE user_id = ? AND folder_id IS NULL ORDER BY due_date ASC
    `).bind(userId).all();
  } else if (folderId === 'all') {
    tasks = await env.DB.prepare(`
      SELECT t.* FROM tasks t
      LEFT JOIN folder_members fm ON t.folder_id = fm.folder_id
      WHERE t.user_id = ? OR fm.user_id = ?
      ORDER BY t.due_date ASC
    `).bind(userId, userId).all();
  } else {
    tasks = await env.DB.prepare(`
      SELECT t.* FROM tasks t
      LEFT JOIN folder_members fm ON t.folder_id = fm.folder_id
      WHERE (t.user_id = ? OR fm.user_id = ?) AND t.folder_id = ?
      ORDER BY t.due_date ASC
    `).bind(userId, userId, folderId).all();
  }

  return json({ tasks: tasks.results || [] }, 200, corsHeaders);
}

async function handleCreateTask(request, env, corsHeaders) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { title, description, due_date, folder_id, image_url } = await request.json();
  const taskId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO tasks (id, title, description, due_date, folder_id, image_url, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(taskId, title, description || null, due_date, folder_id || null, image_url || null, userId).run();

  return json({ 
    task: { id: taskId, title, description, due_date, folder_id, image_url, user_id: userId, completed: 0 }
  }, 201, corsHeaders);
}

async function handleUpdateTask(request, env, corsHeaders, taskId) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const { title, description, due_date, completed, image_url } = await request.json();

  const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`)
    .bind(taskId, userId).first();

  if (!task) {
    return json({ error: 'Not authorized' }, 403, corsHeaders);
  }

  await env.DB.prepare(`
    UPDATE tasks SET title = ?, description = ?, due_date = ?, completed = ?, image_url = ?
    WHERE id = ?
  `).bind(
    title ?? task.title,
    description ?? task.description,
    due_date ?? task.due_date,
    completed !== undefined ? (completed ? 1 : 0) : task.completed,
    image_url ?? task.image_url,
    taskId
  ).run();

  return json({ success: true }, 200, corsHeaders);
}

async function handleDeleteTask(request, env, corsHeaders, taskId) {
  const userId = await authenticate(request, env);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  await env.DB.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).bind(taskId, userId).run();

  return json({ success: true }, 200, corsHeaders);
}

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  
  try {
    const userId = await env.SESSIONS.get(token);
    return userId || null;
  } catch {
    return null;
  }
}

function generateToken() {
  return crypto.randomUUID();
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
}
