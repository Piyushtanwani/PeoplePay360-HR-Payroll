package com.peoplepay360.controller;

import com.peoplepay360.service.RecruitmentService.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import com.peoplepay360.model.JobOpening;
import com.peoplepay360.service.CandidateScorer;
import com.peoplepay360.service.RecruitmentService;

@RestController
@RequestMapping("/api/recruitment")
public class RecruitmentController {
    private final RecruitmentService service;
    public RecruitmentController(RecruitmentService service) { this.service = service; }

    @GetMapping("/openings")
    public List<JobOpening> openings() { return service.listOpenings(); }
    @GetMapping("/openings/{id}")
    public JobOpening opening(@PathVariable Long id) { return service.getOpening(id); }
    @PostMapping("/openings")
    public JobOpening createOpening(@RequestBody JobOpening in) { return service.createOpening(in); }
    @PutMapping("/openings/{id}")
    public JobOpening updateOpening(@PathVariable Long id, @RequestBody JobOpening in) {
        return service.updateOpening(id, in);
    }

    @GetMapping("/openings/{id}/candidates")
    public List<CandidateView> candidates(@PathVariable Long id) { return service.listCandidates(id); }
    @PostMapping("/openings/{id}/candidates")
    public CandidateView createCandidate(@PathVariable Long id, @RequestBody CreateCandidate in) {
        return service.createCandidate(id, in);
    }
    @PutMapping("/candidates/{id}/stage")
    public CandidateView stage(@PathVariable Long id, @RequestBody StageChange in) {
        return service.changeStage(id, in);
    }
    @GetMapping("/candidates/{id}/identity")
    public IdentityView identity(@PathVariable Long id) { return service.reveal(id); }

    @PostMapping("/openings/{id}/comparison")
    public CandidateScorer.Result comparePost(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> raw = (List<Object>) body.getOrDefault("candidateIds", List.of());
        List<Long> ids = raw.stream().map(o -> ((Number) o).longValue()).toList();
        return service.compare(id, ids);
    }
    @GetMapping("/openings/{id}/comparison")
    public CandidateScorer.Result compareGet(@PathVariable Long id, @RequestParam List<Long> candidateIds) {
        return service.compare(id, candidateIds);
    }
    @PostMapping("/comparisons/{id}/decisions")
    public void decide(@PathVariable Long id, @RequestBody DecisionInput in) { service.decide(id, in); }
    @PostMapping("/candidates/{id}/convert")
    public Map<String, Long> convert(@PathVariable Long id, @RequestBody ConvertInput in) {
        return service.convert(id, in);
    }
}
