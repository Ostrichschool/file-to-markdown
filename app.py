import os
import uuid
import time
from flask import Flask, render_template, request, jsonify, send_file
from markitdown import MarkItDown

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
OUTPUT_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "outputs")
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100 MB limit

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

mmd = MarkItDown()


@app.route("/")
def index():
    return render_template("index.html")


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


DEFAULT_PORT = 5050

def find_available_port(start_port):
    import socket
    for port in range(start_port, start_port + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('localhost', port))
                return port
            except OSError:
                continue
    return start_port

if __name__ == "__main__":
    port = find_available_port(DEFAULT_PORT)
    print(f"🚀 サーバーを起動中... http://localhost:{port}")
    app.run(debug=True, port=port)
