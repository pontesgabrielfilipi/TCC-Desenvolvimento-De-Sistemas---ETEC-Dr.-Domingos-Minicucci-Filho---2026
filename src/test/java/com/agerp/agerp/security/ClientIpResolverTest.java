package com.agerp.agerp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClientIpResolverTest {

    @Test
    void ignoraCabecalhoDeOrigemNaoConfiavel() {
        ClientIpResolver resolver = new ClientIpResolver("127.0.0.1");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("203.0.113.8");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.9");
        assertEquals("203.0.113.8", resolver.resolve(request));
    }

    @Test
    void usaPrimeiroIpEncaminhadoSomenteDeProxyConfiavel() {
        ClientIpResolver resolver = new ClientIpResolver("10.0.0.2");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.2");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.9, 10.0.0.1");
        assertEquals("198.51.100.9", resolver.resolve(request));
    }
}
