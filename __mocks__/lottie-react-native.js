'use strict';

/**
 * Lottie under Jest. The real module binds a native view; here an animation renders as a host
 * element named `LottieView` that carries its props (`source`, `autoPlay`, `loop`, `progress`), so a
 * test can read what a screen asked the animation to do without drawing anything. Picked up
 * automatically for the package, like the phosphor and reanimated mocks beside it.
 */
module.exports = { __esModule: true, default: 'LottieView' };
