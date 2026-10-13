/* Creator Hub Creator Network — server-authoritative creator payout routes.
 * Uses the existing diamond withdrawal ledger, not a separate imaginary payouts table.
 * Actual PayPal transfers are recorded by an administrator after completing them via
 * PayPal; this module does not falsely claim to call the PayPal Payouts API.
 */
function databaseFailure(ctx, error, code, message, table = 'diamond_withdrawals') {
  const normalized = ctx.normalizeExternalError(error);
  const dbCode = String(normalized.code || '');
  const details = {
    databaseCode: normalized.code || undefined,
    databaseMessage: normalized.message || undefined,
    table: `public.${table}`,
    hint: normalized.hint || undefined,
  };
  if (['PGRST204', 'PGRST205', '42P01', '42703'].includes(dbCode)) {
    const what = dbCode === '42703' || dbCode === 'PGRST204'
      ? 'The payout database is missing a required column. Review the read-only schema preflight and migration 0019 before changing the live schema.'
      : `The required table public.${table} is missing or not visible in the PostgREST schema cache. Review migration prerequisites before applying a migration.`;
    throw ctx.fail(503, code, `${what} ${normalized.message || ''}`.trim(), details);
  }
  throw ctx.fail(500, code, normalized.message || message, details);
}

async function requireAdmin(ctx) {
  const user = await ctx.requireSupabaseUser(ctx.req);
  const profile = await ctx.profileFor(user);
  if (!profile || profile.is_admin !== true) {
    throw ctx.fail(403, 'ADMIN_REQUIRED', 'Only an authorized Creator Hub administrator can manage payout requests.');
  }
  return user;
}

function safeRpcRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function requireIdempotencyKey(ctx) {
  const headers = ctx.req && ctx.req.headers || {};
  const raw = headers['idempotency-key'] || headers['Idempotency-Key'] || '';
  const key = String(raw).trim();
  if (key.length < 16 || key.length > 200) {
    throw ctx.fail(400, 'PAYOUT_IDEMPOTENCY_REQUIRED', 'Send a unique Idempotency-Key (16–200 characters) to prevent duplicate payout requests.');
  }
  return key;
}

function mapRpcError(ctx, error, fallbackCode, fallbackMessage) {
  const normalized = ctx.normalizeExternalError(error);
  const message = String(normalized.message || fallbackMessage);
  const lower = message.toLowerCase();
  const known = [
    ['INSUFFICIENT_DIAMONDS', 409, 'INSUFFICIENT_DIAMONDS', 'There are not enough diamonds in your current balance.'],
    ['PAYPAL_PAYOUT_ACCOUNT_MISMATCH', 409, 'PAYPAL_PAYOUT_ACCOUNT_MISMATCH', 'Save your PayPal payout account again, then retry the request.'],
    ['PAYOUT_IDEMPOTENCY_CONFLICT', 409, 'PAYOUT_IDEMPOTENCY_CONFLICT', 'That idempotency key was already used for a different payout request.'],
    ['PAYOUT_NOT_FOUND', 404, 'PAYOUT_NOT_FOUND', 'The payout request was not found.'],
    ['PAYOUT_TERMINAL_STATE', 409, 'PAYOUT_TERMINAL_STATE', 'This payout has already reached a final state.'],
    ['PAYOUT_MUST_BE_APPROVED_FIRST', 409, 'PAYOUT_MUST_BE_APPROVED_FIRST', 'Approve the payout before recording it as paid.'],
    ['PAYPAL_TRANSACTION_REFERENCE_REQUIRED', 400, 'PAYPAL_TRANSACTION_REFERENCE_REQUIRED', 'Enter the PayPal transaction reference before marking a payout as paid.'],
    ['VALID_FIAT_AMOUNT_REQUIRED', 400, 'VALID_FIAT_AMOUNT_REQUIRED', 'Enter the actual payout amount and currency before approval/payment.'],
    ['INVALID_PAYOUT_TRANSITION', 409, 'INVALID_PAYOUT_TRANSITION', 'That payout status transition is not allowed.'],
    ['PAYOUT_DESTINATION_MISSING', 409, 'PAYOUT_DESTINATION_MISSING', 'This payout has no saved PayPal destination. Ask the creator to configure it.'],
  ];
  for (const [needle, status, code, friendly] of known) {
    if (message.includes(needle)) throw ctx.fail(status, code, friendly, { databaseMessage: message });
  }
  if (['PGRST204', 'PGRST205', '42P01', '42703'].includes(String(normalized.code || ''))) {
    return databaseFailure(ctx, error, fallbackCode, fallbackMessage, 'diamond_withdrawals');
  }
  throw ctx.fail(500, fallbackCode, message || fallbackMessage, { databaseCode: normalized.code || undefined });
}

export async function handlePayoutRoute(ctx) {
  const { pathname, method, req, res, fail, ok, db, requireSupabaseUser, profileFor, readJson, normalizeExternalError } = ctx;
  const client = () => db();

  if (pathname === '/api/creator/payouts' && method === 'GET') {
    const user = await requireSupabaseUser(req);
    const { data, error } = await client().from('diamond_withdrawals')
      .select('id,amount,status,reference,payout_email_snapshot,fiat_amount,fiat_currency,admin_note,paypal_transaction_id,created_at,updated_at,processed_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) databaseFailure(ctx, error, 'CREATOR_PAYOUT_HISTORY_FAILED', 'Could not load payout history.');
    return ok(res, { requests: data || [] });
  }

  if (pathname === '/api/creator/payouts' && method === 'POST') {
    const user = await requireSupabaseUser(req);
    const body = await readJson(req);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) {
      throw fail(400, 'INVALID_PAYOUT_AMOUNT', 'Enter a whole-number diamond amount greater than zero.');
    }
    const key = requireIdempotencyKey(ctx);
    const { data: destination, error: destinationError } = await client().from('paypal_payout_info')
      .select('paypal_email').eq('user_id', user.id).maybeSingle();
    if (destinationError) databaseFailure(ctx, destinationError, 'CREATOR_PAYOUT_DESTINATION_LOOKUP_FAILED', 'Could not load the saved PayPal payout account.', 'paypal_payout_info');
    if (!destination || !destination.paypal_email) {
      throw fail(409, 'PAYPAL_PAYOUT_ACCOUNT_REQUIRED', 'Save your PayPal payout email in Settings → Payments before requesting a payout.');
    }
    const reference = `creator-payout:${user.id}:${key}`;
    const { data, error } = await client().rpc('request_creator_payout', {
      p_user: user.id,
      p_amount: amount,
      p_reference: reference,
      p_paypal_email: destination.paypal_email,
    });
    if (error) mapRpcError(ctx, error, 'CREATOR_PAYOUT_REQUEST_FAILED', 'Could not create the payout request.');
    const request = safeRpcRow(data);
    if (!request || !request.id) throw fail(500, 'CREATOR_PAYOUT_REQUEST_UNCONFIRMED', 'The database did not confirm the payout request. Check payout history before retrying.');
    return ok(res, { request });
  }

  if (pathname === '/api/admin/payouts' && method === 'GET') {
    await requireAdmin(ctx);
    const { data: rows, error } = await client().from('diamond_withdrawals')
      .select('id,user_id,amount,status,reference,payout_email_snapshot,fiat_amount,fiat_currency,admin_note,processed_by,processed_at,paypal_transaction_id,created_at,updated_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) databaseFailure(ctx, error, 'ADMIN_PAYOUTS_LOOKUP_FAILED', 'Could not load creator payout requests.');
    const userIds = [...new Set((rows || []).map(row => row.user_id).filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const { data, error: profilesError } = await client().from('profiles')
        .select('id,username,display_name').in('id', userIds);
      if (profilesError) databaseFailure(ctx, profilesError, 'ADMIN_PAYOUT_CREATORS_LOOKUP_FAILED', 'Could not load payout creator labels.', 'profiles');
      profiles = data || [];
    }
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    return ok(res, { requests: (rows || []).map(row => ({
      ...row,
      creator: byId.get(row.user_id) ? {
        username: byId.get(row.user_id).username || null,
        displayName: byId.get(row.user_id).display_name || null,
      } : null,
    })) });
  }

  const updateMatch = pathname.match(/^\/api\/admin\/payouts\/([0-9a-f-]{36})\/status$/i);
  if (updateMatch && method === 'POST') {
    const actor = await requireAdmin(ctx);
    const body = await readJson(req);
    const status = String(body.status || '').trim().toLowerCase();
    if (!['approved', 'paid', 'rejected'].includes(status)) throw fail(400, 'INVALID_PAYOUT_STATUS', 'Choose approved, paid, or rejected.');
    const fiatAmount = body.fiatAmount == null || String(body.fiatAmount).trim() === '' ? null : Number(body.fiatAmount);
    if (fiatAmount !== null && (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || Math.round(fiatAmount * 100) !== fiatAmount * 100)) {
      throw fail(400, 'INVALID_FIAT_AMOUNT', 'Enter a positive amount with at most two decimal places.');
    }
    const currency = String(body.fiatCurrency || 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw fail(400, 'INVALID_FIAT_CURRENCY', 'Use a three-letter currency code, such as USD.');
    const note = String(body.adminNote || '').trim().slice(0, 1000);
    const paypalTransactionId = String(body.paypalTransactionId || '').trim().slice(0, 200);
    const { data, error } = await client().rpc('admin_update_creator_payout', {
      p_withdrawal: updateMatch[1],
      p_status: status,
      p_fiat_amount: fiatAmount,
      p_fiat_currency: currency,
      p_admin_note: note,
      p_paypal_transaction_id: paypalTransactionId,
      p_actor: actor.id,
    });
    if (error) mapRpcError(ctx, error, 'ADMIN_PAYOUT_UPDATE_FAILED', 'Could not update the payout request.');
    const request = safeRpcRow(data);
    if (!request || !request.id) throw fail(500, 'ADMIN_PAYOUT_UPDATE_UNCONFIRMED', 'The database did not confirm the payout status update.');
    return ok(res, { request });
  }

  return false;
}
