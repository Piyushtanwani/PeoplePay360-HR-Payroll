package com.peoplepay360;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** For integration tests: wipe and re-migrate the test schema on every run so seeding is deterministic. */
@Configuration
@Profile("it")
public class ItFlywayConfig {
    @Bean
    public FlywayMigrationStrategy cleanMigrateStrategy() {
        return (Flyway flyway) -> {
            flyway.clean();
            flyway.migrate();
        };
    }
}
