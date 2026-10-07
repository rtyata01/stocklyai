# Architecture rules
- Keep default investor holdings in a shared data module consumed by Market Leaders and watchlist starters, so copied portfolios cannot drift from the displayed defaults.
- Derive sector-based watchlist starters from the existing stock sector data, so onboarding reuses maintained selections rather than a separate stock universe.
- Reuse one benefits list in authentication and guest banners; label unavailable account services as coming soon to avoid advertising working delivery or alerts.