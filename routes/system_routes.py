from flask import Blueprint
import subprocess

system_bp = Blueprint("system", __name__)

@system_bp.route("/system_shutdown", methods=["POST"])
def system_shutdown():
    try:
        subprocess.run(["sudo", "/sbin/shutdown", "now"])
        return "Shutting down system..."
    except Exception as e:
        return str(e), 500
