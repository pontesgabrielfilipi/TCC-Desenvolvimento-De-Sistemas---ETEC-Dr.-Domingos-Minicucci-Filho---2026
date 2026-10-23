package com.agerp.agerp.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DatabaseSeederProfileTest {

    @Test
    void seederExigeHabilitacaoExplicita() {
        ConditionalOnProperty condition = DatabaseSeeder.class.getAnnotation(ConditionalOnProperty.class);

        assertNotNull(condition);
        assertEquals("agerp.seed.enabled", condition.name()[0]);
        assertEquals("true", condition.havingValue());
        assertFalse(condition.matchIfMissing());
    }
}
