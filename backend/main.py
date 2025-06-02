import os
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='../frontend/static')

# In-memory "database" (replace with real DB or persistent storage later)
users = {
    'admin': {'password': 'adminpass', 'role': 'admin', 'badges': ['admin']},
    '@antiphish': {'password': None, 'role': 'bot', 'badges': ['bot']}
}
posts = []

# Serve frontend static files and index.html
@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path='index.html'):
    return send_from_directory('../frontend', path)

# Basic Authentication endpoint (very simplified)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = users.get(username)
    if user and user['password'] == password:
        return jsonify({'success': True, 'username': username, 'role': user['role'], 'badges': user['badges']})
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

# Get all users
@app.route('/api/users', methods=['GET'])
def get_users():
    user_list = [{'username': u, 'role': d['role'], 'badges': d['badges']} for u, d in users.items()]
    return jsonify(user_list)

# Get posts
@app.route('/api/posts', methods=['GET'])
def get_posts():
    return jsonify(posts)

# Create post (only if logged in, simplified)
@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.json
    author = data.get('author')
    title = data.get('title')
    content = data.get('content')
    if not (author and title and content):
        return jsonify({'success': False, 'error': 'Missing fields'}), 400
    if author not in users:
        return jsonify({'success': False, 'error': 'Author not found'}), 400

    post = {
        'id': len(posts) + 1,
        'title': title,
        'author': author,
        'content': content,
        'replies': [],
        'created_at': '2025-06-02T12:00:00',  # Use real timestamps in production
        'last_post_at': '2025-06-02T12:00:00'
    }
    posts.append(post)

    # Auto-reply by @antiphish if command found
    if content.startswith('@antiphish run check '):
        url = content[len('@antiphish run check '):].strip()
        report = f"Safety report for URL: {url} — [Fake analysis: URL looks safe ✅]"
        reply = {
            'author': '@antiphish',
            'content': report,
            'created_at': '2025-06-02T12:01:00'
        }
        post['replies'].append(reply)

    return jsonify({'success': True, 'post': post})

# Catch-all for 404s (optional)
@app.errorhandler(404)
def not_found(e):
    return send_from_directory('../frontend', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
