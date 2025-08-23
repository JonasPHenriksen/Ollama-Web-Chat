from flask import Blueprint, jsonify
import subprocess

model_bp = Blueprint("model", __name__)

@model_bp.route("/models")
def models():
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return jsonify({"error": "Failed to list models", "details": result.stderr}), 500
        
        lines = result.stdout.splitlines()
        # Skip header and extract model names
        model_names = [line.split()[0] for line in lines[1:] if line.strip()]
        return jsonify(model_names)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
