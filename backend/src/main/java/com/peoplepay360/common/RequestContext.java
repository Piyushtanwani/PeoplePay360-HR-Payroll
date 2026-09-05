package com.peoplepay360.common;

public final class RequestContext {
    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private RequestContext() {}
    public static void setRequestId(String id) { REQUEST_ID.set(id); }
    public static String getRequestId() { return REQUEST_ID.get(); }
    public static void clear() { REQUEST_ID.remove(); }
}
