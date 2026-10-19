package com.agerp.agerp.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CacheHeaderFilterTest {
    @Test
    void impedeCacheHttpDeDadosMutaveisDaApi() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/clientes");
        var response = new MockHttpServletResponse();

        new CacheHeaderFilter().doFilter(request, response, (req, res) -> { });

        assertEquals("no-cache, no-store, must-revalidate", response.getHeader("Cache-Control"));
        assertEquals("no-cache", response.getHeader("Pragma"));
        assertEquals(0L, response.getDateHeader("Expires"));
    }
}
