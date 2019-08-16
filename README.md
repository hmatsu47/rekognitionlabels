# rekognitionlabels

## Amazon Rekognition & MySQL 8.0 X DevAPI Sample

**【注】このリポジトリのコードは試験的なものです。認証・認可、詳細なエラー処理などが実装されていません。**

**データ滅失・クラウド破産などを引き起こす恐れがあるため、インターネットに公開する形で実行しないでください。**

**Caution: For experimental use only (on local PC) / Lack of identification, authentication, error handling, etc.**

## 内容

このリポジトリのコードは、Node.js上でMySQL X DevAPIを利用するサンプルコードです。

Amazon Rekognitionで写真（容量5MB以下）を判定し、読み取られたラベル（信頼度上位10個かつ60%以上）をMySQL 8.0のドキュメントストアに保存するものです。

## 必要物

 - MySQL Community Server 8.0.17～
 - nginx 1.17.2～
 - Node.js 12.8.0～
 - Vue.js 2.6.10～
 - axios v0.19.0～

※Node.js環境に必要なパッケージ等についてはpackage.jsonを参照。

## その他

 - 誤用を避けるため、環境構築に関する説明はあえて記載しません。
 - ローカルPC上の実行の際にCORS問題の解決が必要です（nginx側リバースプロキシで/app/宛てのリクエストをNode.js側ポートに流すなど）。
