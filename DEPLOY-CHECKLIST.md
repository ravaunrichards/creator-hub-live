# Clean frontend rollout checklist

- [ ] Review this folder as a separate frontend; do not overwrite the existing frontend while reviewing.
- [ ] Confirm the existing backend API and CORS allow the new frontend origin.
- [ ] Confirm `/api/live/rooms` response shape and `/api/livekit/health` response semantics against the deployed backend.
- [ ] Implement and test real authentication before enabling user actions.
- [ ] Verify server-backed video retrieval, upload, comments, follows, likes, messaging, gifts/wallet, and LiveKit token/room lifecycle.
- [ ] Test phone, tablet, desktop, keyboard navigation, safe-area insets, and low-bandwidth behavior.
- [ ] Deploy a preview first and verify browser console/network logs.
- [ ] Only after acceptance, switch the existing Render frontend service root to the new directory; leave backend configuration unchanged.
- [ ] Confirm the production URL, deep links, refresh-on-route behavior, and mobile navigation after deploy.
