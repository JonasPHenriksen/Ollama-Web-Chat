from flask import Blueprint, jsonify
import subprocess
import ollama

model_bp = Blueprint("model", __name__)

@model_bp.route("/models")
def models():
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return jsonify({"error": "Failed to list models", "details": result.stderr}), 500
        
        lines = result.stdout.splitlines()
        model_names = [line.split()[0] for line in lines[1:] if line.strip()]
        return jsonify(model_names)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@model_bp.route('/model_info/<model_name>')
def get_model_info(model_name):
    try:
        info = ollama.show(model_name)
        if "vision" in info.capabilities:
            return jsonify({"has_vision": True})
        else:
            return jsonify({"has_vision": False})
                
    except Exception as e:
        return jsonify({"error": str(e)}), 500