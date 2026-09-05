package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import com.peoplepay360.model.PayslipDelivery;

public interface PayslipDeliveryRepository extends JpaRepository<PayslipDelivery, Long> {
    Optional<PayslipDelivery> findByPayslipId(Long payslipId);
    List<PayslipDelivery> findByPayslipIdIn(List<Long> payslipIds);
}
