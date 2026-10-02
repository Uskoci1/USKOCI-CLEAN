package com.facebook.react.fabric

import com.facebook.react.uimanager.IllegalViewOperationException

class FabricUIManager {
    // tag -> what resolveView does: absent = null (no ViewState / stopped surface), "view" = a mounted view,
    // "viewless" = IllegalViewOperationException (ViewState without an Android view), "broken" = any other exception.
    val state = HashMap<Int, String>()
    var resolveCalls = 0
    fun synchronouslyUpdateViewOnUIThread(tag: Int, props: Any) {}
    fun resolveView(tag: Int): Any? {
        resolveCalls++
        return when (state[tag]) {
            "view" -> Any()
            "viewless" -> throw IllegalViewOperationException("Unable to find view for tag " + tag)
            "broken" -> throw IllegalStateException("resolveView broke for " + tag)
            else -> null
        }
    }
}
