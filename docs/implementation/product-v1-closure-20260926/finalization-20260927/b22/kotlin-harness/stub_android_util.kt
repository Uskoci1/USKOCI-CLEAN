package android.util

object Log {
    @JvmField val lines = ArrayList<String>()
    @JvmField val traces = ArrayList<Throwable>()
    @JvmStatic fun w(tag: String, msg: String): Int { lines.add("$tag: $msg"); return 0 }
    @JvmStatic fun w(tag: String, msg: String, tr: Throwable): Int { lines.add("$tag: $msg"); traces.add(tr); return 0 }
}
