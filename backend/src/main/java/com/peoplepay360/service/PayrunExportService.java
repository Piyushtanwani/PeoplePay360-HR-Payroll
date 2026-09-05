package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.model.Department;
import com.peoplepay360.model.Employee;
import com.peoplepay360.model.EmployeeBankAccount;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.repository.EmployeeBankAccountRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.PayslipRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Renders a payrun as the CSV a payments team hands to the bank.
 *
 * <p>Account numbers are exported masked. The full number is encrypted at rest and there is no reason
 * for a spreadsheet on someone's laptop to hold it; the last four digits are enough to reconcile.
 */
@Service
public class PayrunExportService {
    private static final List<String> HEADERS = List.of(
            "Payslip ID", "Employee No", "Employee", "Department", "Period Start", "Period End",
            "Bank", "Account", "Basic", "Allowances", "Deductions", "Gross", "Net");

    private final PayrunRepository payruns;
    private final PayslipRepository payslips;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final EmployeeBankAccountRepository banks;
    private final AuditService audit;

    public PayrunExportService(PayrunRepository payruns, PayslipRepository payslips,
                               EmployeeRepository employees, DepartmentRepository departments,
                               EmployeeBankAccountRepository banks, AuditService audit) {
        this.payruns = payruns;
        this.payslips = payslips;
        this.employees = employees;
        this.departments = departments;
        this.banks = banks;
        this.audit = audit;
    }

    public record Export(String filename, String csv) {}

    @PreAuthorize("hasAuthority('payrun.export')")
    @Transactional(readOnly = true)
    public Export toCsv(Long payrunId) {
        Payrun payrun = payruns.findById(payrunId).orElseThrow(() -> ApiException.notFound("payrun"));
        if ("DRAFT".equals(payrun.getState()) || "CANCELLED".equals(payrun.getState())) {
            throw ApiException.illegalState(
                    "A " + payrun.getState().toLowerCase() + " payrun has no payslips to export. Compute it first.");
        }
        List<Payslip> slips = payslips.findByPayrunId(payrunId);

        Set<Long> employeeIds = new HashSet<>();
        slips.forEach(p -> employeeIds.add(p.getEmployeeId()));
        Map<Long, Employee> employeeById = new HashMap<>();
        Set<Long> departmentIds = new HashSet<>();
        employees.findAllById(employeeIds).forEach(e -> {
            employeeById.put(e.getId(), e);
            if (e.getDepartmentId() != null) departmentIds.add(e.getDepartmentId());
        });
        Map<Long, String> departmentById = new HashMap<>();
        departments.findAllById(departmentIds).forEach(d -> departmentById.put(d.getId(), d.getName()));
        Map<Long, EmployeeBankAccount> bankById = new HashMap<>();
        banks.findAllById(employeeIds).forEach(b -> bankById.put(b.getEmployeeId(), b));

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", HEADERS)).append("\r\n");
        slips.stream()
                .sorted(Comparator.comparing(
                        p -> employeeById.containsKey(p.getEmployeeId())
                                ? employeeById.get(p.getEmployeeId()).getDisplayName() : ""))
                .forEach(p -> {
                    Employee e = employeeById.get(p.getEmployeeId());
                    EmployeeBankAccount bank = bankById.get(p.getEmployeeId());
                    csv.append(row(
                            String.valueOf(p.getId()),
                            e == null ? "" : e.getEmployeeNo(),
                            e == null ? "" : e.getDisplayName(),
                            e == null || e.getDepartmentId() == null ? "" : departmentById.get(e.getDepartmentId()),
                            String.valueOf(p.getPeriodStart()),
                            String.valueOf(p.getPeriodEnd()),
                            bank == null ? "" : bank.getBankName(),
                            bank == null ? "" : "****" + bank.getAccountLast4(),
                            String.valueOf(p.getBasic()),
                            String.valueOf(p.getAllowances()),
                            String.valueOf(p.getDeductions()),
                            String.valueOf(p.getGross()),
                            String.valueOf(p.getNet())));
                });

        audit.record(Channel.UI, "EXPORT_PAYRUN", "payrun", payrunId.toString(), "ALLOW",
                slips.size() + " payslip(s)", null, null);
        String filename = "payrun_" + payrunId + "_" + payrun.getPeriodStart() + ".csv";
        return new Export(filename, csv.toString());
    }

    private String row(String... cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(escape(cells[i]));
        }
        return sb.append("\r\n").toString();
    }

    /**
     * RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet would treat as a formula.
     * Employee names are user input and must not become executable when the file is opened.
     */
    private String escape(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            return '"' + v.replace("\"", "\"\"") + '"';
        }
        return v;
    }
}
