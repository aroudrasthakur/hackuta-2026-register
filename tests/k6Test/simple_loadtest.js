import { monitor, sendEmail, validateConfig } from './email_api.js';

// One email and one health/queue sample before running a longer profile.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    email_send_success: ['rate>0.99'],
    email_status_success: ['rate>0.99'],
    email_monitor_success: ['rate>0.99'],
  },
};

export function setup() { validateConfig(); }

export default function () {
  sendEmail();
  monitor();
}
