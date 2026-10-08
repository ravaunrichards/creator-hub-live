// ============================================================================
// Supabase & External Error Normalization
// ============================================================================

function normalizeExternalError(error) {
  if (!error) {
    return {
      message: 'Unknown error.',
      code: undefined,
      details: undefined,
      hint: undefined,
      name: undefined
    };
  }

  // Handle PostgREST / Supabase structured error objects directly
  if (typeof error === 'object') {
    return {
      message:
        error.message ||
        error.error_description ||
        error.details ||
        error.hint ||
        JSON.stringify(error),
      code: error.code || error.status || 'INTERNAL_ERROR',
      details: error.details || null,
      hint: error.hint || null,
      name: error.name || 'PostgrestError'
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error.',
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name
    };
  }

  return {
    message: String(error),
    code: undefined,
    details: undefined,
    hint: undefined,
    name: undefined
  };
}

function errorResponse(res, error) {
  const normalized = normalizeExternalError(error);

  const status =
    Number(error?.status) ||
    Number(error?.statusCode) ||
    500;

  const code =
    error?.code ||
    normalized.code ||
    'INTERNAL_ERROR';

  // Log structured diagnostic info safely to avoid [object Object] in logs
  console.error('[Creator Hub Backend Error]', {
    status,
    code,
    message: normalized.message,
    details: normalized.details,
    hint: normalized.hint,
    name: normalized.name
  });

  if (status >= 500) {
    return send(res, status, {
      ok: false,
      code,
      error: normalized.message || 'Internal server error.',
      details: normalized.details || undefined
    });
  }

  return send(res, status, {
    ok: false,
    code,
    error: normalized.message || 'Request failed.',
    details: normalized.details || undefined,
    hint: normalized.hint || undefined
  });
}
