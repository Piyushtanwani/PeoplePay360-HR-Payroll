package com.peoplepay360.common;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

import java.util.Collection;

/** Small predicate helpers shared by the JPA specifications each service builds for its list endpoint. */
public final class Specs {
    private Specs() {}

    /**
     * Case-insensitive contains. The user's own {@code %} and {@code _} are escaped so a search
     * for "50%" cannot turn into a wildcard that matches everything.
     */
    public static Predicate like(CriteriaBuilder cb, Expression<String> field, String q) {
        String escaped = q.toLowerCase()
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
        return cb.like(cb.lower(field), "%" + escaped + "%", '!');
    }

    /** OR of {@link #like} across several columns. */
    @SafeVarargs
    public static Predicate likeAny(CriteriaBuilder cb, String q, Expression<String>... fields) {
        Predicate[] parts = new Predicate[fields.length];
        for (int i = 0; i < fields.length; i++) parts[i] = like(cb, fields[i], q);
        return cb.or(parts);
    }

    /**
     * {@code field IN (values)}, or a predicate that matches nothing when the collection is empty.
     * Hibernate renders an empty {@code IN ()} as invalid SQL on PostgreSQL, and "no candidate ids"
     * must mean no rows rather than every row.
     */
    public static Predicate in(CriteriaBuilder cb, Expression<?> field, Collection<?> values) {
        if (values == null || values.isEmpty()) return cb.disjunction();
        return field.in(values);
    }
}
