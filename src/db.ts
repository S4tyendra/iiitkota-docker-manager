import { Database } from 'bun:sqlite';
import { join } from 'path';
import { CONFIG } from './config';
import type { User, Permission } from './types';
import { existsSync, mkdirSync } from 'fs';

const dbDir = join(CONFIG.PATHS.ENV_BASE_DIR, '..', 'data');
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new Database(join(dbDir, 'users.sqlite'));

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    action TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

export const DB = {
  get allUsers() {
    const users = db.query("SELECT id, username, is_admin FROM users").all() as Partial<User>[];
    for (const user of users) {
      user.is_admin = Boolean(user.is_admin);
      user.permissions = db.query("SELECT scope, action FROM permissions WHERE user_id = ?").all(user.id) as Permission[];
    }
    return users;
  },

  createUser(username: string, passwordHash: string): number | bigint {
    return db.query("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, passwordHash).lastInsertRowid;
  },

  deleteUser(username: string) {
    db.query("DELETE FROM users WHERE username = ?").run(username);
  },

  getUser(username: string): User | null {
    const user = db.query("SELECT * FROM users WHERE username = ?").get(username) as User | null;
    if (!user) return null;
    
    // Convert is_admin to boolean (sqlite stores as 0/1)
    user.is_admin = Boolean(user.is_admin);

    const perms = db.query("SELECT scope, action FROM permissions WHERE user_id = ?").all(user.id) as Permission[];
    user.permissions = perms;
    return user;
  },

  updatePermissions(userId: number, permissions: Permission[]) {
    db.transaction(() => {
      db.query("DELETE FROM permissions WHERE user_id = ?").run(userId);
      const insert = db.prepare("INSERT INTO permissions (user_id, scope, action) VALUES (?, ?, ?)");
      for (const p of permissions) {
        insert.run(userId, p.scope, p.action);
      }
    })();
  },
  
  updatePassword(username: string, hash: string) {
    db.query("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, username);
  },

  checkPermission(user: User, scope: string, action: string): boolean {
    if (user.is_admin) return true; // Super admin
    
    return user.permissions.some(p => {
      // Scope
      if (p.scope !== scope && p.scope !== 'global') return false;

      // Action
      if (p.action === action) return true;

      // Inheritance logic
      if (action === 'view_configuration' && p.action === 'edit_configuration') return true;
      if (action === 'view_env' && p.action === 'edit_env') return true;
      if (action === 'view_status' && p.action === 'manage') return true;

      return false;
    });
  }
};
