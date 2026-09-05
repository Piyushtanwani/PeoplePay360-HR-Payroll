package com.peoplepay360.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.peoplepay360.model.TimeOffType;
public interface TimeOffTypeRepository extends JpaRepository<TimeOffType, Long> {
    Optional<TimeOffType> findByCode(String code);
}
