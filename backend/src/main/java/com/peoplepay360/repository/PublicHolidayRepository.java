package com.peoplepay360.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import com.peoplepay360.model.PublicHoliday;
public interface PublicHolidayRepository extends JpaRepository<PublicHoliday, Long> {
    List<PublicHoliday> findByDateBetween(LocalDate from, LocalDate to);
}
