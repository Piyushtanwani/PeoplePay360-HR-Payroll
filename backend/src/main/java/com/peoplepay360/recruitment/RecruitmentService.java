package com.peoplepay360.recruitment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.contract.ContractDtos;
import com.peoplepay360.contract.ContractService;
import com.peoplepay360.employee.EmployeeDtos;
import com.peoplepay360.employee.EmployeeService;
import com.peoplepay360.security.CurrentUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class RecruitmentService {
    private static final List<String> ORDER = List.of("NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED");

    private final JobOpeningRepository openings;
    private final CandidateRepository candidates;
    private final CandidateIdentityRepository identities;
    private final CandidateComparisonRepository comparisons;
    private final ComparisonDecisionRepository decisions;
    private final CandidateScorer scorer;
    private final EmployeeService employeeService;
    private final ContractService contractService;
    private final CurrentUser currentUser;
    private final AuditService audit;
    private final ObjectMapper mapper;

    public RecruitmentService(JobOpeningRepository openings, CandidateRepository candidates,
                              CandidateIdentityRepository identities, CandidateComparisonRepository comparisons,
                              ComparisonDecisionRepository decisions, CandidateScorer scorer,
                              EmployeeService employeeService, ContractService contractService,
                              CurrentUser currentUser, AuditService audit, ObjectMapper mapper) {
        this.openings = openings;
        this.candidates = candidates;
        this.identities = identities;
        this.comparisons = comparisons;
        this.decisions = decisions;
        this.scorer = scorer;
        this.employeeService = employeeService;
        this.contractService = contractService;
        this.currentUser = currentUser;
        this.audit = audit;
        this.mapper = mapper;
    }

    // ---------- openings ----------
    @PreAuthorize("hasAuthority('candidate.read')")
    @Transactional(readOnly = true)
    public List<JobOpening> listOpenings() { return openings.findAll(); }

    @PreAuthorize("hasAuthority('candidate.read')")
    @Transactional(readOnly = true)
    public JobOpening getOpening(Long id) {
        return openings.findById(id).orElseThrow(() -> ApiException.notFound("opening"));
    }

    @PreAuthorize("hasAuthority('candidate.create')")
    @Transactional
    public JobOpening createOpening(JobOpening in) { return openings.save(in); }

    @PreAuthorize("hasAuthority('candidate.update')")
    @Transactional
    public JobOpening updateOpening(Long id, JobOpening in) {
        JobOpening o = getOpening(id);
        o.setTitle(in.getTitle());
        o.setDepartmentId(in.getDepartmentId());
        o.setSalaryStructureId(in.getSalaryStructureId());
        o.setWorkingScheduleId(in.getWorkingScheduleId());
        o.setBandMin(in.getBandMin());
        o.setBandMax(in.getBandMax());
        o.setTargetStartDate(in.getTargetStartDate());
        if (in.getCriteria() != null) o.setCriteria(in.getCriteria());
        if (in.getStatus() != null) o.setStatus(in.getStatus());
        return o;
    }

    // ---------- candidates ----------
    public record CandidateView(Long id, Long openingId, String displayCode, String stage,
                                Object profile, BigDecimal expectedSalary, LocalDate availableFrom,
                                Long hiredEmployeeId, String rejectionReason) {}
    public record CreateCandidate(Map<String, Object> identity, Object profile, BigDecimal expectedSalary,
                                  LocalDate availableFrom) {}
    public record StageChange(String stage, String reason) {}
    public record IdentityView(Long candidateId, String displayName, String email, String phone) {}
    public record DecisionInput(Long candidateId, String decision, String rationale) {}
    public record ConvertInput(BigDecimal wage, LocalDate startDate, Long workingScheduleId,
                               Long salaryStructureId, Long departmentId, String jobTitle) {}

    @PreAuthorize("hasAuthority('candidate.read')")
    @Transactional(readOnly = true)
    public List<CandidateView> listCandidates(Long openingId) {
        return candidates.findByOpeningId(openingId).stream().map(this::toView).toList();
    }

    @PreAuthorize("hasAuthority('candidate.create')")
    @Transactional
    public CandidateView createCandidate(Long openingId, CreateCandidate in) {
        getOpening(openingId);
        long n = candidates.findByOpeningId(openingId).size() + 1;
        Candidate c = new Candidate();
        c.setOpeningId(openingId);
        c.setDisplayCode("C" + n);
        c.setStage("NEW");
        c.setExpectedSalary(in.expectedSalary());
        c.setAvailableFrom(in.availableFrom());
        try { c.setProfile(mapper.writeValueAsString(in.profile() == null ? Map.of() : in.profile())); }
        catch (Exception e) { c.setProfile("{}"); }
        c = candidates.save(c);
        if (in.identity() != null) {
            CandidateIdentity id = new CandidateIdentity();
            id.setCandidateId(c.getId());
            id.setDisplayName(String.valueOf(in.identity().getOrDefault("displayName", "Candidate " + c.getDisplayCode())));
            id.setEmail((String) in.identity().get("email"));
            id.setPhone((String) in.identity().get("phone"));
            identities.save(id);
        }
        return toView(c);
    }

    @PreAuthorize("hasAuthority('candidate.update')")
    @Transactional
    public CandidateView changeStage(Long candidateId, StageChange in) {
        Candidate c = require(candidateId);
        String from = c.getStage();
        String to = in.stage();
        if ("REJECTED".equals(to)) {
            if (in.reason() == null || in.reason().isBlank()) {
                throw ApiException.validation("A rejection reason is required.");
            }
            c.setStage("REJECTED");
            c.setRejectionReason(in.reason());
            return toView(c);
        }
        if ("HIRED".equals(to)) {
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Candidates become HIRED only through conversion.");
        }
        int fi = ORDER.indexOf(from), ti = ORDER.indexOf(to);
        if (fi < 0 || ti < 0 || Math.abs(ti - fi) != 1) {
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Illegal stage transition from " + from + " to " + to);
        }
        c.setStage(to);
        return toView(c);
    }

    @PreAuthorize("hasAuthority('candidate.reveal')")
    @Transactional(readOnly = true)
    public IdentityView reveal(Long candidateId) {
        CandidateIdentity id = identities.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("identity"));
        audit.record(Channel.UI, "READ_SENSITIVE", "candidate", candidateId.toString(), "ALLOW",
                "identity reveal", null, null);
        return new IdentityView(id.getCandidateId(), id.getDisplayName(), id.getEmail(), id.getPhone());
    }

    // ---------- comparison ----------
    @PreAuthorize("hasAuthority('candidate.compare')")
    @Transactional
    public CandidateScorer.Result compare(Long openingId, List<Long> candidateIds) {
        if (candidateIds == null || candidateIds.size() < 2 || candidateIds.size() > 5) {
            throw ApiException.validation("Select between 2 and 5 candidates.");
        }
        JobOpening opening = getOpening(openingId);
        List<Candidate> selected = candidateIds.stream().map(this::require).toList();
        String stage = selected.get(0).getStage();
        if (selected.stream().anyMatch(c -> !c.getStage().equals(stage))) {
            throw ApiException.validation("All candidates must be at the same stage.");
        }
        CandidateScorer.Result result = scorer.score(opening, selected);
        CandidateComparison cc = new CandidateComparison();
        cc.setOpeningId(openingId);
        cc.setCandidateIds(candidateIds.toArray(new Long[0]));
        cc.setRubricVersion(result.rubricVersion());
        cc.setRequestedBy(currentUser.userId());
        try {
            cc.setWeights(mapper.writeValueAsString(result.weights()));
            cc.setResult(mapper.writeValueAsString(result));
        } catch (Exception ignored) {}
        comparisons.save(cc);
        return result;
    }

    @PreAuthorize("hasAuthority('candidate.update')")
    @Transactional
    public void decide(Long comparisonId, DecisionInput in) {
        comparisons.findById(comparisonId).orElseThrow(() -> ApiException.notFound("comparison"));
        ComparisonDecision d = new ComparisonDecision();
        d.setComparisonId(comparisonId);
        d.setCandidateId(in.candidateId());
        d.setDecision(in.decision());
        d.setRationale(in.rationale());
        d.setDecidedBy(currentUser.userId());
        decisions.save(d);
        audit.record(Channel.UI, "COMPARISON_DECISION", "candidate", in.candidateId().toString(), "ALLOW",
                in.decision(), null, null);
    }

    // ---------- conversion ----------
    @PreAuthorize("hasAuthority('candidate.convert')")
    @Transactional
    public Map<String, Long> convert(Long candidateId, ConvertInput in) {
        Candidate c = require(candidateId);
        if (!"OFFER".equals(c.getStage())) {
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "Only a candidate at OFFER stage can be converted.");
        }
        boolean advanced = decisions.findByCandidateId(candidateId).stream()
                .anyMatch(d -> "ADVANCE".equals(d.getDecision()));
        if (!advanced) {
            throw new ApiException(ErrorCode.ILLEGAL_STATE, "An ADVANCE decision is required before conversion.");
        }
        CandidateIdentity id = identities.findById(candidateId)
                .orElseThrow(() -> ApiException.notFound("identity"));
        EmployeeDtos.CreateEmployee ce = new EmployeeDtos.CreateEmployee(
                id.getDisplayName(), in.departmentId(), null, "FULL_TIME", in.workingScheduleId(),
                LocalDate.now(), id.getEmail(), in.jobTitle());
        EmployeeDtos.EmployeeDetail emp = employeeService.create(ce);
        ContractDtos.CreateContract cc = new ContractDtos.CreateContract(
                emp.id(), in.wage(), "MONTHLY", in.startDate(), null, in.workingScheduleId(),
                in.salaryStructureId(), in.jobTitle(), in.departmentId());
        ContractDtos.ContractDto contract = contractService.create(cc);
        c.setHiredEmployeeId(emp.id());
        c.setStage("HIRED");
        audit.record(Channel.UI, "CONVERT_CANDIDATE", "candidate", candidateId.toString(), "ALLOW",
                "employee " + emp.id(), null, null);
        return Map.of("employeeId", emp.id(), "contractId", contract.id());
    }

    private Candidate require(Long id) {
        return candidates.findById(id).orElseThrow(() -> ApiException.notFound("candidate"));
    }
    private CandidateView toView(Candidate c) {
        Object profile;
        try { profile = mapper.readValue(c.getProfile(), Object.class); }
        catch (Exception e) { profile = Map.of(); }
        return new CandidateView(c.getId(), c.getOpeningId(), c.getDisplayCode(), c.getStage(), profile,
                c.getExpectedSalary(), c.getAvailableFrom(), c.getHiredEmployeeId(), c.getRejectionReason());
    }
}
