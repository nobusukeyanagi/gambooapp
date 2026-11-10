# Gamboo アプリ画面プロトタイプ

競輪・オートレースを中心とするGambooアプリの画面実装です。HTML／CSS／JavaScriptによる静的サイトで、画面の見た目と操作を確認するためのプロトタイプです。

## 画面一覧

| ファイル | 画面 |
| --- | --- |
| `index.html` | 全画面のQRコード一覧 |
| `SCR-100_bet.html` | 車券購入 |
| `SCR-200_keirin.html` | 競輪予想 |
| `SCR-210_racecardkeirin.html` | 競輪出走表 |
| `SCR-300_autorace.html` | オートレース予想 |
| `SCR-310_racecardautorace.html` | オートレース出走表 |
| `SCR-400_campaign.html` | キャンペーン |
| `SCR-500_mypage.html` | マイページ |

## ディレクトリ

- `assets/design.css`：全画面共通のデザイン変数
- `assets/ui.css`／`assets/ui.js`：全画面共通のUI・操作
- `assets/venue.css`／`assets/venue.js`：競輪・オートレース予想の共通部分
- `assets/racecard.css`：両競技の出走表共通部分
- `assets/SCR-*.css`：画面固有のスタイル
- `assets/*racecard*.js`、`assets/keirin-*.js`、`assets/auto-*.js`：表示・分析・レースデータ（必要なファイルのみ個別に使用）
- `assets/images/`：バナーや選手・ユーザー画像
- `docs/STYLE-GUIDE.md`：現行デザイン・実装仕様と保守ルール
- `docs/home-style-guide.md`：車券購入画面の詳細な検証方針
- `scripts/` と `.github/workflows/`：自動検証とGitHub Pages公開設定

## ローカル確認

静的サーバーから配信してください。HTMLを直接ファイルとして開くと、ページ間で参照するデータの取得などが正しく動作しない場合があります。

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173/` を開きます。

### 品質チェック

検証には Node.js 24 と Playwright（Chromium）を利用します。ブラウザを用いる検証時は上記のローカルサーバーを起動してください。

```bash
npm ci
npx playwright install chromium
npm run check:shared-css
npm run check:home
node scripts/check-pages.mjs
node scripts/check-auto310.mjs
node scripts/check-responsive-text.mjs
```

GitHub Actionsにも、ホーム・その他画面・オートレース出走表・レスポンシブ文字表示の検証ワークフローを配置しています。

## 実装上の注意

- **画面・成績データは固定の確認用サンプルです。** 実際のレース情報をリアルタイム取得する本番サービスではありません。画面によってデータの対象日・対象レースが異なります。
- SCR-210の防府5Rデータは `keirin-mania.js` が `keirin-hofu5-data.js` を動的に読み込みます。HTMLから直接参照されていないという理由で削除しないでください。
- SCR-210のマニア分析用詳細データと評価印は、画面本体の防府5Rとは別の参照レースに由来します。実選手の防府5R分析値として扱わないでください。
- 画面内の外部リンクにはGambooなどの公開サイトへの遷移が含まれます。実環境の認証・投票処理との接続は別途確認が必要です。
- 各HTMLには検索エンジンへのインデックス登録を抑制する `noindex` 指定があります。公開方針に応じて管理してください。
- QRコード生成ライブラリのライセンスは `assets/QR-LICENSE.txt` を参照してください。

デザイン・CSS変数の変更や共通化を行う場合は、まず `docs/STYLE-GUIDE.md` を参照してください。
