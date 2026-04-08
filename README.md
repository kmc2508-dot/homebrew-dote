# 服装提案アプリ（MVP）

寒暖差に応じて、朝・昼・夜の服装（長袖 / 半袖 / 上着）を提案する静的Webアプリです。

## 使い方
1. `index.html` をブラウザで開く（GitHub Pagesでも可）。
2. 「設定」で OpenWeather APIキーを保存。
3. 現在地または地名入力で天気を取得。
4. メイン提案と時間帯別提案を確認。

## 保存される設定（LocalStorage）
- `userType`: `cold | normal | hot`
- `location`: 地名
- `notifications`: 通知オンオフ
- `apiKey`: OpenWeather APIキー

## GitHub Pages公開
- このリポジトリをGitHubにpushし、Pagesの公開元を対象ブランチのrootに設定してください。
