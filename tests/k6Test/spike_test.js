import { baseRate, monitor, sendEmail, validateConfig } from './email_api.js';

const rate = baseRate();

export const options = {
  scenarios: {
    email_spike: {
      executor: 'ramping-arrival-rate',
      startRate: rate,
      timeUnit: '1m',
      stages: [
        { target: rate, duration: '30s' },
        { target: rate * 10, duration: '10s' },
        { target: rate * 10, duration: '30s' },
        { target: rate, duration: '10s' },
        { target: rate, duration: '30s' },
      ],
      preAllocatedVUs: 2,
      maxVUs: 20,
      exec: 'send',
    },
    service_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m50s',
      exec: 'observe',
    },
  },
  thresholds: {
    dropped_iterations: ['count<1'],
    email_send_success: ['rate>0.95'],
    email_status_success: ['rate>0.95'],
    email_monitor_success: ['rate>0.95'],
  },
};

export function setup() { validateConfig(); }
export function send() { sendEmail(); }
export function observe() { monitor(); }
