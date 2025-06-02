from flask import Flask, request, session, jsonify
from flask_cors import CORS
import uuid

app = Flask(__name__)
app.secret_key = 'supersecretkey'
CORS(app)

users = {
    'admin': {'password': 'admin123', 'role': 'admin', 'badge': '[ADMIN]'},
    '@antiphish': {'password': None, 'role': 'bot', 'badge': '[BOT]'}
}

posts = []

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = users.get(data['username'])
    if user and user['password'] == data['password']:
        session['username'] = data['username']
        return {'ok': True}
    return {'ok': False}, 403

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return {'ok': True}

@app.route('/api/me')
def get_me():
    username = session.get('username')
    if not username: return {}, 403
    return {'username': username, 'badge': users[username]['badge']}

@app.route('/api/users')
def get_users():
    return [{'username': u, 'badge': users[u]['badge']} for u in users]

@app.route('/api/settings', methods=['POST'])
def update_settings():
    username = session.get('username')
    if not username: return {}, 403
    pw = request.form['password']
    users[username]['password'] = pw
    return {'ok': True}

@app.route('/api/posts')
def list_posts():
    return posts

@app.route('/api/post', methods=['POST'])
def create_post():
    username = session.get('username')
    if not username: return {}, 403
    data = request.json
    post_id = str(uuid.uuid4())
    post = {
        'id': post_id,
        'title': data['title'],
        'desc': data['desc'],
        'author': username,
        'last_reply': data['date']
    }
    posts.append(post)
    return post

@app.route('/api/admin')
def admin():
    username = session.get('username')
    if username and users[username]['role'] == 'admin':
        return {'users': len(users), 'posts': len(posts)}
    return {}, 403
