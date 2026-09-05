package com.peoplepay360.controller;

import com.peoplepay360.common.PageResponse;
import com.peoplepay360.dto.ContractDtos.ContractTemplateDto;
import com.peoplepay360.dto.ContractDtos.SaveContractTemplate;
import com.peoplepay360.service.ContractTemplateService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/contract-templates")
public class ContractTemplateController {
    private final ContractTemplateService service;

    public ContractTemplateController(ContractTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<ContractTemplateDto> list(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) Boolean active,
                                                  Pageable pageable) {
        return PageResponse.of(service.list(q, active, pageable));
    }

    @GetMapping("/{id}")
    public ContractTemplateDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public ContractTemplateDto create(@Valid @RequestBody SaveContractTemplate in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public ContractTemplateDto update(@PathVariable Long id, @Valid @RequestBody SaveContractTemplate in) {
        return service.update(id, in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
