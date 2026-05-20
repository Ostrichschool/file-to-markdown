# File to Markdown コンバーター / Markdown Vault Hub 仕様書

---

## 1. アプリ概要

| 項目 | 内容 |
|------|------|
| アプリ名 | File to Markdown コンバーター / Markdown Vault Hub |
| 目的 | 各種ファイルのMarkdown変換、およびObsidian Vault等のMarkdownフォルダの閲覧 |
| 動作環境 | ローカルPC、または社内LAN内のサーバーPC |
| 既定アクセスURL | http://localhost:5050 |
| ファイルサイズ上限 | 100 MB |
| Vault閲覧 | 読み取り専用 |

---

## 2. 技術スタック

| レイヤー | 技術 |
|----------|------|
| バックエンド | Python 3.x、Flask 3.x |
| 変換エンジン | Microsoft MarkItDown（`markitdown[all]`）|
| フロントエンド | HTML / CSS / Vanilla JavaScript |
| 履歴表示 | Git CLI |
| 起動方式 | `python app.py` または `start.command`（macOS）|

---

## 3. ファイル構成

```text
file_to_markdown/
├── app.py                  # Flask アプリ本体
├── requirements.txt        # 依存パッケージ一覧
├── start.command           # 起動スクリプト（ダブルクリックで起動）
├── .gitignore
├── README.md               # 使用説明書
├── SPEC.md                 # 本仕様書
├── templates/
│   └── index.html          # メイン画面
├── static/
│   ├── app.js              # フロントエンドロジック
│   └── style.css           # スタイルシート
├── uploads/                # 変換処理中の一時ファイル置き場（自動削除）
├── outputs/                # 未使用（将来拡張用）
└── vault/                  # OBSIDIAN_VAULT_PATH未指定時の既定Vault
```

---

## 4. 環境変数

| 変数名 | 既定値 | 内容 |
|--------|--------|------|
| `OBSIDIAN_VAULT_PATH` | アプリフォルダ内の `vault/` | 閲覧対象のObsidian VaultまたはMarkdownフォルダ |
| `APP_HOST` | `127.0.0.1` | Flaskの待受ホスト。社内LAN公開時は `0.0.0.0` |
| `PORT` | `5050` | 起動ポート |

---

## 5. API 仕様

### POST `/api/convert`

ファイルを1件受け取り、Markdown に変換して返す。

**リクエスト**

| 項目 | 内容 |
|------|------|
| Content-Type | `multipart/form-data` |
| フィールド名 | `file` |

**レスポンス（成功時）**

```json
{
  "success": true,
  "markdown": "変換後のMarkdownテキスト",
  "conversion_time": 0.07
}
```

**レスポンス（失敗時）**

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

---

### GET `/api/vault/files`

Vault配下のMarkdownまたはテキストファイル一覧を返す。

対象拡張子：

```text
.md
.markdown
.txt
```

**レスポンス（成功時）**

```json
{
  "success": true,
  "vault_path": "/path/to/vault",
  "files": [
    {
      "path": "01_Requirements/要件定義.md",
      "name": "要件定義.md",
      "folder": "01_Requirements",
      "size": 1234,
      "modified": "2026-05-20T10:00:00"
    }
  ]
}
```

---

### GET `/api/vault/file?path=<relative-path>`

指定したVault内ファイルの本文を返す。

**制約**

- Vault外へのパストラバーサルを禁止
- `.md` / `.markdown` / `.txt` のみ対象
- UTF-8として読み込めるファイルのみ対象

---

### GET `/api/vault/history?path=<relative-path>`

Git管理されたVaultで、指定ファイルまたはVault全体の履歴を返す。

内部では以下に相当するGitコマンドを実行する。

```bash
git -C "$OBSIDIAN_VAULT_PATH" log --pretty=format:%h%x09%an%x09%ad%x09%s --date=short --max-count=50 -- <path>
```

---

### GET `/api/vault/status`

Git管理されたVaultで、未コミット変更の有無を返す。

内部では以下に相当するGitコマンドを実行する。

```bash
git -C "$OBSIDIAN_VAULT_PATH" status --short
```

---

### GET `/download/<filename>`

指定したファイル名の Markdown ファイルをダウンロードする（現在は未使用）。

---

### POST `/cleanup`

`uploads/` および `outputs/` ディレクトリ内のファイルをすべて削除する。

---

## 6. フロントエンド動作仕様

### タブ構成

| タブ | 内容 |
|------|------|
| Vault閲覧 | Vault内Markdownの一覧・本文・Git履歴を表示 |
| ファイル→Markdown変換 | 従来のファイル変換画面 |

### Vault閲覧

- 起動時に `/api/vault/files` と `/api/vault/status` を取得する
- ファイル選択時に `/api/vault/file` と `/api/vault/history` を取得する
- 検索欄でファイル名・フォルダ名を絞り込む
- Markdownは簡易レンダリングで表示する

### ファイル選択

- ドラッグ＆ドロップ、またはファイル選択ダイアログで複数ファイルを受け付ける
- 同一ファイル（ファイル名とサイズが一致）の重複追加を防ぐ

### 変換処理

- ファイルを1件ずつ順番に `/api/convert` へ送信する
- 変換中はスピナーを表示し、完了後に自動で非表示にする
- 変換完了後、選択ファイルリストは自動でクリアされる

### 変換結果の表示

- 新しい結果は上に積み上がる形式で表示される
- 「クリア」ボタンを押すまで結果は保持される（ページリロードで消える）
- プレビュー：モーダルで Markdown テキストを表示
- ダウンロード：ブラウザのダウンロードフォルダに `.md` ファイルを保存

### ポート設定

- デフォルトポート: `5050`
- 使用中の場合は `5051`、`5052`… と順番に空きポートを探す（最大100番先まで）

---

## 7. セキュリティ・制約

| 項目 | 内容 |
|------|------|
| 既定アクセス範囲 | `127.0.0.1`（同一PCのみ）|
| LAN公開 | `APP_HOST=0.0.0.0` 指定時のみ |
| Vault編集 | 非対応。Web画面からVaultを書き換えない |
| パストラバーサル対策 | Vault外のファイルパスを拒否 |
| ファイルの保持 | アップロードファイルは変換後すぐに削除 |
| デバッグモード | `debug=True`（本番環境への公開不可） |
| 外部公開 | 非推奨。公開する場合は認証・TLS・ファイアウォール設定が必要 |

---

## 8. 今後の拡張候補

- 認証機能
- Markdownレンダリング品質の向上
- MermaidやObsidian内部リンクへの対応
- GitHub / GitLab remoteとの同期状態表示
- QuartzやMkDocsへの静的サイト出力
