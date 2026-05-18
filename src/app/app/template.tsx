'use client';

/**
 * Route boundary — template.tsx re-runs on every navigation
 * (unlike layout.tsx which preserves state). Returns the
 * children as a fragment so it doesn't add a wrapping element
 * to the DOM.
 *
 * Previously this rendered a `.transition` div with a CSS
 * fade-in animation. The `animation` property on the wrapper
 * created a stacking context that trapped the LiveChatPanel
 * (z:250) so that — from the document's perspective — it
 * painted at the wrapper's z:auto instead of escaping to
 * `.shell` (z:55). The BottomNav at z:70 inside .shell ended
 * up rendering ABOVE the chat panel, so the bottom gradient
 * scrim covered the input row and the message composer became
 * untappable.
 *
 * Removing the wrapper eliminates the stacking trap entirely.
 * The fade-in is a minor cosmetic loss; each panel already has
 * its own slide-in / rise transform that carries the route
 * entrance feel on its own.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
