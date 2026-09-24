'use strict';

// Use the library's Jest renderer; no native gesture/worklet runtime exists in Jest.
// Model only the documented completion callback so route/draft tests can dismiss
// a sheet, and the documented footer slot (`footerComponent` rendered through
// `BottomSheetFooter`) so the actions a sheet pins there can be found and pressed.
// The footer is rendered as a component, as the library renders it, so a footer
// function rebuilt on every render is mounted again here just as it is on a phone.
// The shape is the same with or without a footer, so the content is never mounted
// again when one appears (a guard's question, say).
// Dragging, scrolling and animation still require the device check.
const React = require('react');
const official = require('@gorhom/bottom-sheet/mock');
const NO_POSITION = { value: 0, get: () => 0, set: () => undefined };
class BottomSheet extends official.default {
  close() { this.props.onClose?.(); }
  render() {
    const Footer = this.props.footerComponent;
    return React.createElement(React.Fragment, null, this.props.children,
      Footer ? React.createElement(Footer, { animatedFooterPosition: NO_POSITION }) : null);
  }
}
const BottomSheetFooter = ({ children }) => children ?? null;
module.exports = { ...official, __esModule: true, default: BottomSheet, BottomSheetFooter };
