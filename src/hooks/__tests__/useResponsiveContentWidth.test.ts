import { responsiveContentWidth, TABLET_BREAKPOINT } from '../useResponsiveContentWidth';

describe('responsiveContentWidth', () => {
  it('phones get the base cap unchanged, up to just under the breakpoint', () => {
    for (const width of [320, 360, 393, 430, 440, 600, TABLET_BREAKPOINT - 1]) {
      expect(responsiveContentWidth(440, width)).toBe(440);
      expect(responsiveContentWidth(420, width)).toBe(420);
      expect(responsiveContentWidth(480, width)).toBe(480);
    }
  });

  it('tablets get 1.5× the base, from the breakpoint up', () => {
    for (const width of [TABLET_BREAKPOINT, 744, 820, 1032]) {
      expect(responsiveContentWidth(440, width)).toBe(660);
      expect(responsiveContentWidth(420, width)).toBe(630);
      expect(responsiveContentWidth(480, width)).toBe(720);
    }
  });

  it('follows the window: Split View narrowing an iPad drops back to the phone cap', () => {
    expect(responsiveContentWidth(440, 1032)).toBe(660);
    expect(responsiveContentWidth(440, 375)).toBe(440);
  });
});
