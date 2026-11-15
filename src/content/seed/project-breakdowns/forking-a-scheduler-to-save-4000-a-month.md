---
title: "Forking a Scheduler to Save About $4,000 a Month"
summary: "SAHA needed scheduling and telehealth video for a team far smaller than the hosted plan's minimum. Here is the build-versus-buy math, the fork strategy, and the self-hosted deployment that let a small wellness marketplace own its stack."
date: 2026-11-14
featureImage: null
featureImageAlt: null
featureImageCaption: null
draft: false
slug: forking-a-scheduler-to-save-4000-a-month
tags:
  - architecture
  - self-hosting
  - livekit
  - stripe
claim_source:
  - claim: "The scheduler SAHA needed would have required a sub-organization API plan billed for a minimum of 100 users, roughly $4,000 every month"
    source: "Owner-supplied facts, owner-confirmed 2026-11-15"
    checked: "2026-11-15"
  - claim: "Forked an open-source scheduler (cal.com), built the custom SAHA integration, and self-hosted it on a single DigitalOcean droplet"
    source: "Owner-supplied facts, owner-confirmed 2026-11-15"
    checked: "2026-11-15"
  - claim: "SAHA Meet is a self-hosted, reskinned LiveKit integration for HIPAA-appropriate telehealth video without per-seat hosted API costs"
    source: "Owner-supplied facts, owner-confirmed 2026-11-15"
    checked: "2026-11-15"
---

SAHA Collective is a wellness marketplace built for founder Alenka Kyslik. Providers need a profile, a way to take payments, and a calendar that clients can actually use. The product also needed video for telehealth sessions. None of that is exotic. The interesting part was the cost curve: the team is small, the provider count is small, and the hosted tools that fit the feature list were priced for companies several sizes larger.

This breakdown is about the scheduler, because that is where the build-versus-buy decision was clearest. The short version: the scheduling product SAHA needed would have required a sub-organization API plan billed for a minimum of 100 users — roughly $4,000 every month for a team a fraction of that size. Instead of paying it, I forked the open-source scheduler, built the custom integration SAHA actually needed, and self-hosted it on a single DigitalOcean droplet. The monthly cost dropped from thousands of dollars to a flat droplet bill, and SAHA owns the whole stack.

The rest of this post is the reasoning and the shape of the implementation.

## The constraint was the pricing model, not the feature list

The hosted scheduler was not a bad product. It had the features, the integrations, and the polish. But the plan SAHA needed sat behind a sub-organization API tier with a 100-user minimum. That minimum is the important number. It does not matter that the per-user price is reasonable at 100 users if you have a fraction of that and the bill does not scale down.

There are three normal responses to that mismatch:

1. Pay the minimum and treat it as the cost of doing business.
2. Change the product to fit a cheaper plan, which usually means dropping the provider and API workflows that make the marketplace work.
3. Own the scheduling layer, accept the maintenance, and spend the difference on engineering time.

We chose the third option because the scheduler was not the product. It was infrastructure for the product. The product is the relationship between SAHA, its providers, and its clients. Scheduling needed to be reliable and integrated, but it did not need to be a differentiator that justified a four-figure monthly bill at launch.

## What "fork the scheduler" actually means

The scheduler is a real application, not a library. SAHA's scheduler is a cut-down cal.com fork, so it has its own authentication, database, admin surface, and frontend. Forking it is not a one-line dependency swap; it is a commitment to operate a second web application. That commitment is the price of the cost saving, and it should be stated plainly before anyone starts.

The strategy was to cut the fork down to the surface SAHA needs:

- **One tenant.** SAHA runs one marketplace, not a multi-tenant scheduling platform. Removing tenant-selection and organization-switching code simplifies routing, permissions, and the database model.
- **Provider profiles and availability.** A provider has a public profile, working hours, service types, and a booking link. The fork keeps the scheduling engine and replaces the parts that assumed a generic SaaS onboarding flow.
- **Client booking.** A client picks a service, sees available times, books, and receives the confirmation the marketplace expects. The booking flow is the part that must feel like SAHA, because it is the part clients touch.
- **Payment handoff, not payment ownership.** SAHA already had Stripe in the provider portal. The scheduler hands off to the existing payment flow instead of becoming a second billing system. That keeps reconciliation in one place and avoids duplicating subscription logic.
- **Video handoff.** A confirmed telehealth appointment gets a room from SAHA Meet. The scheduler owns the calendar entry; LiveKit owns the call. Keeping those responsibilities separate made both easier to deploy and reason about.

The fork also needed a hard boundary around upstream updates. A fork that cannot take security patches is a liability. I kept the upstream history, isolated SAHA-specific changes, and documented the patch surface so a future update is a reviewable diff rather than a rewrite.

## The integration layer

The scheduler is embedded in SAHA's existing WordPress site. That sentence hides a lot of glue. The provider portal is a separate application with its own authentication and Stripe integration. The scheduler is another application with its own database. The marketplace is the thing that has to make them feel like one product.

The integration layer does four jobs:

1. **Identity.** A provider who signs up in the portal gets a scheduler account without a second manual onboarding. The mapping is explicit and stored, not inferred from an email address.
2. **Catalog.** Services and availability are synchronized from the marketplace into the scheduler. When a provider changes what they offer, the booking link reflects it.
3. **Booking events.** A confirmed booking emits an event the marketplace can consume: who booked, which service, when, and which provider. That event is the input to confirmation email, calendar sync, and the telehealth room.
4. **Failure handling.** If the scheduler is down, the marketplace should still explain what happened and offer a route back. If a booking event is duplicated, the consumer must be idempotent. These are not edge cases at scale; they are the normal behavior of a distributed system with a queue and a database.

The integration is intentionally boring. Webhooks and a small persistence layer are easier to debug at 2 a.m. than a clever event mesh that only one person understands.

## Why self-hosting on one droplet is defensible here

A single DigitalOcean droplet sounds fragile until you compare it to the actual workload. SAHA's scheduling traffic is bursty around bookings and quiet the rest of the day. The database is small. The availability calculation is not a GPU problem. One well-sized droplet with backups, monitoring, and a documented restore path is a reasonable starting point for a marketplace at this stage.

The important word is "documented." Self-hosting is only cheaper if you do not spend the savings on emergency firefighting. That means:

- nightly database backups, with a restore drill that has actually been run;
- TLS certificates that renew automatically;
- process supervision so the scheduler comes back after a deploy or a reboot;
- logs that are retained long enough to answer "what happened at 2 a.m.?";
- a staging copy for provider-facing changes.

None of that is free, but it is predictable. The hosted plan was also predictable — at a number the business could not justify yet.

## SAHA Meet and the HIPAA-appropriate posture

The scheduler handles appointments. SAHA Meet handles the video inside those appointments. It is a self-hosted LiveKit deployment, reskinned for SAHA's brand, so the call feels like part of the product instead of a generic meeting link.

The reason to self-host is the same reason as the scheduler: per-seat hosted video costs scale with usage in a way that does not match a small marketplace's economics. The reason to be careful is different. Health-adjacent video has privacy expectations, and "we used a video API" is not a posture.

I describe SAHA Meet as **HIPAA-appropriate** rather than making a certification claim. A deployment is not a certificate. What we control is how the system is deployed and configured: self-hosted infrastructure, access controlled at the application layer, no third-party call recording by default, and a clear boundary around what is stored and for how long. The exact compliance obligations depend on the provider, the data, and the agreements in place. The engineering job is to make the privacy posture explicit and reviewable, not to print a badge on a landing page.

## What the decision bought

The scheduler moved from a four-figure monthly line item to a flat droplet bill. That is the headline, and it is real. The more durable outcome is ownership: SAHA can change the booking flow, add a provider field, or adjust a reminder without waiting for a vendor roadmap or a plan upgrade.

The trade-off is maintenance. A fork is a product you now operate. I would not recommend this path for every company. If scheduling is your core differentiator, buy the mature product and spend your engineering time on the thing only you can build. If scheduling is infrastructure and the pricing model is a minimum-user mismatch, owning a narrow fork can be the rational choice — provided you budget for backups, monitoring, and the unglamorous work of keeping it alive.

That is the actual lesson from this project: the cheapest stack is not the one with the lowest invoice. It is the one whose total cost — bill plus maintenance plus risk — matches the size of the business it serves.
