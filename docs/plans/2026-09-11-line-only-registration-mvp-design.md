# Line-only registration MVP

## Decision

Operators select one **Line** after choosing a Production Order. They do not
select, see, or need to understand Route Steps or route sequence.

The Line selector contains only Lines configured on that Production Order.
When a Line is selected, the system resolves the earliest matching internal
Route Step and stores both the Line and Route Step on the Registration.

## Why

This keeps the current normalized schema and its traceability benefits while
removing route-model complexity from the operator workflow. It also preserves
component-only behavior: an internally resolved step that does not require a
main serial hides the main-serial registration field and scans only the
registered components.

## Compatibility

The backend still accepts legacy `subline` and optional `route_step_id`
payloads for existing callers. New MVP clients submit `line_id`; the backend
uses it as the preferred route-resolution input.

## Verification

The normalized scan integration test creates a line-mapped order route,
submits a registration using `line_id`, and verifies that the correct internal
Route Step is persisted before scanning.
