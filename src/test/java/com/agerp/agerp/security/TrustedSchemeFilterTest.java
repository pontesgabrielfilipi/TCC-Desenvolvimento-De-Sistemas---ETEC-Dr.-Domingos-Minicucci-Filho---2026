package com.agerp.agerp.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class TrustedSchemeFilterTest {
    @Test void apenasPeerConfiavelPodeDeclararHttps() throws Exception {
        var filter = new TrustedSchemeFilter(new ClientIpResolver("10.8.0.2"));
        var foreign = new MockHttpServletRequest();
        foreign.setRemoteAddr("198.51.100.7");
        foreign.addHeader("X-Forwarded-Proto", "https");
        var first = new MockFilterChain();
        filter.doFilter(foreign, new MockHttpServletResponse(), first);
        assertFalse(first.getRequest().isSecure());

        var trusted = new MockHttpServletRequest();
        trusted.setRemoteAddr("10.8.0.2");
        trusted.addHeader("X-Forwarded-Proto", "https");
        var second = new MockFilterChain();
        filter.doFilter(trusted, new MockHttpServletResponse(), second);
        var passed = (jakarta.servlet.http.HttpServletRequest) second.getRequest();
        assertTrue(passed.isSecure());
        assertEquals("https", passed.getScheme());
        assertEquals("10.8.0.2", passed.getRemoteAddr());
    }

    @Test void protocoloAmbiguoNaoEConfiavel() throws Exception {
        var filter = new TrustedSchemeFilter(new ClientIpResolver("10.8.0.2"));
        var req = new MockHttpServletRequest();
        req.setRemoteAddr("10.8.0.2");
        req.addHeader("X-Forwarded-Proto", "http,https");
        var chain = new MockFilterChain();
        filter.doFilter(req, new MockHttpServletResponse(), chain);
        assertFalse(chain.getRequest().isSecure());
    }
}
