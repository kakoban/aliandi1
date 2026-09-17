#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MRSIGNALLL Official Telegram Bot Integration
Features:
1. Deep-link secure bot authentication (/start login_CODE)
2. Mandatory Channel Membership Verification (@MRSIGNALLL) before web access
3. Direct English welcome message & Bitunix 30% Fee Cashback referral campaign
4. Instant Admin notifications on new registrations and voluntary donations
Zero external dependencies (pure urllib + threading).
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import threading
import time
import secrets
import os
import database as db

BOT_TOKEN = "8832981624:AAHBXdOq7qVRTyGh6TziXbcxCVBYBXY00-U"
BOT_USERNAME = "mrsignallo_bot"
OFFICIAL_CHANNEL = "@MRSIGNALLL"
REFERRAL_LINK = "https://www.bitunix.com/register?vipCode=gNLc4507"
REFERRAL_CODE = "gNLc4507"
TELEGRAM_API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"

# In-memory pending auth sessions: { code: { 'created_at': float, 'verified': bool, 'token': str, 'user': dict } }
pending_auth_sessions = {}
# Known admin chat IDs
admin_chat_ids = set()

def send_telegram_request(method, payload):
    url = f"{TELEGRAM_API_BASE}/{method}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return {"ok": False, "error": str(e)}

def is_channel_member(user_id):
    """
    Checks if a user is an active member of @MRSIGNALLL
    """
    if not user_id:
        return False
    payload = {
        "chat_id": OFFICIAL_CHANNEL,
        "user_id": int(user_id)
    }
    res = send_telegram_request("getChatMember", payload)
    if not res.get("ok"):
        return False
    status = res.get("result", {}).get("status", "")
    return status in ["creator", "administrator", "member", "restricted"]

def send_message(chat_id, text, parse_mode="HTML", reply_markup=None):
    if not chat_id:
        return False
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    res = send_telegram_request("sendMessage", payload)
    return res.get("ok", False)

def answer_callback_query(callback_id, text=None, show_alert=False):
    payload = {"callback_query_id": callback_id}
    if text:
        payload["text"] = text
        payload["show_alert"] = show_alert
    return send_telegram_request("answerCallbackQuery", payload)

def notify_admin(text):
    def _worker():
        try:
            conn = db.get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT telegram_id FROM users WHERE role IN ('admin', 'founder') AND telegram_id IS NOT NULL")
            rows = cursor.fetchall()
            for r in rows:
                if r['telegram_id']:
                    admin_chat_ids.add(str(r['telegram_id']))
            conn.close()
        except Exception:
            pass

        for cid in list(admin_chat_ids):
            if cid:
                send_message(cid, text)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

def notify_user_welcome(chat_id, user_dict):
    """
    Sends English welcome message with account details & Bitunix referral showcase
    """
    def _worker():
        username = user_dict.get('username') or user_dict.get('telegram_username') or 'Trader'
        role = user_dict.get('role', 'free')
        role_en = "System Founder 👑" if role == "founder" else ("System Admin 🛡️" if role == "admin" else "Verified Free Trader 💎")

        referral_keyboard = {
            "inline_keyboard": [
                [{"text": "🎁 Claim 30% Fee Cashback on Bitunix ↗", "url": REFERRAL_LINK}],
                [{"text": "📢 Join Official Channel (@MRSIGNALLL)", "url": "https://t.me/MRSIGNALLL"}]
            ]
        }

        msg = (
            f"🎉 <b>Membership Confirmed! Welcome, {username}!</b>\n\n"
            f"Your account is now verified and connected to the <b>MRSIGNALLL Pro Futures Platform</b>.\n\n"
            f"🔹 <b>Account Tier:</b> {role_en}\n"
            f"⚡ <b>Platform Access:</b> 100% Free & Unlocked\n"
            f"💎 <b>Tools Ready:</b> Risk Sizing, Isolated Liquidation Engine, Multi-TP Ladder & Pine Script Indicator.\n\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🎁 <b>EXCLUSIVE TRADING BENEFIT: 30% FEE CASHBACK</b>\n"
            f"Trading fees are the silent killer draining your PnL. Over a month of active trading, those cuts add up to hundreds of dollars.\n\n"
            f"Through our official <b>Bitunix × Mr. Signal</b> partnership, you unlock:\n\n"
            f"• <b>30% Direct Fee Cashback:</b> Returned directly to your wallet on every trade.\n"
            f"• <b>Up to 500 USDT in Deposit Vouchers:</b> Deposit & trade bonuses.\n"
            f"• <b>Lowest Base Fee Brackets</b> & Private Trading Competitions.\n\n"
            f"👉 <b>Register & Activate 30% Cashback:</b>\n"
            f"{REFERRAL_LINK}\n"
            f"<b>Promo Code:</b> <code>{REFERRAL_CODE}</code>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🌐 <i>Precision Before Position · MRSIGNALLL</i>"
        )
        send_message(chat_id, msg, reply_markup=referral_keyboard)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

def notify_user_deposit(chat_id, plan_name, tx_hash, days=None):
    def _worker():
        msg = (
            f"❤️ <b>Thank you for your generous donation!</b>\n\n"
            f"Your voluntary support of <b>{plan_name}</b> has been verified.\n"
            f"🔗 <b>Transaction Hash:</b> <code>{tx_hash[:20]}...</code>\n\n"
            f"We deeply appreciate your help in keeping MRSIGNALLL 100% free and maintaining our servers. Wishing you profitable trades! 🌹"
        )
        send_message(chat_id, msg)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

# Deep link session management for Website <-> Bot Login
def create_auth_session():
    now = time.time()
    expired = [k for k, v in pending_auth_sessions.items() if now - v.get('created_at', 0) > 600]
    for k in expired:
        pending_auth_sessions.pop(k, None)

    code = secrets.token_hex(12)
    pending_auth_sessions[code] = {
        'created_at': now,
        'verified': False,
        'token': None,
        'user': None
    }
    bot_url = f"https://t.me/{BOT_USERNAME}?start=login_{code}"
    return code, bot_url

def check_auth_session(code):
    if not code or code not in pending_auth_sessions:
        return {'verified': False, 'error': 'Session expired'}
    session_data = pending_auth_sessions[code]
    if session_data.get('verified'):
        res = {
            'verified': True,
            'token': session_data.get('token'),
            'user': session_data.get('user')
        }
        pending_auth_sessions.pop(code, None)
        return res
    return {'verified': False}

def send_membership_required_prompt(chat_id, first_name, code=None):
    """
    Sends English prompt requiring user to join @MRSIGNALLL channel first
    """
    cb_data = f"check_sub_{code}" if code else "check_sub_none"
    keyboard = {
        "inline_keyboard": [
            [{"text": "📢 1. Join @MRSIGNALLL Channel", "url": "https://t.me/MRSIGNALLL"}],
            [{"text": "✅ 2. I Have Joined · Verify & Continue", "callback_data": cb_data}]
        ]
    }
    text = (
        f"👋 <b>Welcome to MRSIGNALLL, {first_name}!</b>\n\n"
        f"🔒 <b>Action Required: Channel Membership</b>\n"
        f"To activate your free access to the <b>MRSIGNALLL Pro Futures Platform</b>, you must be a member of our official Telegram channel:\n\n"
        f"👉 <b>@MRSIGNALLL</b>\n\n"
        f"<i>1. Tap the button below to join the channel.\n"
        f"2. Tap 'I Have Joined · Verify & Continue' to finish authentication.</i>"
    )
    send_message(chat_id, text, reply_markup=keyboard)

def complete_user_login(user_id, username, first_name, chat_id, code=None):
    """
    Authenticates user in database, resolves web session and sends English welcome
    """
    token, user_dict = db.auth_telegram(
        telegram_id=user_id,
        username=username,
        display_name=first_name
    )

    if code and code in pending_auth_sessions:
        pending_auth_sessions[code]['verified'] = True
        pending_auth_sessions[code]['token'] = token
        pending_auth_sessions[code]['user'] = user_dict

    notify_user_welcome(chat_id, user_dict)

    admin_alert = (
        f"🔔 <b>New Verified Member (via Telegram Bot):</b>\n"
        f"• User: <b>{first_name}</b> (@{username or 'no_username'})\n"
        f"• ID: <code>{user_id}</code>\n"
        f"• Channel Member: <b>Yes (Verified)</b>\n"
        f"• Role: <b>{user_dict.get('role')}</b>"
    )
    notify_admin(admin_alert)

# Background Telegram Long-Polling Thread
def bot_polling_loop():
    last_update_id = 0
    while True:
        try:
            url = f"{TELEGRAM_API_BASE}/getUpdates?offset={last_update_id + 1}&timeout=5"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if data.get('ok'):
                for update in data.get('result', []):
                    last_update_id = max(last_update_id, update.get('update_id', 0))
                    handle_update(update)
        except Exception:
            time.sleep(3)

def handle_update(update):
    # 1. Handle Callback Queries (User clicks "I Have Joined · Verify & Continue")
    if 'callback_query' in update:
        cb = update['callback_query']
        cb_id = cb.get('id')
        cb_data = cb.get('data', '')
        from_user = cb.get('from', {})
        user_id = from_user.get('id')
        username = from_user.get('username') or ''
        first_name = from_user.get('first_name') or 'Trader'
        chat_id = cb.get('message', {}).get('chat', {}).get('id') or user_id

        if cb_data.startswith('check_sub_'):
            code = cb_data[len('check_sub_'):]
            if code == 'none':
                code = None

            # Verify real channel membership
            if is_channel_member(user_id):
                answer_callback_query(cb_id, text="✅ Channel membership verified! Welcome to MRSIGNALLL.")
                complete_user_login(user_id, username, first_name, chat_id, code)
            else:
                answer_callback_query(
                    cb_id,
                    text="⚠️ You have not joined @MRSIGNALLL yet! Please join the channel first, then tap Verify.",
                    show_alert=True
                )
        return

    # 2. Handle Regular Messages
    msg = update.get('message', {})
    if not msg:
        return

    chat = msg.get('chat', {})
    chat_id = chat.get('id')
    from_user = msg.get('from', {})
    user_id = from_user.get('id')
    username = from_user.get('username') or ''
    first_name = from_user.get('first_name') or 'Trader'
    text = (msg.get('text') or '').strip()

    username_lower = username.lower()
    is_founder = (username_lower == 'the_foundder')
    is_admin = (username_lower == 'havaeiop')

    if chat_id and (is_founder or is_admin):
        admin_chat_ids.add(str(chat_id))

    if text.startswith('/start'):
        parts = text.split()
        code = None
        if len(parts) > 1 and parts[1].startswith('login_'):
            code = parts[1][len('login_'):].strip()

        # Check channel membership
        if is_channel_member(user_id):
            complete_user_login(user_id, username, first_name, chat_id, code)
        else:
            # Must join channel first!
            send_membership_required_prompt(chat_id, first_name, code)

        if is_admin:
            send_message(chat_id, "🛡️ <b>Admin Mode Active:</b> You will receive all registration and donation alerts.")
        elif is_founder:
            send_message(chat_id, "👑 <b>Founder Mode Active:</b> MRSIGNALLL system is running and monitored.")

def start_bot_thread():
    t = threading.Thread(target=bot_polling_loop, daemon=True)
    t.start()
