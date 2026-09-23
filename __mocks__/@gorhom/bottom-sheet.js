'use strict';

// Use the library's Jest renderer; no native gesture/worklet runtime exists in Jest.
// Model only the documented completion callback so route/draft tests can dismiss
// a sheet, and the documented footer slot (`footerComponent` rendered through
// `BottomSheetFooter`) so the actions a sheet pins there can be found and pressed.
// Dragging, scrolling and animation still require the device check.
const React = require('react');
const official = require('@gorhom/bottom-sheet/mock');
const NO_POSITION = { value: 0, get: () => 0, set: () => undefined };
class BottomSheet extends official.default {
  close() { this.props.onClose?.(); }
  render() {
    const Footer = this.props.footerComponent;
    return Footer
      ? React.createElement(React.Fragment, null, this.props.children, React.createElement(Footer, { animatedFooterPosition: NO_POSITION }))
      : this.props.children;
  }
}
const BottomSheetFooter = ({ children }) => children ?? null;
module.exports = { ...official, __esModule: true, default: BottomSheet, BottomSheetFooter };
