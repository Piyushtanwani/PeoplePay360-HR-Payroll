package com.peoplepay360.service;

import com.peoplepay360.model.Contract;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeBankAccountRepository;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.repository.TimeOffRequestRepository;
import com.peoplepay360.model.Attendance;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.repository.AttendanceRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import com.peoplepay360.model.Payrun;
import com.peoplepay360.model.PayrunIssue;
import com.peoplepay360.repository.PayslipRepository;

/** Produces the pre-validation issues from Part B12 for a payrun's selected employees. */
@Component
public class PayrunChecker {
    private final EmployeeRepository employees;
    private final EmployeeBankAccountRepository banks;
    private final PayslipRepository payslips;
    private final ContractResolver contractResolver;
    private final TimeOffRequestRepository requests;
    private final AttendanceRepository attendance;
    private final VarianceService varianceService;

    public PayrunChecker(EmployeeRepository employees, EmployeeBankAccountRepository banks,
                         PayslipRepository payslips, ContractResolver contractResolver,
                         TimeOffRequestRepository requests, AttendanceRepository attendance,
                         VarianceService varianceService) {
        this.employees = employees;
        this.banks = banks;
        this.payslips = payslips;
        this.contractResolver = contractResolver;
        this.requests = requests;
        this.attendance = attendance;
        this.varianceService = varianceService;
    }

    public List<PayrunIssue> check(Payrun payrun, List<Long> employeeIds) {
        List<PayrunIssue> issues = new ArrayList<>();
        for (Long empId : employeeIds) {
            Employee e = employees.findById(empId).orElse(null);
            if (e == null) continue;

            if (banks.findById(empId).isEmpty()) {
                issues.add(issue(payrun, empId, "MISSING_BANK_DETAILS", "BLOCKER", true,
                        e.getDisplayName() + " has no bank account.", "/employees/" + empId + "?tab=bank"));
            }
            if (e.getWorkEmail() == null || e.getWorkEmail().isBlank()) {
                issues.add(issue(payrun, empId, "MISSING_EMAIL", "BLOCKER", true,
                        e.getDisplayName() + " has no work email.", "/employees/" + empId));
            }
            if (e.getDepartmentId() == null || e.getJobTitle() == null || e.getHireDate() == null) {
                issues.add(issue(payrun, empId, "INCOMPLETE_EMPLOYEE_DATA", "WARNING", true,
                        e.getDisplayName() + " is missing department, job title or hire date.", "/employees/" + empId));
            }

            ContractResolver.Resolution res = contractResolver.forPeriod(empId, payrun.getPeriodStart(), payrun.getPeriodEnd());
            if (res.contract() == null) {
                issues.add(issue(payrun, empId, "NO_VALID_CONTRACT", "BLOCKER", false,
                        e.getDisplayName() + " has no contract valid in the period.", "/contracts?employeeId=" + empId));
            } else if ("MULTIPLE_CONTRACTS_IN_PERIOD".equals(res.warning())) {
                issues.add(issue(payrun, empId, "MULTIPLE_CONTRACTS_IN_PERIOD", "WARNING", true,
                        e.getDisplayName() + " has more than one contract intersecting the period.",
                        "/contracts?employeeId=" + empId));
            } else if ("CONTRACT_ENDS_IN_PERIOD".equals(res.warning())) {
                Contract c = res.contract();
                issues.add(issue(payrun, empId, "CONTRACT_ENDS_IN_PERIOD", "WARNING", true,
                        e.getDisplayName() + "'s contract ends within the period.", "/contracts/" + c.getId()));
            }
            if (res.contract() != null) {
                Contract c = res.contract();
                if (c.getStartDate().isAfter(payrun.getPeriodStart()) && !c.getStartDate().isAfter(payrun.getPeriodEnd())) {
                    issues.add(issue(payrun, empId, "CONTRACT_STARTS_IN_PERIOD", "WARNING", true,
                            e.getDisplayName() + "'s contract starts within the period.", "/contracts/" + c.getId()));
                }
            }

            // Duplicate payslip: a payslip on another non-cancelled payrun overlapping this period.
            boolean duplicate = payslips.findOverlapping(empId, payrun.getPeriodStart(), payrun.getPeriodEnd())
                    .stream().anyMatch(p -> !p.getPayrunId().equals(payrun.getId()));
            if (duplicate) {
                issues.add(issue(payrun, empId, "DUPLICATE_PAYSLIP", "BLOCKER", false,
                        e.getDisplayName() + " already has a payslip for an overlapping period.", null));
            }

            long pending = requests.findByEmployeeIdAndState(empId, "PENDING").stream()
                    .filter(r -> !r.getStartDate().isAfter(payrun.getPeriodEnd())
                            && !r.getEndDate().isBefore(payrun.getPeriodStart())).count();
            if (pending > 0) {
                issues.add(issue(payrun, empId, "PENDING_LEAVE_IN_PERIOD", "WARNING", true,
                        e.getDisplayName() + " has pending leave in the period.",
                        "/timeoff?tab=requests&employeeId=" + empId + "&state=PENDING"));
            }

            // Attendance nobody closed makes the worked-days input understate the month.
            long openEntries = attendance.findRange(empId, payrun.getPeriodStart(), payrun.getPeriodEnd())
                    .stream().filter(a -> a.getCheckIn() != null && a.getCheckOut() == null).count();
            if (openEntries > 0) {
                issues.add(issue(payrun, empId, "MISSING_CHECKOUT_IN_PERIOD", "WARNING", true,
                        e.getDisplayName() + " has " + openEntries
                                + " attendance entry(s) with no check-out, so worked days may be understated.",
                        "/attendance?tab=exceptions&employeeId=" + empId));
            }

            // A large move against last month is usually a data problem, so it is surfaced before payment.
            for (Payslip slip : payslips.findByPayrunId(payrun.getId())) {
                if (!slip.getEmployeeId().equals(empId)) continue;
                if (varianceService.isFlagged(slip)) {
                    issues.add(issue(payrun, empId, "VARIANCE_FLAG", "WARNING", true,
                            e.getDisplayName() + "'s net pay moved more than "
                                    + varianceService.thresholdPct() + "% against their previous payslip.",
                            "/payroll/payslips?payslipId=" + slip.getId()));
                }
            }
        }
        return issues;
    }

    private PayrunIssue issue(Payrun p, Long empId, String code, String severity, boolean overridable,
                              String message, String fixLink) {
        PayrunIssue i = new PayrunIssue();
        i.setPayrunId(p.getId());
        i.setEmployeeId(empId);
        i.setCheckCode(code);
        i.setSeverity(severity);
        i.setOverridable(overridable);
        i.setMessage(message);
        i.setStatus("OPEN");
        i.setFixLink(fixLink);
        return i;
    }
}
