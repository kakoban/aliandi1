#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MRSIGNALLL SQLite Database & Authentication Manager
Zero external dependencies, robust persistence for users, roles, sessions and transactions.
"""

import sqlite3
import os
import hashlib
import secrets
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mrsignalll.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        telegram_id TEXT UNIQUE,
        telegram_username TEXT,
        wallet_address TEXT UNIQUE,
        auth_provider TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'free',
        plan TEXT DEFAULT 'none',
        subscription_expires_at INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
    ''')

    # 2. Sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    ''')

    # 3. Transactions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        tx_hash TEXT UNIQUE NOT NULL,
        network TEXT NOT NULL,
        plan TEXT NOT NULL,
        amount REAL NOT NULL,
        verified_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')

    conn.commit()

    # Columns migration for profile & Discord-style badges
    for col, c_type in [("avatar", "TEXT DEFAULT ''"), ("bio", "TEXT DEFAULT ''"), ("badges", "TEXT DEFAULT ''")]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {c_type}")
        except Exception:
            pass
    conn.commit()

    now_ms = int(time.time() * 1000)
    lifetime_ms = now_ms + (100 * 365 * 24 * 60 * 60 * 1000) # 100 years

    # 1. Ensure Founder account (@the_foundder)
    cursor.execute("SELECT id FROM users WHERE LOWER(telegram_username) = 'the_foundder'")
    founder_row = cursor.fetchone()
    if founder_row:
        cursor.execute("UPDATE users SET role = 'founder', plan = 'lifetime', subscription_expires_at = ?, username = 'MRSIGNALLL Founder (@the_foundder)' WHERE id = ?", (lifetime_ms, founder_row['id']))
    else:
        cursor.execute('''
        INSERT INTO users (username, telegram_username, auth_provider, role, plan, subscription_expires_at, created_at, updated_at)
        VALUES (?, 'the_foundder', 'telegram', 'founder', 'lifetime', ?, ?, ?)
        ''', ('MRSIGNALLL Founder (@the_foundder)', lifetime_ms, now_ms, now_ms))

    # 2. Ensure Admin account (@Havaeiop)
    cursor.execute("SELECT id FROM users WHERE LOWER(telegram_username) = 'havaeiop'")
    admin_row = cursor.fetchone()
    if admin_row:
        cursor.execute("UPDATE users SET role = 'admin', plan = 'lifetime', subscription_expires_at = ?, username = 'System Admin (@Havaeiop)' WHERE id = ?", (lifetime_ms, admin_row['id']))
    else:
        cursor.execute('''
        INSERT INTO users (username, telegram_username, auth_provider, role, plan, subscription_expires_at, created_at, updated_at)
        VALUES (?, 'Havaeiop', 'telegram', 'admin', 'lifetime', ?, ?, ?)
        ''', ('System Admin (@Havaeiop)', lifetime_ms, now_ms, now_ms))

    conn.commit()
    conn.close()

# Password Security
def hash_password(password, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}${hashed}"

def verify_password(stored_password, provided_password):
    if not stored_password or '$' not in stored_password:
        return False
    salt, hashed = stored_password.split('$', 1)
    return hash_password(provided_password, salt) == stored_password

# Session Management
def create_session(user_id):
    conn = get_db()
    cursor = conn.cursor()
    token = secrets.token_hex(32)
    now = int(time.time())
    expires_at = now + (30 * 24 * 60 * 60) # 30 days

    cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires_at))
    conn.commit()
    conn.close()
    return token

def delete_session(token):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def format_user_dict(row):
    if not row:
        return None
    user = dict(row)
    # Remove sensitive hash
    user.pop('password_hash', None)

    now_ms = int(time.time() * 1000)
    exp = user.get('subscription_expires_at') or 0
    role = user.get('role', 'free')

    is_privileged = role in ['admin', 'founder']
    is_active = is_privileged or (exp > now_ms)
    days_left = 9999 if is_privileged else max(0, int((exp - now_ms) / (1000 * 60 * 60 * 24)))

    user['subscription'] = {
        'active': is_active,
        'daysLeft': days_left,
        'expiresAt': exp,
        'plan': 'lifetime' if is_privileged else user.get('plan', 'none')
    }

    user['avatar'] = user.get('avatar') or ''
    user['bio'] = user.get('bio') or ''

    # Discord-style profile badges
    badges = []
    if role == 'founder':
        badges.append({'id': 'founder', 'label': 'Founder', 'icon': '👑', 'color': '#F0B90B', 'desc': 'MRSIGNALLL Creator & Lead Architect'})
    if role in ['admin', 'founder']:
        badges.append({'id': 'admin', 'label': 'Staff', 'icon': '🛡️', 'color': '#2AABEE', 'desc': 'Platform Administrator'})
    if exp > now_ms or user.get('plan') in ['1', '3', '5', '12', '20', 'lifetime']:
        badges.append({'id': 'supporter', 'label': 'Patron', 'icon': '💛', 'color': '#0ECB81', 'desc': 'Server Supporter & Backer'})
    if user.get('telegram_id'):
        badges.append({'id': 'tg_verified', 'label': 'Verified', 'icon': '🤖', 'color': '#229ED9', 'desc': 'Connected via Official Telegram Bot'})
    if user.get('wallet_address'):
        badges.append({'id': 'web3', 'label': 'Web3', 'icon': '🌐', 'color': '#F6851B', 'desc': 'Web3 Wallet Connected'})
    badges.append({'id': 'trader', 'label': 'Pro Trader', 'icon': '⚡', 'color': '#FCD535', 'desc': 'Precision Futures Trader'})

    user['badges'] = badges
    return user

def update_user_profile(user_id, username=None, avatar=None, bio=None):
    conn = get_db()
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)
    updates = []
    params = []

    if username is not None and username.strip():
        updates.append("username = ?")
        params.append(username.strip()[:40])
    if avatar is not None:
        updates.append("avatar = ?")
        params.append(avatar.strip()[:2000])
    if bio is not None:
        updates.append("bio = ?")
        params.append(bio.strip()[:160])

    if updates:
        updates.append("updated_at = ?")
        params.append(now_ms)
        params.append(user_id)
        sql = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(sql, tuple(params))
        conn.commit()

    conn.close()
    return True

def get_user_by_session(token):
    if not token:
        return None
    conn = get_db()
    cursor = conn.cursor()
    now = int(time.time())

    cursor.execute('''
    SELECT u.* FROM users u
    JOIN sessions s ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
    ''', (token, now))
    row = cursor.fetchone()
    conn.close()
    return format_user_dict(row)

# Authentication Providers
def auth_telegram(telegram_id=None, username=None, display_name=None):
    conn = get_db()
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)

    clean_username = username.lstrip('@').strip() if username else None
    display = display_name or (f"@{clean_username}" if clean_username else f"User_{telegram_id or 'tg'}")

    # Check if user already exists
    user = None
    if telegram_id:
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (str(telegram_id),))
        user = cursor.fetchone()
    if not user and clean_username:
        cursor.execute("SELECT * FROM users WHERE LOWER(telegram_username) = LOWER(?)", (clean_username,))
        user = cursor.fetchone()

    clean_lower = clean_username.lower() if clean_username else ''
    is_founder = (clean_lower == 'the_foundder')
    is_admin = (clean_lower == 'havaeiop')

    if user:
        user_id = user['id']
        lifetime_ms = now_ms + (100 * 365 * 24 * 60 * 60 * 1000)
        if is_founder and user['role'] != 'founder':
            cursor.execute("UPDATE users SET role = 'founder', plan = 'lifetime', subscription_expires_at = ?, username = 'MRSIGNALLL Founder (@the_foundder)', updated_at = ? WHERE id = ?", (lifetime_ms, now_ms, user_id))
            conn.commit()
        elif is_admin and user['role'] != 'admin':
            cursor.execute("UPDATE users SET role = 'admin', plan = 'lifetime', subscription_expires_at = ?, username = 'System Admin (@Havaeiop)', updated_at = ? WHERE id = ?", (lifetime_ms, now_ms, user_id))
            conn.commit()
    else:
        # Create new user
        if is_founder:
            role = 'founder'
            plan = 'lifetime'
            exp = now_ms + (100 * 365 * 24 * 60 * 60 * 1000)
            display = 'MRSIGNALLL Founder (@the_foundder)'
        elif is_admin:
            role = 'admin'
            plan = 'lifetime'
            exp = now_ms + (100 * 365 * 24 * 60 * 60 * 1000)
            display = 'System Admin (@Havaeiop)'
        else:
            role = 'free'
            plan = 'none'
            exp = 0

        cursor.execute('''
        INSERT INTO users (username, telegram_id, telegram_username, auth_provider, role, plan, subscription_expires_at, created_at, updated_at)
        VALUES (?, ?, ?, 'telegram', ?, ?, ?, ?, ?)
        ''', (display, str(telegram_id) if telegram_id else None, clean_username, role, plan, exp, now_ms, now_ms))
        conn.commit()
        user_id = cursor.lastrowid

    conn.close()
    token = create_session(user_id)
    return token, get_user_by_session(token)

def register_email(username, email, password):
    conn = get_db()
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)

    clean_email = email.strip().lower()
    clean_username = username.strip() if username else clean_email.split('@')[0]

    # Check if exists
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (clean_email,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Email already registered")

    pwd_hash = hash_password(password)

    cursor.execute('''
    INSERT INTO users (username, email, password_hash, auth_provider, role, plan, subscription_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, 'email', 'free', 'none', 0, ?, ?)
    ''', (clean_username, clean_email, pwd_hash, now_ms, now_ms))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    token = create_session(user_id)
    return token, get_user_by_session(token)

def login_email(email, password):
    conn = get_db()
    cursor = conn.cursor()
    clean_email = email.strip().lower()

    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (clean_email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(user['password_hash'], password):
        raise ValueError("Invalid email or password")

    token = create_session(user['id'])
    return token, get_user_by_session(token)

def auth_wallet(wallet_address):
    if not wallet_address or len(wallet_address) < 20:
        raise ValueError("Invalid wallet address")

    conn = get_db()
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)
    norm_address = wallet_address.strip().lower()
    short_display = f"{norm_address[:6]}...{norm_address[-4:]}"

    cursor.execute("SELECT * FROM users WHERE LOWER(wallet_address) = ?", (norm_address,))
    user = cursor.fetchone()

    if user:
        user_id = user['id']
    else:
        cursor.execute('''
        INSERT INTO users (username, wallet_address, auth_provider, role, plan, subscription_expires_at, created_at, updated_at)
        VALUES (?, ?, 'wallet', 'free', 'none', 0, ?, ?)
        ''', (short_display, norm_address, now_ms, now_ms))
        conn.commit()
        user_id = cursor.lastrowid

    conn.close()
    token = create_session(user_id)
    return token, get_user_by_session(token)

# Subscription & Transaction Linking
def upgrade_user_subscription(user_id, plan_code, plan_months, tx_hash, network='BSC', amount=1.0):
    conn = get_db()
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)

    # Get current user expiration
    cursor.execute("SELECT subscription_expires_at, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    duration_ms = plan_months * 30 * 24 * 60 * 60 * 1000
    current_exp = user['subscription_expires_at'] if user else 0

    new_exp = (max(now_ms, current_exp)) + duration_ms
    new_role = 'admin' if user and user['role'] == 'admin' else 'premium'

    cursor.execute('''
    UPDATE users
    SET role = ?, plan = ?, subscription_expires_at = ?, updated_at = ?
    WHERE id = ?
    ''', (new_role, str(plan_code), new_exp, now_ms, user_id))

    # Record transaction
    if tx_hash:
        try:
            cursor.execute('''
            INSERT INTO transactions (user_id, tx_hash, network, plan, amount, verified_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, tx_hash, network, str(plan_code), amount, now_ms))
        except sqlite3.IntegrityError:
            pass # already recorded

    conn.commit()
    conn.close()

# Admin Features
def admin_get_users(admin_user_id):
    # Verify admin
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (admin_user_id,))
    req_user = cursor.fetchone()
    if not req_user or req_user['role'] not in ['admin', 'founder']:
        conn.close()
        raise PermissionError("Access denied. Admin access required.")

    cursor.execute('''
    SELECT id, username, email, telegram_username, wallet_address, auth_provider, role, plan, subscription_expires_at, created_at
    FROM users
    ORDER BY id DESC
    ''')
    rows = cursor.fetchall()
    conn.close()

    now_ms = int(time.time() * 1000)
    users_list = []
    for r in rows:
        u = dict(r)
        exp = u.get('subscription_expires_at') or 0
        role = u.get('role', 'free')
        is_priv = role in ['admin', 'founder']
        u['is_active'] = is_priv or (exp > now_ms)
        u['days_left'] = 9999 if is_priv else max(0, int((exp - now_ms) / (1000 * 60 * 60 * 24)))
        users_list.append(u)
    return users_list

def admin_set_user_role(admin_user_id, target_user_id, new_role, add_days=0):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (admin_user_id,))
    req_user = cursor.fetchone()
    if not req_user or req_user['role'] not in ['admin', 'founder']:
        conn.close()
        raise PermissionError("Access denied. Admin access required.")

    now_ms = int(time.time() * 1000)
    cursor.execute("SELECT subscription_expires_at FROM users WHERE id = ?", (target_user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise ValueError("User not found")

    current_exp = target['subscription_expires_at'] or 0
    if new_role == 'admin':
        new_exp = now_ms + (100 * 365 * 24 * 60 * 60 * 1000)
        plan = 'lifetime'
    elif add_days > 0:
        new_exp = max(now_ms, current_exp) + (add_days * 24 * 60 * 60 * 1000)
        plan = 'custom'
    else:
        new_exp = current_exp
        plan = 'free' if new_role == 'free' else 'active'

    cursor.execute('''
    UPDATE users
    SET role = ?, plan = ?, subscription_expires_at = ?, updated_at = ?
    WHERE id = ?
    ''', (new_role, plan, new_exp, now_ms, target_user_id))
    conn.commit()
    conn.close()
    return True

# Initialize on module load
init_db()
