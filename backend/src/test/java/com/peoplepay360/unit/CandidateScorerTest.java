package com.peoplepay360.unit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.model.Candidate;
import com.peoplepay360.service.CandidateScorer;
import com.peoplepay360.model.JobOpening;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CandidateScorerTest {
    private final CandidateScorer scorer = new CandidateScorer(new ObjectMapper());

    private JobOpening opening() {
        JobOpening o = new JobOpening();
        o.setTitle("Warehouse Supervisor");
        o.setBandMin(new BigDecimal("40000"));
        o.setBandMax(new BigDecimal("55000"));
        o.setTargetStartDate(LocalDate.of(2026, 9, 1));
        o.setCriteria("[]");
        return o;
    }
    private Candidate candidate(String code, String salary, String profile) {
        Candidate c = new Candidate();
        c.setDisplayCode(code);
        c.setExpectedSalary(new BigDecimal(salary));
        c.setAvailableFrom(LocalDate.of(2026, 9, 1));
        c.setProfile(profile);
        return c;
    }

    @Test
    void withinBandScoresFullSalaryAndAboveBandIsFlagged() {
        Candidate within = candidate("C1", "45000",
                "{\"skills\":[{\"name\":\"Shift lead\",\"level\":5,\"isMustHave\":true}],\"yearsExperience\":6}");
        Candidate above = candidate("C2", "60000",
                "{\"skills\":[{\"name\":\"Shift lead\",\"level\":3,\"isMustHave\":true}],\"yearsExperience\":8}");
        CandidateScorer.Result r = scorer.score(opening(), List.of(within, above));

        CandidateScorer.CandidateScore c1 = r.candidates().get(0);
        CandidateScorer.CandidateScore c2 = r.candidates().get(1);
        assertThat(c1.bandStatus()).isEqualTo("WITHIN_BAND");
        assertThat(c2.bandStatus()).startsWith("ABOVE_BAND_");
        assertThat(c1.total()).isBetween(0, 100);
        assertThat(r.disclaimer()).contains("human");
    }
}
