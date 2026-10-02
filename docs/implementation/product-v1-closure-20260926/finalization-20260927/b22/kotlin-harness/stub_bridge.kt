package com.facebook.react.bridge

object UiThreadUtil {
    // The harness flips this to run a pass "off the UI thread".
    @JvmField var onUiThread = true
    @JvmStatic fun isOnUiThread(): Boolean = onUiThread
}
