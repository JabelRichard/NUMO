import { TABLET_BREAKPOINT } from '../useResponsiveContentWidth';
import { responsiveTopPadding, TABLET_EXTRA_TOP } from '../useResponsiveTopPadding';

describe('responsiveTopPadding', () => {
  it('phones keep their own top padding, up to just under the breakpoint', () => {
    for (const width of [320, 393, 440, TABLET_BREAKPOINT - 1]) {
      expect(responsiveTopPadding(10, width)).toBe(10);
      expect(responsiveTopPadding(16, width)).toBe(16);
      expect(responsiveTopPadding(4, width)).toBe(4);
    }
  });

  it('tablets get extra room on top, at the same breakpoint as the content width', () => {
    for (const width of [TABLET_BREAKPOINT, 820, 1032]) {
      expect(responsiveTopPadding(10, width)).toBe(10 + TABLET_EXTRA_TOP);
      expect(responsiveTopPadding(4, width)).toBe(4 + TABLET_EXTRA_TOP);
    }
  });
});
