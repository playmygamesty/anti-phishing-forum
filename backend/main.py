import os
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
import base64
import requests

app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get("SECRET_KEY", "supersecret")

# Connect to MongoDB
MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client['antiphish_forum']

users_col = db['users']
posts_col = db['posts']

# Signup
@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        existing_user = users_col.find_one({"username": username})
        if existing_user:
            return "Username already exists!", 400
        users_col.insert_one({
            "username": username,
            "password": password,
            "role": "user",
            "badges": []
        })
        return redirect(url_for("login"))
    return render_template("signup.html")

# Login
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = users_col.find_one({"username": username})
        if user and user["password"] == password:
            session["username"] = user["username"]
            return redirect(url_for("index"))
        return "Invalid credentials", 401
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

def logged_in():
    return "username" in session

def current_user():
    if not logged_in():
        return None
    return users_col.find_one({"username": session["username"]})

@app.route("/")
def index():
    if not logged_in():
        return redirect(url_for("login"))
    user = current_user()
    posts = list(posts_col.find())
    return render_template("index.html", posts=posts, user=user)

@app.route("/post", methods=["POST"])
def create_post():
    if not logged_in():
        return jsonify({"error": "Unauthorized"}), 401
    title = request.form.get("title")
    content = request.form.get("content")
    author = current_user()
    post = {
        "title": title,
        "content": content,
        "author": author["username"],
        "replies": []
    }
    post_id = posts_col.insert_one(post).inserted_id

    if "@antiphish run check " in content:
        url_to_check = content.split("@antiphish run check ")[1].strip()
        report = check_url_virustotal(url_to_check)
        bot_reply = {
            "author": "@antiphish",
            "content": f"URL Safety Report for {url_to_check}:\n{report}"
        }
        posts_col.update_one({"_id": post_id}, {"$push": {"replies": bot_reply}})

    return redirect(url_for("index"))

@app.route("/post/<post_id>/reply", methods=["POST"])
def reply_post(post_id):
    if not logged_in():
        return jsonify({"error": "Unauthorized"}), 401
    content = request.form.get("content")
    author = current_user()
    posts_col.update_one(
        {"_id": ObjectId(post_id)},
        {"$push": {"replies": {"author": author["username"], "content": content}}}
    )
    return redirect(url_for("index"))

def check_url_virustotal(url):
    api_key = os.environ.get("VT_API_KEY")
    if not api_key:
        return "VirusTotal API key not set."

    headers = {"x-apikey": api_key}
    url_b64 = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
    api_url = f"https://www.virustotal.com/api/v3/urls/{url_b64}"

    res = requests.get(api_url, headers=headers)
    if res.status_code == 404:
        submit_res = requests.post("https://www.virustotal.com/api/v3/urls", headers=headers, data={"url": url})
        if submit_res.status_code != 200:
            return "Failed to submit URL for scanning."
        return "URL submitted for scanning. Please check back later."
    elif res.status_code == 200:
        stats = res.json()["data"]["attributes"]["last_analysis_stats"]
        return (
            f"Total scans: {sum(stats.values())}\n"
            f"Harmless: {stats.get('harmless', 0)}\n"
            f"Malicious: {stats.get('malicious', 0)}\n"
            f"Suspicious: {stats.get('suspicious', 0)}\n"
            f"Undetected: {stats.get('undetected', 0)}"
        )
    else:
        return f"Error from VirusTotal: {res.status_code}"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
