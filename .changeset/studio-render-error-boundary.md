---
"@verbatra/studio": minor
---

Show a recoverable notice instead of a blank page when the dashboard fails to render.

Studio mounted its React tree with nothing above it to catch a render throw. React's response to an
uncaught throw during render is to unmount the whole tree, so a fault in any single panel took the
entire dashboard down to an empty page: no message, no indication that anything had happened, and
no hint that a reload was the way out.

The tree is now mounted behind an error boundary. A render throw is caught at the top and replaced
by a full-screen notice in the style of the existing session-expired screen: it is announced with
`role="alert"`, it names the error so the fault can be identified without opening devtools, and it
carries a button that reloads the dashboard. The full error and its component stack are also logged
to the browser console, which is where the faulting component is actually named. Nothing is
reported anywhere off the machine.

This covers throws raised while React renders the tree, which is the case that blanked the page.
Errors thrown from event handlers, from async callbacks, and from work scheduled outside a render
pass happen where React is not rendering, so they do not reach the boundary and are unaffected.
