# Fact Memories

Total: 16

## oxmysql JS runtime caches function references

**Subject:** `fact:oxmysql-hot-restart-behavior`
**Confidence:** 95%
**Verification:** check_before_use

oxmysql's JavaScript runtime caches function references, which causes stale callback issues during hot restarts of individual resources. Full server restarts don't have this problem.

---

## DirHaven server load order configuration

**Subject:** `fact:dirhaven-server-structure`
**Confidence:** 85%
**Verification:** check_before_use

oxmysql loads at line 30, followed by bracket resources [dirhaven-core] at line 34 and [dirhaven-content], with oxmysql needing to load first.

---

## System uses PM2 process manager

**Subject:** `fact:system-configuration`
**Confidence:** 75%
**Verification:** check_before_use

The user's system uses PM2 for process management, likely for keeping services running.

---

## User operates in America/Chicago timezone

**Subject:** `fact:timezone-preference`
**Confidence:** 80%
**Verification:** check_before_use

The system is configured to use America/Chicago timezone for timestamps.

---

## Telegram Bot Token Disclosed

**Subject:** `fact:telegram-bot-token`
**Confidence:** 95%
**Verification:** check_before_use

A Telegram bot token (8662288736:AAGMUC4-Pzs39bGTQHXhM1HfgDT80CxhapU) and chat ID (7269577495) were shared in this conversation, appearing to be credentials for a heartbeat monitoring system.

---

## System Path: Vintinuum API Directory

**Subject:** `fact:system-path-vintinuum-api`
**Confidence:** 90%
**Verification:** check_before_use

User has a system at /home/vinta/vintinuum-api/ with a heartbeat.js file that sends periodic status messages.

---

## User Timezone: America/Chicago

**Subject:** `fact:timezone-chicago`
**Confidence:** 85%
**Verification:** check_before_use

The heartbeat system is configured to use America/Chicago timezone for timestamps.

---

## User has Telegram bot heartbeat system

**Subject:** `fact:telegram-bot-setup`
**Confidence:** 95%
**Verification:** check_before_use

User is setting up a heartbeat notification system that sends periodic messages to a Telegram chat (chat_id: 7269577495) using a bot token.

---

## User working on vintinuum-api project

**Subject:** `fact:user-project-location`
**Confidence:** 95%
**Verification:** check_before_use

User has a project located at /home/vinta/vintinuum-api and is working with Claude Code interface to create files.

---

## User has a Telegram bot token

**Subject:** `fact:bot-token-security`
**Confidence:** 95%
**Verification:** check_before_use

The user shared a live Telegram bot token (8662288736:AAHPXDNTxQVd8nhYuEzX4oGno8_JmXWzw4k) and was informed it should not be shared publicly as it allows control of the bot.

---

## User experiences connection issues via Telegram

**Subject:** `fact:telegram-connectivity-issues`
**Confidence:** 75%
**Verification:** check_before_use

The user reports experiencing disconnections or service interruptions when communicating through Telegram, which they attribute to infrastructure problems rather than the assistant itself.

---

## User has Windows Subsystem for Linux installed

**Subject:** `fact:user-uses-windows-subsystem-linux`
**Confidence:** 80%
**Verification:** check_before_use

The user has WSL installed with mounted drives accessible via /mnt/c/ or /mnt/d/ paths, indicating a Windows machine running WSL.

---

## User works with a system called Atlas

**Subject:** `fact:user-references-atlas-system`
**Confidence:** 65%
**Verification:** check_before_use

The user references 'Atlas' as a system or tool that can be deployed or accessed when given proper file system paths.

---

## DirHaven was built by Vinta from the ground up

**Subject:** `fact:vintinuum-origin`
**Confidence:** 80%
**Verification:** check_before_use

Vinta built DirHaven as a complete system rather than using existing frameworks or tools.

---

## User references 'Vintinuum Brain' control system

**Subject:** `fact:vintinuum-brain-concept`
**Confidence:** 60%
**Verification:** check_before_use

User mentions a concept called 'vintinuum brain' that could figure out solutions and control aspects of systems needing help across multiple scenarios.

---

## Unresolved issue with DirHaven

**Subject:** `fact:dirhaven-issue`
**Confidence:** 70%
**Verification:** check_before_use

There is an ongoing situation or problem related to 'DirHaven' that the assistant is asking the user about, suggesting it's relevant to their current emotional state.

---
