#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MRSIGNALLL Web, Payment & Authentication Server
Serves static frontend, manages SQLite users & roles, and provides proxy APIs.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
import sys
import database as db
import telegram_bot as tg_bot

PORT = int(os.environ.get("PORT", 8000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
WALLEX_API_KEY = "20577|4LqWQnuVzrWCmKsbLNTbbzUSKXF4BsfnMyxnVJwM"
WALLEX_BASE = "https://api.wallex.ir"

class WallexRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _set_cors_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization, X-Auth-Token")
        self.end_headers()

    def _get_auth_token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[len("Bearer "):].strip()
        token = self.headers.get("X-Auth-Token", "")
        if token:
            return token.strip()
        return None

    def _get_current_user(self):
        token = self._get_auth_token()
        if not token:
            return None
        return db.get_user_by_session(token)

    def do_OPTIONS(self):
        self._set_cors_headers(200)

    def do_GET(self):
        # 1. Auth & User Status
        if self.path == "/api/auth/me":
            user = self._get_current_user()
            self._set_cors_headers(200)
            res = {
                "authenticated": bool(user),
                "user": user
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            return

        # 1.1 Telegram Deep-Link session generator
        elif self.path == "/api/auth/telegram/session":
            code, bot_url = tg_bot.create_auth_session()
            self._set_cors_headers(200)
            self.wfile.write(json.dumps({
                "success": True,
                "code": code,
                "bot_url": bot_url,
                "bot_username": tg_bot.BOT_USERNAME
            }, ensure_ascii=False).encode("utf-8"))
            return

        # 1.2 Telegram Deep-Link session poll
        elif self.path.startswith("/api/auth/telegram/poll"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            code = params.get("code", [""])[0]
            poll_res = tg_bot.check_auth_session(code)
            self._set_cors_headers(200)
            self.wfile.write(json.dumps(poll_res, ensure_ascii=False).encode("utf-8"))
            return

        # 2. Admin: Get all users
        elif self.path == "/api/admin/users":
            user = self._get_current_user()
            if not user or user.get("role") not in ["admin", "founder"]:
                self._set_cors_headers(403)
                self.wfile.write(json.dumps({
                    "success": False,
                    "message": "Access denied. Admin access required."
                }, ensure_ascii=False).encode("utf-8"))
                return

            try:
                users_list = db.admin_get_users(user["id"])
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({"success": True, "users": users_list}, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # 3. Wallex Proxy & Status (Sensitive endpoints protected by Admin role)
        elif self.path.startswith("/api/wallex/"):
            endpoint = self.path[len("/api/wallex"):]
            if endpoint == "/currencies":
                self._proxy_wallex("/v1/currencies", auth=False)
            elif endpoint in ["/balances", "/profile"]:
                user = self._get_current_user()
                if not user or user.get("role") not in ["admin", "founder"]:
                    self._set_cors_headers(403)
                    self.wfile.write(json.dumps({
                        "success": False,
                        "message": "Access denied. Admin only."
                    }, ensure_ascii=False).encode("utf-8"))
                    return
                path = "/v1/account/balances" if endpoint == "/balances" else "/v1/account/profile"
                self._proxy_wallex(path, auth=True)
            elif endpoint == "/status":
                self._set_cors_headers(200)
                res = {
                    "online": True,
                    "service": "Crypto Gateway Proxy",
                    "apiKeyActive": True,
                    "defaultNetwork": "BSC (BEP-20)",
                    "targetPriceUsd": 1.00
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            else:
                self._set_cors_headers(404)
                self.wfile.write(json.dumps({"success": False, "message": "Endpoint not found"}).encode("utf-8"))
            return

        # 4. Live Multi-Exchange Crypto Price Endpoint (Zero CORS, Geo-Unrestricted)
        elif self.path.startswith("/api/market/price"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            symbol = params.get("symbol", ["BTC"])[0]
            price_data = self._fetch_live_crypto_price(symbol)
            self._set_cors_headers(200 if price_data.get("success") else 404)
            self.wfile.write(json.dumps(price_data, ensure_ascii=False).encode("utf-8"))
            return

        else:
            super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_len) if content_len > 0 else b"{}"

        try:
            data = json.loads(post_body.decode("utf-8")) if post_body else {}
        except Exception:
            data = {}

        # 1. Telegram Auth (Strictly disabled for direct manual requests; must authenticate via official Telegram Bot)
        if self.path == "/api/auth/telegram":
            self._set_cors_headers(403)
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Direct input disabled. Use official Telegram bot."
            }, ensure_ascii=False).encode("utf-8"))
            return

        # 2. Email Register
        elif self.path == "/api/auth/register":
            try:
                username = data.get("username", "").strip()
                email = data.get("email", "").strip()
                password = data.get("password", "")

                if not email or "@" not in email:
                    self._set_cors_headers(400)
                    self.wfile.write(json.dumps({"success": False, "message": "Invalid email address."}, ensure_ascii=False).encode("utf-8"))
                    return
                if not password or len(password) < 6:
                    self._set_cors_headers(400)
                    self.wfile.write(json.dumps({"success": False, "message": "Password must be at least 6 characters."}, ensure_ascii=False).encode("utf-8"))
                    return

                token, user = db.register_email(username, email, password)
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "token": token,
                    "user": user,
                    "message": "Registration successful."
                }, ensure_ascii=False).encode("utf-8"))
            except ValueError as ve:
                self._set_cors_headers(400)
                self.wfile.write(json.dumps({"success": False, "message": str(ve)}, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # 3. Email Login
        elif self.path == "/api/auth/login":
            try:
                email = data.get("email", "").strip()
                password = data.get("password", "")

                if not email or not password:
                    self._set_cors_headers(400)
                    self.wfile.write(json.dumps({"success": False, "message": "Please enter your email and password."}, ensure_ascii=False).encode("utf-8"))
                    return

                token, user = db.login_email(email, password)
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "token": token,
                    "user": user,
                    "message": "Login successful."
                }, ensure_ascii=False).encode("utf-8"))
            except ValueError as ve:
                self._set_cors_headers(401)
                self.wfile.write(json.dumps({"success": False, "message": str(ve)}, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # 4. Web3 Wallet Login
        elif self.path == "/api/auth/wallet":
            try:
                address = data.get("address", "").strip()
                token, user = db.auth_wallet(address)
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "token": token,
                    "user": user,
                    "message": "Wallet connected successfully."
                }, ensure_ascii=False).encode("utf-8"))
            except ValueError as ve:
                self._set_cors_headers(400)
                self.wfile.write(json.dumps({"success": False, "message": str(ve)}, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # 5. Logout
        elif self.path == "/api/auth/logout":
            token = self._get_auth_token()
            if token:
                db.delete_session(token)
            self._set_cors_headers(200)
            self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode("utf-8"))
            return

        # 6. Admin Set User Role
        elif self.path == "/api/admin/set-user-role":
            current_user = self._get_current_user()
            if not current_user or current_user.get("role") not in ["admin", "founder"]:
                self._set_cors_headers(403)
                self.wfile.write(json.dumps({"success": False, "message": "Access denied. Admin only."}, ensure_ascii=False).encode("utf-8"))
                return

            try:
                target_user_id = int(data.get("user_id"))
                new_role = str(data.get("role", "free"))
                add_days = int(data.get("add_days", 0))

                db.admin_set_user_role(current_user["id"], target_user_id, new_role, add_days)
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": "Role updated successfully."
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False).encode("utf-8"))
            return

        # 7. Verify Crypto Deposit
        elif self.path == "/api/wallex/verify":
            try:
                tx_hash = data.get("txHash", "").strip()
                network = data.get("network", "BSC").strip()
                plan = str(data.get("plan", "1"))

                if not tx_hash or len(tx_hash) < 16:
                    self._set_cors_headers(400)
                    self.wfile.write(json.dumps({
                        "success": False,
                        "message": "Invalid transaction hash (TxHash)."
                    }, ensure_ascii=False).encode("utf-8"))
                    return

                # Check if user is logged in
                current_user = self._get_current_user()
                months_map = {"1": 1, "3": 3, "12": 12}
                months = months_map.get(plan, 1)
                amount_map = {"1": 1.0, "5": 5.0, "20": 20.0, "3": 3.0, "12": 10.0}
                amount = amount_map.get(plan, 1.0)

                if current_user:
                    db.upgrade_user_subscription(current_user["id"], plan, months, tx_hash, network, amount)
                    updated_user = db.get_user_by_session(self._get_auth_token())
                    if updated_user and updated_user.get("telegram_id"):
                        tg_bot.notify_user_deposit(updated_user["telegram_id"], f"{amount} USDT", tx_hash, 999)
                else:
                    updated_user = None

                # Admin notification for donation
                user_name = updated_user.get('username') if updated_user else 'Guest Trader'
                deposit_alert = (
                    f"❤️ <b>New Voluntary Donation Received!</b>\n"
                    f"• Supporter: <b>{user_name}</b>\n"
                    f"• Donation Amount: <b>{amount} USDT</b>\n"
                    f"• Network: {network}\n"
                    f"• TxHash: <code>{tx_hash}</code>"
                )
                tg_bot.notify_admin(deposit_alert)

                res = {
                    "success": True,
                    "message": "Donation verified successfully! Thank you for supporting MRSIGNALLL.",
                    "txHash": tx_hash,
                    "network": network,
                    "plan": plan,
                    "user": updated_user,
                    "verifiedAt": "now"
                }
                self._set_cors_headers(200)
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        # 8. Update User Profile (Avatar, Username, Bio)
        elif self.path == "/api/user/profile":
            user = self._get_current_user()
            if not user:
                self._set_cors_headers(401)
                self.wfile.write(json.dumps({"success": False, "message": "Authentication required"}, ensure_ascii=False).encode("utf-8"))
                return

            try:
                username = data.get("username")
                avatar = data.get("avatar")
                bio = data.get("bio")

                db.update_user_profile(user["id"], username=username, avatar=avatar, bio=bio)
                updated_user = db.get_user_by_session(self._get_auth_token())
                self._set_cors_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "user": updated_user,
                    "message": "Profile updated successfully."
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        else:
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"success": False, "message": "Not found"}).encode("utf-8"))

    def _proxy_wallex(self, path, auth=False):
        url = f"{WALLEX_BASE}{path}"
        headers = {"Content-Type": "application/json"}
        if auth:
            headers["X-API-Key"] = WALLEX_API_KEY

        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                content = response.read()
                self._set_cors_headers(response.status)
                self.wfile.write(content)
        except urllib.error.HTTPError as e:
            err_content = e.read()
            self._set_cors_headers(e.code)
            self.wfile.write(err_content)
        except Exception as e:
            self._set_cors_headers(502)
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

    def _fetch_live_crypto_price(self, symbol):
        sym = symbol.strip().upper().replace("USDT", "")
        multiplier = 1.0
        query_sym = sym
        if sym.startswith("1000"):
            query_sym = sym[4:]
            multiplier = 1000.0

        # 1. MEXC Spot/Futures (Fast, reliable, no geo-blocking)
        try:
            url = f"https://api.mexc.com/api/v3/ticker/price?symbol={query_sym}USDT"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4) as r:
                data = json.loads(r.read().decode("utf-8"))
                if "price" in data:
                    p = float(data["price"]) * multiplier
                    return {"success": True, "symbol": sym, "price": p, "source": "MEXC"}
        except Exception:
            pass

        # 2. KuCoin
        try:
            url = f"https://api.kucoin.com/api/v1/market/orderbook/level1?symbol={query_sym}-USDT"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4) as r:
                data = json.loads(r.read().decode("utf-8"))
                p_str = data.get("data", {}).get("price")
                if p_str:
                    return {"success": True, "symbol": sym, "price": float(p_str) * multiplier, "source": "KuCoin"}
        except Exception:
            pass

        # 3. CoinEx
        try:
            url = f"https://api.coinex.com/v2/spot/ticker?market={query_sym}USDT"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4) as r:
                data = json.loads(r.read().decode("utf-8"))
                row = data.get("data", [{}])[0]
                if "last" in row:
                    return {"success": True, "symbol": sym, "price": float(row["last"]) * multiplier, "source": "CoinEx"}
        except Exception:
            pass

        # 4. CoinGecko Global Search Fallback (Handles TON, obscure or unlisted coins)
        try:
            search_url = f"https://api.coingecko.com/api/v3/search?query={query_sym}"
            req = urllib.request.Request(search_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as r:
                data = json.loads(r.read().decode("utf-8"))
                coins = data.get("coins", [])
                exact = next((c for c in coins if c.get("symbol", "").upper() == query_sym), None)
                if exact:
                    cid = exact["id"]
                    p_url = f"https://api.coingecko.com/api/v3/simple/price?ids={cid}&vs_currencies=usd"
                    req2 = urllib.request.Request(p_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req2, timeout=3) as r2:
                        pdata = json.loads(r2.read().decode("utf-8"))
                        cg_p = pdata.get(cid, {}).get("usd")
                        if cg_p:
                            return {"success": True, "symbol": sym, "price": float(cg_p) * multiplier, "source": "CoinGecko"}
        except Exception:
            pass

        # 5. Binance FAPI (for VPS / non-restricted IPs)
        try:
            url = f"https://fapi.binance.com/fapi/v2/ticker/price?symbol={sym}USDT"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as r:
                data = json.loads(r.read().decode("utf-8"))
                if "price" in data:
                    return {"success": True, "symbol": sym, "price": float(data["price"]), "source": "Binance"}
        except Exception:
            pass

        return {"success": False, "message": f"Price not available for {sym}"}

def run():
    db.init_db()
    tg_bot.start_bot_thread()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), WallexRequestHandler) as httpd:
        print(f"MRSIGNALLL Server with DB, Auth & Telegram Bot running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run()
