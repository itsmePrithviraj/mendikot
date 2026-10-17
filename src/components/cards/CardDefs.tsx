import { memo } from "react";

/** Suit silhouettes on a 100×100 grid. Shared by cards, chips and buttons. */
export const SUIT_PATHS = {
  hearts:
    "M50 91C46 86 7 62 7 34C7 18 19 8 32 8C41 8 47 13 50 21C53 13 59 8 68 8C81 8 93 18 93 34C93 62 54 86 50 91Z",
  diamonds:
    "M50 3C59 21 72 36 89 50C72 64 59 79 50 97C41 79 28 64 11 50C28 36 41 21 50 3Z",
  spades:
    "M50 5C45 19 10 39 10 62C10 76 21 85 33 85C40 85 45 82 48 77C47 85 43 91 35 95H65C57 91 53 85 52 77C55 82 60 85 67 85C79 85 90 76 90 62C90 39 55 19 50 5Z",
  clubs:
    "M31 29a19 19 0 1 1 38 0a19 19 0 1 1-38 0Z M10 57a19 19 0 1 1 38 0a19 19 0 1 1-38 0Z M52 57a19 19 0 1 1 38 0a19 19 0 1 1-38 0Z M40 50a10 10 0 1 1 20 0a10 10 0 1 1-20 0Z M54 58C54 76 58 87 66 95H34C42 87 46 76 46 58Z",
} as const;

export const SHEEP_BODY =
  "M25 12.5A6.3 6.3 0 0 1 36.5 15.1A5.3 5.3 0 0 1 43.5 21.8A4.5 4.5 0 0 1 43.5 30.2A5.3 5.3 0 0 1 36.5 36.9A6.3 6.3 0 0 1 25 39.5A6.3 6.3 0 0 1 13.5 36.9A5.3 5.3 0 0 1 6.5 30.2A4.5 4.5 0 0 1 6.5 21.8A5.3 5.3 0 0 1 13.5 15.1A6.3 6.3 0 0 1 25 12.5Z";

/**
 * One hidden SVG sprite rendered once per document. Every card, chip and
 * mark composes these symbols with <use>, so artwork is defined only here.
 * Not display:none — patterns and gradients must stay resolvable.
 */
export const CardDefs = memo(function CardDefs() {
  return (
    <svg className="card-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {Object.entries(SUIT_PATHS).map(([suit, d]) => (
          <symbol key={suit} id={`s-${suit}`} viewBox="0 0 100 100">
            <path d={d} fill="currentColor" />
          </symbol>
        ))}
        <symbol id="sheep" viewBox="0 0 64 56">
          <g stroke="currentColor" strokeWidth="3.6" strokeLinecap="round">
            <path d="M15 40v10M22 41v10M31 41v10M38 40v10" />
          </g>
          <path
            d={SHEEP_BODY}
            transform="translate(-1 0) scale(1.06 1.12) translate(0 -2)"
            fill="currentColor"
            className="sheep-fleece"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <ellipse cx="44" cy="15.5" rx="5.6" ry="2.8" transform="rotate(-28 44 15.5)" fill="currentColor" />
          <ellipse cx="51" cy="23" rx="8.2" ry="10.4" transform="rotate(24 51 23)" fill="currentColor" />
          <circle cx="53.6" cy="20.4" r="1.8" className="sheep-eye" />
        </symbol>
        <symbol id="crest-k" viewBox="0 0 100 100">
          <path
            fill="currentColor"
            d="M12 74 8 30 31 49 50 14 69 49 92 30 88 74Z M12 79h76v10H12Z"
          />
          <circle cx="8" cy="27" r="5" fill="currentColor" />
          <circle cx="50" cy="11" r="5" fill="currentColor" />
          <circle cx="92" cy="27" r="5" fill="currentColor" />
        </symbol>
        <symbol id="crest-q" viewBox="0 0 100 100">
          <path
            fill="currentColor"
            d="M50 12C37 30 37 56 50 74C63 56 63 30 50 12Z M20 36C15 56 28 72 45 77C38 61 33 47 20 36Z M80 36C85 56 72 72 55 77C62 61 67 47 80 36Z M18 82H82C76 88 64 90 50 90C36 90 24 88 18 82Z"
          />
        </symbol>
        <symbol id="crest-j" viewBox="0 0 100 100">
          <path fill="currentColor" d="M74 8C42 14 24 44 26 84C52 68 70 46 74 8Z" />
          <path
            d="M26 86 64 26"
            fill="none"
            className="crest-vein"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M18 88H62" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </symbol>
        <pattern id="back-weave" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M0 0 20 20M20 0 0 20"
            className="weave-line"
            strokeWidth="1"
            fill="none"
          />
          <path d="M10 0 20 10 10 20 0 10Z" className="weave-diamond" />
          <circle cx="0" cy="0" r="1.6" className="weave-dot" />
          <circle cx="20" cy="0" r="1.6" className="weave-dot" />
          <circle cx="0" cy="20" r="1.6" className="weave-dot" />
          <circle cx="20" cy="20" r="1.6" className="weave-dot" />
        </pattern>
        <symbol id="card-back" viewBox="0 0 250 350">
          <rect width="250" height="350" rx="16" className="back-paper" />
          <rect x="9" y="9" width="232" height="332" rx="10" className="back-felt" />
          <rect x="19" y="19" width="212" height="312" rx="6" fill="url(#back-weave)" />
          <rect x="25" y="25" width="200" height="300" rx="4" className="back-frame" />
          <circle cx="125" cy="175" r="46" className="back-medallion" />
          <circle cx="125" cy="175" r="39" className="back-medallion-ring" />
          <use href="#sheep" x="94" y="148" width="62" height="54" className="back-sheep" />
        </symbol>
      </defs>
    </svg>
  );
});
