# 全画面共通スタイルの管理方針

更新日：2026-11-10。対象は SCR-100／200／210／300／310／400／500 の7画面と、QR入口の `index.html`。

## 設計原則

- 色・フォント・ウェイト・余白・罫線・角丸・影・共通寸法は `assets/design-tokens.css` を正本とし、利用箇所から `var(--...)` で直接参照する。
- HTMLは必要な共通CSSを `<link rel="stylesheet">` で直接読み込む。CSS の `@import` や値の別名を作るだけの中間変数は設けない。
- 同じ役割の部品は同じCSSに置き、競技固有の項目・列幅・データ構造は専用CSS／JSに残す。
- `!important`、重複したセレクター、ページ単位の追加上書きは、新規導入しない。既存のものは変更前後の画像比較を伴って段階的に減らす。
- CSSの読み込み順序は表示結果に影響するため、原則として自動的に並べ替えない。

## 共通CSSと直接参照先

| CSS | 対象 | 責務 |
| --- | --- | --- |
| `design-tokens.css` | 全8HTML | 基本値の一元管理 |
| `app-base.css` | アプリ7画面 | アプリ外枠と基本レイアウト |
| `bottom-nav-icons.css` | アプリ7画面 | 競技・ナビアイコン |
| `tap-feedback.css` | 全8HTML | タップ状態 |
| `ui-consistency.css` | 全8HTML | 共通ヘッダー、ボトムナビ、共通UI |
| `venue-list.css`, `venue-sort.css` | SCR-200・300 | 開催場一覧と並び順 |
| `payout-bar.css` | SCR-100・500 | 払戻金表示 |
| `racecard-layout.css` | SCR-210・310 | 出走表画面の基本レイアウト（旧 keirin-detail.css） |
| `racecard-analyzer.css` | SCR-210・310 | 分析タブ／詳細シート（旧 keirin-mania.css） |
| `racecard-controls.css` | SCR-210・310 | レース選択と情報バー等（旧 keirin-race-selector.css） |
| `race-selector-shared.css` | SCR-210・310 | レースボタン・スクロール境界 |
| `racecard-common.css` | SCR-210・310 | 出走表の箱表・メニューバー共通指定 |

共有ファイルは、どちらの画面からも**同じファイルを直接読み込む**。SCR-210・310は `racecard-common.css` を末尾に読み込む。その他のアプリ画面とQR入口は `ui-consistency.css` を最後の共通スタイルとして読み込む。参照順は表示差分を検証しながら管理する。

## ページ固有CSS／JS

- SCR-100：`home.css`／`home.js`
- SCR-200・300：開催場・予想表示の共通CSS／JS（`venue-list`、`venue-sort`、`venue-calendar`）
- SCR-210：`keirin-racecard-grouped.css`、`keirin-detail-9car.css`、`keirin-marutoku.css`、`keirin-position.css`、競輪用データ・描画JS
- SCR-310：`auto-racecard-v2.css`、`auto-racecard-v2.js`、`auto-analyzer-detail-source.js`
- SCR-400：`campaign.css`／`campaign.js`
- SCR-500：`mypage.css`
- QR入口：`qr-index.css`／`qr-index.js`、QR生成ライブラリ

JSは操作共通化が成立する場合だけ共有し、競輪とオートレースの異なるレースデータや解析計算を無理に同一化しない。`keirin-hofu5-data.js` は `keirin-mania.js` が動的に読み込むため、HTMLに直接記載されていなくても使用中である。

## 整理で廃止した旧ファイル

現行8HTMLとJSから参照されていない旧オートレース画面の `auto-detail.css`、`auto-detail.js`、`autorace-lab-merged.css` は削除。整理前の完全な状態は Git ブランチ `refactor-baseline-20261110` に保管。

## 検証と変更手順

1. 現行の意図した画面・データ・操作をテスト期待値の基準とする。古い項目名や廃止されたUIを基準にしない。
2. 変更を機能単位の小さなコミットに分ける。
3. CSS変更は `Verify Gamboo Home`／`Verify Non-Home Pages` の Chromium 画像比較で整理前コミットとの差分を確認する。さらに `Verify SCR-310`、`Verify Responsive Text` を確認する。
4. 意図しない見た目・機能差分があれば整理を戻す。視覚テストが通っても全操作の同一性まで保証できないため、タブ、並び替え、スクロール、遷移は別途確認する。
