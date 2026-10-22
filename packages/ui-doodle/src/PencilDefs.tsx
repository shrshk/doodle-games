/**
 * Shared filters and patterns. Render once per document; every inline SVG on the page can
 * reference these ids. Kept out of `display: none`, which breaks url(#id) references.
 */
export function PencilDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {/* slight hand wobble for ink lines */}
        <filter id="doodle-pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* crayon: speckled grain punched out of fills, plus wobble */}
        <filter id="doodle-crayon" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.4"
            result="grain"
          />
          <feComposite in="SourceGraphic" in2="grain" operator="in" result="speckled" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="warp" />
          <feDisplacementMap in="speckled" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* characters: the same crayon look, but the grain only thins the fill a little, so a token
            stays solid and the board never shows through it */}
        <filter id="doodle-crayon-token" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 1.3"
            result="grain"
          />
          <feComposite in="SourceGraphic" in2="grain" operator="in" result="speckled" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="warp" />
          <feDisplacementMap in="speckled" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* die-cut sticker edge: cream halo plus a soft ink rim, so a character reads on any
            background. Radii are in the 100-unit character box, so it scales with the token. */}
        <filter id="doodle-sticker" x="-15%" y="-15%" width="130%" height="130%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="3.2" result="halo" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="4.4" result="rim" />
          <feFlood floodColor="#3B2F2A" floodOpacity="0.55" />
          <feComposite in2="rim" operator="in" result="rimInk" />
          <feFlood floodColor="#FFFDF6" />
          <feComposite in2="halo" operator="in" result="haloPaper" />
          <feMerge>
            <feMergeNode in="rimInk" />
            <feMergeNode in="haloPaper" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* white streaks over crayon fills, like paper showing through */}
        <pattern id="doodle-streak" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#fff" strokeWidth="1.3" strokeOpacity="0.38" />
        </pattern>
        <pattern id="doodle-streak-soft" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#fff" strokeWidth="1.1" strokeOpacity="0.2" />
        </pattern>
        <pattern id="doodle-streak-dark" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#2a1f1a" strokeWidth="0.9" strokeOpacity="0.16" />
        </pattern>
      </defs>
    </svg>
  );
}

/** A crayon-filled shape: flat fill, streak overlay, pencil outline. */
export function Crayon({
  d,
  fill,
  stroke,
  strokeWidth = 2,
  dark = false,
}: {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  dark?: boolean;
}) {
  return (
    <g>
      <path d={d} fill={fill} />
      <path d={d} fill={dark ? "url(#doodle-streak-dark)" : "url(#doodle-streak)"} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}
