from flask import Blueprint, jsonify
import subprocess

system_bp = Blueprint("system", __name__)

@system_bp.route("/system_shutdown", methods=["POST"])
def system_shutdown():
    try:
        subprocess.run(["sudo", "/sbin/shutdown", "now"])
        return "Shutting down system..."
    except Exception as e:
        return str(e), 500


def get_vram_info():
    """
    Returns a dict with 'used' and 'total' VRAM in MB.
    """
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"]
        )
        used, total = output.decode("utf-8").strip().split(", ")
        return {"used": int(used), "total": int(total)}
    except Exception:
        return {"used": None, "total": None}


@system_bp.route("/vram")
def vram():
    info = get_vram_info()
    return jsonify({
        "vram_used_mb": info["used"],
        "vram_total_mb": info["total"]
    })
