# 全ページ共通CSSの運用方針

## 読み込み順序

全9ページは以下をHTMLの `<link rel="stylesheet">` から**直接**読み込む。CSSの `@import`、他の変数を参照するだけの別名トークンは用いない。

1. `assets/design-tokens.css` — 色、余白、フォント、罫線、角丸などの共通変数
2. `assets/bottom-nav-icons.css` — ボトムナビを持つアプリ画面
3. `assets/app-base.css` — 通常のアプリ画面の外枠・レイアウト基盤
4. ページ専用CSS — 各画面の固有配置・コンテンツ
5. `assets/tap-feedback.css` — 共通の押下反応
6. `assets/ui-consistency.css` — 共通UIの最終定義。CSS群の末尾で読み込む

`index.html` はQR・パスワード入口専用画面のため、**画面外枠の配置に影響する `app-base.css` のみ例外**として読まず、`qr-index.css` で専用レイアウトを維持する。共通の `design-tokens.css`、`tap-feedback.css`、`ui-consistency.css` は直接読み込む。

ホーム専用の `home.css` を他画面へ流用しない。共有すべき部品は共通CSSに移した上で、各ページはその共通CSSを直接参照する。

## ページ専用CSS

- ホーム：`home.css`
- 競輪トップ（`SCR-02_keirin.html`）・オートレーストップ（`SCR-02_autorace.html`）：`venue-list.css`（オートのみ `venue-list-auto-overrides.css` を追加）
- マニア分析：`mania-analysis.css`
- 出走表・競輪（`SCR-03_racecardkeirin.html`）：`keirin-detail.css` と `keirin-detail-9car.css`、マニア分析統合用 `keirin-mania.css`／`keirin-mania.js`
- 出走表・オート（`SCR-04_racecardkeirin.html`）／データ解析ラボ：`auto-detail.css`
- マイページ：`mypage.css`
- キャンペーン：`campaign.css`
- QR入口：`qr-index.css`

## 今回の対応範囲

ページ内の `<style>` を撤廃して専用CSSへ分離した。共通UIの確定値に上書きされる古い高さ・サイズ指定は削除した。今後ページごとに段階的なデザイン改修を実施する予定のため、それ以外のページ固有スタイルは機械的に書き換えず保留している。特にフォントウェイトの数値直書き、個別のインライン `style` 属性、複雑な旧セレクターは今後のページ別検証の対象である。

## 検証

`scripts/check-pages.mjs` と `.github/workflows/pages-refactor-check.yml` が、全9ページのCSS直接参照・ファイル存在・読み込み順を検査し、8の非ホームページについて296/390/768px、上部・下部でChromiumの画像を取得する。

画像比較は GitHub Actionsの `Verify Non-Home Pages` の手動起動時、`baseline_commit` にGitコミットSHAを入力する。画像の変更許容率は原則0.005%。操作状態や全OSの見た目までの完全一致を保証するものではない。

## 競輪出走表へのマニア分析統合

出走表の「前開催成績」の右側に、総合評価と8評価項目の列を追加した。従来の「マニア分析タブ」の独立画面および別CSSを廃止し、横スクロール位置に応じて上部メニューの出走表／マニア分析の選択を切り替える。評価項目を押すと、同じ画面内で既存の条件別詳細シートを開く。元のデモ評価値は1〜7車に引き継ぎ、8・9車は未設定とする。詳細シートは現行出走表の9選手を対象に計算する。
