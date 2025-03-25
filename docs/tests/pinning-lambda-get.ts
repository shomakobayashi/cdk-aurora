import http from 'k6/http';
import { check, sleep } from 'k6';

const API_ENDPOINT = __ENV.API_ENDPOINT;
// トランザクション保持時間（ミリ秒）- 環境変数から設定可能
const HOLD_TIME = parseInt(__ENV.HOLD_TIME || '0');
const TRANSACTION_ENABLED = __ENV.TRANSACTION_ENABLED === 'true';

export let options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '10s', target: 30 },
    { duration: '10s', target: 50 },
    { duration: '10s', target: 70 },
    { duration: '10s', target: 100 },
    { duration: '10s', target: 150 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function() {
  // GETリクエスト実行 - トランザクション情報を含める
  const url = `${API_ENDPOINT}?transaction=${TRANSACTION_ENABLED}&holdTime=${HOLD_TIME}`;
  const startTime = new Date().getTime();
  
  const response = http.get(url);
  
  // レスポンス時間の計算
  const duration = new Date().getTime() - startTime;
  
  check(response, {
    'GET status is 200': (r) => r.status === 200,
    'GET response has data': (r) => {
      try {
        return r.json().length > 0;
      } catch (e) {
        return false;
      }
    },
  });
  
  // レスポンスタイムをログに記録
  if (response.timings.duration > 200) {
    console.log(`High latency (${response.timings.duration.toFixed(2)}ms) for GET request with holdTime=${HOLD_TIME}ms, transaction=${TRANSACTION_ENABLED}`);
  }
  
  // エラー時のログ出力
  if (response.status !== 200) {
    console.log(`Failed GET request: ${response.status}, Body: ${response.body}, holdTime=${HOLD_TIME}ms, transaction=${TRANSACTION_ENABLED}`);
  }
  
  // 基本的な待機時間
  const baseSleep = 1;
  // トランザクションを使用する場合は、ピン留めの効果を見るために追加の待機
  sleep(baseSleep + (TRANSACTION_ENABLED ? 1 : 0));
}