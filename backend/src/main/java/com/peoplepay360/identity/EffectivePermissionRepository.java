package com.peoplepay360.identity;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public class EffectivePermissionRepository {
    private final JdbcTemplate jdbc;
    public EffectivePermissionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<String> findCodesByUserId(Long userId) {
        return jdbc.queryForList(
            "SELECT permission_code FROM v_effective_permission WHERE user_id = ?", String.class, userId);
    }
    public long countUsersWithPermission(String code) {
        Long n = jdbc.queryForObject(
            "SELECT count(DISTINCT user_id) FROM v_effective_permission v " +
            "JOIN app_user u ON u.id = v.user_id " +
            "WHERE v.permission_code = ? AND u.active = TRUE", Long.class, code);
        return n == null ? 0 : n;
    }
}
