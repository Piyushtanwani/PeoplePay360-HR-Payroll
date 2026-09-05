package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.model.Department;
import com.peoplepay360.repository.DepartmentRepository;
import com.peoplepay360.model.Employee;
import com.peoplepay360.repository.EmployeeRepository;
import com.peoplepay360.model.Contract;
import com.peoplepay360.repository.ContractRepository;
import com.peoplepay360.dto.PayrollDtos.*;
import com.peoplepay360.security.OwnershipGuard;
import com.peoplepay360.security.ScopeResolver;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.peoplepay360.model.Payslip;
import com.peoplepay360.repository.PayrunInputRepository;
import com.peoplepay360.repository.PayrunRepository;
import com.peoplepay360.repository.PayslipDeliveryRepository;
import com.peoplepay360.repository.PayslipLineRepository;
import com.peoplepay360.repository.PayslipRepository;

@Service
public class PayslipService {
    private final PayslipRepository payslips;
    private final PayslipLineRepository payslipLines;
    private final PayslipDeliveryRepository deliveries;
    private final PayrunRepository payruns;
    private final PayrunInputRepository inputs;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final ContractRepository contracts;
    private final ScopeResolver scopeResolver;
    private final OwnershipGuard ownershipGuard;

    public PayslipService(PayslipRepository payslips, PayslipLineRepository payslipLines,
                          PayslipDeliveryRepository deliveries, PayrunRepository payruns,
                          PayrunInputRepository inputs, EmployeeRepository employees, DepartmentRepository departments,
                          ContractRepository contracts, ScopeResolver scopeResolver, OwnershipGuard ownershipGuard) {
        this.payslips = payslips;
        this.payslipLines = payslipLines;
        this.deliveries = deliveries;
        this.payruns = payruns;
        this.inputs = inputs;
        this.employees = employees;
        this.departments = departments;
        this.contracts = contracts;
        this.scopeResolver = scopeResolver;
        this.ownershipGuard = ownershipGuard;
    }

    @PreAuthorize("hasAuthority('payslip.read.own')")
    @Transactional(readOnly = true)
    public List<PayslipDto> list(Long payrunId, Long employeeId, String period) {
        Long scoped = scopeResolver.resolveEmployeeFilter("payslip.read.all", employeeId);
        return payslips.findAll().stream()
                .filter(p -> payrunId == null || p.getPayrunId().equals(payrunId))
                .filter(p -> scoped == null || p.getEmployeeId().equals(scoped))
                .map(this::toDto).toList();
    }

    @PreAuthorize("hasAuthority('payslip.read.own')")
    @Transactional(readOnly = true)
    public PayslipDto get(Long id) {
        Payslip p = payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
        ownershipGuard.requireOwnedOr404(p.getEmployeeId(), "payslip.read.all", "payslip", id);
        return toDto(p);
    }

    @PreAuthorize("hasAuthority('payslip.update.all')")
    @Transactional
    public void setNote(Long id, String note) {
        Payslip p = payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
        p.setNote(note);
    }

    public Payslip require(Long id) {
        return payslips.findById(id).orElseThrow(() -> ApiException.notFound("payslip"));
    }

    public PayslipDto toDto(Payslip p) {
        Employee e = employees.findById(p.getEmployeeId()).orElse(null);
        String deptName = e == null || e.getDepartmentId() == null ? null :
                departments.findById(e.getDepartmentId()).map(Department::getName).orElse(null);
        String contractRef = p.getContractId() == null ? null :
                contracts.findById(p.getContractId()).map(Contract::getReference).orElse(null);
        var payrun = payruns.findById(p.getPayrunId()).orElse(null);
        List<PayslipLineDto> lines = payslipLines.findByPayslipIdOrderBySequenceAsc(p.getId()).stream()
                .map(l -> new PayslipLineDto(l.getRuleCode(), l.getRuleName(), l.getCategory(), l.getSequence(), l.getAmount()))
                .toList();
        List<PayslipInputDto> inputDtos = inputs.findByPayrunIdAndEmployeeId(p.getPayrunId(), p.getEmployeeId())
                .stream().map(i -> new PayslipInputDto(i.getCode(), i.getValue(), i.getSource())).toList();
        PayStub stub = deliveries.findByPayslipId(p.getId())
                .map(d -> new PayStub(d.getStatus(), d.getSentAt(), d.getRecipient()))
                .orElse(new PayStub("NOT_SENT", null, e == null ? null : e.getWorkEmail()));
        return new PayslipDto(p.getId(), p.getPayrunId(), payrun == null ? null : payrun.getName(),
                payrun == null ? null : payrun.getState(), p.getEmployeeId(),
                e == null ? null : e.getDisplayName(), e == null ? null : e.getEmployeeNo(), deptName,
                p.getContractId(), contractRef, p.getPeriodStart(), p.getPeriodEnd(), p.getWorkedDays(),
                p.getScheduledDays(), p.getUnpaidDays(), p.getBasic(), p.getAllowances(), p.getDeductions(),
                p.getGross(), p.getNet(), lines, inputDtos, stub);
    }
}
