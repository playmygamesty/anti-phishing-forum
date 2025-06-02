import os
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get("SECRET_KEY", "supersecret")

# In-memory user and post data (replace with DB in real app)
users = {
    "admin": {"password": "adminpass", "role": "admin", "badges": ["admin"]},
}
posts = []

# Virustotal API key from env var
VT_API_KEY = os.environ.get("VT_API_KEY")

# Simple login system
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = users.get(username)
        if user and user["password"] == password:
            session["username"] = username
            return redirect(url_for("index"))
        return "Invalid credentials", 401
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.pop("username", None)
    return redirect(url_for("login"))

def logged_in():
    return "username" in session

def current_user():
    return session.get("username")

@app.route("/")
def index():
    if not logged_in():
        return redirect(url_for("login"))
    return render_template("index.html", posts=posts, user=current_user())

@app.route("/post", methods=["POST"])
def create_post():
    if not logged_in():
        return jsonify({"error": "Unauthorized"}), 401
    title = request.form.get("title")
    content = request.form.get("content")
    author = current_user()
    post = {
        "id": len(posts) + 1,
        "title": title,
        "content": content,
        "author": author,
        "replies": [],
    }
    posts.append(post)

    # Check for @antiphish run check URL in content
    if content and "@antiphish run check " in content:
        # extract URL
        parts = content.split("@antiphish run check ")
        if len(parts) > 1:
            url_to_check = parts[1].strip()
            report = check_url_virustotal(url_to_check)
            # Add a bot reply with the report
            bot_reply = {
                "author": "@antiphish",
                "content": f"URL Safety Report for {url_to_check}:\n{report}"
            }
            post["replies"].append(bot_reply)

    return redirect(url_for("index"))

@app.route("/post/<int:post_id>/reply", methods=["POST"])
def reply_post(post_id):
    if not logged_in():
        return jsonify({"error": "Unauthorized"}), 401
    content = request.form.get("content")
    author = current_user()
    post = next((p for p in posts if p["id"] == post_id), None)
    if not post:
        return "Post not found", 404
    reply = {"author": author, "content": content}
    post["replies"].append(reply)
    return redirect(url_for("index"))

def check_url_virustotal(url):
    if not VT_API_KEY:
        return "VirusTotal API key not configured."

    headers = {"x-apikey": VT_API_KEY}
    params = {"url": url}
    api_url = "https://www.virustotal.com/api/v3/urls"
    
    # Virustotal requires URL to be base64 encoded (without trailing '=')
    import base64
    url_bytes = url.encode()
    url_b64 = base64.urlsafe_b64encode(url_bytes).decode().strip("=")

    res = requests.get(f"https://www.virustotal.com/api/v3/urls/{url_b64}", headers=headers)
    if res.status_code == 404:
        # URL not scanned yet, submit URL for scanning
        submit_res = requests.post(api_url, headers=headers, data={"url": url})
        if submit_res.status_code != 200:
            return "Failed to submit URL for scanning."
        return "URL submitted for scanning. Please check back later."

    elif res.status_code == 200:
        data = res.json()
        stats = data["data"]["attributes"]["last_analysis_stats"]
        harmless = stats.get("harmless", 0)
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        undetected = stats.get("undetected", 0)
        total = harmless + malicious + suspicious + undetected
        report = (
            f"Total scans: {total}\n"
            f"Harmless: {harmless}\n"
            f"Malicious: {malicious}\n"
            f"Suspicious: {suspicious}\n"
            f"Undetected: {undetected}"
        )
        return report
    else:
        return f"Error from VirusTotal API: {res.status_code}"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
