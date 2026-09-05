package com.peoplepay360.recruitment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Deterministic weighted scoring. The language model adds explanation only; the numbers come from here. */
@Component
public class CandidateScorer {
    private final ObjectMapper mapper;
    public CandidateScorer(ObjectMapper mapper) { this.mapper = mapper; }

    public record CriterionScore(String label, int score, String evidence) {}
    public record CandidateScore(String code, int total, String bandStatus, List<CriterionScore> criteria) {}
    public record Result(int rubricVersion, Map<String, Integer> weights, List<CandidateScore> candidates,
                         List<String> unassessable, String disclaimer) {}

    private static final Map<String, Integer> DEFAULT_WEIGHTS = Map.of(
            "Must-have skills coverage", 35,
            "Experience fit", 25,
            "Salary within band", 20,
            "Availability", 10,
            "Nice-to-have skills", 10);

    public Result score(JobOpening opening, List<Candidate> candidates) {
        List<CandidateScore> scores = new ArrayList<>();
        for (Candidate c : candidates) {
            JsonNode profile = read(c.getProfile());
            List<CriterionScore> crit = new ArrayList<>();

            int mustHave = mustHaveCoverage(profile);
            crit.add(new CriterionScore("Must-have skills coverage", mustHave,
                    "Required skills present at level"));

            int exp = experienceFit(profile);
            crit.add(new CriterionScore("Experience fit", exp, years(profile) + " years of experience"));

            String bandStatus = bandStatus(opening, c.getExpectedSalary());
            int salary = salaryScore(bandStatus);
            crit.add(new CriterionScore("Salary within band", salary, bandStatus));

            int avail = availabilityScore(opening, c);
            crit.add(new CriterionScore("Availability", avail,
                    c.getAvailableFrom() == null ? "Availability unknown" : "Available from " + c.getAvailableFrom()));

            int nice = niceToHave(profile);
            crit.add(new CriterionScore("Nice-to-have skills", nice, "Optional skills present"));

            int total = weighted(crit);
            scores.add(new CandidateScore(c.getDisplayCode(), total, bandStatus, crit));
        }
        List<String> unassessable = List.of(
                "Communication and cultural fit cannot be assessed from structured profiles.");
        return new Result(1, DEFAULT_WEIGHTS, scores, unassessable,
                "Advisory output. A human records the decision.");
    }

    private int weighted(List<CriterionScore> crit) {
        double total = 0;
        for (CriterionScore cs : crit) {
            int w = DEFAULT_WEIGHTS.getOrDefault(cs.label(), 0);
            total += (cs.score() / 5.0) * w;
        }
        return BigDecimal.valueOf(total).setScale(0, RoundingMode.HALF_UP).intValue();
    }

    private int mustHaveCoverage(JsonNode profile) {
        JsonNode skills = profile.path("skills");
        if (!skills.isArray() || skills.isEmpty()) return 0;
        int must = 0, have = 0;
        for (JsonNode s : skills) {
            if (s.path("isMustHave").asBoolean(false)) {
                must++;
                if (s.path("level").asInt(0) >= 3) have++;
            }
        }
        if (must == 0) return 3;
        return (int) Math.round((double) have / must * 5);
    }

    private int niceToHave(JsonNode profile) {
        JsonNode skills = profile.path("skills");
        if (!skills.isArray() || skills.isEmpty()) return 0;
        int nice = 0, have = 0;
        for (JsonNode s : skills) {
            if (!s.path("isMustHave").asBoolean(false)) {
                nice++;
                if (s.path("level").asInt(0) >= 3) have++;
            }
        }
        if (nice == 0) return 3;
        return (int) Math.round((double) have / nice * 5);
    }

    private int years(JsonNode profile) { return profile.path("yearsExperience").asInt(0); }

    private int experienceFit(JsonNode profile) {
        int y = years(profile);
        if (y >= 3 && y <= 10) return 5;
        if (y < 3) return Math.max(0, 5 - (3 - y));
        return Math.max(0, 5 - (y - 10));
    }

    private String bandStatus(JobOpening o, BigDecimal expected) {
        if (expected == null || o.getBandMin() == null || o.getBandMax() == null) return "UNKNOWN";
        if (expected.compareTo(o.getBandMax()) > 0) {
            double pct = expected.subtract(o.getBandMax()).doubleValue() / o.getBandMax().doubleValue() * 100;
            return "ABOVE_BAND_" + (int) Math.round(pct) + "PCT";
        }
        if (expected.compareTo(o.getBandMin()) < 0) return "BELOW_BAND";
        return "WITHIN_BAND";
    }

    private int salaryScore(String bandStatus) {
        if (bandStatus.equals("WITHIN_BAND") || bandStatus.equals("BELOW_BAND")) return 5;
        if (bandStatus.startsWith("ABOVE_BAND_")) {
            int pct = Integer.parseInt(bandStatus.replaceAll("\\D", ""));
            return Math.max(0, 5 - pct / 5);
        }
        return 3;
    }

    private int availabilityScore(JobOpening o, Candidate c) {
        if (c.getAvailableFrom() == null || o.getTargetStartDate() == null) return 3;
        if (!c.getAvailableFrom().isAfter(o.getTargetStartDate())) return 5;
        long weeks = java.time.temporal.ChronoUnit.WEEKS.between(o.getTargetStartDate(), c.getAvailableFrom());
        return Math.max(0, 5 - (int) (weeks / 2));
    }

    private JsonNode read(String json) {
        try { return mapper.readTree(json == null ? "{}" : json); }
        catch (Exception e) { return mapper.createObjectNode(); }
    }
}
