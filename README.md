# QR Reader

シンプルでモダンなPWA QRコードリーダー。

## Features

- 起動時に背面カメラを自動リクエスト
- カメラ映像上の滑らかなスキャンライン
- QRコードを検出すると結果画面へ
- URLはブラウザで開く / コピー
- URL以外のQRテキストもコピー可能
- カメラ切り替え
- レスポンシブ / Safe Area対応
- Service WorkerによるPWA対応

## Development

HTTPSまたはlocalhostで開いてください。カメラAPIは安全なコンテキストが必要です。

## Note

QR認識にはjsQRをCDNから読み込んでいます。完全オフライン認識まで含める場合は、次の段階でライブラリをリポジトリへ同梱します。
