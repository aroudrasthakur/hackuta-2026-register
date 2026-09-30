import { baseRate, monitor, sendEmail, validateConfig } from './email_api.js';

const rate = baseRate();

export const options = {
  scenarios: {
    email_load: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1m',
      duration: '2m',
      preAllocatedVUs: 2,
      maxVUs: 10,
      exec: 'send',
    },
    service_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'observe',
    },
  },
  thresholds: {
    dropped_iterations: ['count<1'],
    email_send_success: ['rate>0.99'],
    email_status_success: ['rate>0.99'],
    email_monitor_success: ['rate>0.99'],
    'http_req_duration{endpoint:send-email}': ['p(95)<5000'],
  },
};

export function setup() { validateConfig(); }
export function send() { sendEmail(); }
export function observe() { monitor(); }
