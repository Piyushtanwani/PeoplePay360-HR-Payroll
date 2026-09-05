package com.peoplepay360.service;

import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;

/** Resolves the contract applicable to a payroll period, per Part B11. */
@Component
public class ContractResolver {
    private final ContractRepository contracts;
    public ContractResolver(ContractRepository contracts) { this.contracts = contracts; }

    public record Resolution(Contract contract, String warning) {}

    public Resolution forPeriod(Long employeeId, LocalDate periodStart, LocalDate periodEnd) {
        List<Contract> running = contracts.findByEmployeeIdAndStateIn(employeeId, List.of("RUNNING"));
        // 1. contract whose range contains periodEnd
        List<Contract> containsEnd = running.stream().filter(c -> c.containsDate(periodEnd)).toList();
        if (!containsEnd.isEmpty()) {
            List<Contract> intersecting = running.stream().filter(c -> c.intersects(periodStart, periodEnd)).toList();
            String warning = intersecting.size() > 1 ? "MULTIPLE_CONTRACTS_IN_PERIOD" : null;
            return new Resolution(containsEnd.get(0), warning);
        }
        // 2. otherwise the latest intersecting one
        List<Contract> intersecting = running.stream()
                .filter(c -> c.intersects(periodStart, periodEnd))
                .sorted(Comparator.comparing(Contract::getStartDate).reversed())
                .toList();
        if (!intersecting.isEmpty()) {
            String warning = intersecting.size() > 1 ? "MULTIPLE_CONTRACTS_IN_PERIOD" : "CONTRACT_ENDS_IN_PERIOD";
            return new Resolution(intersecting.get(0), warning);
        }
        return new Resolution(null, "NO_VALID_CONTRACT");
    }
}
