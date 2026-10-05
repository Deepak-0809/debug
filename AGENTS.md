# Architecture rules

- Enforce account-linked data cleanup with a trigger on public profiles, preserving payment records; account deletion cascades through profiles without modifying the auth schema.
- Log only AI provider status metadata, never raw AI responses or provider error bodies, because those can include submitted code.