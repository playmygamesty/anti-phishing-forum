# Simple in-memory models for demo; replace with a real DB in production
users = {
    "admin": {
        "password": "adminpass",  # Store hashed passwords in prod!
        "role": "admin",
        "badges": ["admin"],
        "email": None,
        "profile": {"bio": "I am the admin."},
    }
}

posts = []
post_id_counter = 1

def create_user(username, password, role="user"):
    if username in users:
        return False
    users[username] = {
        "password": password,
        "role": role,
        "badges": [],
        "email": None,
        "profile": {},
    }
    return True

def authenticate(username, password):
    user = users.get(username)
    if not user:
        return False
    return user["password"] == password

def is_admin(username):
    user = users.get(username)
    return user and user["role"] == "admin"

def add_post(author, title, content):
    global post_id_counter
    post = {
        "id": post_id_counter,
        "author": author,
        "title": title,
        "content": content,
        "replies": [],
        "created_at": "2025-06-02 12:00",  # Just example, add real timestamp in prod
        "last_post_info": None,
    }
    posts.append(post)
    post_id_counter += 1
    return post
