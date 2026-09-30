# Email API k6 tests

These scripts target `https://emailservice.hackuta.org`. Every successful POST may send a real email. Use an inbox you control and run the profiles one at a time.

Set `EMAIL_API_KEY` and `EMAIL_TEST_RECIPIENT` in the environment before running k6. Optionally set `EMAIL_RATE_PER_MINUTE` to a positive integer; its default is `2`. Do not commit the API key or pass it as a command-line argument that might be saved in shell history.

| Script | Send profile at the default rate | Approximate sends |
| --- | --- | ---: |
| `simple_loadtest.js` | One-request smoke test | 1 |
| `load_test.js` | 2/min for 2 minutes | 4 |
| `stress_test.js` | Gradually rises from 2/min to 16/min, then falls | 30 |
| `spike_test.js` | Briefly rises from 2/min to 20/min, then recovers | 16 |
| `soak_test.js` | 2/min for 10 minutes | 20 |

Run `simple_loadtest.js` first, then one profile with `k6 run tests/k6Test/load_test.js` (substitute the other filename as needed). The send scenario posts an email and looks up the returned ID. A separate monitor samples `/queue-size` and `/health` every 10 seconds. The status check validates that the lookup succeeds; it does not require immediate delivery because new rows start as `pending`. These tests measure API acceptance and queue behavior; confirm actual delivery through the test inbox or server logs. The `email_queue_depth` metric reports sampled pending counts. Check `/queue-size` after a run to see whether the queue drains. A dropped-iterations count means k6 could not sustain the requested arrival rate and fails the four load profiles.
