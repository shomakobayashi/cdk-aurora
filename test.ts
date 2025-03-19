import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// カスタムメトリクスの定義
const connectionFailures = new Counter('connection_failures');
const failureRate = new Rate('failure_rate');

export let options = {
    stages: [
        { duration: '30s', target: 10 },  // 10並列
        { duration: '30s', target: 50 },  // 50並列
        { duration: '30s', target: 100 }, // 100並列
        { duration: '30s', target: 200 }, // 200並列
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% のリクエストが 500ms 以下
        'failure_rate': ['rate<0.1'],      // 失敗率が10%未満
    },
};

export default function () {
    // テストタイプを環境変数から取得（READ/WRITE）
    const testType = __ENV.TEST_TYPE || 'READ';

    // APIエンドポイントを環境変数から取得
    const apiUrl = __ENV.API_URL;

    // URLが設定されていない場合はエラー
    if (!apiUrl) {
        console.error('API_URL environment variable is not set. Please provide a valid URL.');
        fail('Missing API_URL');
        return;
    }

    // 各VUとリクエストで一意のIDを生成
    const uniqueId = `${__VU}-${Date.now()}`;

    let res;

    try {
        if (testType === 'READ') {
            // READ操作（GET）
            res = http.get(apiUrl);
        } else {
            // WRITE操作（POST）
            const payload = JSON.stringify({
                data: `TestUser_${uniqueId}`  // 一意のユーザー名を生成
            });
            const params = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            res = http.post(apiUrl, payload, params);
        }

        // レスポンスのチェック
        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 500ms': (r) => r.timings.duration < 500,
            'valid response body': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body !== null;
                } catch (e) {
                    return false;
                }
            }
        });

        // 接続失敗の検出
        if (!success || res.status >= 500) {
            connectionFailures.add(1);
            failureRate.add(1);
        } else {
            failureRate.add(0);
        }

        // レスポンスボディをログに出力（デバッグ用、必要に応じて）
        if (res.status !== 200) {
            console.log(`Failed request: ${res.status}, ${res.body}`);
        }
    } catch (error) {
        console.error(`Request error: ${error}`);
        connectionFailures.add(1);
        failureRate.add(1);
    }

    sleep(1);
}