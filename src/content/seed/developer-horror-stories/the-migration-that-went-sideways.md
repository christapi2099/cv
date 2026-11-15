---
title: "The Migration That Went Sideways (and What I'd Do Again)"
summary: "Moving RollTrack off AWS was supposed to be a weekend infrastructure task. The database moved fine. The assumptions around it did not. A war story about cutovers, hidden dependencies, and keeping customers out of your maintenance window."
date: 2026-11-14
featureImage: null
featureImageAlt: null
featureImageCaption: null
draft: true
slug: the-migration-that-went-sideways
tags:
  - migration
  - infrastructure
  - postgresql
claim_source:
  - claim: "Moved RollTrackApp from AWS to DigitalOcean without customer-visible downtime"
    source: "PROMPT.md — case studies (owner-supplied facts)"
    checked: "2026-11-14"
  - claim: "RollTrackApp began as a UC Irvine capstone at the 2025 ICS Project Expo and became a company"
    source: "https://ics.uci.edu/2026/03/19/from-project-expo-to-cto-alumnus-christopher-tapia-kicked-his-career-into-high-gear/"
    checked: "2026-11-14"
---

The migration started the way most migrations start: with a bill I did not want to keep paying and a spreadsheet that said the move would be straightforward.

RollTrack runs the parts of a martial arts gym that nobody opens a browser for fun to look at — attendance, payments, student records, retention analytics. The app started as my UC Irvine capstone at the 2025 ICS Project Expo, then turned into a company. At some point the infrastructure stopped being a capstone detail and became the thing I thought about at night. AWS had been the default because it was the default. DigitalOcean was cheaper, simpler to reason about, and closer to the shape of the product: one small team, a predictable workload, and no desire to run a cloud platform as a side quest.

The spreadsheet was right about the monthly number. It was wrong about how many places a cloud provider hides inside an application.

## The plan looked clean on paper

The plan had five steps: stand up the new boxes, restore the database, deploy the app, lower the DNS TTL, and switch traffic during the quietest window we could find. Then we would watch dashboards, roll back if anything looked wrong, and go back to building product.

We did the boring parts first. We provisioned the new database and app server, restored a recent dump, and ran the test suite against the restored copy. We checked that migrations applied cleanly from the same commit that was running in production. We wrote down the rollback order: DNS first, then the old app server stays warm until the new one has served a full day of traffic.

What the plan did not account for was everything that had quietly learned the old address.

## The database was the easy part

People talk about database migrations as if the database is the hard part. Ours was fine. Postgres restored in minutes, the schema matched, and the app connected on the first try. The database was the one component that told the truth: either the data is there or it is not.

The application was the liar.

The first thing that broke was a background worker. It was not part of the web request path, so it was not in the deploy checklist. It had its own environment file on the old box, pointed at the old database, and kept happily writing to it after the web app had moved. We caught it because a scheduled job ran twice and a report looked off by a handful of rows. Nobody outside the company saw it. Internally, it was the moment the migration stopped being a deployment and became an audit.

Then we found the second category: URLs that were not in configuration. Uploaded files, generated reports, and a few integration callbacks had absolute hostnames baked into records or copied into environment variables by hand over the previous year. None of them were in the repository because they had been set in a dashboard. None of them were in the migration document because the migration document was written by the same person who remembered to check the obvious places.

The third category was timing. Cron jobs, retry queues, and payment webhooks all have their own clocks. If you move the database at the same time a webhook retry is in flight, you can create a duplicate event or lose one. We had planned a quiet window, but "quiet" for users is not the same as "quiet" for machines. The machines do not read your maintenance notice.

## What actually saved the cutover

Two things saved it.

The first was that we kept the old environment running. Not as a fallback we talked about, but as a real, warm environment with the same code and the same data up to the cutover point. When the worker wrote to the old database, we could compare the two and reconcile the difference instead of guessing. When a URL still pointed at the old host, the old host still answered, so the failure was visible in logs instead of being a broken page for a customer.

The second was that we treated the DNS record as a feature flag, not a finish line. We lowered the TTL ahead of time, switched it during the window, and watched both environments. The old app server stayed up until the new one had handled a full cycle of the jobs that only run at night. That is the part I would repeat: the migration is not done when the homepage loads. It is done when the least-visited code path has run successfully on the new infrastructure.

The part I would do differently is the inventory. I would make a list of every place the application can learn a hostname, a credential, or a bucket name, and I would check each one on the new box before touching DNS. Not because the list is fun, but because the alternative is discovering them one at a time while your phone is on the table and your heart rate is not where you want it.

## The honest outcome

We moved RollTrack from AWS to DigitalOcean without customer-visible downtime. That sentence is true, and it is also doing a lot of work. Inside the window, the migration went sideways in the small ways migrations always do. Customers did not see it because the old environment stayed warm, because we watched the background jobs, and because we were willing to stop and fix the boring things instead of declaring victory when the homepage rendered.

The bill went down, which was the point. The more useful outcome was a shorter list of assumptions. The application now has one documented place to change a hostname, one deploy path, and a runbook that includes the workers, the crons, and the callbacks — the parts that do not show up in a screenshot.

A migration is a stress test for your operational honesty. The database will tell you the truth. Everything around it will tell you what you forgot to write down.
