-- The test container runs Flyway with the application's default placeholder.
-- The restricted production role is represented here by an inert NOLOGIN role.
CREATE ROLE aguser NOLOGIN;
