import os
import uuid
import time
import subprocess
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from markitdown import MarkItDown

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100 MB limit

# Obsidian Vault settings
# Example:
#   export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian/App-Development-Vault"
VAULT_PATH = os.path.abspath(os.environ.get("OBSIDIAN_VAULT_PATH", os.path.join(BASE_DIR, "vault")))
ALLOWED_TEXT_EXTENSIONS = {".md", ".markdown", ".txt"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(VAULT_PATH, exist_ok=True)

mmd = MarkItDown()


def is_hidden_path(relative_path):
    parts = relative_path.split(os.sep)
    return any(part.startswith(".") for part in parts if part)


def normalize_vault_relative_path(relative_path):
    relative_path = relative_path or ""
    safe_path = os.path.normpath(relative_path).lstrip(os.sep)
    if safe_path == ".":
        safe_path = ""
    absolute_path = os.path.abspath(os.path.join(VAULT_PATH, safe_path))
    if absolute_path != VAULT_PATH and not absolute_path.startswith(VAULT_PATH + os.sep):
        raise ValueError("Vault外のパスにはアクセスできません")
    return safe_path, absolute_path


def run_git_command(args):
    if not os.path.isdir(os.path.join(VAULT_PATH, ".git")):
        return {"available": False, "output": "このVaultはGit管理されていません"}

    try:
        completed = subprocess.run(
            ["git", "-C", VAULT_PATH] + args,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if completed.returncode != 0:
            return {"available": True, "error": completed.stderr.strip() or completed.stdout.strip()}
        return {"available": True, "output": completed.stdout.strip()}
    except FileNotFoundError:
        return {"available": False, "output": "gitコマンドが見つかりません"}
    except subprocess.TimeoutExpired:
        return {"available": True, "error": "gitコマンドがタイムアウトしました"}


@app.route("/")
def index():
    return render_template("index.html", vault_path=VAULT_PATH)


@app.route("/api/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "ファイルが選択されていません"}), 400

    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"success": False, "error": "ファイルが選択されていません"}), 400

    session_id = str(uuid.uuid4())
    original_filename = file.filename
    _, ext = os.path.splitext(original_filename)
    temp_path = os.path.join(UPLOAD_FOLDER, f"{session_id}{ext}")

    try:
        file.save(temp_path)

        start_time = time.time()
        res = mmd.convert(temp_path)
        elapsed = time.time() - start_time

        markdown_text = res.text_content

        return jsonify({
            "success": True,
            "markdown": markdown_text,
            "conversion_time": round(elapsed, 2),
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/api/vault/files")
def vault_files():
    files = []
    for root, dirs, filenames in os.walk(VAULT_PATH):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in {"__pycache__", "node_modules"}]
        for filename in filenames:
            _, ext = os.path.splitext(filename)
            if ext.lower() not in ALLOWED_TEXT_EXTENSIONS:
                continue
            absolute_path = os.path.join(root, filename)
            relative_path = os.path.relpath(absolute_path, VAULT_PATH)
            if is_hidden_path(relative_path):
                continue
            stat = os.stat(absolute_path)
            files.append({
                "path": relative_path.replace(os.sep, "/"),
                "name": filename,
                "folder": os.path.dirname(relative_path).replace(os.sep, "/"),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            })

    files.sort(key=lambda item: item["path"].lower())
    return jsonify({"success": True, "vault_path": VAULT_PATH, "files": files})


@app.route("/api/vault/file")
def vault_file():
    relative_path = request.args.get("path", "")
    try:
        safe_path, absolute_path = normalize_vault_relative_path(relative_path)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400

    _, ext = os.path.splitext(absolute_path)
    if ext.lower() not in ALLOWED_TEXT_EXTENSIONS:
        return jsonify({"success": False, "error": "Markdownまたはテキストファイルのみ閲覧できます"}), 400

    if not os.path.exists(absolute_path):
        return jsonify({"success": False, "error": "ファイルが見つかりません"}), 404

    try:
        with open(absolute_path, "r", encoding="utf-8") as f:
            content = f.read()
        stat = os.stat(absolute_path)
        return jsonify({
            "success": True,
            "path": safe_path.replace(os.sep, "/"),
            "content": content,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            "size": stat.st_size,
        })
    except UnicodeDecodeError:
        return jsonify({"success": False, "error": "UTF-8として読み込めませんでした"}), 400


@app.route("/api/vault/history")
def vault_history():
    relative_path = request.args.get("path", "")
    git_args = ["log", "--pretty=format:%h%x09%an%x09%ad%x09%s", "--date=short", "--max-count=50"]

    if relative_path:
        try:
            safe_path, _ = normalize_vault_relative_path(relative_path)
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        git_args += ["--", safe_path]

    result = run_git_command(git_args)
    if not result.get("available"):
        return jsonify({"success": True, "git_available": False, "message": result.get("output"), "commits": []})
    if result.get("error"):
        return jsonify({"success": False, "git_available": True, "error": result["error"]}), 500

    commits = []
    for line in result.get("output", "").splitlines():
        parts = line.split("\t", 3)
        if len(parts) == 4:
            commits.append({"hash": parts[0], "author": parts[1], "date": parts[2], "subject": parts[3]})

    return jsonify({"success": True, "git_available": True, "commits": commits})


@app.route("/api/vault/status")
def vault_status():
    result = run_git_command(["status", "--short"])
    if not result.get("available"):
        return jsonify({"success": True, "git_available": False, "message": result.get("output"), "changes": []})
    if result.get("error"):
        return jsonify({"success": False, "git_available": True, "error": result["error"]}), 500

    changes = []
    for line in result.get("output", "").splitlines():
        if len(line) >= 4:
            changes.append({"status": line[:2].strip(), "path": line[3:]})
    return jsonify({"success": True, "git_available": True, "changes": changes})


@app.route("/download/<filename>")
def download(filename):
    try:
        file_path = os.path.join(OUTPUT_FOLDER, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "ファイルが見つかりません"}), 404
        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/cleanup", methods=["POST"])
def cleanup():
    """アップロード/出力ディレクトリのクリーンアップ"""
    try:
        for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
            for f in os.listdir(folder):
                fp = os.path.join(folder, f)
                if os.path.isfile(fp):
                    os.remove(fp)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


DEFAULT_PORT = int(os.environ.get("PORT", "5050"))


def find_available_port(start_port):
    import socket
    host = os.environ.get("APP_HOST", "127.0.0.1")
    bind_host = "0.0.0.0" if host == "0.0.0.0" else "127.0.0.1"
    for port in range(start_port, start_port + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((bind_host, port))
                return port
            except OSError:
                continue
    return start_port


if __name__ == "__main__":
    port = find_available_port(DEFAULT_PORT)
    host = os.environ.get("APP_HOST", "127.0.0.1")
    print(f"🚀 サーバーを起動中... http://{host}:{port}")
    print(f"📚 Obsidian Vault: {VAULT_PATH}")
    app.run(debug=True, host=host, port=port)
