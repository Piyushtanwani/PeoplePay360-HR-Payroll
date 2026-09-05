package com.peoplepay360.unit;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.Paging;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The guard between the query string and the database. */
class PagingTest {
    private static final Sort DEFAULT = Sort.by(Sort.Order.desc("createdAt"));

    @Test
    void appliesTheDefaultSortWhenTheClientSendsNone() {
        Pageable p = Paging.normalise(PageRequest.of(0, 20), DEFAULT, "name", "createdAt");
        assertThat(p.getSort()).isEqualTo(DEFAULT);
    }

    @Test
    void fallsBackToTheDefaultSizeWhenNoneIsGiven() {
        Pageable p = Paging.normalise(Pageable.unpaged(), DEFAULT, "name");
        assertThat(p.getPageSize()).isEqualTo(Paging.DEFAULT_SIZE);
        assertThat(p.getPageNumber()).isZero();
    }

    @Test
    void clampsAnOversizedPageRatherThanReturningTheWholeTable() {
        Pageable p = Paging.normalise(PageRequest.of(3, 100_000), DEFAULT, "name");
        assertThat(p.getPageSize()).isEqualTo(Paging.MAX_SIZE);
        assertThat(p.getPageNumber()).isEqualTo(3);
    }

    @Test
    void translatesAPublicSortNameToItsEntityPath() {
        Pageable p = Paging.normalise(
                PageRequest.of(0, 20, Sort.by(Sort.Order.asc("structureName"))),
                DEFAULT, Map.of("structureName", "structure.name", "createdAt", "createdAt"));
        assertThat(p.getSort().getOrderFor("structure.name")).isNotNull();
    }

    @Test
    void appendsTheDefaultAsATiebreakerSoPagesDoNotRepeatRows() {
        Pageable p = Paging.normalise(PageRequest.of(0, 20, Sort.by(Sort.Order.asc("name"))),
                DEFAULT, "name", "createdAt");
        assertThat(p.getSort()).containsExactly(Sort.Order.asc("name"), Sort.Order.desc("createdAt"));
    }

    @Test
    void doesNotDuplicateAnOrderTheClientAlreadyAskedFor() {
        Pageable p = Paging.normalise(PageRequest.of(0, 20, Sort.by(Sort.Order.asc("createdAt"))),
                DEFAULT, "createdAt");
        assertThat(p.getSort()).containsExactly(Sort.Order.asc("createdAt"));
    }

    @Test
    void refusesAnUnknownSortFieldWithABadRequestNamingTheAllowedOnes() {
        assertThatThrownBy(() -> Paging.normalise(
                PageRequest.of(0, 20, Sort.by("passwordHash")), DEFAULT, "name", "createdAt"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("passwordHash")
                .hasMessageContaining("createdAt, name")
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
    }

    @Test
    void keepsTheDirectionTheClientAskedFor() {
        Pageable p = Paging.normalise(PageRequest.of(0, 20, Sort.by(Sort.Order.desc("name"))), DEFAULT, "name");
        assertThat(p.getSort().getOrderFor("name").getDirection()).isEqualTo(Sort.Direction.DESC);
    }
}
