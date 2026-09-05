package com.peoplepay360.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public class PayrunEmployeeRepository {
    private final JdbcTemplate jdbc;
    public PayrunEmployeeRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void add(Long payrunId, Long employeeId) {
        jdbc.update("INSERT INTO payrun_employee(payrun_id, employee_id) VALUES (?,?) ON CONFLICT DO NOTHING",
                payrunId, employeeId);
    }
    public void clear(Long payrunId) {
        jdbc.update("DELETE FROM payrun_employee WHERE payrun_id = ?", payrunId);
    }
    public List<Long> employeeIds(Long payrunId) {
        return jdbc.queryForList("SELECT employee_id FROM payrun_employee WHERE payrun_id = ?", Long.class, payrunId);
    }
}
