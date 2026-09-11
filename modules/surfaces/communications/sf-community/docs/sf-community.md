# sf-community

## Purpose

The forum, as three separate tabs: sections, the topics of one section, and one
topic's discussion. Opening a row opens a tab beside the current one — there is
no screen that shows a section tree, a topic table and a thread at once.

## Responsibility boundary

Owns forum navigation and the topic screen. Messages themselves belong to
`rp-threads`, which the browser reads directly; attachments belong to `rp-files`
through a `link` message. Membership, roles and tickets are not here.

## How a topic is created

`createTopic` on `rp-community` mints the topic id and the thread id and stamps
the author from the token; this surface then registers the thread and writes the
opening post against `rp-threads`. The split is deliberate: ids a client can
choose are ids it can steal, and a repository calling another repository is what
the architecture forbids.

## Live updates

Replies arrive over Fujin's business channel (`pushrouter`) through the
`threads-state` library, not by polling. A push carries identifiers only; the
text is re-read from `rp-threads`, where the read predicate applies.

## Direct module dependencies

- `front-core`, `g-community`, `g-threads`, `signal-channel`, `threads-state`

## Solution membership

- `communications`

## Source

`modules/surfaces/communications/sf-community`
