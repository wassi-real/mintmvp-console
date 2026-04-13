# Add New Module: Finance

## Purpose

Track project money simply inside MintMVP Console.

---

# What it should show

## 1. Finance Overview

Cards at top:

* Total Budget
* Total Paid
* Pending Payment
* Next Milestone Amount

Example:

* Total Budget: $4,000
* Total Paid: $1,250
* Pending: $750
* Next Milestone: $500

---

## 2. Milestones

This is the main thing.

Each milestone should have:

* title
* description
* amount
* status
* due date
* paid date
* notes

### Status options

* planned
* active
* ready_for_payment
* paid
* overdue

Example:

* Fix Trivia Flow Issues — $250 — paid
* QR + Screen Scaling — $300 — ready_for_payment
* Account System — $800 — planned

---

## 3. Payments

Simple payment log.

Fields:

* amount
* date
* method
* related milestone
* notes

Method examples:

* Wise
* Bank transfer
* PayPal
* Stripe
* Cash

---

## 4. Expenses

Optional but useful if you want to track your own costs.

Fields:

* title
* amount
* category
* date
* notes

Examples:

* Developer payment
* Hosting
* Domain
* API credits

If you want to keep it client-facing only, you can skip this.

---

## 5. Outstanding Balance

Show:

* unpaid milestones
* total unpaid amount

This is very useful in meetings.

---

# New Pages

Add:

```text
/projects/[id]/finance
/projects/[id]/finance/milestones
/projects/[id]/finance/payments
```

If you want simpler, do just one page:

```text
/projects/[id]/finance
```

with tabs:

* Overview
* Milestones
* Payments

---

# Database Tables

## milestones

If you already have milestones, extend it with:

```text
id
project_id
title
description
amount
status
due_date
paid_date
notes
created_at
```

---

## payments

```text
id
project_id
milestone_id
amount
payment_method
paid_at
notes
created_at
```

---

## optional_expenses

```text
id
project_id
title
amount
category
spent_at
notes
created_at
```

Only add this if you want internal cost tracking.

---

# Simple UI layout

## Finance Overview

Top cards:

* Total Paid
* Pending
* Paid Milestones
* Unpaid Milestones

## Milestone Table

Columns:

* Milestone
* Amount
* Status
* Due Date
* Paid Date

## Payment History Table

Columns:

* Amount
* Method
* Milestone
* Date
* Notes

---

# Why this is useful for your client

Your client can instantly see:

* what work was agreed
* what each milestone costs
* what has already been paid
* what is left

That reduces awkward payment confusion.

---

# Keep it simple

Do **not** add:

* invoices
* taxes
* profit/loss
* accounting charts
* subscriptions

This is not QuickBooks.

This is just:

> project money tracker for MintMVP

---


