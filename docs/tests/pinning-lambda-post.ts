import http from 'k6/http';
import { check, sleep } from 'k6';

const API_ENDPOINT = __ENV.API_ENDPOINT;
const TRANSACTION_ENABLED = __ENV.TRANSACTION_ENABLED === 'true';
const HOLD_TIME = parseInt(__ENV.HOLD_TIME || '0');

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
    http_req_duration: ['p(95)<500'], // 95%のリクエストが500ms以下であることを期待
  },
};

export default function() {
  // POSTリクエスト用のデータ
  const payload = JSON.stringify({
    name: `User ${new Date().toISOString()}`,
    useTransaction: TRANSACTION_ENABLED,
    holdTimeMs: HOLD_TIME
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // POSTリクエスト実行
  const response = http.post(API_ENDPOINT, payload, params);
  
  check(response, {
    'POST status is 200': (r) => r.status === 200,
    'POST response has user data': (r) => {
      try {
        return r.json().user !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  // レスポンスタイムの記録
  if (response.timings.duration > 200) {
    console.log(`High latency (${response.timings.duration.toFixed(2)}ms) for POST request`);
  }
  
  // エラー時のみログ出力
  if (response.status !== 200) {
    console.log(`Failed POST request: ${response.status}, Body: ${response.body}`);
  }
  
  // 基本的な待機時間
  const baseSleep = 1;
  // トランザクションを使用する場合は、ピン留めの効果を見るために追加の待機
  sleep(baseSleep + (TRANSACTION_ENABLED ? 1 : 0));
}
