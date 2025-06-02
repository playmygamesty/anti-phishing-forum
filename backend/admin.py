from flask import Blueprint, request, jsonify
from models import users, is_admin

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/users", methods=["GET"])
def list_users():
    # In production, check auth & admin
    user_list = []
    for username, info in users.items():
        user_list.append({
            "username": username,
            "role": info["role"],
            "badges": info["badges"]
        })
    return jsonify(user_list)
