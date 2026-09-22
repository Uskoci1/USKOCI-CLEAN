'use strict';

// Use the library's Jest renderer; no native gesture/worklet runtime exists in Jest.
// Model only the documented completion callback so route/draft tests can dismiss
// a sheet. Dragging, scrolling and animation still require the device check.
const official = require('@gorhom/bottom-sheet/mock');
class BottomSheet extends official.default {
  close() { this.props.onClose?.(); }
}
module.exports = { ...official, __esModule: true, default: BottomSheet };
