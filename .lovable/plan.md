# DebugCP subscriptions and run metering

## Goal
Add Free, Plus, and Pro subscriptions with Razorpay recurring billing, atomic server-side run limits, usage visibility, pricing, and billing controls without changing the debugging pipeline’s outputs or retry behavior.

## Scope and assumptions
- Meter both user-started actions: **Find Failing Test Case** and **Run Test**. History browsing and AI chat remain unmetered.
- Existing users and new users begin on Free with **5 lifetime runs**. Existing historical runs count toward that allowance, capped at 5.
- Use editable placeholder defaults in one backend plan configuration: Plus `20 runs / ₹299 monthly`, Pro `100 runs / ₹799 monthly`, and a 3-day payment grace period. The pricing page reads this configuration from the backend, so values are never duplicated.
- Razorpay test/live mode is determined entirely by the supplied credentials and plan IDs; switching modes requires no code change.
- The project remains React + Lovable Cloud functions. No separate Node server will be introduced.

## Database and security
- Add a private `subscriptions` table for plan, status, quota, cycle dates, grace period, and Razorpay customer/subscription references.
- Add an append-only `run_usage_events` table keyed by an idempotency key. This records each charged debug action and prevents concurrent or repeated requests from consuming quota twice.
- Add a private `payment_webhook_events` table keyed by Razorpay event ID so webhook retries are idempotent.
- Add a `subscription_state_changes` audit table for safe, secret-free operational logging.
- Add database functions that atomically:
  - create a Free subscription record when needed;
  - consume one run only when quota remains;
  - return current usage and plan details;
  - activate, renew, downgrade, or mark a subscription past due.
- Restrict each user to viewing only their own subscription and usage. Payment event and audit tables remain backend-only.
- Update signup handling so new users receive Free automatically, while keeping the existing profile creation intact.

## Server-side run gating
- Add shared quota logic to the existing functions.
- The first processing function for each action consumes quota after authentication and input validation, immediately before paid AI/compiler work starts:
  - full pipeline: `analyze-problem`;
  - single test: `execute-code`.
- Generate one idempotency key per user action and pass it through the existing pipeline. Retry branches reuse that key and do not consume additional runs.
- Require a valid metered action for subsequent paid pipeline functions, preventing direct calls from bypassing limits.
- Return a stable `RUN_LIMIT_REACHED` response with plan and remaining usage so the frontend can show an upgrade prompt.
- Refresh usage after a run starts while preserving all current analysis, compilation, test generation, execution, diagnosis, storage, and chat behavior.

## Razorpay payment flow
- Add a backend plan-config endpoint as the frontend’s source for plan names, intervals, limits, and INR prices.
- Add authenticated backend endpoints to:
  - create a Razorpay subscription for Plus or Pro using the configured Razorpay plan ID;
  - read the authoritative subscription state;
  - change Plus ↔ Pro through Razorpay’s subscription update flow;
  - cancel a subscription through Razorpay.
- Add a public webhook endpoint that reads the raw request body and verifies `X-Razorpay-Signature` with HMAC-SHA256 and the dedicated webhook secret before parsing or applying data.
- Handle `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, and `payment.failed`.
- On activation or Plus → Pro upgrade, grant the new plan’s full limit immediately with no run proration.
- On renewal, reset usage once and advance cycle dates once.
- On failed payment, keep access through a configurable 3-day grace period and show a past-due banner. After grace expiration, quota checks apply Free behavior.
- On cancellation/halt, preserve the recorded paid-cycle usage for history, mark the final status, and apply Free behavior going forward.
- Store only Razorpay IDs and statuses—never payment-card data.

## Frontend
- Add protected `/pricing` and `/billing` pages using the existing visual system.
- Pricing loads all limits and prices from the backend plan-config endpoint and presents Free, Plus, and Pro monthly plans.
- Load Razorpay Checkout only when needed. The browser receives only the public key ID and newly created subscription ID.
- After checkout success, show “Confirming subscription” and poll authoritative backend state until the signed webhook activates it; never trust the checkout callback as activation proof.
- Billing shows the current plan, runs remaining, renewal date, status, upgrade/downgrade actions, and cancellation confirmation.
- Add a compact usage indicator beside the debug actions and in the main account area.
- Add limit-reached messaging linking to Pricing, and a past-due/grace-period banner linking to Billing.
- Disable controls for clear states while retaining server enforcement as the source of truth.

## Configuration and credentials
- Add `.env.example` with names only: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLUS_PLAN_ID`, and `RAZORPAY_PRO_PLAN_ID`.
- Keep editable limits, prices, intervals, and grace days in one shared backend configuration file.
- After the webhook endpoint exists, request the Razorpay values through the secure secret form. No secret will be committed, logged, returned, or exposed to the frontend.
- Provide the deployed webhook URL and required event list for Razorpay test-mode setup.

## Validation
- Test atomic parallel run attempts, exhaustion, duplicate idempotency keys, and Free lifetime limits.
- Test webhook signature rejection, duplicate webhook delivery, activation, renewal, failed payment/grace, cancellation, upgrade, and downgrade state transitions.
- Verify existing full and single-test debugging flows still work and consume exactly one run each.
- Verify pricing/billing/usage states on desktop and mobile, including checkout confirmation and upgrade links.
- Run the existing tests, add focused quota/webhook tests, check runtime logs, and confirm the app builds cleanly.
