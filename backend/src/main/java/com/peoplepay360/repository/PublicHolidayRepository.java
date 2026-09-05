package com.peoplepay360.repository;

import com.peoplepay360.model.PublicHoliday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;

public interface PublicHolidayRepository
        extends JpaRepository<PublicHoliday, Long>, JpaSpecificationExecutor<PublicHoliday> {
    List<PublicHoliday> findByDateBetween(LocalDate from, LocalDate to);
    boolean existsByDate(LocalDate date);
    /** Next holidays for the employee dashboard. */
    List<PublicHoliday> findTop3ByDateGreaterThanEqualOrderByDateAsc(LocalDate from);
}
