# File to Markdown コンバーター / Markdown Vault Hub

Microsoft MarkItDown を使用して、各種ファイルを Markdown 形式に変換する Web アプリです。

この版では、従来のファイル変換機能に加えて、Obsidian Vault などの Markdown フォルダをブラウザで閲覧し、Git履歴を確認できる **Markdown Vault Hub** 機能を追加しています。

---

## 主な機能

### 1. ファイル→Markdown変換

- Microsoft MarkItDown を使用して、各種ファイルを Markdown 形式に変換
- 変換結果をプレビュー
- `.md` ファイルとしてダウンロード

### 2. Markdown Vault Hub

- 指定した Obsidian Vault 配下の `.md` / `.markdown` / `.txt` ファイルを一覧表示
- ファイル名・フォルダ名で検索
- Markdown本文をブラウザで閲覧
- Git管理されているVaultの場合、ファイルごとのコミット履歴を表示
- 未コミット変更の有無を表示
- Web画面からVaultを書き換えない閲覧専用設計

---

## 対応ファイル形式

| カテゴリ | 形式 |
|----------|------|
| ドキュメント | PDF、Word (.docx)、PowerPoint (.pptx)、Excel (.xlsx) |
| テキスト | TXT、HTML、CSV、XML、JSON |
| 画像 | JPG、PNG、GIF など（OCR は非対応） |
| メール | .eml、.msg |
| 電子書籍 | EPUB |
| 音声 | MP3、MP4（テキストトラック抽出） |

---

## 推奨ワークフロー

```text
編集：Obsidian または VS Code
保存：Git管理されたObsidian Vault
履歴：Git / GitLab / GitHub private repo
閲覧：このWebアプリでVaultをブラウザ閲覧
公開：社内サーバーPC、NAS、または社内LAN内の小型PC
```

---

## 起動方法

### 初回のみ：依存パッケージのインストール

```bash
python -m venv venv
source venv/bin/activate
pip install markitdown[all]
pip install flask
```

### ローカル専用で起動

```bash
python app.py
```

起動後、ブラウザで以下の URL を開いてください。

```text
http://localhost:5050
```

---

## Obsidian Vault を指定して起動する

```bash
export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian/App-Development-Vault"
python app.py
```

`OBSIDIAN_VAULT_PATH` を指定しない場合は、アプリフォルダ内の `vault/` が既定のVaultとして使われます。

---

## 社内LAN内のPC・スマホから閲覧できるようにする

同じWi-Fi内の端末からアクセスさせる場合は、`APP_HOST=0.0.0.0` を指定します。

```bash
export OBSIDIAN_VAULT_PATH="/Users/yourname/Documents/Obsidian/App-Development-Vault"
export APP_HOST="0.0.0.0"
python app.py
```

サーバーPCのIPアドレスが `192.168.1.20` の場合、他のPCやスマホから以下で閲覧できます。

```text
http://192.168.1.20:5050
```

MacでIPアドレスを確認する例：

```bash
ipconfig getifaddr en0
```

---

## 使い方：ファイル→Markdown変換

### 1. ファイルを選択する

- ファイルをドロップゾーンに**ドラッグ＆ドロップ**する
- または「**ファイルを選択**」リンクをクリックしてファイルを選ぶ
- 複数ファイルを同時に選択できます

### 2. 変換する

「**変換実行**」ボタンをクリックします。変換中はスピナーが表示されます。

### 3. 結果を確認する

変換が完了すると、各ファイルの結果カードが表示されます。

| 項目 | 内容 |
|------|------|
| マークダウン文字数 | 変換後のテキスト文字数 |
| 変換時間 | 処理にかかった時間 |

### 4. プレビュー・ダウンロード

- **プレビュー**：変換された Markdown テキストをその場で確認できます
- **ダウンロード**：`.md` ファイルとして保存します（元のファイル名 + `.md`）

### 5. クリア

「**クリア**」ボタンを押すと、変換結果がすべてリセットされます。

---

## 使い方：Markdown Vault Hub

1. Vaultを指定してアプリを起動します。
2. 画面上部の「Vault閲覧」タブを開きます。
3. 左側のファイル一覧からMarkdownファイルを選びます。
4. 中央に本文、下部にGit履歴が表示されます。
5. 検索欄でファイル名やフォルダ名を絞り込めます。

---

## Git履歴を表示する条件

Vaultフォルダ自体がGit管理されている必要があります。

例：

```bash
cd "/Users/yourname/Documents/Obsidian/App-Development-Vault"
git init
git add .
git commit -m "Initial vault commit"
```

以後、ObsidianまたはVS Codeで編集したMarkdownをコミットすると、このWebアプリ上で履歴を確認できます。

---

## start.command を使う場合

`start.command` をダブルクリックすると、ローカル専用で起動します。

Vaultを指定したい場合や社内LAN公開したい場合は、ターミナルから環境変数を指定して起動してください。

---

## 終了方法

サーバーが起動しているターミナルウィンドウで `Ctrl + C` を押してください。

---

## 注意事項

- 現時点ではVault閲覧機能は読み取り専用です。Web画面からVaultを書き換えません。
- 変換結果はブラウザを閉じると消えます。必要なファイルはダウンロードしてから閉じてください。
- ローカル専用起動時は同じPCからのみアクセスできます。
- 社内LANに公開する場合、同一ネットワーク内の人は閲覧できます。機密情報を置く場合は、VPN・ファイアウォール・認証機能の追加を検討してください。
- `APP_HOST=0.0.0.0` はLAN公開用です。インターネットに直接公開しないでください。
- ファイルサイズの上限は **100 MB** です。
