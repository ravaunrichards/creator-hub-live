// Run with: node --check src/creator-leagues.js
// These are manual API smoke-test cases, not claims of live integration testing.
export const creatorLeagueManualChecks = [
  ['unauthenticated registration', 'POST /api/creator-leagues/:id/register', 401],
  ['non-admin league creation', 'POST /api/creator-leagues', 403],
  ['invalid score rejected', 'POST /api/creator-leagues/:id/fixtures/:fixtureId/score', 400],
  ['registration closed blocks registration', 'POST /api/creator-leagues/:id/register', 409],
  ['capture amount/currency mismatch leaves registration unpaid', 'POST /api/creator-leagues/payments/paypal/capture-order', 502],
  ['non-owner cannot capture another user payment', 'POST /api/creator-leagues/payments/paypal/capture-order', 403],
];
