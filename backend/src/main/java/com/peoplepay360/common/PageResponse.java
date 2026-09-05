package com.peoplepay360.common;

import org.springframework.data.domain.Page;
import java.util.List;

public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    public static <T> PageResponse<T> of(Page<T> p) {
        return new PageResponse<>(p.getContent(), p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }
    public static <S, T> PageResponse<T> of(Page<S> p, List<T> mapped) {
        return new PageResponse<>(mapped, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }
}
