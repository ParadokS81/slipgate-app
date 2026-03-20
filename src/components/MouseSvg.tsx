/** Clean mouse SVG — converted from user's reference design.
 *  Accepts optional per-button color highlights. */

export interface MouseHighlights {
  mouse1?: string;   // OKLCH color
  mouse2?: string;
  mwheel?: string;
  mouse4?: string;   // side lower
  mouse5?: string;   // side upper
}

interface MouseSvgProps {
  highlights?: MouseHighlights;
}

export default function MouseSvg(props: MouseSvgProps) {
  const fill = (btn: keyof MouseHighlights) => {
    const color = props.highlights?.[btn];
    if (!color) return undefined;
    return `fill: color-mix(in oklch, ${color} 35%, oklch(0.18 0.01 250));`;
  };

  const cls = (btn: keyof MouseHighlights) =>
    props.highlights?.[btn] ? "sg-mouse-fill sg-mouse-hl" : "sg-mouse-fill";

  return (
    <svg viewBox="350 180 920 1700" xmlns="http://www.w3.org/2000/svg" class="sg-mouse-ref">
      {/* Main body + lower palm area */}
      <path transform="translate(451,406)" d="m0 0 1 4-3 36-2 41-1 33v101l3 86 5 91 7 100 4 16 8 16 8 11 8 8 15 10 16 8 19 9 30 12 20 7 28 9 39 10 35 7 35 5 35 3 16 1h57l43-3 31-4 34-6 31-7 30-8 33-11 28-11 26-11 23-12 13-10 7-7 10-15 6-14 3-15 8-113 4-73 2-49 1-39v-114l-2-48-3-42-1-12 3 3 10 21 9 27 6 25 5 35 3 38 1 23v75l-4 106-5 102-4 94-1 35v55l2 46 4 49 8 74 5 43 4 43 2 43v22l-1 26-3 32-5 34-7 34-7 24-9 26-10 23-8 16-9 17-12 19-14 20-14 18-9 10-7 8-14 15-15 14-10 9-14 11-19 14-20 13-16 9-23 12-20 9-28 10-17 5-28 6-23 3-35 2h-12l-31-2-29-4-27-6-29-9-26-10-17-8-22-12-21-13-17-12-18-14-10-9-8-7-12-11-9-9-7-8-10-11-8-10-14-18-11-17-15-25-11-21-11-25-8-22-9-32-7-33-5-35-3-37v-59l3-45 7-65 5-46 2-4 10 14 5 6 6 3 6-1 3-3 1-8-11-132-6-74-3-2-10 1-1-2v-17l11-2 1-1-1-22-5-70-5-74-2-37-1-11-2-2-1-8-2-74v-69l2-40 3-31 5-32 7-27 7-19 9-20z" class="sg-mouse-fill" />
      {/* Right button (Mouse2) */}
      <path transform="translate(812,233)" d="m0 0h12l28 2 30 4 31 6 30 8 36 12 16 6 23 10 29 14 18 11 12 8 16 12 11 9 10 9 16 16 11 14 8 11 2 15 4 46 2 38 1 33v102l-2 63-3 61-5 80-5 72-4 17-6 12-7 9-5 6-10 8-14 8-28 13-28 11-31 11-27 8-33 8-38 7-30 4-33 3-22 1h-15v-288l18-3 16-6 13-8 10-9 7-7 9-14 5-11 4-14 1-6 1-63v-95l-1-49-4-17-6-14-8-12-9-10-9-8-14-8-12-5-13-3-8-1z" class={cls("mouse2")} style={fill("mouse2")} />
      {/* Left button (Mouse1) */}
      <path transform="translate(788,233)" d="m0 0h13v137l-18 3-14 5-16 9-13 12-9 12-8 16-4 14-2 16v187l2 18 5 16 7 14 8 10 6 7 13 10 16 8 13 4 14 2 1 287-1 1h-14l-35-2-37-4-26-4-35-7-24-6-33-10-28-10-29-12-28-13-10-6-11-9-8-9-8-14-4-14-1-5-8-119-3-52-3-72-1-46v-82l1-40 3-53 4-41 2-7 10-14 11-13 7-8 8-7 12-11 17-13 15-10 20-12 21-11 25-11 26-10 34-11 30-8 31-6 20-3z" class={cls("mouse1")} style={fill("mouse1")} />
      {/* Scroll wheel housing */}
      <path transform="translate(802,379)" d="m0 0 18 1 14 4 16 8 10 8 9 9 7 11 5 10 4 14 1 6v204l-4 16-8 16-8 11-9 9-14 9-12 5-12 3h-26l-15-4-17-9-12-11-8-9-8-14-5-16-1-6v-205l4-17 8-16 8-10 10-10 11-7 16-7 9-2z" class={cls("mwheel")} style={fill("mwheel")} />
      <path transform="translate(802,379)" d="m0 0 18 1 14 4 16 8 10 8 9 9 7 11 5 10 4 14 1 6v204l-4 16-8 16-8 11-9 9-14 9-12 5-12 3h-26l-15-4-17-9-12-11-8-9-8-14-5-16-1-6v-205l4-17 8-16 8-10 10-10 11-7 16-7 9-2zm-1 38-15 2-17 6-10 7-5 6-4 10v83h-11l-3 3v53l3 3 11 1v68l3 9 6 8 11 7 14 5 11 2h22l14-3 13-5 11-8 6-10 1-4v-69h11l4-3v-53l-2-3-6-1-7 1v-83l-4-11-5-6-11-7-13-5-9-2-9-1z" class={cls("mwheel")} style={fill("mwheel")} />
      {/* Side button upper (Mouse5) */}
      <path transform="translate(424,977)" d="m0 0 5 1 10 124 6 74v3l-4-2-7-8-9-15-5-15-4-35-5-51-4-43v-19l4-8 6-4z" class={cls("mouse5")} style={fill("mouse5")} />
      {/* Side button lower (Mouse4) */}
      <path transform="translate(411,743)" d="m0 0 2 2 7 108 6 88h-11l-7-3-4-5-3-10v-123l1-27 2-14 4-11z" class={cls("mouse4")} style={fill("mouse4")} />
      {/* Button seam lines */}
      <path transform="translate(763,440)" d="m0 0 2 4v225l-4-4-2-5-1-199 1-13z" class="sg-mouse-fill" />
      <path transform="translate(848,441)" d="m0 0 3 3 2 5v211l-3 7-3 1z" class="sg-mouse-fill" />
      {/* Scroll wheel outline + ridges */}
      <path transform="translate(801,417)" d="m0 0h10l14 2 15 5 10 6 5 4 5 8 2 7v83l7-1 7 2 1 2v53l-4 3h-11v69l-4 10-5 6-9 6-16 6-11 2h-22l-15-3-14-6-10-8-5-9-1-5v-68l-11-1-3-3v-53l3-3h11v-83l4-10 7-8 10-6 15-5zm-2 9-15 3-11 4-1 1-1 240 13 5 11 2h22l17-4 7-4-1-239-12-5-16-3z" class="sg-mouse-detail" />
      <path transform="translate(797,436)" d="m0 0h17l12 2 9 3 1 4-2 2-9-2-15-2-17 1-12 3-4-1v-4l5-3z" class="sg-mouse-detail" />
      <path transform="translate(778,549)" d="m0 0h55l3 2-1 4-5 1h-34l-19-1-1-3z" class="sg-mouse-detail" />
      <path transform="translate(777,626)" d="m0 0 9 1 10 2h21l14-3 5 1-1 5-17 4h-23l-17-4-2-4z" class="sg-mouse-detail" />
      <path transform="translate(799,452)" d="m0 0h14l20 4 3 3-2 4-14-3-8-1h-11l-13 2-10 2-2-4 4-3 11-3z" class="sg-mouse-detail" />
      <path transform="translate(777,660)" d="m0 0 7 1 10 2h24l13-3 5 1v4l-8 3-9 2h-26l-15-4-2-2z" class="sg-mouse-detail" />
      <path transform="translate(777,607)" d="m0 0 8 1 13 2h17l16-3 5 1-1 5-12 3-9 1h-16l-18-3-3-1-1-4z" class="sg-mouse-detail" />
      <path transform="translate(800,528)" d="m0 0h13l20 2 3 2-1 4-3 1-22-2-33 1-1-3 3-3z" class="sg-mouse-detail" />
      <path transform="translate(778,588)" d="m0 0 19 2h18l20-2 1 4-1 2-9 2-9 1h-21l-16-2-3-1v-5z" class="sg-mouse-detail" />
      <path transform="translate(794,470)" d="m0 0h24l16 4 2 2-1 4-8-1-9-2h-24l-12 3h-5l-1-4 5-3z" class="sg-mouse-detail" />
      <path transform="translate(794,508)" d="m0 0h23l17 3 2 2-1 4-11-1-7-1h-23l-12 2h-5l-1-3 2-3z" class="sg-mouse-detail" />
      <path transform="translate(778,643)" d="m0 0 12 3 7 1h18l15-3h5l1 4-5 3-17 3h-16l-20-4-2-2 1-4z" class="sg-mouse-detail" />
      <path transform="translate(777,569)" d="m0 0h58l1 4-2 2-10 1h-37l-10-2-1-3z" class="sg-mouse-detail" />
      <path transform="translate(792,489)" d="m0 0h28l15 4 1 4-4 2-13-3-17-1-15 2-8 2-3-2 1-4 9-3z" class="sg-mouse-detail" />
    </svg>
  );
}
