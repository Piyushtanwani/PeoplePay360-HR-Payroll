package com.peoplepay360.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Normalises the paging a client asked for into paging we are willing to run.
 *
 * <p>Three jobs, all of which protect the database from the query string:
 * <ul>
 *   <li>the page size is clamped, so {@code ?size=100000} cannot ask for the whole table;</li>
 *   <li>a default sort is applied when the client sends none, so a list is never in
 *       accidental insertion order and page 2 cannot repeat rows from page 1;</li>
 *   <li>sort properties are whitelisted per endpoint and translated from the public
 *       (DTO) name to the entity path. An unrecognised name is a 400 rather than a
 *       500 from Hibernate, and a caller cannot sort by — and therefore probe —
 *       a column the endpoint never exposes.</li>
 * </ul>
 */
public final class Paging {
    /** Matches the page size the web client requests; also the fallback when a caller sends none. */
    public static final int DEFAULT_SIZE = 20;
    /** Hard ceiling. Exports stream instead of paging, so nothing legitimately needs more. */
    public static final int MAX_SIZE = 200;

    private Paging() {}

    /** Whitelist where every public sort name is also the entity property name. */
    public static Pageable normalise(Pageable requested, Sort defaultSort, String... sortable) {
        Map<String, String> identity = new LinkedHashMap<>();
        for (String s : sortable) identity.put(s, s);
        return normalise(requested, defaultSort, identity);
    }

    /**
     * @param sortable public sort name -> entity property path, for example
     *                 {@code structureName -> structure.name}.
     */
    public static Pageable normalise(Pageable requested, Sort defaultSort, Map<String, String> sortable) {
        // An unpaged request throws on getPageSize(), so treat it as "no preference expressed".
        boolean paged = requested != null && requested.isPaged();
        int size = !paged || requested.getPageSize() <= 0
                ? DEFAULT_SIZE
                : Math.min(requested.getPageSize(), MAX_SIZE);
        int page = paged ? Math.max(0, requested.getPageNumber()) : 0;

        if (requested == null || requested.getSort().isUnsorted()) {
            return PageRequest.of(page, size, defaultSort);
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (Sort.Order order : requested.getSort()) {
            String path = sortable.get(order.getProperty());
            if (path == null) {
                throw ApiException.validation("Cannot sort by '" + order.getProperty()
                        + "'. Sortable fields: " + String.join(", ", new TreeSet<>(sortable.keySet())));
            }
            orders.add(new Sort.Order(order.getDirection(), path));
        }
        // Append the default as a tiebreaker so equal keys keep a stable order across pages.
        for (Sort.Order fallback : defaultSort) {
            boolean alreadySorted = orders.stream().anyMatch(o -> o.getProperty().equals(fallback.getProperty()));
            if (!alreadySorted) orders.add(fallback);
        }
        return PageRequest.of(page, size, Sort.by(orders));
    }
}
