#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate

echo "Markdown Vault Hub を起動します。"
echo "Vaultを指定する場合は、ターミナルで以下のように起動してください:"
echo "export OBSIDIAN_VAULT_PATH=\"/path/to/your/ObsidianVault\""
echo "python app.py"
echo ""
python app.py
