import { baseRate, monitor, sendEmail, validateConfig } from './email_api.js';

const rate = baseRate();

export const options = {
  scenarios: {
    email_stress: {
      executor: 'ramping-arrival-rate',
      startRate: rate,
      timeUnit: '1m',
      stages: [
        { target: rate * 2, duration: '1m' },
        { target: rate * 4, duration: '1m' },
        { target: rate * 8, duration: '1m' },
        { target: rate, duration: '1m' },
      ],
      preAllocatedVUs: 2,
      maxVUs: 20,
      exec: 'send',
    },
    service_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '4m',
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
