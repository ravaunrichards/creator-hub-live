function errorResponse(res, error) {
  let e;

  if (error instanceof Error) {
    e = error;
  } else if (error && typeof error === 'object') {
    const message =
      error.message ||
      error.error_description ||
      error.details ||
      error.hint ||
      'Internal server error.';

    e = new Error(String(message));

    if (error.code) e.code = String(error.code);
    if (error.status) e.status = Number(error.status);
    if (error.details) e.details = error.details;
    if (error.hint) e.hint = error.hint;
    if (error.name) e.name = error.name;
  } else {
    e = new Error(String(error || 'Internal server error.'));
  }

  const status = Number(e.status) || 500;

  // Keep the complete structured error in Render logs for diagnosis.
  console.error('[Creator Hub Backend Error]', {
    status,
    code: e.code || 'INTERNAL_ERROR',
    message: e.message,
    details: e.details,
    hint: e.hint,
    name: e.name
  });

  return send(res, status, {
    ok: false,
    code: e.code || 'INTERNAL_ERROR',
    error: status >= 500
      ? (e.message || 'Internal server error.')
      : e.message,
    details: e.details || undefined,
    hint: e.hint || undefined
  });
}
