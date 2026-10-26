package com.agerp.agerp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.util.Collections;

class ClientIpResolverTest {

    @Test
    void ignoraCabecalhoDeOrigemNaoConfiavel() {
        ClientIpResolver resolver = new ClientIpResolver("127.0.0.1");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("203.0.113.8");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.9");
        headers(request, "198.51.100.9");
        assertEquals("203.0.113.8", resolver.resolve(request));
    }

    @Test
    void paraNoPrimeiroHopNaoConfiavelPartindoDoPeer() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.2");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.2");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.9, 10.0.0.1");
        headers(request, "198.51.100.9, 10.0.0.1");
        assertEquals("10.0.0.1", resolver.resolve(request));
    }

    @Test
    void rejeitaSpoofingESintaxeInvalida() {
        var resolver = new ClientIpResolver("10.0.0.0/24");
        var request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.2");
        headers(request, "198.51.100.9, 999.1.1.1");
        assertEquals("10.0.0.2", resolver.resolve(request));
        headers(request, "198.51.100.9, 10.0.0.3");
        assertEquals("198.51.100.9", resolver.resolve(request));
        when(request.getHeaders("Forwarded")).thenReturn(Collections.enumeration(java.util.List.of("for=1.2.3.4")));
        assertEquals("10.0.0.2", resolver.resolve(request));
    }

    @Test
    void rejeitaCidrsInvalidosEValidaIpv6() {
        assertThrows(IllegalArgumentException.class, () -> new ClientIpResolver("100.64.0.0/33"));
        assertThrows(IllegalArgumentException.class, () -> new ClientIpResolver("proxy.local"));
        var resolver = new ClientIpResolver("2001:db8::/32");
        var request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("2001:db8::1");
        headers(request, "2001:4860::8888");
        assertEquals("2001:4860::8888", resolver.resolve(request));
    }

    private void headers(HttpServletRequest request, String xff) {
        when(request.getHeaders("Forwarded")).thenReturn(Collections.emptyEnumeration());
        when(request.getHeaders("X-Real-IP")).thenReturn(Collections.emptyEnumeration());
        when(request.getHeaders("CF-Connecting-IP")).thenReturn(Collections.emptyEnumeration());
        when(request.getHeaders("X-Forwarded-For")).thenReturn(Collections.enumeration(java.util.List.of(xff)));
    }
}
