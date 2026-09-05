package com.peoplepay360.security;

import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.RequestContext;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/** Writes an RFC 7807 Problem+JSON body from inside servlet filters. */
public final class ProblemWriter {
    private ProblemWriter() {}
    public static void write(HttpServletResponse res, ErrorCode code, String detail) throws IOException {
        res.setStatus(code.status.value());
        res.setContentType("application/problem+json");
        String rid = RequestContext.getRequestId();
        String body = "{\"type\":\"about:blank\",\"title\":\"" + code.status.getReasonPhrase() + "\","
                + "\"status\":" + code.status.value() + ","
                + "\"detail\":\"" + detail.replace("\"", "'") + "\","
                + "\"code\":\"" + code.name() + "\","
                + "\"requestId\":\"" + (rid == null ? "" : rid) + "\"}";
        res.getWriter().write(body);
    }
}
