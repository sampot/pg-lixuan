# 里長選舉（pg-lixuan）

四週社區競選小品：走訪六個鄰里，以服務、活動與貼近地方需求的政見，和兩名 AI 候選人爭取里民信任。

## 執行

無 build、無框架的純 HTML／CSS／JavaScript SAM：

```sh
python3 -m http.server 4173
```

開啟 <http://localhost:4173>。

## 測試

```sh
npx vitest run
```

不安裝或提交 `node_modules`。

## 規則

- 全程四週，每週 4 點行動力；資源包含志工、經費與信任。
- 六個鄰里各關心交通、治安、環境、長照中的兩項；對題政見較有效。
- 重複承諾會產生可信度風險；傳言與爭議只能正面澄清，沒有抹黑操作。
- 民調顯示帶誤差的區間，不揭露精確票數。
- 第四週開放催票，但低信任無法靠最後動員瞬間翻盤。
- 最佳得票與音效設定使用 Playgrounds KV：`lixuan:best`、`lixuan:settings`。

## 授權

程式碼 MIT。美術、音效、音樂與字型見 [ATTRIBUTION.md](./ATTRIBUTION.md)。
