# Architecture rules
- Keep default investor holdings in a shared data module consumed by Market Leaders and watchlist starters, so copied portfolios cannot drift from the displayed defaults.
- Derive sector-based watchlist starters from the existing stock sector data, so onboarding reuses maintained selections rather than a separate stock universe.
- Reuse one benefits list in authentication and guest banners; label unavailable account services as coming soon to avoid advertising working delivery or alerts.
- Keep email subscriptions and price alerts private behind server endpoints and unguessable management tokens; guests need no account and must not gain public access to other subscribers.
- Use Resend through the linked connector for digest and price-alert emails, reusing the portfolio briefing function; do not enable delivery until a verified sender is configured.
- Detect alerts from a stored previous quote to a new quote across the threshold, then retry a pending notification with a stable idempotency key rather than sending repeatedly.