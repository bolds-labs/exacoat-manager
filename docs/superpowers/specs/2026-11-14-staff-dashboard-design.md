# Staff dashboard (short design)

## Intent
Admins and customer service need one screen that tells them what to do today: shared team notes, what needs attention, and reviews to approve, in the same look as the main Dashboard. International orders that were handed to the courier but never marked shipped must not be forgotten.

## Goals
- New screen "Staff dashboard" for administrators and shop managers. Shop managers land on it after sign-in (today they land on Orders).
- Team notes shared by everyone (stored in WordPress, never in the browser; AGENTS.md s3).
- Needs attention with links straight to the work.
- Approve or reject pending reviews without leaving the screen.

## Non-goals
- No sales figures for shop managers (they do not see money screens today; that stays).
- No chat or notifications outside the manager.

## Approaches
1. **Read existing data where it exists, add two small plugin endpoints (chosen):** order counts and reviews already have endpoints; team notes and the overdue international list need new ones.
2. Compute the overdue list in the browser from the 500-order list. Rejected: misses older orders and loads far more data than needed.

## Layout
```
Staff dashboard                                              Refresh
| Payment confirmed | Warranty to review | Reviews to approve | Overdue international |
|        7          |         2          |         5          |          1            |
---------------------------------------------------------------------------------------
| Overdue international orders              | Team notes                              |
| #542901  Jane, United States  4 days      | [Write a note...]            [Add]      |
| Goorita booked 10 Nov, still not shipped  | Pinned: Restock matte black (Rina, 2d)  |
| -> Open order                             | Customer X wants call back (Andi, 5h)   |
---------------------------------------------------------------------------------------
| Reviews waiting for approval (5)                                  View all reviews  |
| Stars, customer, product, text, photos      [Approve] [Reject]                      |
---------------------------------------------------------------------------------------
| Quick links: Orders, RMA claims, Custom label, Export shipments, Tracking pool       |
```

## Rules
- **Overdue international:** order status `ready-to-ship` (Waiting for Courier Pickup), shipping country not Indonesia, and more than 2 days since courier pickup. Pickup time is `_goorita_booked_at`, else the Rayspeed booking time if recorded, else the time the order entered `ready-to-ship` (from its status change note), else the order's last modified date. Shown oldest first with the number of days. My call: 2 days counted in full 24 hour periods.
- **Team notes:** text, author (signed-in staff member), time, pin, mark done, delete (author or administrator). Newest first, pinned on top, done notes folded away. Stored in WordPress (`exacoat_staff_notes`), capped at 300 notes.
- **Reviews:** pending reviews from the existing reviews endpoint, approve and reject use the existing status update, same rules and emails as the Reviews screen.
- Counts come from the existing counts endpoint; when it is unavailable the cards show no number (same rule as Orders).

## Left to the builder
Endpoint names, component split, empty states, screenshots in both modes.
