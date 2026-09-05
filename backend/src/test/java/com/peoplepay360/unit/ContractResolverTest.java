package com.peoplepay360.unit;

import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.service.ContractResolver;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ContractResolverTest {
    private final ContractRepository repo = mock(ContractRepository.class);
    private final ContractResolver resolver = new ContractResolver(repo);

    private Contract c(long id, LocalDate start, LocalDate end) {
        Contract c = new Contract();
        c.setReference("C-" + id);
        c.setEmployeeId(1L);
        c.setStartDate(start);
        c.setEndDate(end);
        c.setState("RUNNING");
        return c;
    }

    @Test
    void picksContractContainingPeriodEnd() {
        when(repo.findByEmployeeIdAndStateIn(eq(1L), any()))
                .thenReturn(List.of(c(1, LocalDate.of(2025, 1, 1), null)));
        ContractResolver.Resolution r = resolver.forPeriod(1L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));
        assertThat(r.contract()).isNotNull();
        assertThat(r.warning()).isNull();
    }

    @Test
    void noContractReturnsNoValidContractWarning() {
        when(repo.findByEmployeeIdAndStateIn(eq(1L), any())).thenReturn(List.of());
        ContractResolver.Resolution r = resolver.forPeriod(1L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));
        assertThat(r.contract()).isNull();
        assertThat(r.warning()).isEqualTo("NO_VALID_CONTRACT");
    }

    @Test
    void contractEndingInPeriodRaisesWarning() {
        when(repo.findByEmployeeIdAndStateIn(eq(1L), any()))
                .thenReturn(List.of(c(1, LocalDate.of(2025, 1, 1), LocalDate.of(2026, 8, 15))));
        ContractResolver.Resolution r = resolver.forPeriod(1L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));
        assertThat(r.contract()).isNotNull();
        assertThat(r.warning()).isEqualTo("CONTRACT_ENDS_IN_PERIOD");
    }

    @Test
    void multipleIntersectingContractsRaiseWarning() {
        when(repo.findByEmployeeIdAndStateIn(eq(1L), any())).thenReturn(List.of(
                c(1, LocalDate.of(2025, 1, 1), LocalDate.of(2026, 8, 31)),
                c(2, LocalDate.of(2026, 8, 10), null)));
        ContractResolver.Resolution r = resolver.forPeriod(1L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));
        assertThat(r.warning()).isEqualTo("MULTIPLE_CONTRACTS_IN_PERIOD");
    }
}
