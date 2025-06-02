from flask import Blueprint, request, jsonify
from models import users, create_user, authenticate

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if not create_user(username, password):
        return jsonify({"error": "User already exists"}), 409
    return jsonify({"message": "User created"})

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if authenticate(username, password):
        # In production, issue real JWT or session token!
        return jsonify({"message": "Login success", "username": username})
    return jsonify({"error": "Invalid credentials"}), 401
