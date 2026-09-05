package com.peoplepay360.arch;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING;

/**
 * Structural rules, so the layering both READMEs describe cannot quietly erode.
 *
 * <p>These exist because the audit found a controller building its own JPA query, which meant the
 * permission check and the query lived in different places and the CSV export could not reuse either.
 */
class ArchitectureTest {
    private static JavaClasses classes;

    @BeforeAll
    static void loadClasses() {
        classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.peoplepay360");
    }

    @Test
    void controllersDoNotReachPastTheServiceLayer() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..controller..")
                .should().dependOnClassesThat().resideInAPackage("..repository..")
                .because("a controller that queries directly puts the permission check and the query "
                        + "in different places, so neither can be reused or tested as one thing");
        rule.check(classes);
    }

    @Test
    void repositoriesDoNotDependOnServices() {
        ArchRule rule = noClasses()
                .that().resideInAPackage("..repository..")
                .should().dependOnClassesThat().resideInAPackage("..service..")
                .because("the dependency runs one way: services use repositories, never the reverse");
        rule.check(classes);
    }

    @Test
    void nothingPrintsToTheConsole() {
        NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS
                .because("diagnostics belong in the logger, where they carry a level and a request id")
                .check(classes);
    }

    @Test
    void dependenciesAreConstructorInjected() {
        NO_CLASSES_SHOULD_USE_FIELD_INJECTION
                .because("constructor injection keeps collaborators visible and makes the class testable "
                        + "without a Spring context")
                .check(classes);
    }

    @Test
    void loggingGoesThroughSlf4j() {
        NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING.check(classes);
    }
}
