# Live Sessions

Live Session is implemented as a local-first collaboration system.

## Host flow

1. `arceus session host`
2. host writes session descriptor to `.arceus/sessions/<id>.meta.json`
3. host opens a local socket server
4. host appends all events to `.arceus/sessions/<id>.events.jsonl`
5. optional file watching broadcasts change activity

## Join flow

1. `arceus session join <session-id>`
2. client resolves descriptor
3. client receives snapshot plus recent events
4. live events continue over the socket connection

## Event types

- participant joined or left
- model switched
- task started or completed
- shell command started or completed
- file changed
- diff prepared
- git action recorded
- conflict detected

## Safety

Live session transport shares state and visibility. It does not silently overwrite files across terminals. Destructive operations remain explicit and inspectable.
