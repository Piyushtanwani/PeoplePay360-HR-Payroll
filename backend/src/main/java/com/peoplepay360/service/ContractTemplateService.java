package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.Paging;
import com.peoplepay360.common.Specs;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.dto.ContractDtos.ContractTemplateDto;
import com.peoplepay360.dto.ContractDtos.SaveContractTemplate;
import com.peoplepay360.model.ContractTemplate;
import com.peoplepay360.model.SalaryStructure;
import com.peoplepay360.model.WorkingSchedule;
import com.peoplepay360.repository.ContractTemplateRepository;
import com.peoplepay360.repository.SalaryStructureRepository;
import com.peoplepay360.repository.WorkingScheduleRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Reusable contract terms. A template is a convenience for whoever onboards people, so it reuses the
 * contract permissions rather than introducing a second set nobody has been granted.
 */
@Service
public class ContractTemplateService {
    private static final Map<String, String> SORTS =
            Map.of("name", "name", "wage", "wage", "jobTitle", "jobTitle", "active", "active",
                    "createdAt", "createdAt");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"));

    private final ContractTemplateRepository templates;
    private final WorkingScheduleRepository schedules;
    private final SalaryStructureRepository structures;
    private final AuditService audit;

    public ContractTemplateService(ContractTemplateRepository templates, WorkingScheduleRepository schedules,
                                   SalaryStructureRepository structures, AuditService audit) {
        this.templates = templates;
        this.schedules = schedules;
        this.structures = structures;
        this.audit = audit;
    }

    @PreAuthorize("hasAuthority('contract.read.all')")
    @Transactional(readOnly = true)
    public Page<ContractTemplateDto> list(String q, Boolean active, Pageable pageable) {
        Specification<ContractTemplate> spec = (root, cq, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                ps.add(cb.or(Specs.like(cb, root.get("name"), q), Specs.like(cb, root.get("jobTitle"), q)));
            }
            if (active != null) ps.add(cb.equal(root.get("active"), active));
            return cb.and(ps.toArray(new Predicate[0]));
        };
        return templates.findAll(spec, Paging.normalise(pageable, DEFAULT_SORT, SORTS)).map(this::toDto);
    }

    @PreAuthorize("hasAuthority('contract.read.all')")
    @Transactional(readOnly = true)
    public ContractTemplateDto get(Long id) {
        return toDto(require(id));
    }

    @PreAuthorize("hasAuthority('contract.create.all')")
    @Transactional
    public ContractTemplateDto create(SaveContractTemplate in) {
        if (templates.existsByNameIgnoreCase(in.name().trim())) {
            throw ApiException.conflict("A contract template named " + in.name().trim() + " already exists.");
        }
        ContractTemplate t = new ContractTemplate();
        apply(t, in);
        t.setActive(in.active() == null || in.active());
        t = templates.save(t);
        ContractTemplateDto dto = toDto(t);
        audit.record(Channel.UI, "CREATE_CONTRACT_TEMPLATE", "contract_template", t.getId().toString(), "ALLOW",
                null, null, audit.toJson(dto));
        return dto;
    }

    @PreAuthorize("hasAuthority('contract.update.all')")
    @Transactional
    public ContractTemplateDto update(Long id, SaveContractTemplate in) {
        ContractTemplate t = require(id);
        String before = audit.toJson(toDto(t));
        if (!t.getName().equalsIgnoreCase(in.name().trim()) && templates.existsByNameIgnoreCase(in.name().trim())) {
            throw ApiException.conflict("A contract template named " + in.name().trim() + " already exists.");
        }
        apply(t, in);
        if (in.active() != null) t.setActive(in.active());
        ContractTemplateDto dto = toDto(t);
        audit.record(Channel.UI, "UPDATE_CONTRACT_TEMPLATE", "contract_template", id.toString(), "ALLOW",
                null, before, audit.toJson(dto));
        return dto;
    }

    /**
     * Templates are only read at the moment a contract is created, so deleting one cannot orphan
     * anything and a hard delete is safe.
     */
    @PreAuthorize("hasAuthority('contract.delete.all')")
    @Transactional
    public void delete(Long id) {
        ContractTemplate t = require(id);
        audit.record(Channel.UI, "DELETE_CONTRACT_TEMPLATE", "contract_template", id.toString(), "ALLOW",
                t.getName(), audit.toJson(toDto(t)), null);
        templates.delete(t);
    }

    /** Loads an active template for the onboarding flow; an archived one cannot be applied. */
    ContractTemplate requireActive(Long id) {
        ContractTemplate t = require(id);
        if (!t.isActive()) {
            throw ApiException.validation("The contract template " + t.getName()
                    + " is archived and cannot be applied to a new employee.");
        }
        return t;
    }

    private ContractTemplate require(Long id) {
        return templates.findById(id).orElseThrow(() -> ApiException.notFound("contract template"));
    }

    private void apply(ContractTemplate t, SaveContractTemplate in) {
        t.setName(in.name().trim());
        t.setWage(in.wage());
        t.setWageType(in.wageType() == null || in.wageType().isBlank() ? "MONTHLY" : in.wageType());
        t.setWorkingScheduleId(in.workingScheduleId());
        t.setSalaryStructureId(in.salaryStructureId());
        t.setJobTitle(in.jobTitle());
        t.setDescription(in.description());
        if (in.workingScheduleId() != null && schedules.findById(in.workingScheduleId()).isEmpty()) {
            throw ApiException.validation("Unknown working schedule.");
        }
        if (in.salaryStructureId() != null && structures.findById(in.salaryStructureId()).isEmpty()) {
            throw ApiException.validation("Unknown salary structure.");
        }
    }

    private ContractTemplateDto toDto(ContractTemplate t) {
        String scheduleName = t.getWorkingScheduleId() == null ? null
                : schedules.findById(t.getWorkingScheduleId()).map(WorkingSchedule::getName).orElse(null);
        String structureName = t.getSalaryStructureId() == null ? null
                : structures.findById(t.getSalaryStructureId()).map(SalaryStructure::getName).orElse(null);
        return new ContractTemplateDto(t.getId(), t.getName(), t.getWage(), t.getWageType(),
                t.getWorkingScheduleId(), scheduleName, t.getSalaryStructureId(), structureName,
                t.getJobTitle(), t.getDescription(), t.isActive(), t.getCreatedAt());
    }
}
