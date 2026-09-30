import http from 'k6/http';
import { check, sleep } from 'k6';
import { Gauge, Rate } from 'k6/metrics';

export const API_BASE_URL = 'https://emailservice.hackuta.org';

const sendSuccess = new Rate('email_send_success');
const statusSuccess = new Rate('email_status_success');
const monitorSuccess = new Rate('email_monitor_success');
const queueDepth = new Gauge('email_queue_depth');

export function baseRate() {
  const rate = Number(__ENV.EMAIL_RATE_PER_MINUTE || '2');
  if (!Number.isInteger(rate) || rate < 1) {
    throw new Error('EMAIL_RATE_PER_MINUTE must be a positive integer');
  }
  return rate;
}

export function validateConfig() {
  if (!__ENV.EMAIL_API_KEY || !__ENV.EMAIL_TEST_RECIPIENT) {
    throw new Error('Set EMAIL_API_KEY and EMAIL_TEST_RECIPIENT before running an email test');
  }
}

function json(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

export function sendEmail() {
  const response = http.post(
    `${API_BASE_URL}/send-email`,
    JSON.stringify({
      email: __ENV.EMAIL_TEST_RECIPIENT,
      api_key: __ENV.EMAIL_API_KEY,
      subject: `k6 email API test ${Date.now()}-${__VU}-${__ITER}`,
      body: 'Automated email API performance test.',
      note: 'k6 performance test',
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'send-email' } },
  );

  const result = json(response);
  const accepted = response.status >= 200 && response.status < 300 &&
    typeof result?.id === 'string' && result.id.length > 0;
  check(response, { 'send accepted with id': () => accepted });
  sendSuccess.add(accepted);

  if (!accepted) return;

  const statusResponse = http.get(
    `${API_BASE_URL}/email-status?id=${encodeURIComponent(result.id)}`,
    { tags: { name: 'GET /email-status', endpoint: 'email-status' } },
  );
  const status = json(statusResponse);
  const found = statusResponse.status === 200 && status?.id === result.id &&
    typeof status.status === 'string' && status.status.length > 0;
  check(statusResponse, { 'sent email has a status': () => found });
  statusSuccess.add(found);
}

export function monitor() {
  const queueResponse = http.get(`${API_BASE_URL}/queue-size`, { tags: { endpoint: 'queue-size' } });
  const queue = json(queueResponse);
  const queueOk = queueResponse.status === 200 && Number.isInteger(queue?.size) && queue.size >= 0;
  check(queueResponse, { 'queue size is valid': () => queueOk });
  monitorSuccess.add(queueOk);
  if (queueOk) queueDepth.add(queue.size);

  const healthResponse = http.get(`${API_BASE_URL}/health`, { tags: { endpoint: 'health' } });
  const health = json(healthResponse);
  const healthOk = healthResponse.status === 200 && health !== null &&
    Object.prototype.hasOwnProperty.call(health, 'service') &&
    Object.prototype.hasOwnProperty.call(health, 'database');
  check(healthResponse, { 'health reports service and database': () => healthOk });
  monitorSuccess.add(healthOk);

  sleep(10);
}
