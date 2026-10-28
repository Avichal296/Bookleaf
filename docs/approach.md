# Approach

I prioritised the ticket lifecycle, private author data, and a usable workflow for the operations team. The dashboard begins with publishing context—book status and royalty facts—so an author can explain an issue without searching elsewhere. The admin queue surfaces urgency, while private notes and ownership assignment support team handoffs.

AI is assistance, not an authority. New tickets are accepted immediately with deterministic classification; a retryable queue refines the category and priority when a model is configured. Knowledge-base policy is compacted into a short prompt, and drafts are explicitly editable before they reach an author. Missing or failing AI falls back to local rules and a policy-based response.

The trade-off is a single PostgreSQL writer and UI-only file attachment in order to keep this five-day demo understandable and easy to run. A production evolution would add object storage and malware scanning, audit events, notification delivery, SLA monitoring, refresh sessions, rate limits, and managed database/Redis with secret rotation. At scale, read replicas and time partitioning precede author-key sharding; cross-shard analytics should be served from an aggregate store.
